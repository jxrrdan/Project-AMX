resource "aws_ecs_cluster" "main" {
  name = "amx-${var.dealer_group_id}-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name       = aws_ecs_cluster.main.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
  }
}

# --- Secrets in SSM Parameter Store ---
resource "aws_ssm_parameter" "secret_key" {
  name  = "/amx/${var.dealer_group_id}/SECRET_KEY"
  type  = "SecureString"
  value = var.secret_key
}

resource "aws_ssm_parameter" "mongodb_url" {
  name  = "/amx/${var.dealer_group_id}/MONGODB_URL"
  type  = "SecureString"
  value = var.mongodb_connection_string
}

resource "aws_ssm_parameter" "mqtt_password" {
  name  = "/amx/${var.dealer_group_id}/MQTT_PASSWORD"
  type  = "SecureString"
  value = var.mqtt_password
}

resource "aws_ssm_parameter" "dvla_api_key" {
  name  = "/amx/${var.dealer_group_id}/DVLA_API_KEY"
  type  = "SecureString"
  value = var.dvla_api_key
}

# --- IAM for ECS task ---
resource "aws_iam_role" "task_execution" {
  name = "amx-${var.dealer_group_id}-ecs-exec"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "task_execution" {
  role       = aws_iam_role.task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ssm_read" {
  name = "ssm-read"
  role = aws_iam_role.task_execution.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ssm:GetParameter", "ssm:GetParameters"]
      Resource = "arn:aws:ssm:${var.aws_region}:*:parameter/amx/${var.dealer_group_id}/*"
    }]
  })
}

# --- ALB ---
resource "aws_lb" "main" {
  name               = "amx-${var.dealer_group_id}"
  internal           = false
  load_balancer_type = "application"
  subnets            = var.public_subnet_ids
  security_groups    = [aws_security_group.alb.id]
}

resource "aws_security_group" "alb" {
  name   = "amx-${var.dealer_group_id}-alb"
  vpc_id = var.vpc_id
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "ecs" {
  name   = "amx-${var.dealer_group_id}-ecs"
  vpc_id = var.vpc_id
  ingress {
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_lb_target_group" "backend" {
  name        = "amx-${var.dealer_group_id}-be"
  port        = 8000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"
  health_check {
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 30
  }
}

# --- ECS Task Definition ---
resource "aws_ecs_task_definition" "backend" {
  family                   = "amx-${var.dealer_group_id}-backend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.backend_cpu
  memory                   = var.backend_memory
  execution_role_arn       = aws_iam_role.task_execution.arn

  container_definitions = jsonencode([
    {
      name  = "backend"
      image = var.backend_image
      portMappings = [{ containerPort = 8000 }]
      secrets = [
        { name = "SECRET_KEY",     valueFrom = aws_ssm_parameter.secret_key.arn },
        { name = "MONGODB_URL",    valueFrom = aws_ssm_parameter.mongodb_url.arn },
        { name = "MQTT_PASSWORD",  valueFrom = aws_ssm_parameter.mqtt_password.arn },
        { name = "DVLA_API_KEY",   valueFrom = aws_ssm_parameter.dvla_api_key.arn },
      ]
      environment = [
        { name = "DEALER_GROUP_ID",   value = var.dealer_group_id },
        { name = "MQTT_BROKER_HOST",  value = var.mqtt_broker_host },
        { name = "MQTT_BROKER_PORT",  value = tostring(var.mqtt_broker_port) },
        { name = "MQTT_USERNAME",     value = var.mqtt_username },
        { name = "MQTT_USE_TLS",      value = tostring(var.mqtt_use_tls) },
        { name = "MQTT_ENABLED",      value = "true" },
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = "/ecs/amx-${var.dealer_group_id}"
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "backend"
        }
      }
    }
  ])
}

resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/amx-${var.dealer_group_id}"
  retention_in_days = 30
}

resource "aws_ecs_service" "backend" {
  name            = "amx-${var.dealer_group_id}-backend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = 8000
  }

  depends_on = [aws_iam_role_policy_attachment.task_execution]
}

output "alb_dns_name" { value = aws_lb.main.dns_name }
