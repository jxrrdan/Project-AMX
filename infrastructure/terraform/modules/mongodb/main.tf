resource "mongodbatlas_cluster" "amx" {
  project_id = var.project_id
  name       = "amx-${var.dealer_group_id}-${var.environment}"

  cluster_type = "REPLICASET"

  provider_name               = "AWS"
  provider_region_name        = replace(upper(var.aws_region), "-", "_")
  provider_instance_size_name = var.cluster_tier

  mongo_db_major_version = "7.0"
  auto_scaling_disk_gb_enabled = true

  replication_specs {
    num_shards = 1
    regions_config {
      region_name     = replace(upper(var.aws_region), "-", "_")
      electable_nodes = 3
      priority        = 7
      read_only_nodes = 0
    }
  }

  # Backup
  cloud_backup = var.environment == "prod"

  labels {
    key   = "DealerGroup"
    value = var.dealer_group_id
  }
}

resource "mongodbatlas_database_user" "app" {
  username           = "amx-${var.dealer_group_id}"
  password           = random_password.db_password.result
  project_id         = var.project_id
  auth_database_name = "admin"

  roles {
    role_name     = "readWrite"
    database_name = "amx"
  }
}

resource "random_password" "db_password" {
  length  = 32
  special = false
}

output "connection_string" {
  sensitive = true
  value = replace(
    mongodbatlas_cluster.amx.connection_strings[0].standard_srv,
    "mongodb+srv://",
    "mongodb+srv://${mongodbatlas_database_user.app.username}:${random_password.db_password.result}@"
  )
}
