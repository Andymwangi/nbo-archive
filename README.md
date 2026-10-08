# nboarchive -- The Accession Room

Kenya-first e-commerce for [@nboarchives](https://www.instagram.com/nboarchives/): high-quality thrifted
polos, jackets, sweaters, hoodies and tees, mostly one-of-one. Every piece is an *accession* with an
archive number (`NBO-0142`), a condition grade, measurements, flaws shown honestly, and a cleaned date.

> Not a shop that happens to have products. An archive that happens to sell.

The full product brief lives in `nboarchive_agentic_plan.json`. This README records the decisions taken
when turning that brief into a codebase.

---

## Stack

| Layer | Choice | Version |
|---|---|---|
| Web | Next.js App Router, React, TypeScript | 16.3.8 / 19.3.0 / 5.9.3 (pinned) |
| Styling | Tailwind CSS with a fully custom `@theme` (no default palette or radius scale) | 4.3.3 |
| Behaviour primitives | Radix (headless only -- every visual layer is custom) | 1.6.7 |
| Utility icons | Solar via Iconify (close, search, arrows only; garment motifs are custom SVG) | 6.0.2 |
| Client data | Server Components + Server Actions over a typed `lib/api` client; TanStack Query is added with the holds module, where client-side polling first needs it | -- |
| Validation (web) | Zod | 3.25.76 |
| API | Django 5.2 LTS + Django REST Framework | 5.2.17 / 3.18.1 |
| API docs | drf-spectacular (Swagger at `/api/docs/`) + `docs/postman_collection.json` | 0.30.0 |
| Auth | Passwordless email magic link for admins -> SimpleJWT; guest checkout for customers | 5.5.1 |
| Jobs | Celery + Redis (hold expiry, payment reconciliation, notifications) | 5.6.3 |
| Database | PostgreSQL 17 | -- |
| Payments | M-Pesa Daraja STK Push behind a provider interface (mock provider in dev) | -- |
| Media | Local filesystem in dev; Cloudinary-compatible storage abstraction in prod | -- |

Package managers: `npm` for `web/` (no shared `packages/` directory, so no workspaces), `pip` + venv for `api/`.

---

## Folder structure

```
nboarchive/
  README.md
  nboarchive_agentic_plan.json   product brief (source of truth for catalog + concept)
  docker-compose.yml             postgres, redis, api, worker, beat, web
  .env.example                   every key, no values
  api/                           Django project
    config/                      settings/{base,dev,prod,test}.py, urls, celery, wsgi, asgi
    apps/
      common/                    base model (created_at/updated_at), pagination, exceptions
      accounts/                  AdminUser (owner|editor|packer), magic-link login, JWT
      catalog/                   Accession, AccessionImage, Flaw, Drop, archive-number sequence
      inventory/                 Hold with row-level locking, expiry task
      orders/                    Order, OrderItem, ShippingZone, state machine, tracker lookup
      payments/                  Payment, provider interface, M-Pesa Daraja + mock, reconciliation
      fieldnotes/                FieldNote (buyer notes, moderated)
      shareassets/               4:5 and 9:16 Instagram share images (Pillow)
      audit/                     admin audit log
    seed/                        placeholder accessions + photos (flagged is_placeholder)
    tests/                       pytest; concurrency tests run against real Postgres
  web/                           Next.js app
    src/app/                     routes (storefront + /admin)
    src/components/              bespoke design-system components
    src/lib/api/                 typed API client -- components never call fetch directly
    src/motion/                  stamp, flip, drawer, hold-timer (+ reduced-motion fallbacks)
    src/styles/                  tokens + globals
  docs/                          decision record, signature moments, api, payments runbook, status
```

---

## Design decisions (provisional -- pending owner sign-off)

No Instagram exports have been supplied yet, so the following are recorded as **provisional** in
`docs/design/decision-record.md` and must be re-sampled against real @nboarchives photography.

### Typography

| Role | Family | Why |
|---|---|---|
| Display / archive numbers | Bricolage Grotesque | Characterful, slightly irregular grotesk; holds up at 8-14vw numerals |
| Text | Instrument Sans | Legible humanist-leaning grotesk, not Inter |
| Meta / labels / prices | DM Mono | Typewriter-flavoured catalogue data, care-label feel |

All three are SIL OFL (commercial use OK), self-hosted at build time via `next/font`, subset to Latin,
`font-display: swap` with metric-matched fallbacks.

### Colour

| Token | Light | Dark | Use |
|---|---|---|---|
| `paper` | `#EEE8DC` | `#17150F` | background (warm off-paper / dark archive drawer) |
| `paper-2` | `#E4DCCB` | `#211E17` | secondary surface (index card, label stock) |
| `ink` | `#1C1A16` | `#ECE5D6` | text (never pure black / white) |
| `ink-muted` | `#5E584D` | `#A69E8E` | metadata |
| `ink-faint` | `#686152` | `#958D7C` | catalogue numbers, inactive marks |
| `signal` | `#B33318` | `#F0603A` | price-sticker / stamp ink -- used sparingly |
| `tag` | `#2E5B3F` | `#7FB08F` | cleaned-and-inspected marks only |

Dark mode is a designed variant (warm dark drawer), not an inversion. Banned: purple/blue gradients,
neon on dark, glow shadows, gradient text, mesh backgrounds.

### Concept vocabulary

Place on hold (15-minute timed reservation) instead of add-to-cart; CLAIMED stamp instead of out-of-stock;
contact-sheet layout instead of uniform product grid; Accessions instead of collections; Field notes
instead of star reviews; measurements on the item label instead of a size-guide modal.

---

## Placeholder content

Seed accessions use real photographs of thrifted garments sourced from Unsplash (free licence),
downloaded into `api/seed/media/`. Every seeded row has `is_placeholder=True` and the storefront marks
them as sample pieces. Remove them with:

```
python manage.py purge_placeholders
```

---

## Running locally

```
cp .env.example .env              # fill values
docker compose up -d db redis
cd api && python -m venv .venv && .venv/Scripts/activate && pip install -r requirements-dev.txt
python manage.py migrate && python manage.py seed_archive && python manage.py runserver 8010
cd web && npm install && npm run dev   # web reads web/.env.local (NEXT_PUBLIC_API_URL, API_INTERNAL_URL, NEXT_PUBLIC_SITE_URL, INTERNAL_API_TOKEN, HOLDS_ENABLED, CONTACT_* details)
```

Swagger: http://localhost:8010/api/docs/ -- Web: http://localhost:3010

### Sending real email (Gmail for testing)

Staff sign-in links and customer sign-in codes are sent by the Celery worker. Locally they print
in the worker's terminal (`EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend`). To send
real email through Gmail, turn on 2-step verification on the Google account, create an app
password (Google Account > Security > App passwords), and set in `.env`:

```
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=your.address@gmail.com
EMAIL_HOST_PASSWORD=the-16-character-app-password
DEFAULT_FROM_EMAIL=nboarchive <your.address@gmail.com>
```

Restart the API and the worker after changing `.env`. On Windows the worker and the scheduler run
as two processes: `celery -A config worker --pool=solo -l info` and `celery -A config beat -l info`.

### Deployment requirements

- The web app must sit behind one reverse proxy that appends the real client address to
  `X-Forwarded-For` (nginx `proxy_add_x_forwarded_for`, or the hosting edge). Rate limits depend on it.
- Set `TRUSTED_PROXIES` on the API to the network the web container connects from.
- Set the same random `INTERNAL_API_TOKEN` on the API and the web server. Server-side page renders
  carry it so the storefront is not rate-limited as one anonymous client.
- Set `MEDIA_BASE_URL` on the API to the public origin that serves `/media/` (usually the API's own
  public URL). Image URLs are built from it; without it they carry the internal hostname the web
  server used to reach the API. If it differs from `NEXT_PUBLIC_API_URL`, the web build must see it
  too so `next/image` allows that host.
- Serve over HTTPS: session cookies are `Secure` in production builds and are dropped over plain HTTP.
- If a proxy rewrites `Host`, add the public origin to `serverActions.allowedOrigins` in
  `web/next.config.ts`, or Server Actions fail Next's origin check.

### Ports

Other local projects already occupy 3000-3002, 4000, 5432-5434, 5555, 6379, 6380, 8000, 8025, 8081
and 9000-9001, so nboarchive uses its own block. Host ports are set in `.env`; the compose file falls
back to the same values.

| Service | Host port |
|---|---|
| Postgres | 5436 |
| Redis | 6381 |
| API (Django) | 8010 |
| Web (Next.js) | 3010 |

---

## Credits

Utility icons: [Solar](https://www.figma.com/community/file/1166831539721848736) by 480 Design,
licensed CC BY 4.0, bundled via `@iconify-icons/solar`. Fonts: Bricolage Grotesque, Instrument Sans
and DM Mono, all SIL Open Font License.
