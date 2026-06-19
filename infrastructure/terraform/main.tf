terraform {
  required_version = ">= 1.7"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    mongodbatlas = {
      source  = "mongodb/mongodbatlas"
      version = "~> 1.15"
    }
  }

  backend "s3" {
    # Configured per deployment via -backend-config flags
    # terraform init -backend-config="bucket=amx-tf-state-{dealer_group_id}" \
    #                -backend-config="key=amx/{dealer_group_id}/terraform.tfstate" \
    #                -backend-config="region=eu-west-2"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project      = "AMX"
      DealerGroup  = var.dealer_group_id
      Environment  = var.environment
      ManagedBy    = "Terraform"
    }
  }
}

provider "mongodbatlas" {
  public_key  = var.mongodb_atlas_public_key
  private_key = var.mongodb_atlas_private_key
}

# --- MongoDB Atlas cluster (operational store + MQTT payloads) ---
module "mongodb" {
  source = "./modules/mongodb"

  project_id      = var.mongodb_atlas_project_id
  dealer_group_id = var.dealer_group_id
  environment     = var.environment
  cluster_tier    = var.mongodb_cluster_tier
  aws_region      = var.aws_region
}

# --- Networking ---
module "networking" {
  source = "./modules/networking"

  dealer_group_id = var.dealer_group_id
  environment     = var.environment
  aws_region      = var.aws_region
  vpc_cidr        = var.vpc_cidr
}

# --- Application containers (ECS Fargate) ---
module "app" {
  source = "./modules/app"

  dealer_group_id   = var.dealer_group_id
  environment       = var.environment
  aws_region        = var.aws_region
  vpc_id            = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids
  public_subnet_ids  = module.networking.public_subnet_ids

  mongodb_connection_string = module.mongodb.connection_string
  secret_key                = var.secret_key
  mqtt_broker_host          = var.mqtt_broker_host
  mqtt_broker_port          = var.mqtt_broker_port
  mqtt_username             = var.mqtt_username
  mqtt_password             = var.mqtt_password
  mqtt_use_tls              = var.mqtt_use_tls
  dvla_api_key              = var.dvla_api_key

  backend_image  = var.backend_image
  frontend_image = var.frontend_image
  backend_cpu    = var.backend_cpu
  backend_memory = var.backend_memory
}
