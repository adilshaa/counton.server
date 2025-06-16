```markdown
# Secure Node.js Express Server (JWT Edition)

A Node.js server built with Express, featuring user registration and login using JWT-based stateless authentication with access and refresh tokens, and placeholder integration for PayPal subscription payments. This project aims to demonstrate fundamental security practices for modern APIs.

## Authentication Flow

This application uses a token-based authentication system:

1.  **Registration/Login**:
    *   When a user registers (`POST /auth/register`) or logs in (`POST /auth/login`), the server generates two tokens, both returned in the JSON response body:
        *   **Access Token**: A short-lived JWT. This token is used to authenticate subsequent requests to protected API endpoints. The client should store this (e.g., in memory).
        *   **Refresh Token**: A longer-lived JWT. The client should store this securely (e.g., in `localStorage` or a secure native store).
2.  **Accessing Protected Routes**:
    *   To access protected routes (e.g., `GET /profile`, `GET /api/data`), the client must include the Access Token in the `Authorization` header with the `Bearer` scheme:
        ```
        Authorization: Bearer <your_access_token>
        ```
3.  **Token Expiration & Refresh**:
    *   When an Access Token expires, the client will receive a 403 Forbidden (or 401 Unauthorized) error.
    *   The client should then make a request to the `POST /auth/refresh-token` endpoint, sending its stored Refresh Token in the JSON request body: `{ "refreshToken": "your_stored_refresh_token" }`.
    *   The server validates this refresh token against its stored record. Upon success, it issues a new Access Token and a new Refresh Token (rotation), both returned in the response body. The client updates its stored tokens.
4.  **Logout**:
    *   When a user logs out (`POST /auth/logout`), the client should discard its stored Access and Refresh Tokens.
    *   The client should also send the Refresh Token in the request body to the server. The server then invalidates this specific Refresh Token in its database, preventing its further use.

## Features

- User registration with password hashing (bcrypt)
- JWT-based stateless authentication with access and refresh tokens (tokens returned in response body)
- Refresh token rotation and server-side validation against stored user record
- Protected routes using JWT authentication middleware
- Logout functionality (client clears tokens, server invalidates provided refresh token)
- Basic security headers with `helmet`
- Rate limiting with `express-rate-limit`
- Data persistence with MongoDB using Mongoose ODM
- User activity tracking (last login date, active status)
- PayPal integration for subscription payments (order creation & capture)
- Placeholder for subscription management (monthly plan, status tracking)
- CORS (Cross-Origin Resource Sharing) configured for specific frontend URL (and `127.0.0.1` variant for localhost) with credentials support (though cookies are no longer the primary auth mechanism, `credentials:true` might be kept for other potential uses or future cookie needs if any).
- Centralized application configuration (`config/appConfig.js`)
- Utility functions for token generation and verification (`utils/tokenUtils.js`)
- PayPal SDK client setup (`utils/paypalClient.js`)

## Getting Started

### Prerequisites

- Node.js and npm installed
- MongoDB instance (local or cloud-hosted like MongoDB Atlas)
- PayPal Developer Account and Sandbox credentials (Client ID, Secret) for testing payments.

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
# The REFRESH_TOKEN_COOKIE_MAX_AGE in appConfig.js (default 7 days) is used for DB expiry of refresh token.

# Server Port (Optional - defaults to 3000 if not set)
PORT=3000

# Server Base URL (Optional - defaults to http://localhost:PORT)
SERVER_BASE_URL=http://localhost:3000

# Frontend URL (Optional - defaults to http://localhost:5173)
# Crucial for CORS and PayPal redirect URLs.
FRONTEND_URL=http://localhost:5173

# Node Environment (Optional - defaults to 'development')
# Set to 'production' for production builds.
NODE_ENV=development

# PayPal Credentials and Environment
# Obtain these from your PayPal Developer Dashboard.
PAYPAL_CLIENT_ID=YOUR_PAYPAL_SANDBOX_CLIENT_ID_HERE
PAYPAL_CLIENT_SECRET=YOUR_PAYPAL_SANDBOX_SECRET_HERE
PAYPAL_ENVIRONMENT=sandbox # or 'live' for production
```

-   **`MONGODB_URI`**: Your MongoDB connection string.
-   **`ACCESS_TOKEN_SECRET`**: **Critical for security.** Used to sign access tokens.
-   **`REFRESH_TOKEN_SECRET`**: **Critical for security.** Used to sign refresh tokens.
-   **`ACCESS_TOKEN_EXPIRATION`**: How long access tokens are valid (e.g., `15m`, `1h`, `1d`).
-   **`REFRESH_TOKEN_EXPIRATION`**: How long refresh tokens are valid (this defines the JWT's "exp" claim). The server also stores an expiry for the refresh token in the database (based on `REFRESH_TOKEN_COOKIE_MAX_AGE` in `appConfig.js`, default 7 days), which should ideally align with this JWT expiration.
-   **`PORT`**: The port the server will listen on.
-   **`SERVER_BASE_URL`**: The canonical base URL for this server.
-   **`FRONTEND_URL`**: The base URL for your frontend application. This URL is primary in the server's CORS `allowedOrigins` list. For `localhost`-based `FRONTEND_URL`s, the `127.0.0.1` equivalent is also typically allowed by the server configuration. It's also used for PayPal redirect URLs.
-   **`NODE_ENV`**: The application environment (`development` or `production`).
-   **`PAYPAL_CLIENT_ID`**: Your PayPal application's Client ID. **Required for payments.**
-   **`PAYPAL_CLIENT_SECRET`**: Your PayPal application's Client Secret. **Required for payments.**
-   **`PAYPAL_ENVIRONMENT`**: Set to `sandbox` for testing or `live` for production payments.

*Note: The `.env` file is included in `.gitignore`. For production, use your hosting platform's environment variable configuration.*

## API Endpoints

### Authentication (`/auth`)

-   **`POST /auth/register`**: Register a new user.
    *   **Body**: `{ "username": "user", "password": "password" }`
    *   **Response (201 OK)**:
        ```json
        {
          "message": "User registered successfully.",
          "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
          "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
          "user": {
            "id": "507f191e810c19729de860ea",
            "username": "newuser",
            "isActive": true,
            "lastLoginAt": "2023-10-27T10:00:00.000Z",
            "subscriptionStatus": "none",
            "subscriptionPlan": "none"
          }
        }
        ```
-   **`POST /auth/login`**: Log in an existing user.
    *   **Body**: `{ "username": "user", "password": "password" }`
    *   **Response (200 OK)**:
        ```json
        {
          "message": "Login successful.",
          "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
          "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
          "user": {
            "id": "507f191e810c19729de860ea",
            "username": "testuser",
            "isActive": true,
            "lastLoginAt": "2023-10-27T10:00:00.000Z",
            "subscriptionStatus": "none",
            "subscriptionPlan": "none"
          }
        }
        ```
-   **`POST /auth/refresh-token`**: Obtain a new access token using a valid refresh token.
    *   **Request Body**: `{ "refreshToken": "your_stored_refresh_token" }`
    *   **Response (200 OK)**:
        ```json
        {
          "message": "Access token refreshed successfully.",
          "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
          "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." // New rotated refresh token
        }
        ```
-   **`POST /auth/logout`**: Log out the current user.
    *   **Request Body (Optional but Recommended)**: `{ "refreshToken": "your_stored_refresh_token_to_invalidate" }`
    *   **Response (200 OK)**: `{ message }`. Server attempts to invalidate the provided refresh token in the database. Client should always discard its stored tokens.

### User Profile & Data (`/` and `/api`)
(This section remains largely the same, emphasizing Authorization header)
...

### Subscription API (`/api/subscriptions`)
(This section remains largely the same, emphasizing Authorization header)
...

## Payment Flow Overview (PayPal)
(This section remains as previously defined)
...

## Data Models
(This section remains as previously defined)
...

## Frontend Client Requirements

When making requests to this backend:
-   **Authentication**: Include the `accessToken` in the `Authorization` header with the `Bearer` scheme for all protected endpoints.
    ```
    Authorization: Bearer <your_access_token>
    ```
-   **Token Storage**: The client is responsible for securely storing the `accessToken` (typically in memory) and `refreshToken` (e.g., in `localStorage` or a secure native store). Be mindful of XSS risks if using `localStorage` (see Security Considerations).
-   **Token Refresh**: When an `accessToken` expires (indicated by a 401/403 response from a protected endpoint), the client should send its stored `refreshToken` in the body of a `POST` request to `/auth/refresh-token` to obtain new tokens.
-   **CORS**: If your frontend and backend are on different origins, ensure your frontend HTTP client is configured to handle cross-origin requests correctly. The backend's CORS policy is set via `FRONTEND_URL` and allows credentials (though cookies are no longer the primary mechanism for auth tokens, `credentials: true` in CORS might be relevant if other cookies are ever used or for specific future needs).

## Security Considerations

This server implements several security features, but security is an ongoing process.

### 1. Token Security (JWT)
-   **Secrets**: `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET` must be strong, random, and kept confidential. Use environment variables.
-   **Expiration**: Access tokens have short expirations. Refresh tokens have longer expirations.
-   **Storing Tokens on the Client-Side**:
    *   **Access Tokens**: Typically stored in JavaScript memory for the duration of a user session/tab.
    *   **Refresh Tokens**: Now returned in the response body, the client is responsible for their storage (e.g., `localStorage`).
    *   **XSS Warning**: Storing tokens, especially refresh tokens, in `localStorage` makes them vulnerable to theft if an XSS (Cross-Site Scripting) vulnerability exists on your frontend application. Attackers could potentially steal these tokens and impersonate users.
        *   **Mitigation**: Implement strong XSS prevention measures: sanitize all user inputs, use appropriate output encoding, and implement a robust Content Security Policy (CSP).
        *   **Alternative (Previously Used)**: HttpOnly cookies (which were removed in this version) offer better protection against XSS for refresh tokens as they are not accessible to JavaScript. This change to client-side storage for refresh tokens introduces a trade-off: simpler for some SPA architectures, but requires heightened XSS vigilance.
-   **Refresh Token Rotation & Server-Side Validation**: Refresh tokens are validated against a server-side database record. This record is updated upon rotation and cleared upon logout (if the token is provided), helping to detect and prevent reuse of compromised or old tokens.
-   **HTTPS**: Always use HTTPS in production to protect tokens in transit.

### 2. Data Injection (NoSQL Injection)
-   *(This application now uses MongoDB with Mongoose as an ODM...)*

### 3. Cross-Site Scripting (XSS)
-   **Prevention**: (This section remains crucial, especially with client-side token storage) Output encoding, Content Security Policy (CSP), input validation. `helmet` provides some default protections.

### 4. Cross-Site Request Forgery (CSRF)
-   **Context**: With tokens primarily sent in Authorization headers (access tokens) or request bodies (refresh tokens), traditional CSRF attacks that rely on browser auto-sending cookies with requests are less of a direct threat to these token-based authentications.
-   **Considerations**: If any part of your API were to rely on cookie-based sessions for authentication (not the case for JWTs here), CSRF would be a major concern. The `credentials: true` in CORS is kept for potential other uses but doesn't make the JWT flow vulnerable to CSRF if tokens are handled as described.

### 5. Password Policies & Storage
-   *(This section remains largely the same.)*

### 6. Dependency Management
-   *(This section remains largely the same.)*

### 7. Security Headers
-   *(This section remains largely the same.)*

### 8. Rate Limiting
-   *(This section remains largely the same.)*

### 9. Token Management
-   The security of tokens is paramount. Refer to the "Token Security (JWT)" section for details.

### 10. Error Handling
-   *(This section remains largely the same.)*

### 11. Input Validation
-   *(This section remains largely the same.)*

This list is not exhaustive. Always stay updated on current security best practices.
```
