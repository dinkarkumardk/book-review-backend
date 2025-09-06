# Project Task Breakdown: BookVerse

## Milestone 1: Backend Setup 
- [ ] **Task 1.1:** Initialize a Node.js Express project with TypeScript.
- [ ] **Task 1.2:** Set up Prisma ORM and connect it to a local PostgreSQL database.
- [ ] **Task 1.3:** Define `User`, `Book`, and `Review` models in `schema.prisma` based on the PRD.
- [ ] **Task 1.4:** Implement user signup and login routes that return a JWT.
- [ ] **Task 1.5:** Create JWT authentication middleware to protect routes.
- [ ] **Task 1.6:** Implement CRUD endpoints for Books.
- [ ] **Task 1.7:** Implement CRUD endpoints for Reviews, ensuring users can only edit their own.
- [ ] **Task 1.8:** Implement the logic to auto-calculate a book's average rating.
- [ ] **Task 1.9:** Implement profile and recommendation endpoints.
- [ ] **Task 1.10:** Write unit tests for all API endpoints to achieve >80% coverage.

## Milestone 2: Frontend Setup 
- [ ] **Task 2.1:** Initialize a React project using Vite and TypeScript; set up Tailwind CSS.
- [ ] **Task 2.2:** Create pages for Home (Book List), Book Detail, Login, Signup, and Profile.
- [ ] **Task 2.3:** Create components for `BookCard`, `ReviewForm`, `SearchBar`, and `Navbar`.
- [ ] **Task 2.4:** Implement client-side routing using `react-router-dom`.
- [ ] **Task 2.5:** Set up a global state (React Context) for managing user authentication tokens.
- [ ] **Task 2.6:** Connect the frontend to the backend API using Axios, fetching and displaying data for all pages.

## Milestone 3: Deployment 
- [ ] **Task 3.1:** Write a simple Terraform script to create an S3 bucket and an EC2 instance with a security group.
- [ ] **Task 3.2:** Manually deploy the backend to the EC2 instance.
- [ ] **Task 3.3:** Build the React app and upload the static files to the S3 bucket.