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
| POST | `/auth/refresh/` | public | New access token. Refresh tokens are not rotated (concurrent refreshes from the web app would race) and are revoked on logout |
| POST | `/auth/logout/` | admin | Revoke a refresh token |
| GET | `/auth/me/` | admin | Current admin |
| GET/POST | `/auth/users/` | owner | List / add admins (new admins get a link) |
| GET/PATCH | `/auth/users/{id}/` | owner | View / change name, phone, role, active |

Error codes: `invalid_link`, `token_not_valid`, `not_authenticated`, `permission_denied`,
`validation_error`, `throttled`, `not_found`, `conflict`.

Rate limits on the public auth endpoints are per visitor IP. The API reads `X-Forwarded-For` only
when the direct peer is listed in `TRUSTED_PROXIES` (loopback by default); the web app forwards the
visitor address on link requests, link redemption and token refresh.

The web server's own calls (page renders and cache refreshes, which have no visitor behind them)
send `X-Internal-Token: <INTERNAL_API_TOKEN>` instead. A matching token lifts the anonymous
per-minute limit only; scoped limits such as magic-link requests still apply. An empty
`INTERNAL_API_TOKEN` disables the bypass.

Bootstrap the first owner with `python manage.py create_owner --email ... --name ...`.

## Catalog (public)

| Method | Path | Purpose |
|---|---|---|
| GET | `/catalog/accessions/` | Browse public pieces (paginated cards, newest first) |
| GET | `/catalog/accessions/{archive_no}/` | One piece with photos, flaws, measurements and up to 4 pieces from the same era. Accepts `NBO-0142`, `0142` or `142` |
| GET | `/catalog/facets/` | Values and counts for the filter drawer, plus `price_min` / `price_max` |
| GET | `/catalog/drops/` | Scheduled and released drops, newest first |
| GET | `/catalog/drops/{number}/` | One drop. Its pieces come from `/catalog/accessions/?drop={number}` |

Browse filters: `category`, `size` (measured chest band) and `condition` repeat for several values
(`?category=polo&category=tee`); `brand`, `colour` and `era` take comma-separated values matched
case-insensitively; `drop`, `price_min`, `price_max` (whole shillings); `include_claimed=true`;
`sort` = `newest` (default), `price`, `-price`, `number`, `-number`.

Public pieces are those `live`, `held` or `claimed`, plus `scheduled` pieces whose release time
has passed (reported as `live`). Claimed pieces are left out of browse unless asked for, and show
`claimed.city` and `claimed.claimed_at`. Prices are whole Kenyan shillings. Measurements are whole
centimetres, measured flat. Chest bands (pit to pit): `xs` under 48, `s` 48-51, `m` 52-55,
`l` 56-59, `xl` 60-63, `xxl` 64 and over (provisional until the owner confirms).

Photo URLs are absolute, built from `MEDIA_BASE_URL` when it is set and from the request host
otherwise. Each photo carries `width`, `height` and `placeholder` (a tiny base64
JPEG for blur-up).

## Catalog (admin)

Every admin may read; owners and editors may write (packers get 403 on writes).

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/admin/accessions/` | List any status (`status`, `category`, `drop`, `is_placeholder`, `q`) / start a draft and take the next archive number |
| GET/PATCH/DELETE | `/admin/accessions/{id}/` | View with `problems` (what blocks publishing) / edit / delete a draft |
| POST | `/admin/accessions/{id}/publish/` | Go live now |
| POST | `/admin/accessions/{id}/schedule/` | Schedule: takes the drop's release time, or `release_at` when not in a drop |
| POST | `/admin/accessions/{id}/withdraw/` | Take off the archive |
| POST | `/admin/accessions/{id}/images/` | Upload a photo (multipart: `file`, `kind`, `alt_text`) |
| POST | `/admin/accessions/{id}/images/order/` | Reorder photos (`ids`, every photo once) |
| PATCH/DELETE | `/admin/accessions/{id}/images/{image_id}/` | Change kind or alt text / remove |
| POST | `/admin/accessions/{id}/flaws/` | List a flaw (`description`, `image_id`) |
| PATCH/DELETE | `/admin/accessions/{id}/flaws/{flaw_id}/` | Edit / remove a flaw |
| GET/POST | `/admin/drops/` | List / start a draft drop and take the next drop number |
| GET/PATCH/DELETE | `/admin/drops/{id}/` | View / edit title and intro / delete a draft drop |
| POST | `/admin/drops/{id}/schedule/` | Set or move the release time; scheduled pieces move with it |
| POST | `/admin/drops/{id}/release/` | Release now; scheduled pieces go live |

Statuses: `draft`, `scheduled`, `live`, `held`, `claimed`, `withdrawn`. Holds and orders own
`held` and `claimed`; while a piece is in either, every catalogue write returns 409 `conflict`.
Archive and drop numbers are never reused, even when a draft is deleted. A live piece cannot be
scheduled (409); withdraw it first.

Publishing (now or scheduled) requires title, brand, tagged size, colour, fabric, condition
grade, price, cleaned date, all four measurements, at least 3 photos including a front photo, and
a close-up photo on every flaw. A failed publish returns 400 with each problem under `fields`.

Photos: JPEG, PNG or WebP up to 15 MB, at most 12 per piece. Every upload is re-encoded as JPEG
(long edge at most 2400 px), which strips EXIF and GPS data; camera orientation is applied first
and photos tagged with a colour profile (Display P3, CMYK) are converted to sRGB.

A beat task runs every minute to mark due drops and pieces released. Public reads compare release
times directly, so a release never waits on it.

Placeholder data: put the photos named in `api/seed/media/` (see `api/seed/accessions.py`) and run
`python manage.py seed_archive`; remove them with `python manage.py purge_placeholders`.
