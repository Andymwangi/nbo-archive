# Research notes

Collected 2026-10-07 to 2026-10-08 by research agents for the storefront redesign, customer
sign-in and checkout planning. Each section says how solid its evidence is; nothing here is a
substitute for the owner's own confirmation.

## 1. SMS one-time codes in Kenya (2026-10-08)

Confidence: low to medium. Africa's Talking's own verification (KYC) pages could not be retrieved;
most Kenya sender-ID detail comes from provider blogs, not the Communications Authority or
Safaricom.

- **The real paperwork is the sender ID, with any provider.** To send from a name such as
  NBOARCHIVE, Safaricom requires registration through a licensed content provider. Sources agree it
  typically needs a business registration or incorporation certificate, an authorisation letter,
  and trademark proof if the name is a product name. Safaricom reviews on Mondays and Thursdays;
  Airtel and Telkom take 7-14 working days.
  - Telerivet, Feb 2026: https://www.telerivet.com/blog/kenya-sms-sender-id-compliance-safaricom
  - Link Mobility, Apr 2026: https://docs.linkmobility.com/regulatory-guidelines/sender-id/kenya
  - Infobip LOA guidelines: https://www.infobip.com/docs/essentials/africa-registration/kenya-letter-of-authorization-loa-guidelines.md
- **Africa's Talking:** individual vs business document list not found. A 2020 help article quotes
  KES 7,500 + VAT (KES 8,700) one-off for a Safaricom + Airtel sender ID, paid via Paybill 525900
  (https://help.africastalking.com/en/articles/407085-how-do-i-set-up-my-sender-id-in-kenya-or-uganda).
  A snippet of their docs suggests the default sandbox sender only reaches Airtel numbers
  (unconfirmed). Price per SMS reported by third parties at about KES 0.50-1.00.
- **Celcom Africa** (Kenyan): self-reported KES 0.50 per SMS and 1-3 day sender approval
  (https://celcomafrica.com/pricing, https://celcomafrica.com/faqs.php).
- **Twilio / AWS:** about USD 0.31 per SMS to Kenya and no domestic sender-ID registration
  (AWS: international companies only). Poor fit.
- **Firebase Phone Auth:** Google sends from its own sender, so no sender-ID paperwork; needs the
  Blaze (billing) plan; Kenya price not found.
- **WhatsApp Cloud API:** needs Meta business verification; a reseller quotes about KES 1.12 per
  authentication message (possibly outdated).
- **Email codes:** free, no paperwork, live the same day.

Decision (owner, 2026-10-08): nboarchive is not yet a registered business. Customer sign-in launches
with email codes (Gmail SMTP for testing); SMS is added later behind the same flow. Enquiry emails
to Africa's Talking and Celcom Africa were drafted for the owner to send.

## 2. Lufimen.com (2026-10-07, plus owner screenshots 2026-10-08)

Lufimen is a Kenyan men's accessories store on Shopify. Commerce mechanics worth borrowing (all
adopted in the storefront): a one-line service announcement bar, categories in the header and as
image tiles with "Shop X" buttons, a product carousel with "View all", an availability filter with
counts, delivery and payment information beside the buy button, a contact block in the footer, and
a floating WhatsApp button. Not borrowed: repeated near-identical product rows, hype copy, rounded
navy/crimson styling, quantity buttons, testimonials without real buyers.

Lufimen's published shipping policy (useful reference for our own): Nairobi same day if ordered
before 6 PM, paid by M-Pesa or cash on delivery; outside Nairobi next day at KES 250-500, paid
before dispatch; free store pickup within 7 days; deliveries 10 am-7 pm Monday to Saturday.

## 3. Distinctive e-commerce heroes, headers and footers (2026-10-07)

Closest peer: Cream Archive (https://creamarchive.com), a vintage archive that sells in drops, with
the drop date in its announcement bar and an SMS drop sign-up in the footer. Other references:
Rokit (catalogue-first vintage), Aimé Leon Dore, Stüssy, Kith, Palace, Ranboo x basement.studio
(Awwwards). Performance guidance: the hero image is the LCP element; preload it, serve AVIF/WebP,
avoid client-rendered heroes. Visual design of these sites could not be observed (text-only fetch).

## 4. Delivery zones for Nairobi and Kiambu (PENDING)

A research agent was started on 2026-10-08 to group popular residential areas by road corridor.
Its results had not arrived when this file was written. Re-run it with this brief:

> Group Nairobi Metro and Kiambu County residential areas by the road corridor couriers use, for
> delivery zones. Owner's examples: Ruai, Utawala, Pipeline, Buruburu, Syokimau, Kitengela, Joska,
> Njiru, Mwiki. Corridors: CBD and surroundings; Thika Road; Outer Ring / Jogoo Road (Eastlands);
> Kangundo Road; Eastern Bypass; Mombasa Road (including Syokimau, Mlolongo, Athi River, Kitengela,
> noting Machakos and Kajiado counties); Langata Road / Southern Bypass (Karen, Rongai); Ngong Road
> (Kilimani, Kileleshwa, Lavington, Ngong); Waiyaki Way / Westlands (Kangemi, Uthiru, Kinoo);
> Limuru Road / Kiambu Road (Runda, Ridgeways, Thindigua); Juja Road (Dandora, Mathare, Huruma).
> Kiambu: Thika Road side (Ruiru, Juja, Kahawa Wendani/Sukari, Thika town); Kiambu Road side
> (Kiambu town, Ndenderu, Thindigua, Kirigiti); Waiyaki Way / Nakuru highway side (Kikuyu, Kinoo,
> Regen, Muguga, Limuru); others (Banana, Karuri, Githunguri, Gatundu). For each zone: name, county
> notes, distance band (inner/middle/outer), areas. Also: what Pick Up Mtaani is and its agent list,
> and any published Nairobi courier price bands (references only; never invent fees).

Owner decisions so far: zones are managed from the desk, seeded with this grouping; fees are set by
the owner (a zone without a fee is not offered at checkout). Nairobi pickup is one Pick Up Mtaani
store the owner will arrange, at KES 0 to the buyer.
