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
| GET | `/catalog/facets/` | Values and counts for the filter drawer, plus `price_min` / `price_max` and `availability` counts (on the rail, on hold, claimed) |
| GET | `/catalog/pulse/` | The live strip: `next_drop` (soonest scheduled drop not yet open, or null), `on_rail` (pieces for sale), `on_hold` (pieces held right now) |
| GET | `/catalog/drops/` | Scheduled and released drops, newest first |
| GET | `/catalog/drops/{number}/` | One drop. Its pieces come from `/catalog/accessions/?drop={number}` |

Browse filters: `category`, `size` (measured chest band) and `condition` repeat for several values
(`?category=polo&category=tee`); `brand`, `colour` and `era` take comma-separated values matched
case-insensitively; `drop`, `price_min`, `price_max` (whole shillings); `availability` repeats
for `on_rail`, `on_hold`, `claimed` (without it, browse shows the rail and holds);
`include_claimed=true` (older equivalent of adding claimed pieces);
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

## Holds

A hold reserves one piece for one visitor for 15 minutes (`HOLD_DURATION_MINUTES`). Holds are
switched off unless `HOLDS_ENABLED=true`; while off, every holds endpoint returns 404
`holds_closed`. Keep it off in production until checkout and payment exist.

Visitors have no accounts. The web server sends the visitor's random key in `X-Visitor-Token`
(32 to 128 URL-safe characters); the API stores only its SHA-256.

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/holds/` | visitor | The visitor's active holds, soonest to expire first, each with its piece card |
| POST | `/holds/` | visitor | Hold a piece (`archive_no`). 201 new, 200 when this visitor already holds it |
| DELETE | `/holds/{id}/` | visitor | Let go early. 204, also when the hold has already ended |
| POST | `/admin/accessions/{id}/release-hold/` | owner, editor | Clear a stuck hold; returns the admin piece. Also repairs a piece marked `held` with no hold behind it. 409 `no_hold` when the piece is not held |

Conflict codes on `POST /holds/`: `piece_held` (someone else holds it), `not_for_sale` (claimed,
or marked held with no hold behind it, which the desk's release repairs), `hold_limit` (the
visitor already has 3 active holds). Pieces that are not public return 404. Placing a hold is
rate limited per visitor address (`hold`, 30 a minute); reading holds only counts against the
general anonymous rate, which the web server's own reads are exempt from.

Rules:

- The piece moves to `held` in the same transaction that creates the hold, and back to `live`
  when the hold is released or expires. While held, catalogue writes return 409.
- A `scheduled` piece whose release time has passed can be held; holding it releases it.
- The database allows one active hold per piece (partial unique constraint), and placement locks
  the piece row and the visitor, so neither a double hold nor a fourth hold can be raced in.
- A beat task expires lapsed holds every minute. Placing a hold also expires a lapsed hold on
  that piece first, so a buyer never waits for the task.
- The public piece record carries `hold.expires_at` while held: when the piece comes back. The
  admin piece carries `active_hold` (`expires_at`, `created_at`).

## Drop alerts

People can ask to hear when a drop opens, by WhatsApp (Kenyan mobile) or email. Every record keeps
when consent was given and which wording (`consent_version`) was agreed to; leaving the list keeps
the record with `unsubscribed_at` set, so consent history stays provable.

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/alerts/drops/` | public | Join (`phone` and/or `email`, `consent: true`, optional `source`). Always 202; joining again renews consent and merges a phone and email into one record |
| POST | `/alerts/drops/unsubscribe/` | public | Leave (`phone` or `email`). Always 202 |
| GET | `/admin/drop-alerts/` | owner | Current subscribers; `include_unsubscribed=true` for everyone |

Both public endpoints are rate limited per visitor address (`alerts`, 10 an hour). Nothing sends
messages yet; sending drop alerts arrives with the operations module.

## Customers

Optional customer accounts with no passwords: every sign-in is a six-digit code sent by email
(SMS is added later behind the same flow once the business can register a sender ID). Checkout
stays open to guests.

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/customers/sign-in/` | public | Email a code (`email`). Always 202; the first successful sign-in creates the account |
| POST | `/customers/sign-in/verify/` | public | Exchange `email` + `code` for a session `token` and the customer |
| GET/PATCH | `/customers/me/` | customer | Read, or update `name` and `phone` (Kenyan mobile, stored as E.164) |
| POST | `/customers/sign-out/` | customer | End the session. Always 204 |

Customer calls carry the session in `X-Customer-Session`; the web server keeps it in an httpOnly
cookie and never exposes it to page scripts. Codes last `CUSTOMER_CODE_TTL_MINUTES` (10), allow 5
wrong guesses, are stored only as an HMAC keyed with the server secret, and requesting a new code
retires the previous one. An address gets at most 3 codes per 15 minutes; requests and checks are
also rate limited per visitor address (`customer_code` 10 an hour, `customer_verify` 30 an hour).
Sessions last `CUSTOMER_SESSION_DAYS` (30) and are stored hashed. Errors: `invalid_code` (401),
`not_signed_in` (401).

Email delivery uses Django's SMTP settings. For testing with Gmail: `EMAIL_HOST=smtp.gmail.com`,
`EMAIL_PORT=587`, `EMAIL_HOST_USER` your Gmail address, `EMAIL_HOST_PASSWORD` a Google app
password (requires 2-step verification), and `EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend`.
Codes are sent by the Celery worker.
