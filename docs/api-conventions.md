# API Conventions

REST conventions for the backend.

## Resource Paths

Use plural nouns, prefixed with /api:
- /api/clients
- /api/services
- /api/service-steps
- /api/client-steps
- /api/client-payments
- /api/client-payment-monthlies
- /api/organizations
- /api/auth/login

## HTTP Verbs

- GET    /api/clients        list all clients
- GET    /api/clients/:id    get one client
- POST   /api/clients        create a client
- PUT    /api/clients/:id    update a client (or PATCH for partial update)
- DELETE /api/clients/:id    delete a client

## Status Codes

- 200  successful GET, PUT, PATCH, DELETE
- 201  successful POST (resource created)
- 400  invalid input (failed Zod validation)
- 401  missing or invalid JWT token
- 404  requested resource does not exist
- 500  unexpected server error

## Request and Response

- Request and response bodies are JSON.
- Validate every request body with Zod before using it.
- On validation failure, return 400 with a clear message of what is wrong.
- Never include the password field in any user response.

## Errors

- Use a single error-handling middleware so all errors return a consistent
  JSON shape, for example: { "error": "message here" }.
- Do not leak stack traces or internal details to the client.

## Authentication

- POST /api/auth/login takes username and password, returns a JWT on success.
- All other routes require a valid JWT in the Authorization header
  (format: `Bearer <token>`).
- A JWT-checking middleware protects those routes.
