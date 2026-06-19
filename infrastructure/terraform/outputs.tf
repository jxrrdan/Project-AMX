output "alb_dns_name" {
  description = "ALB DNS — point your dealer group's DNS CNAME here"
  value       = module.app.alb_dns_name
}

output "mongodb_connection_string" {
  sensitive   = true
  description = "MongoDB Atlas connection string (also stored in SSM)"
  value       = module.mongodb.connection_string
}
