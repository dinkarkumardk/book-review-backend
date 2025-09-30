Backend Infrastructure (Terraform)
=================================

This stack provisions the backend application infrastructure for BookVerse:

* VPC (public subnets for EC2, private subnets for RDS)
* Security Groups (EC2, RDS)
* EC2 instance (Node.js backend)
* Elastic IP (stable public endpoint)
* RDS PostgreSQL instance
* S3 bucket for backend assets (e.g. cover images)
* IAM roles & instance profile

Frontend hosting (S3 + CloudFront) has been moved to the frontend repository stack.

Variables:
* aws_region (default us-east-1)
* environment (dev/staging/prod)
* project_name (default bookverse)
* instance_type (default t3.micro)
* key_pair_name (SSH key name)
* allowed_cidr_blocks (for SSH/API ingress)
* database_name (default bookverse)
* database_username (default bookverse_admin)
* database_password (required)
* jwt_secret (required)

Outputs:
* backend_instance_public_ip
* backend_instance_public_dns
* backend_api_url
* rds_endpoint

Usage:
```bash
terraform init
terraform apply -var="database_password=***" -var="jwt_secret=***" -var="key_pair_name=bookverse-key"
```

After provisioning, deploy application via CI/CD or manually SSH + pm2.
