# Database

The application uses a new MySQL 8 database. Build the Prisma schema by hand
for the eight business tables below. Do NOT create Laravel system tables.

## Tables

### users
System users for login. No roles.
- id, name, username, phone, password (bcrypt hash), created_at, updated_at

### clients
The central table. Holds client, iqama, passport, and visa data.
- id, name, phone, passport, board_number, visa_number
- iqama_number, iqama_end_date
- card_type, notes, payment_type, next_payment_date, amount
- service_id   -> services.id    (a client belongs to one service)
- organization_id -> organizations.id (a client may have one organization)
- last_step_id, created_at, updated_at

### services
Service types offered by the office.
- id, name, created_at, updated_at

### service_steps
The steps that make up each service.
- id, name, number
- service_id -> services.id
- created_at, updated_at

### client_steps
Tracks which step each client reached, and when.
- id, step_date
- client_id -> clients.id
- step_id   -> service_steps.id
- created_at, updated_at

### client_payments
Client payments and next payment dates.
- id, amount, next_payment_date, is_done, last_payment, notes
- client_id -> clients.id
- created_at, updated_at

### client_payment_monthlies
Monthly payment records for clients.
- id, iqama_end_date, month, received_date, amount, received_amount, status, notes
- client_id -> clients.id
- created_at, updated_at

### organizations
Sponsoring organizations linked to clients.
- id, name, number, expired_date, type, capacity, owner, phone
- created_at, updated_at

### login_platforms
External login platforms (muqeem / chamber). Login URL is user-editable;
disabling a platform hides its login column on the organizations page.
- id, key (unique), enabled, login_url

### organization_credentials
Per-organization credentials for an external platform. Password is stored
encrypted (AES-256-GCM, key in CREDENTIALS_ENCRYPTION_KEY env var) because
the feature requires retrieving it for autofill via the Chrome extension.
- id, platform, username, password_enc
- organization_id -> organizations.id (cascade on delete)
- unique (organization_id, platform)
- created_at, updated_at

## Relationships Summary

- services      1 --- many service_steps
- services      1 --- many clients
- organizations 1 --- many clients
- clients       1 --- many client_steps
- clients       1 --- many client_payments
- clients       1 --- many client_payment_monthlies
- service_steps 1 --- many client_steps

## Notes

- When a client is deleted, their client_steps, client_payments, and
  client_payment_monthlies should be deleted too (cascade).
- When a service or organization is deleted, set the related client's
  foreign key to null rather than deleting the client.
- The original schema.sql is a reference only — use it to confirm column
  names and types, not to import data.
