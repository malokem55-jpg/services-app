# CLAUDE.md — Backend (server)

Rules for the Express backend. Also follow the root CLAUDE.md.

## Stack

- Node.js with TypeScript
- Framework: Express
- Database access: Prisma ORM (MySQL 8)
- Authentication: JWT
- Input validation: Zod

## Architecture

- Keep database logic in a service layer (src/services/), not inside routes.
- Routes (src/routes/) only handle HTTP: parse input, call a service, send response.
- Middleware (src/middleware/) holds auth checks and error handling.
- Shared helpers go in src/lib/.

## API Rules

Follow the conventions in ../docs/api-conventions.md. Key points:
- Plural resource paths: /api/clients, /api/services, etc.
- Correct HTTP verbs: GET, POST, PUT/PATCH, DELETE.
- Correct status codes: 200, 201, 400, 401, 404, 500.
- Validate every request body with Zod before using it.
- Never return passwords or sensitive fields in any response.

## Database

- The database is new and empty. Build the Prisma schema by hand for the eight
  business tables only — see ../docs/database.md.
- Do NOT create Laravel system tables (migrations, cache, jobs, sessions, etc.).
- Apply schema changes with `npx prisma migrate dev`.

## Authentication

- Simple login only. There are no roles — any logged-in user accesses everything.
- Hash passwords with bcrypt. Never store plain-text passwords.
- Protect all routes except login with a JWT-checking middleware.
- Keep the JWT secret and database URL in `.env`.

## Reminders

- After adding a route, test it returns the correct status codes.
- Handle the case where a requested record does not exist (return 404).
