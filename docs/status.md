# Status

Updated: 2026-10-07

## Module progress

| # | Module | Backend | Web | Notes |
|---|---|---|---|---|
| 1 | Bootstrap (settings, Swagger, Celery, error envelope, health) | Done | -- | |
| 2 | Auth (magic link, JWT, admin users, roles) | Done | Done | Login, verify, desk, staff room. Awaiting owner visual check |
| 3 | Catalog (accessions, drops, images, filters) | Done | Done | 3a backend, 3b storefront, 3c admin desk (accessions, piece editor, photos, flaws, drops). Awaiting owner visual check |
| 4 | Inventory holds | Done | Done | Place, release, expiry, staff release; behind `HOLDS_ENABLED` (off in production until checkout). Awaiting owner visual check |
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

- Storefront: `/orders/track`, `/orders/[orderNo]`, `/field-notes`, `/style-guide`.
- Admin desk: `/admin/list`, `/admin/orders`, `/admin/orders/[id]/slip`.


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
- Storefront data is cached for 60 seconds per API call, served stale-while-revalidate: after the
  minute, the first visit still gets the old data while it refreshes, the next gets the new. So a
  piece that changes without a desk action (a scheduled release by the beat task; holds and
  claims once Modules 4-5 exist) shows a minute or so late. Desk writes expire the `catalog` tag
  with `updateTag`, so their edits show at once (measured: a publish, a rename and a withdraw were
  each visible on the next storefront request). A drop page opens at its release time regardless,
  because it checks the clock rather than the cached status.
- The storefront filter drawer needs JavaScript; sort, active filters, paging and the archive-number
  jump are plain links and forms that work without it.
- A production build (`next start`) against an API on localhost cannot show photos: Next's image
  optimiser refuses private addresses outside dev (`dangerouslyAllowLocalIP` is dev-only on
  purpose). Use `npm run dev` locally; in production the media host is public.
- A malformed percent-escape in a dynamic route (`/item/%E0%A4%A`) returns 500 from Next's own
  parameter decoding before page code runs.
- The "next accession" on the home page is looked up on the first page of drops (24 highest
  numbers).
- `npm audit` reports 5 high-severity advisories in `braces`, pulled in by `eslint-config-next`
  (lint tooling only, not shipped). The fix is a forced breaking upgrade; left for the next
  eslint-config-next release.
- Photo uploads go through `POST /admin/accessions/[id]/photos`, a Route Handler that proxy.ts
  skips: proxy buffers request bodies up to 10 MB and silently truncates larger ones. The handler
  checks the origin, refreshes the access cookie and checks the role itself. A batch of photos is
  uploaded with one kind; set each photo's kind afterwards.
- The new-piece and drop drawers, confirm dialogs and photo uploads need JavaScript. The piece
  editor's section forms work without it.
- Next's data cache keeps API responses across builds and deploys. A field added to a cached
  public read must be optional with a default in its zod schema, or pages fail on cache entries
  written before the field existed (seen with `hold` on the piece record during module 4).
- Holds are anonymous: a visitor is a random cookie, so someone rotating cookies (or calling the
  API with fresh `X-Visitor-Token` values) can hold many pieces, bounded only by the per-address
  rate of 30 holds a minute. That is why `HOLDS_ENABLED` stays off in production until module 5,
  where a hold should be tied to the buyer's phone number before it can last 15 minutes.
- A hold that lapses is shown as held on the cached storefront for up to a minute after the expiry
  task ends it (the API cannot expire Next's cache). Placing a hold on such a piece still works:
  the lapsed hold is ended on the spot.
- The hold clock counts to the expiry the API set, corrected for the gap between the phone's and
  the server's clocks at page load. If the phone's clock changes while the page is open, the clock
  drifts with it; the server stays the authority, and the page refreshes until it agrees.
- Shipping, returns, privacy and terms pages are drafts: they state only what is known and mark
  every fee, window and responsibility as "to be confirmed by the owner", with a draft banner.
- The drop list collects sign-ups (WhatsApp number and/or email, with consent records) but nothing
  sends alerts yet; sending arrives with module 7.
- Contact details (WhatsApp, email, Instagram, city, hours) come from the web server's environment
  and stay hidden while unset. Only Instagram (from the brief) is set in local development.
- The home page fetches one newest piece per stocked category for the category plates (up to five
  cached API calls), plus the rail, the pulse and the facets.
- Customer sign-in sends codes by email only. SMS needs a registered business to get a sender ID
  approved (Safaricom requires a business registration or incorporation certificate and an
  authorisation letter through a licensed provider); until then email codes are the only channel.
- Code emails go out through the Celery worker; a worker started before a new task was added must
  be restarted to pick it up.
