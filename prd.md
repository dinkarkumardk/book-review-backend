# Product Requirements Document: BookVerse

## 1. Goal
[cite_start]To develop a minimal yet functional book review platform allowing users to find, rate, and review books, and receive basic recommendations[cite: 2].

## 2. Functional Requirements

### 2.1. [cite_start]User Authentication [cite: 4]
- [cite_start]**FR-1:** Users must be able to sign up, log in, and log out using an email and password[cite: 5].
- [cite_start]**FR-2:** The system will use JWT for token-based authentication[cite: 6].

### 2.2. [cite_start]Books Listing & Search [cite: 9]
- [cite_start]**FR-3:** Users can view a paginated list of all books[cite: 11].
- [cite_start]**FR-4:** Users can search for books by title or author[cite: 12].

### 2.3. [cite_start]Reviews & Ratings [cite: 14]
- [cite_start]**FR-5:** Authenticated users can create, read, update, and delete their own reviews[cite: 16].
- [cite_start]**FR-6:** Users can rate a book on a 1-5 integer scale[cite: 17].

### 2.4. [cite_start]Average Rating Calculation [cite: 19]
- [cite_start]**FR-7:** Each book must display its average rating, rounded to one decimal place, and the total number of reviews[cite: 22, 23].
- [cite_start]**FR-8:** This calculation must be updated automatically when a review is added, edited, or deleted[cite: 24].

### 2.5. [cite_start]User Profile [cite: 25]
- [cite_start]**FR-9:** A user's profile must show a list of all reviews they have written[cite: 28].
- [cite_start]**FR-10:** Users must be able to mark/unmark books as favorites, and these should appear on their profile[cite: 29].

### 2.6. [cite_start]Recommendations [cite: 30]
- [cite_start]**FR-11:** For the MVP, provide a list of top-rated books as a default recommendation[cite: 32].
- [cite_start]**FR-12:** Use an LLM API (like OpenAI) to provide recommendations based on a user's favorite genres[cite: 33, 34].

## 3. Data Models
- [cite_start]**User:** `userId`, `name`, `email`, `hashedPassword`[cite: 8].
- [cite_start]**Book:** `bookId`, `title`, `author`, `description`, `coverImageURL`, `genres` (array), `publishedYear`[cite: 13].
- [cite_start]**Review:** `reviewId`, `bookId`, `userId`, `rating` (1-5), `text`, `timestamp`[cite: 18].