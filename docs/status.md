# Status

Updated: 2026-10-06

## Module progress

| # | Module | Backend | Web | Notes |
|---|---|---|---|---|
| 1 | Bootstrap (settings, Swagger, Celery, error envelope, health) | Done | -- | |
| 2 | Auth (magic link, JWT, admin users, roles) | Done | Done | Login, verify, desk, staff room. Awaiting owner visual check |
| 3 | Catalog (accessions, drops, images, filters) | Done | Pending | 3a backend done; 3b storefront and 3c admin desk next |
| 4 | Inventory holds | Pending | Pending | |
| 5 | Orders + shipping zones | Pending | Pending | |
| 6 | Payments (mock, then Daraja) | Pending | Pending | |
| 7 | Admin quick-list, orders board, share assets | Pending | Pending | |
| 8 | Field notes, policies, motion, QA | Pending | Pending | |

## Owner questions (batched, not blocking yet)

1. Instagram exports (30-60 images, captions, highlights) to replace provisional palette and type.
2. Strictly one-of-one, or occasional multiples of the same item and size?
3. Quality-check steps (inspection, washing/steaming, repairs) and returns/exchange policy.
4. Delivery partners, zone fees, and whether Nairobi pickup/meet-up is offered.
5. Production domain (needed before enabling HSTS preload and email sending).

## Routes not yet built

Created with real content in their module, not as empty placeholders (an empty `page.tsx` breaks
`next build`):

- Storefront: `/` (latest accession), `/archive`, `/item/[archiveNo]`, `/drops`, `/drops/[number]`,
  `/hold`, `/orders/track`, `/orders/[orderNo]`, `/field-notes`, `/about`, `/policies/[slug]`,
  `/style-guide`.
- Admin desk: `/admin/list`, `/admin/accessions`, `/admin/accessions/[id]`, `/admin/drops`,
  `/admin/orders`, `/admin/orders/[id]/slip`.

Until `/` exists, the 404 page's "Back to the archive" link lands on the same 404.

## Known limitations

- Per-address magic-link cap (3 per 15 minutes) is a count check, not a lock; two simultaneous
  requests can both pass it. IP throttling (5/hour per visitor) bounds the impact.
- Visitor IPs reach the API through the web server's `X-Forwarded-For`, trusted only from
  `TRUSTED_PROXIES`. `next start` passes a client-supplied `X-Forwarded-For` through unchanged, so
  without a reverse proxy in front of the web app a visitor can choose the IP the rate limit sees.
  Production must sit behind exactly one proxy that appends the real client address.
- With JavaScript disabled, admin forms submit and their actions run, but the re-rendered page shows
  the idle form instead of the result. Staff pages assume JavaScript.
- `/admin/session-expired` clears cookies on GET (it is the redirect target for Server Components,
  which cannot clear cookies). A cross-site link can therefore sign a staff member out; it cannot
  sign anyone in.
- Chest-band edges for the size filter are provisional (XS <48, S 48-51, M 52-55, L 56-59,
  XL 60-63, XXL 64+ cm pit to pit) until the owner confirms them.
- Uploaded photos live on the local filesystem (`MEDIA_STORAGE=local` is the only supported
  value). `prod.py` serves no `/media/`, so production needs the reverse proxy to serve the media
  volume, or a Cloudinary/S3 backend added (new package plus a settings branch).
- HEIC photos from iPhones are rejected; the camera must save JPEG ("Most Compatible").
- A scheduled piece is public from its release time even before the beat task flips it to
  `live`. The holds module must treat `scheduled` with a past `release_at` as holdable.
- The admin audit log is deferred to module 7; catalogue writes are not yet audited.
- The Django admin (`/django-admin/`) shows catalogue records read-only. Every catalogue write goes
  through the API so photo metadata stripping and the publishing rules always apply.
- `api/Dockerfile` uses Python 3.14 while the project targets 3.12.
