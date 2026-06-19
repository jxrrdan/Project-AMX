variable "dealer_group_id" {
  description = "Unique identifier for the dealer group — used in resource names and MQTT topics"
  type        = string
}

variable "environment" {
  description = "Deployment environment: prod | staging | dev"
  type        = string
  default     = "prod"
}

variable "aws_region" {
  description = "AWS region for this deployment"
  type        = string
  default     = "eu-west-2"
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

# MongoDB Atlas
variable "mongodb_atlas_public_key" {
  type      = string
  sensitive = true
}

variable "mongodb_atlas_private_key" {
  type      = string
  sensitive = true
}

variable "mongodb_atlas_project_id" {
  type = string
}

variable "mongodb_cluster_tier" {
  description = "Atlas cluster tier — M0 is free, M10+ for production"
  type        = string
  default     = "M10"
}

# Application
variable "backend_image" {
  description = "Docker image URI for the backend (ECR or Docker Hub)"
  type        = string
}

variable "frontend_image" {
  description = "Docker image URI for the frontend (ECR or Docker Hub)"
  type        = string
}

variable "backend_cpu" {
  type    = number
  default = 512
}

variable "backend_memory" {
  type    = number
  default = 1024
}

# Secrets
variable "secret_key" {
  type      = string
  sensitive = true
}

# MQTT
variable "mqtt_broker_host" {
  type = string
}

variable "mqtt_broker_port" {
  type    = number
  default = 8883
}

variable "mqtt_username" {
  type      = string
  sensitive = true
  default   = ""
}

variable "mqtt_password" {
  type      = string
  sensitive = true
  default   = ""
}

variable "mqtt_use_tls" {
  type    = bool
  default = true
}

# DVLA
variable "dvla_api_key" {
  type      = string
  sensitive = true
  default   = ""
}
