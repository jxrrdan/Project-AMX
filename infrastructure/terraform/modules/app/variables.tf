variable "dealer_group_id"          { type = string }
variable "environment"              { type = string }
variable "aws_region"               { type = string }
variable "vpc_id"                   { type = string }
variable "private_subnet_ids"       { type = list(string) }
variable "public_subnet_ids"        { type = list(string) }
variable "mongodb_connection_string" { type = string; sensitive = true }
variable "secret_key"               { type = string; sensitive = true }
variable "mqtt_broker_host"         { type = string }
variable "mqtt_broker_port"         { type = number; default = 8883 }
variable "mqtt_username"            { type = string; default = "" }
variable "mqtt_password"            { type = string; sensitive = true; default = "" }
variable "mqtt_use_tls"             { type = bool; default = true }
variable "dvla_api_key"             { type = string; sensitive = true; default = "" }
variable "backend_image"            { type = string }
variable "frontend_image"           { type = string }
variable "backend_cpu"              { type = number; default = 512 }
variable "backend_memory"           { type = number; default = 1024 }
