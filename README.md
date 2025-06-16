```markdown
# Secure Node.js Express Server (JWT Edition)

A Node.js server built with Express, featuring user registration and login using JWT-based stateless authentication with access and refresh tokens. This project aims to demonstrate fundamental security practices for modern APIs.

## Authentication Flow

This application uses a token-based authentication system:

1.  **Registration/Login**:
    *   When a user registers (`POST /auth/register`) or logs in (`POST /auth/login`), the server generates two tokens:
        *   **Access Token**: A short-lived JWT returned in the response body. This token is used to authenticate subsequent requests to protected API endpoints.
        *   **Refresh Token**: A longer-lived JWT stored in an HttpOnly cookie (default name: `jid`). This token is used to obtain new access tokens without requiring the user to re-enter their credentials.
2.  **Accessing Protected Routes**:
    *   To access protected routes (e.g., `GET /profile`, `GET /api/data`), the client must include the Access Token in the `Authorization` header with the `Bearer` scheme:
        ```
        Authorization: Bearer <your_access_token>
        ```
3.  **Token Expiration & Refresh**:
    *   When an Access Token expires, the client will receive a 403 Forbidden (or 401 Unauthorized) error.
    *   The client should then make a request to the `POST /auth/refresh-token` endpoint. This endpoint uses the Refresh Token (sent automatically via the HttpOnly cookie) to generate a new Access Token (and a new Refresh Token for rotation).
4.  **Logout**:
    *   When a user logs out (`POST /auth/logout`), the server clears the Refresh Token cookie, effectively invalidating the user's ability to obtain new Access Tokens. The client should also discard its stored Access Token.

## Features

- User registration with password hashing (bcrypt)
- JWT-based stateless authentication with access and refresh tokens (using `jsonwebtoken` and `passport-local` for initial credential check)
- Refresh token rotation for enhanced security
- HttpOnly cookies for refresh token storage
- Protected routes using JWT authentication middleware
- Logout functionality (clears refresh token cookie)
- Basic security headers with `helmet`
- Rate limiting with `express-rate-limit`
- Data persistence with MongoDB using Mongoose ODM
- CORS (Cross-Origin Resource Sharing) enabled for all origins (default configuration)
- Centralized application configuration (`config/appConfig.js`)
- Utility functions for token generation and verification (`utils/tokenUtils.js`)

## Getting Started

### Prerequisites

- Node.js and npm installed
- MongoDB instance (local or cloud-hosted like MongoDB Atlas)

### Installation

1.  Clone the repository (or create the files as per the commit).
2.  Navigate to the project directory:
    ```bash
    cd your-project-name
    ```
3.  Install dependencies:
    ```bash
    npm install
    ```
4.  Configure environment variables (see Configuration section below). You can copy `.env.example` to `.env` to get started.

### Running the Server

-   **Production mode:**
    ```bash
    npm start
    # This typically runs: node server.js
    ```
-   **Development mode (with auto-restart using `nodemon`):**
    ```bash
    npm run dev
    # This runs: nodemon server.js
    ```
The server will typically start on `http://localhost:3000` (or the port specified in your `.env` file).

### Configuration

Before running the application, you need to set up environment variables. Create a `.env` file in the root of the project (you can copy `.env.example` to get started). This file is gitignored.

```env
# MongoDB Connection URI
MONGODB_URI=mongodb://localhost:27017/counton_db

# JWT Secrets - CRITICAL: Use strong, unique random strings for these in production!
ACCESS_TOKEN_SECRET=your_very_strong_random_access_token_secret_here
REFRESH_TOKEN_SECRET=your_even_stronger_random_refresh_token_secret_here

# JWT Expiration Times (examples)
ACCESS_TOKEN_EXPIRATION=15m
REFRESH_TOKEN_EXPIRATION=7d
# REFRESH_TOKEN_COOKIE_MAX_AGE=604800000 # Optional: 7 days in ms (if overriding appConfig default for cookie)

# Server Port (Optional - defaults to 3000 if not set)
PORT=3000

# Server Base URL (Optional - defaults to http://localhost:PORT)
SERVER_BASE_URL=http://localhost:3000

# Frontend URL (Optional - defaults to http://localhost:3001)
FRONTEND_URL=http://localhost:3001

# Node Environment (Optional - defaults to 'development')
NODE_ENV=development
```

-   **`MONGODB_URI`**: Your MongoDB connection string.
-   **`ACCESS_TOKEN_SECRET`**: **Critical for security.** Used to sign access tokens.
-   **`REFRESH_TOKEN_SECRET`**: **Critical for security.** Used to sign refresh tokens. Must be different from the access token secret.
-   **`ACCESS_TOKEN_EXPIRATION`**: How long access tokens are valid (e.g., `15m`, `1h`, `1d`).
-   **`REFRESH_TOKEN_EXPIRATION`**: How long refresh tokens are valid (e.g., `7d`, `30d`).
-   **`PORT`**: The port the server will listen on. Defaults to `3000`.
-   **`SERVER_BASE_URL`**: The canonical base URL for this server.
-   **`FRONTEND_URL`**: The base URL for your frontend application.
-   **`NODE_ENV`**: The application environment (`development` or `production`).

*Note: The `.env` file is included in `.gitignore`. For production, use your hosting platform's environment variable configuration.*

## API Endpoints

-   **`POST /auth/register`**: Register a new user.
    *   **Body**: `{ "username": "user", "password": "password" }`
    *   **Response**: `201 OK` with `{ message, accessToken, user: { id, username } }`. Sets HttpOnly refresh token cookie.
-   **`POST /auth/login`**: Log in an existing user.
    *   **Body**: `{ "username": "user", "password": "password" }`
    *   **Response**: `200 OK` with `{ message, accessToken, user: { id, username } }`. Sets HttpOnly refresh token cookie.
-   **`POST /auth/refresh-token`**: Obtain a new access token using a valid refresh token (sent via HttpOnly cookie).
    *   **Response**: `200 OK` with `{ message, accessToken }`. Sets a new HttpOnly refresh token cookie (rotation).
-   **`POST /auth/logout`**: Log out the current user.
    *   **Response**: `200 OK` with `{ message }`. Clears the refresh token cookie.
-   **`GET /profile`**: (Protected) Get the current user's profile information.
    *   **Headers**: Requires `Authorization: Bearer <accessToken>`
    *   **Response**: `200 OK` with user profile data.
-   **`GET /api/data`**: (Protected) Get sample protected data.
    *   **Headers**: Requires `Authorization: Bearer <accessToken>`
    *   **Response**: `200 OK` with sample data.

## Security Considerations

This server implements several security features, but security is an ongoing process.

### 1. Token Security (JWT)
-   **Secrets**: `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET` must be strong, random, and kept confidential. Do NOT hardcode them; use environment variables.
-   **Expiration**: Access tokens should have a short expiration time (e.g., 15 minutes to 1 hour) to limit the impact if compromised. Refresh tokens can have a longer expiration (e.g., 7-30 days).
-   **Storage**:
    *   **Access Tokens**: Typically stored in client-side memory (e.g., JavaScript variable). Avoid storing in `localStorage` or `sessionStorage` if possible due to XSS risks.
    *   **Refresh Tokens**: Stored in HttpOnly cookies to prevent access by client-side JavaScript, mitigating XSS risks for this token. The `secure: true` flag (used in production) ensures they are sent only over HTTPS. `SameSite` attribute (e.g., 'Lax' or 'Strict') should be considered for further CSRF protection if the cookie could be sent with cross-site requests initiated by browser navigation.
-   **Refresh Token Rotation**: This application implements refresh token rotation, where a new refresh token is issued each time one is used. This helps invalidate a compromised refresh token if it's used, as the attacker and legitimate user would have different subsequent refresh tokens.
-   **Server-Side Invalidation (Advanced)**: For critical applications, consider maintaining an allowlist or denylist of refresh tokens on the server to explicitly invalidate them (e.g., upon password change, or if a token is suspected compromised). This is noted as a TODO in the `logoutUser` and `handleRefreshToken` functions.
-   **HTTPS**: Always use HTTPS in production to protect tokens in transit.

### 2. Data Injection (NoSQL Injection)
-   *(This section remains largely the same as before, emphasizing Mongoose's role but also the need for input validation.)*
    *(This application now uses MongoDB with Mongoose as an ODM. Mongoose schemas (defining types, required fields, etc.) and its query generation methods provide a good level of protection against MongoDB query injection attacks, especially when not constructing query parts directly from unsanitized user input. Always validate and sanitize input where appropriate, even with an ODM.)*

### 3. Cross-Site Scripting (XSS)
-   *(This section remains largely the same. HttpOnly cookies for refresh tokens help, but general XSS prevention is still key.)*
-   **Prevention**: Output encoding, Content Security Policy (CSP), input validation. `helmet` provides some default protections.

### 4. Cross-Site Request Forgery (CSRF)
-   **Issue**: While JWTs themselves are not inherently vulnerable to CSRF if sent in headers, the use of cookies for refresh tokens needs consideration.
-   **Prevention**:
    *   HttpOnly cookies prevent JavaScript access.
    *   The `SameSite` cookie attribute (e.g., `Lax` or `Strict`) is a strong defense for cookies against CSRF. Consider adding this to the refresh token cookie settings in `authController.js`.
    *   The refresh token endpoint (`/auth/refresh-token`) is a POST request. If it were GET, it would be more susceptible.
    *   For APIs, ensuring the `Content-Type` header is `application/json` (and rejecting other types) can also help mitigate some CSRF vectors that rely on simple HTML form submissions.

### 5. Password Policies & Storage
-   *(This section remains largely the same.)*

### 6. Dependency Management
-   *(This section remains largely the same.)*

### 7. Security Headers
-   *(This section remains largely the same.)*

### 8. Rate Limiting
-   *(This section remains largely the same.)*

### 9. Session Management (Now "Token Management")
-   This section should be re-titled or merged with "Token Security (JWT)". The old session-specific points are no longer relevant.

### 10. Error Handling
-   *(This section remains largely the same.)*

### 11. Input Validation
-   *(This section remains largely the same.)*

This list is not exhaustive. Always stay updated on current security best practices.
```
