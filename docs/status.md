# Status

Updated: 2026-10-06

## Module progress

| # | Module | Backend | Web | Notes |
|---|---|---|---|---|
| 1 | Bootstrap (settings, Swagger, Celery, error envelope, health) | Done | -- | |
| 2 | Auth (magic link, JWT, admin users, roles) | Done | Done | Login, verify, desk, staff room. Awaiting owner visual check |
| 3 | Catalog (accessions, drops, images, filters) | Pending | Pending | |
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
