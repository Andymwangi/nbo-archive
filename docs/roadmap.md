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

### Module 4: Holds (done 2026-10-07)

A visitor reserves a one-of-one piece for 15 minutes with an honest countdown. One active hold per
piece is enforced by the database and by row locks; a visitor can hold at most 3 pieces. Holds are
switched off in production (`HOLDS_ENABLED`) until checkout exists. See `docs/api.md` (Holds) and
the limitations in `docs/status.md`.

### Storefront shell redesign (done 2026-10-07)

Live strip (next drop, pieces on the rail and on hold), a "drop console" header with category
tags, a phone tab bar, an ink footer led by the drop-list sign-up, information pages (about,
contact, how holds work, size and condition guide, draft policies), a home page that opens on the
newest-arrivals rail (or the next drop's countdown when one is scheduled) with category plates,
an availability filter with counts, and a delivery note beside the hold button. Lufimen.com was
reviewed for ideas; only its commerce mechanics were adopted.

Follow-up 2026-10-08, from the owner's Lufimen screenshots: the header now uses the familiar
layout (wordmark left, full menu with every category centred, search / holds bag / theme on the
right), the home page opens on a two-photo hero of the newest pieces with one headline and one
"Shop the archive" button, then a promise strip, the drop band when one is scheduled, a "New in"
carousel with edge arrows and a progress bar, and category tiles with "Shop polos" bars. A
floating WhatsApp button appears once the number is configured. The archive's look (paper, ink,
signal, square corners, mono labels, archive-number stickers) is kept throughout.

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
