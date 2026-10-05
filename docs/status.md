# Status

Updated: 2026-10-05

## Module progress

| # | Module | Backend | Web | Notes |
|---|---|---|---|---|
| 1 | Bootstrap (settings, Swagger, Celery, error envelope, health) | Done | -- | |
| 2 | Auth (magic link, JWT, admin users, roles) | Done | Pending | Next: web foundation + admin login |
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

## Known limitations

- Per-address magic-link cap (3 per 15 minutes) is a count check, not a lock; two simultaneous
  requests can both pass it. IP throttling (5/hour) bounds the impact.
- Client IP is read from REMOTE_ADDR. Behind a production proxy this needs trusted
  X-Forwarded-For handling, configured when hosting is chosen.
