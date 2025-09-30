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
