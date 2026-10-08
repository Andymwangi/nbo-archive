# Handoff

Written 2026-10-08, mid-planning of checkout (modules 5 and 6). Everything below is committed and
pushed to `origin/main` except this file and `docs/research/research-notes.md`.

## Plan of record

`docs/roadmap.md` (order of work), `docs/status.md` (what exists and its limitations),
`docs/api.md` (every endpoint). Research: `docs/research/research-notes.md`.

## Done and verified

| Area | State |
|---|---|
| Modules 1-4 | Bootstrap, staff auth, catalogue (storefront + desk), holds (behind `HOLDS_ENABLED`) |
| Storefront shell | Live strip, familiar header (menu with categories, search, account, holds bag, theme), phone tab bar, ink footer with drop-list sign-up, info pages with draft policies, WhatsApp button (hidden until `CONTACT_WHATSAPP` set) |
| Home | Hero carousel of the 5 newest pieces, promise strip, drop band when scheduled, "New in" carousel, category tiles |
| Drop alerts | Sign-up with consent records (no sending yet) |
| Customer sign-in | Email one-time codes, httpOnly session cookie, `/account/sign-in`, `/account` |
| Tests at last run | API 251 passed; web 101 passed; build, lint, typecheck clean |

## Next: checkout (modules 5 and 6). Decisions already made by the owner

1. Delivery zones are managed from the desk and seeded from the Nairobi + Kiambu corridor research
   (section 4 of the research notes; the research must be re-run, its results never arrived).
   A zone without a fee is not offered. Never invent fees.
2. Pickup: one Pick Up Mtaani store in Nairobi, fee KES 0, details added by the owner.
3. Placing a hold requires a signed-in customer (email code); the 3-hold cap is per customer.
   This replaces the anonymous visitor cookie and closes the hold-hoarding loophole.
4. Payments: a mock provider now, with an M-Pesa Daraja STK Push integration built against the
   free sandbox and switched on once the owner has a Paybill/Till and production keys (the
   business is not yet registered).
5. When the M-Pesa prompt is sent, the hold extends by up to 5 minutes.
6. Desk: a basic orders list with status updates (packing, dispatched with tracking note,
   delivered) now; the full orders board in module 7.
7. Confirmation: emailed receipt to the customer plus a receipt page.

## Proposed build order (not started)

1. API: bind holds to customers (Hold.customer, cap per customer, holds endpoints read
   `X-Customer-Session`), update hold tests.
2. API: `apps/orders` with ShippingZone (name, region, areas[], fee_kes nullable, eta, kind
   delivery|pickup, pickup_details, position, is_active), Order (ORD-00001 numbering via the
   catalogue Sequence, customer, contact and address snapshot, zone and fee snapshot, subtotal,
   total, status machine pending_payment > paid > packing > dispatched > delivered, plus cancelled
   and expired, payment_due_at), OrderItem (hold one-to-one, piece and price snapshot), OrderEvent
   (status audit). Cancelling an unpaid order releases its holds; unpaid orders expire with their
   holds. Public tracker by order number + phone. Desk zone CRUD and order status endpoints.
3. Web: checkout page from `/hold`, zone picker, order tracker, receipt page, account order list,
   desk orders list.
4. API: `apps/payments` provider interface, mock provider, Daraja STK Push (sandbox) with callback
   validation, idempotent payment records, status re-query and a reconciliation beat task. Payment
   success marks the order paid, converts holds and claims pieces (claimed city and date), and
   emails the receipt.
5. Web: payment screens (waiting for PIN, cancelled, failed, timed out, paid).

## Working notes

- Owner rules: `~/.claude/CLAUDE.md` (plan first, ask in plain numbered text, no AI attribution in
  commits, verify by execution, self-audit after each task, research via Sonnet subagents).
- Ports: Postgres 5436, Redis 6381, API 8010, web 3010 (others are used by other projects).
- Windows: run Celery worker and beat as two processes; restart the worker after adding tasks.
- No Playwright: verify with build, tests and HTTP checks; the owner does visual checks.
- Next's data cache survives deploys: any new field on a cached public read must default in zod.
- Long bash heredocs in this environment can fail to parse; write files with the file tool or
  run edit scripts from the scratchpad instead.
