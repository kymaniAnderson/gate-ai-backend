# Authentication API Endpoints

## Login
Authenticate a user and get a JWT token.

```http
POST /api/auth/local
```

Request body:
```json
{
  "identifier": "user@example.com",
  "password": "your_password"
}
```

Success Response (200):
```json
{
  "jwt": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "user@example.com",
    "email": "user@example.com",
    "provider": "local",
    "confirmed": true,
    "blocked": false,
    "role": {
      "id": 1,
      "name": "Authenticated",
      "type": "authenticated"
    }
  }
}
```

Error Response (400):
```json
{
  "error": {
    "status": 400,
    "name": "ValidationError",
    "message": "Invalid identifier or password"
  }
}
```

## Register
Create a new user account (if public registration is enabled).

```http
POST /api/auth/local/register
```

Request body:
```json
{
  "username": "johndoe",
  "email": "johndoe@example.com",
  "password": "your_password"
}
```

Success Response (200):
```json
{
  "jwt": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "johndoe",
    "email": "johndoe@example.com",
    "provider": "local",
    "confirmed": true,
    "blocked": false,
    "role": {
      "id": 1,
      "name": "Authenticated",
      "type": "authenticated"
    }
  }
}
```

## Invite User (Admin Only)
Invite a new user by creating an account and sending login credentials via email.

```http
POST /api/auth/invite
```

Headers:
```
Authorization: Bearer {admin_jwt_token}
```

Request body:
```json
{
  "email": "newuser@example.com",
  "role": "authenticated"
}
```

Success Response (200):
```json
{
  "message": "Invitation sent successfully",
  "user": {
    "id": 1,
    "email": "newuser@example.com"
  }
}
```

## Forgot Password
Request a password reset link.

```http
POST /api/auth/forgot-password
```

Request body:
```json
{
  "email": "user@example.com"
}
```

Success Response (200):
```json
{
  "ok": true
}
```

## Reset Password
Reset password using the code received in email.

```http
POST /api/auth/reset-password
```

Request body:
```json
{
  "code": "reset_password_code_from_email",
  "password": "new_password",
  "passwordConfirmation": "new_password"
}
```

Success Response (200):
```json
{
  "jwt": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "user@example.com",
    "email": "user@example.com"
  }
}
```

## Get Current User
Get the currently authenticated user's information.

```http
GET /api/users/me
```

Headers:
```
Authorization: Bearer {jwt_token}
```

Success Response (200):
```json
{
  "id": 1,
  "username": "johndoe",
  "email": "johndoe@example.com",
  "provider": "local",
  "confirmed": true,
  "blocked": false,
  "role": {
    "id": 1,
    "name": "Authenticated",
    "type": "authenticated"
  }
}
```

## Change Password (Authenticated)
Change password for the currently authenticated user.

```http
POST /api/auth/change-password
```

Headers:
```
Authorization: Bearer {jwt_token}
```

Request body:
```json
{
  "currentPassword": "current_password",
  "password": "new_password",
  "passwordConfirmation": "new_password"
}
```

Success Response (200):
```json
{
  "jwt": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "johndoe",
    "email": "johndoe@example.com"
  }
}
```

## Email Confirmation
Confirm a user's email address.

```http
GET /api/auth/email-confirmation?confirmation={confirmation_token}
```

Success Response (200):
```json
{
  "jwt": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "johndoe",
    "email": "johndoe@example.com",
    "confirmed": true
  }
}
```

## Send Email Confirmation
Request a new email confirmation link.

```http
POST /api/auth/send-email-confirmation
```

Request body:
```json
{
  "email": "user@example.com"
}
```

Success Response (200):
```json
{
  "email": "user@example.com",
  "sent": true
}
```

# Using the JWT Token

After successful authentication, include the JWT token in the Authorization header for all authenticated requests:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

# Error Handling

Common error responses:

401 Unauthorized:
```json
{
  "error": {
    "status": 401,
    "name": "UnauthorizedError",
    "message": "Invalid credentials"
  }
}
```

403 Forbidden:
```json
{
  "error": {
    "status": 403,
    "name": "ForbiddenError",
    "message": "Forbidden access"
  }
}
```

400 Bad Request:
```json
{
  "error": {
    "status": 400,
    "name": "ValidationError",
    "message": "Validation failed",
    "details": {
      "errors": [
        {
          "path": ["email"],
          "message": "Email is required"
        }
      ]
    }
  }
}
``` 