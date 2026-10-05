# API

Interactive docs: `http://localhost:8010/api/docs/` (Swagger UI). Raw schema: `/api/schema/`.
A Postman collection is generated to `docs/postman_collection.json` once all modules exist.

## Conventions

- Base path `/api/v1/`. JSON only.
- Admin endpoints use `Authorization: Bearer <access>`. Customers never authenticate.
- Every error has the shape `{"error": {"code": "...", "message": "...", "fields"?: {...}}}`.
  Branch on `code`, never on `message`.
- Lists are paginated: `?page=` and `?page_size=` (max 96), returning `count`, `next`,
  `previous`, `results`.
- Phone numbers are stored and returned as E.164 Kenyan mobiles (`+2547XXXXXXXX`).

## Auth

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/auth/magic-link/` | public | Email a single-use sign-in link (always 202) |
| POST | `/auth/magic-link/verify/` | public | Exchange link token for `access` + `refresh` |
| POST | `/auth/refresh/` | public | Rotate refresh token (old one is blacklisted) |
| POST | `/auth/logout/` | admin | Revoke a refresh token |
| GET | `/auth/me/` | admin | Current admin |
| GET/POST | `/auth/users/` | owner | List / add admins (new admins get a link) |
| GET/PATCH | `/auth/users/{id}/` | owner | View / change name, phone, role, active |

Error codes: `invalid_link`, `token_not_valid`, `not_authenticated`, `permission_denied`,
`validation_error`, `throttled`, `not_found`.

Bootstrap the first owner with `python manage.py create_owner --email ... --name ...`.
