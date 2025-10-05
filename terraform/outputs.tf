output "backend_instance_public_ip" {
  value = aws_instance.backend.public_ip
}

output "backend_instance_public_dns" {
  value = aws_instance.backend.public_dns
}

output "backend_api_url" {
  value = "http://${aws_instance.backend.public_dns}:3001"
}

output "rds_endpoint" {
  value = aws_db_instance.postgres.address
}

output "database_name_value" {
  value = var.database_name
}

output "database_username_value" {
  value = var.database_username
}

output "ssh_command" {
  value = var.key_pair_name != "" ? "ssh -i ${var.key_pair_name}.pem ec2-user@${aws_instance.backend.public_dns}" : "ssh ec2-user@${aws_instance.backend.public_dns}"
}
