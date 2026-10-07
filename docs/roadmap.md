# Roadmap

Updated: 2026-10-07. One plan for the remaining build, consolidated from the agentic plan
(`nboarchive_agentic_plan.json`), the decisions recorded per module, and `docs/status.md`.
`status.md` records what exists and its limitations; this file records what comes next and in what
order.

## Where the build stands

Modules 1 to 3 are complete. Baseline re-run on 2026-10-07:

| Check | Result |
|---|---|
| API tests (`pytest`, live PostgreSQL) | 162 passed |
| API lint and format (`ruff`) | clean |
| OpenAPI schema (`spectacular --validate --fail-on-warn`) | clean |
| Migrations | all applied, none pending |
| Web unit tests (`vitest`) | 79 passed |
| Web typecheck, lint, Prettier | clean |
| Web production build | compiles |

| # | Module | API | Web |
|---|---|---|---|
| 1 | Bootstrap: settings, Swagger, Celery, error envelope, health | Done | -- |
| 2 | Auth: magic link, JWT cookies, staff and roles | Done | Done |
| 3 | Catalogue: pieces, drops, photos, flaws, filters, storefront, desk | Done | Done |

Everything through module 3 is pushed to `origin/main`.

## Order of work

Each module runs the same cycle: plan and questions, API built and verified (tests against live
PostgreSQL), web built and verified (build, unit tests, HTTP checks), self-audit, commits, owner
visual check. One module at a time.

### Housekeeping (done 2026-10-07)

The 3c commits are pushed, `agentRules: false` stops `next dev` writing agent files,
`.gitattributes` fixes line endings, and the API image runs Python 3.12.

### Module 4: Holds (in progress)

Decisions: anonymous visitor cookie, at most 3 active holds per visitor, fixed 15 minutes, held
pieces show other visitors when they return, hold button behind a flag (on in dev, off in
production until checkout exists), owner and editor can release a stuck hold.

The "place on hold" replacement for add-to-cart. A visitor reserves a one-of-one piece for 15
minutes with an honest countdown; no piece can ever be held or sold twice.

API (`apps/inventory`):

- `Hold` model: piece, visitor key (hashed), status (`active`, `converted`, `released`, `expired`),
  `expires_at`, timestamps. A partial unique constraint allows one active hold per piece, so the
  database refuses a double hold even if application code is wrong.
- Hold service: lock the piece row, accept `live` or `scheduled` with a past release time, set the
  piece to `held` in the same transaction. Repeat requests from the same visitor return the
  existing hold. Release and expiry return the piece to `live`.
- Expiry: a beat task every minute, plus lazy expiry when a piece is requested, so a lapsed hold
  never blocks a buyer while waiting for the task.
- Endpoints: place a hold, list the visitor's holds, release a hold, and a staff release for a stuck
  hold. Scoped rate limit per visitor.
- Public piece detail gains the hold's expiry for held pieces (the honest "back in 12 minutes").
- Tests: 50 threads racing for one piece (exactly one hold), expiry, release, the scheduled-piece
  rule, idempotent repeats, the per-visitor cap.

Web:

- A random httpOnly visitor cookie, sent to the API only as a header and stored there hashed.
- Item page: "Place on hold" on live pieces; on a piece this visitor holds, the countdown, a release
  button and the path to checkout; on someone else's hold, when it comes back.
- `HoldTimer` (server-provided expiry, `role="timer"`, refreshes at zero, reduced-motion safe).
- `/hold`: the visitor's held pieces with timers. Module 5 turns this into checkout.
- A hold indicator in the index navigation.
- Hold and release expire the `catalog` cache tag so the archive shows "On hold" at once.

### Module 5: Orders and delivery

Guest checkout from `/hold`: phone (+254 formatting), name, delivery zone and address, order
number, and an order tracker by order number and phone.

- API: `ShippingZone`, `Order`, `OrderItem`, order state machine (pending payment, paid, packing,
  dispatched, delivered, cancelled), conversion of holds into an order, zone fees.
- Web: `PhoneInput`, `ZonePicker`, checkout page, `/orders/track`, `/orders/[orderNo]` receipt
  styled as an archive receipt.
- Needs from the owner: delivery zones, fees, ETAs, pickup option.

### Module 6: Payments

- Provider interface with a mock provider first, then M-Pesa Daraja STK Push in sandbox: initiate,
  callback with validation, idempotent payment records, re-query by CheckoutRequestID,
  reconciliation task.
- Payment success claims the piece (`claimed`, buyer city, date) and stamps it; failure or timeout
  releases the hold.
- Web: payment states (waiting for PIN, cancelled, insufficient funds, timeout, success).
- Payments runbook (`docs/payments-runbook.md`).
- Needs from the owner: Daraja sandbox keys, later production keys and three real test payments.

### Module 7: Back-room operations

- Orders board (paid, packing, dispatched, delivered), tracking entry, printable packing slip.
- Phone-first quick list: photos, template per category, measurements, price, under 60 seconds.
- Instagram share assets: 4:5 and 9:16 images with archive number and price, caption draft.
- Admin audit log for catalogue, order and staff changes.

### Module 8: Content, polish and quality

- Field notes (buyer notes, moderated), About, policies (shipping, returns, authenticity, privacy,
  terms), style guide page.
- Motion pass: stamp-down on claim, card flip, reduced-motion alternatives.
- Quality: WCAG 2.2 AA pass, performance budget on mid-range Android, security review,
  load test of a drop release, Postman collection (`docs/postman_collection.json`).

## Waiting on the owner

These do not block module 4 but shape modules 5 to 8 and launch:

1. Instagram exports to replace the provisional palette, type and voice.
2. Strictly one-of-one, or occasional multiples of the same piece and size?
3. Quality-check steps and the returns or exchange policy.
4. Delivery partners, zone fees, ETAs, and whether Nairobi pickup is offered.
5. Production domain and hosting.
6. Chest-band edges for the size filter (provisional today).
7. Real item photos (the archive holds 5 placeholder pieces; the original plan said 15).
