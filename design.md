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
Auth suffix denotes endpoints requiring Bearer token.



### Operational Endpoints

Liveness (no DB):
- `GET /health`
- `GET /api/health`

Readiness (DB connectivity check):
- `GET /ready`
- `GET /api/ready`

Readiness returns 200 with `db: ok` if a lightweight `SELECT NOW()` succeeds, otherwise 503 with error details. Use liveness for container/PM2 restarts and readiness for deploy verification.
### Recommendation Strategy
1. Hybrid (default):
	- If user has favorites: aggregate top 3 genres → fetch best books in those genres ordered by rating & review count.
	- Fallback: global top-rated list.
2. Top Rated: global rating + review count ordering.
3. LLM (stub): currently mirrors top-rated selection; will integrate OpenAI later.

### Favorites
Many-to-many via `Favorite` join model with unique(userId, bookId). Toggle endpoint adds or removes record then returns status message.

### User Reviews Listing
Returns array of reviews with `{ id, rating, text, createdAt, book: { id, title, author } }` ordered newest first.

## 4. Non-Functional Requirements
- **Security:** Passwords will be hashed with `bcrypt`. Basic input validation will be in place.
- **Testability:** Backend unit test coverage must exceed 80%.