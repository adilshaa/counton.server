```markdown
# Secure Node.js Express Server

A basic Node.js server built with Express, featuring user registration, login, and session-based authentication using Passport.js. This project aims to demonstrate fundamental security practices.

## Features

- User registration with password hashing (bcrypt)
- User login with Passport.js (local strategy)
- Session management with `express-session`
- Protected routes
- Logout functionality
- Basic security headers with `helmet`
- Rate limiting with `express-rate-limit`
- Data persistence with MongoDB using Mongoose ODM
- CORS (Cross-Origin Resource Sharing) enabled for all origins (default configuration)

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
4.  Configure environment variables (see Configuration section below).

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
The server will typically start on `http://localhost:3000`.

### Configuration

Before running the application, you need to set up environment variables. Create a `.env` file in the root of the project with the following variables (this file is gitignored):

```env
# MongoDB Connection URI
MONGODB_URI=mongodb://localhost:27017/secure_node_app_dev

# Session Secret - A long, random string used to sign the session ID cookie
SESSION_SECRET=your_very_long_random_and_secure_secret_string_here
```

-   **`MONGODB_URI`**: Your MongoDB connection string. The example above connects to a local MongoDB instance and a database named `secure_node_app_dev`. Replace with your actual URI if using a cloud-hosted database or different local setup.
-   **`SESSION_SECRET`**: A long, random, and unique string for securing sessions. **Change this to a strong secret in your environment.** This is crucial for session security.

*Note: The `.env` file is included in `.gitignore` and should not be committed to version control. For production environments, set these variables directly in your hosting platform's configuration.*

## API Endpoints

- `POST /auth/register`: Register a new user. Body: `{ "username": "user", "password": "password" }`
- `POST /auth/login`: Log in an existing user. Body: `{ "username": "user", "password": "password" }`
- `POST /auth/logout`: Log out the current user.
- `GET /profile`: (Protected) Get the current user's profile information.
- `GET /api/data`: (Protected) Get sample protected data.

## Security Considerations

This server implements several security features, but security is an ongoing process. Here are some important considerations:

### 1. SQL Injection (and Data Injection)
-   **Issue**: Occurs when untrusted data is sent to an interpreter as part of a command or query. For SQL databases, attackers can manipulate queries to access or modify data. For NoSQL databases like MongoDB, the term "NoSQL Injection" is used.
-   **Prevention**:
    -   **Use Parameterized Queries or Prepared Statements (SQL)**: Most database libraries support this.
    -   **Use ORMs/ODMs**: Libraries like Sequelize (SQL) or Mongoose (MongoDB) often have built-in protection.
        *(This application now uses MongoDB with Mongoose as an ODM. Mongoose schemas (defining types, required fields, etc.) and its query generation methods provide a good level of protection against MongoDB query injection attacks, especially when not constructing query parts directly from unsanitized user input. Always validate and sanitize input where appropriate, even with an ODM.)*
    -   **Validate and Sanitize Input**: Ensure data is in the expected format and escape special characters if not using an ORM/ODM that handles this.

### 2. Cross-Site Scripting (XSS)
-   **Issue**: Attackers inject malicious scripts into web pages viewed by other users.
-   **Prevention**:
    -   **Output Encoding**: Encode data before rendering it in HTML. Modern templating engines often do this by default.
    -   **Content Security Policy (CSP)**: Use `helmet.contentSecurityPolicy()` to define a CSP that restricts where scripts can be loaded from.
    -   **Input Validation/Sanitization**: Cleanse user input that will be displayed.
    -   `helmet` provides some XSS protection (e.g., `helmet.xssFilter()` which is deprecated but `helmet` enables `X-XSS-Protection` by default in a compatible way).

### 3. Cross-Site Request Forgery (CSRF)
-   **Issue**: Tricks a victim's browser into making an unintended request to a web application where they are authenticated.
-   **Prevention**:
    -   **CSRF Tokens**: For any state-changing operations (POST, PUT, DELETE requests initiated from traditional web pages/forms), use CSRF tokens. Middleware like `csurf` can help. For API-based authentication (like tokens), CSRF is less of a concern if tokens are handled correctly (e.g., not stored in cookies accessible by JavaScript without SameSite protections).
    -   **SameSite Cookies**: Use `SameSite` attribute on cookies. This server's session cookie can be configured for this (`Lax` or `Strict`). `express-session` allows setting this.
    -   Verify `Origin` or `Referer` headers for sensitive requests (can be spoofed but adds a layer).

### 4. HTTPS
-   **Importance**: Always use HTTPS in production. HTTPS encrypts data in transit between the client and server, protecting against eavesdropping and man-in-the-middle attacks.
-   **Implementation**: Use a reverse proxy like Nginx or Caddy to handle TLS termination, or configure HTTPS directly in your Node.js application (less common for production). Ensure session cookies are marked `Secure` (this is done in `server.js` for production).

### 5. Password Policies & Storage
-   **Storage**: Passwords are hashed using `bcrypt` via the Mongoose pre-save hook in this example, which is good.
-   **Policies**:
    -   Enforce strong password complexity (length, character types) - the Mongoose schema has a basic minlength. This can be enhanced.
    -   Consider implementing multi-factor authentication (MFA) for higher security.
    -   Protect against brute-force attacks on login (this server uses `express-rate-limit`).

### 6. Dependency Management
-   **Vulnerabilities**: Third-party packages can have vulnerabilities.
-   **Action**:
    -   Regularly update dependencies: `npm update`.
    -   Audit dependencies for known vulnerabilities: `npm audit`. Fix reported issues promptly.

### 7. Security Headers
-   **`helmet`**: This application uses `helmet` to set various HTTP security headers (e.g., `X-Content-Type-Options`, `Strict-Transport-Security`, `X-Frame-Options`). Review and customize `helmet`'s configuration as needed. For example, `Content-Security-Policy` is a powerful header that requires careful configuration.

### 8. Rate Limiting
-   **`express-rate-limit`**: Used here to protect against brute-force attacks on authentication routes and can be applied to other sensitive endpoints.

### 9. Session Management
-   **Secret**: Use a long, random, and unique string for the `express-session` secret in production. Store it securely using environment variables (as prompted in the Configuration section).
-   **Cookie Settings**:
    -   `HttpOnly`: Helps prevent client-side scripts from accessing the session cookie. `express-session` sets this by default.
    -   `Secure`: Ensure this is `true` in production when using HTTPS, so the cookie is only sent over HTTPS (this is configured in `server.js`).
    -   `SameSite`: Set to `Lax` or `Strict` to protect against CSRF (can be configured in `express-session`).

### 10. Error Handling
-   **Information Disclosure**: The current error handler logs detailed errors to the console but sends generic messages to the client. Avoid sending detailed error information (like stack traces) to the client in production.

### 11. Input Validation
-   **Principle**: Validate all incoming data from users or external services (e.g., in request bodies, URL parameters, query strings). Check for type, format, length, and allowed characters. Mongoose schema validation provides a good starting point for data persisted to the database. Additional validation should be performed in controllers or dedicated validation middleware.

This list is not exhaustive. Always stay updated on current security best practices.
```
