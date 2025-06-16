```markdown
# Secure Node.js Express Server (JWT Edition)

A Node.js server built with Express, featuring user registration and login using JWT-based stateless authentication with access and refresh tokens, and placeholder integration for PayPal subscription payments. This project aims to demonstrate fundamental security practices for modern APIs.

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
- HttpOnly cookies for refresh token storage (with `SameSite=None` and `secure=true` for cross-origin scenarios)
- Protected routes using JWT authentication middleware
- Logout functionality (clears refresh token cookie and server-side record)
- Basic security headers with `helmet`
- Rate limiting with `express-rate-limit`
- Data persistence with MongoDB using Mongoose ODM
- User activity tracking (last login date, active status)
- PayPal integration for subscription payments (order creation & capture)
- Placeholder for subscription management (monthly plan, status tracking)
- CORS (Cross-Origin Resource Sharing) configured for specific frontend URL with credentials support
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
# REFRESH_TOKEN_COOKIE_MAX_AGE=604800000 # Optional: 7 days in ms (if overriding appConfig default for cookie)

# Server Port (Optional - defaults to 3000 if not set)
PORT=3000

# Server Base URL (Optional - defaults to http://localhost:PORT)
SERVER_BASE_URL=http://localhost:3000

# Frontend URL (Optional - defaults to http://localhost:5173)
# Crucial for CORS and PayPal redirect URLs.
FRONTEND_URL=http://localhost:5173

# Node Environment (Optional - defaults to 'development')
# Set to 'production' in your production environment.
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
-   **`ACCESS_TOKEN_EXPIRATION`**: How long access tokens are valid.
-   **`REFRESH_TOKEN_EXPIRATION`**: How long refresh tokens are valid.
-   **`PORT`**: The port the server will listen on.
-   **`SERVER_BASE_URL`**: The canonical base URL for this server.
-   **`FRONTEND_URL`**: The base URL for your frontend application. This is critical for enabling Cross-Origin Resource Sharing (CORS) correctly, especially when frontend and backend run on different ports during development (e.g., `http://localhost:5173` for frontend, `http://localhost:3000` for backend). The server's CORS policy is configured to only allow requests from this URL when credentials (like cookies) are involved. It's also used for PayPal redirect URLs.
-   **`NODE_ENV`**: The application environment (`development` or `production`).
-   **`PAYPAL_CLIENT_ID`**: Your PayPal application's Client ID. **Required for payments.**
-   **`PAYPAL_CLIENT_SECRET`**: Your PayPal application's Client Secret. **Required for payments.**
-   **`PAYPAL_ENVIRONMENT`**: Set to `sandbox` for testing or `live` for production payments.

*Note: The `.env` file is included in `.gitignore`. For production, use your hosting platform's environment variable configuration.*

## API Endpoints
(Details as before, with updated response examples for /auth/register and /auth/login to include new user fields)
### Authentication (`/auth`)

-   **`POST /auth/register`**: Register a new user.
    *   **Body**: `{ "username": "user", "password": "password" }`
    *   **Response (201 OK)**: Sets HttpOnly refresh token cookie.
        ```json
        {
          "message": "User registered successfully.",
          "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
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
    *   **Response (200 OK)**: Sets HttpOnly refresh token cookie.
        ```json
        {
          "message": "Login successful.",
          "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
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
    *   **Response (200 OK)**: Sets a new HttpOnly refresh token cookie.
        ```json
        {
          "message": "Access token refreshed successfully.",
          "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
        }
        ```
-   **`POST /auth/logout`**: Log out the current user.
    *   **Response (200 OK)**: `{ message }`. Clears the refresh token cookie.

### User Profile & Data (`/` and `/api`)

-   **`GET /profile`**: (Protected) Get the current user's profile information.
    *   **Headers**: Requires `Authorization: Bearer <accessToken>`
    *   **Response (200 OK)**: User profile data.
-   **`GET /api/data`**: (Protected) Get sample protected data.
    *   **Headers**: Requires `Authorization: Bearer <accessToken>`
    *   **Response (200 OK)**: Sample data.

### Subscription API (`/api/subscriptions`)

All subscription endpoints require JWT authentication (Bearer token).

*   **`POST /api/subscriptions/create-order`**
    *   **Description**: Creates a subscription order with PayPal and returns an `orderID`.
    *   **Access**: Private (JWT Authenticated)
    *   **Response (201 Created)**:
        ```json
        {
          "message": "PayPal order created successfully.",
          "orderID": "PAYPAL_GENERATED_ORDER_ID"
        }
        ```

*   **`POST /api/subscriptions/capture-payment`**
    *   **Description**: Captures the payment for a previously created PayPal order (after client-side payer approval) and activates the user's subscription.
    *   **Access**: Private (JWT Authenticated)
    *   **Request Body**:
        ```json
        {
          "orderID": "PAYPAL_GENERATED_ORDER_ID_FROM_CREATE_ORDER_STEP"
        }
        ```
    *   **Response (200 OK)**:
        ```json
        {
          "message": "Payment captured and subscription activated successfully.",
          "subscription": {
            "plan": "monthly_standard_10_usd",
            "status": "active",
            "subscribedAt": "2023-10-27T10:05:00.000Z",
            "expiresAt": "2023-11-26T10:05:00.000Z",
            "lastPaymentAmount": 10.00,
            "paymentTransactionId": "PAYPAL_CAPTURE_TRANSACTION_ID"
          }
        }
        ```

*   **`GET /api/subscriptions/status`**
    *   **Description**: Retrieves the current authenticated user's subscription status and details.
    *   **Access**: Private (JWT Authenticated)
    *   **Response (200 OK)**:
        ```json
        {
          "plan": "monthly_standard_10_usd",
          "status": "active",
          "subscribedAt": "2023-10-27T10:05:00.000Z",
          "expiresAt": "2023-11-26T10:05:00.000Z",
          "lastPaymentAmount": 10.00,
          "lastPaymentDate": "2023-10-27T10:05:00.000Z",
          "paymentTransactionId": "PAYPAL_CAPTURE_TRANSACTION_ID"
        }
        ```

## Payment Flow Overview (PayPal)
(This section remains as previously defined)
...

## Data Models
(This section remains as previously defined)
...

## Frontend Client Requirements

When making requests to this backend, especially to endpoints that rely on cookies (like `/auth/refresh-token`) or protected endpoints after login:

-   Your frontend HTTP client (e.g., Fetch API, Axios) **must** be configured to include credentials with requests.
    -   For **Fetch API**: `fetch(url, { credentials: 'include', ... });`
    -   For **Axios**: `axios.get(url, { withCredentials: true, ... });`
-   This is essential for the browser to send the HttpOnly refresh token cookie to the backend, particularly in cross-origin scenarios.

## Security Considerations

This server implements several security features, but security is an ongoing process.

### 1. Token Security (JWT)
-   **Secrets**: `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET` must be strong, random, and kept confidential. Do NOT hardcode them; use environment variables.
-   **Expiration**: Access tokens should have a short expiration time (e.g., 15 minutes to 1 hour) to limit the impact if compromised. Refresh tokens can have a longer expiration (e.g., 7-30 days).
-   **Storage**:
    *   **Access Tokens**: Typically stored in client-side memory (e.g., JavaScript variable). Avoid storing in `localStorage` or `sessionStorage` if possible due to XSS risks.
    *   **Refresh Tokens**: Stored in HttpOnly cookies to prevent access by client-side JavaScript, mitigating XSS risks for this token.
-   **Refresh Token Rotation & Server-Side Validation**: This application implements refresh token rotation (a new refresh token is issued upon use). Crucially, refresh tokens are also validated against a record stored with the user in the database. This stored record is updated with the new refresh token during rotation and cleared upon logout. This strategy helps detect and prevent the reuse of compromised or old refresh tokens, as only the current, server-acknowledged refresh token is valid.
-   **HTTPS**: Always use HTTPS in production to protect tokens in transit.

#### Cross-Origin Cookie Considerations (for Refresh Token)

To ensure the HttpOnly refresh token cookie (`jid`) is correctly sent from a frontend running on a different origin (e.g., `http://localhost:5173`) to the backend (e.g., `http://localhost:3000`):
-   The cookie is set with `SameSite=None` and `secure=true`.
    -   `SameSite=None` is necessary for cross-origin requests.
    -   `secure=true` is a requirement for `SameSite=None`. Modern browsers often allow `secure=true` cookies on `localhost` over HTTP for development purposes, but **HTTPS is strictly required in production.**
-   The cookie is also set with `path: '/'` to be accessible across all backend paths.
-   The backend's CORS policy is configured with `origin: FRONTEND_URL` and `credentials: true` to allow requests from the specified frontend origin and to permit cookie exchange.

### 2. Data Injection (NoSQL Injection)
-   *(This application now uses MongoDB with Mongoose as an ODM. Mongoose schemas (defining types, required fields, etc.) and its query generation methods provide a good level of protection against MongoDB query injection attacks, especially when not constructing query parts directly from unsanitized user input. Always validate and sanitize input where appropriate, even with an ODM.)*

### 3. Cross-Site Scripting (XSS)
-   **Prevention**: Output encoding, Content Security Policy (CSP), input validation. `helmet` provides some default protections. HttpOnly cookies for refresh tokens help mitigate direct token theft via XSS.

### 4. Cross-Site Request Forgery (CSRF)
-   **Issue**: While JWTs themselves are not inherently vulnerable to CSRF if sent in headers, the use of cookies (even HttpOnly with `SameSite=None`) for refresh tokens needs careful consideration in cross-origin contexts.
-   **Prevention**:
    *   HttpOnly cookies prevent JavaScript access.
    *   `SameSite=None; Secure` is used for the refresh token cookie to enable cross-origin requests. While `SameSite=Lax` (default for modern browsers if not specified) or `SameSite=Strict` are stronger CSRF defenses, they prevent the cookie from being sent in most/all cross-origin scenarios, which might be necessary if your frontend and backend are on different domains.
    *   The refresh token endpoint (`/auth/refresh-token`) is a POST request.
    *   The backend's CORS policy is specific to the `FRONTEND_URL`.
    *   For highly sensitive operations not covered by JWT Bearer token authentication (if any were to exist that rely solely on the cookie state for auth, which is not the case here for primary actions), additional CSRF token protection might be considered, but the primary defense for JWT APIs is the Bearer token in the Authorization header.

### 5. Password Policies & Storage
-   *(This section remains largely the same.)*

### 6. Dependency Management
-   *(This section remains largely the same.)*

### 7. Security Headers
-   *(This section remains largely the same.)*

### 8. Rate Limiting
-   *(This section remains largely the same.)*

### 9. Token Management (Formerly Session Management)
-   The security of tokens is paramount. Refer to the "Token Security (JWT)" section for details on handling access and refresh tokens, managing their lifecycle, and storage best practices.

### 10. Error Handling
-   *(This section remains largely the same.)*

### 11. Input Validation
-   *(This section remains largely the same.)*

This list is not exhaustive. Always stay updated on current security best practices.
```
