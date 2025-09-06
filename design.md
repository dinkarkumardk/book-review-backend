# Design Document: BookVerse

## 1. Architecture: Fast-Track Assignment Model
For rapid development and deployment, we will use a simple, classic architecture:
- **Frontend:** A React Single Page Application (SPA) hosted on **AWS S3**.
- **Backend:** A Node.js/Express REST API running on a single **AWS EC2 instance**.
- **Database:** A PostgreSQL database running on the **same EC2 instance** to minimize complexity for this assignment.

## 2. Tech Stack
- **Frontend:** React (with Vite), Tailwind CSS, Axios
- **Backend:** Node.js, Express.js, TypeScript
- **Database:** PostgreSQL (with Prisma ORM)
- **Authentication:** JSON Web Tokens (JWT)
- **Testing:** Jest & Supertest for backend unit tests.
- **Deployment:** Manual deployment to EC2/S3, with simple Terraform scripts for infrastructure setup.

## 3. API Endpoints
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/books?page=1&search=query`
- `GET /api/books/:id`
- `POST /api/books/:id/reviews` (Auth Required)
- `PUT /api/reviews/:id` (Auth Required, Owner Only)
- `DELETE /api/reviews/:id` (Auth Required, Owner Only)
- `GET /api/profile` (Auth Required)
- `POST /api/profile/favorites` (Auth Required)
- `GET /api/recommendations` (Auth Required)

## 4. Non-Functional Requirements
- **Security:** Passwords will be hashed with `bcrypt`. Basic input validation will be in place.
- **Testability:** Backend unit test coverage must exceed 80%.