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

## 4. Delivery zones for Nairobi and Kiambu (2026-10-08)

Confidence: the corridor groupings (A, B) come from the research model's knowledge of Nairobi
geography, not from web sources; county boundaries were not checked against an official map. Items
marked "check" are the least certain. Sections C and D come from thin web results. No fees here are
recommendations: fees are set by the owner.

### A. Nairobi metro, by corridor (CBD outward)

| # | Zone | Band | Areas | County notes / checks |
|---|---|---|---|---|
| 1 | CBD and surroundings | inner | CBD, Upper Hill, Ngara, Pangani, Hurlingham, Industrial Area, Eastleigh, Nairobi West | Nairobi. Check: Pangani and Eastleigh could sit under Thika Road or Juja Road |
| 2 | Thika Road | inner to middle | Muthaiga, Roysambu, Kasarani, Zimmerman, Githurai 44, Githurai 45, Mwiki, Clay City, Kahawa West, Kahawa Sukari, Mirema, Thome, Garden Estate | Nairobi. Mwiki and Clay City are reached via Thika Road / Kamiti Road. Kahawa West and Sukari straddle the Kiambu boundary |
| 3 | Eastlands (Jogoo Road and Outer Ring) | middle | Makadara, Buruburu, Donholm, Umoja, Kayole, Pipeline, Embakasi, Tena, Komarock, Savannah, Fedha, Nyayo Estate, Harambee | Nairobi. JKIA area is priced like this group |
| 4 | Kangundo Road | outer | Njiru, Ruai, Kamulu, Joska, Saika, Kayole North | Check: Kamulu and Joska may be in Machakos County though treated as Nairobi |
| 5 | Eastern Bypass | outer | Utawala, Mihango, Ruai (bypass side), Githunguri Estate | Nairobi. Ruai and Njiru straddle zones 4 and 5: pick one for shoppers |
| 6 | Mombasa Road | middle to outer | South B, South C, Imara Daima, Embakasi Village, Syokimau, Mlolongo, Athi River, Kitengela, Katani | South B/C and Imara Daima: Nairobi. Syokimau, Mlolongo, Athi River: Machakos. Kitengela: Kajiado (via Namanga Road) |
| 7 | Langata and Southern Bypass | middle to outer | Langata, Karen, Southlands, Hardy, Ongata Rongai, Kiserian | Langata, Karen: Nairobi. Rongai, Kiserian: Kajiado |
| 8 | Ngong Road | inner to outer | Kilimani, Kileleshwa, Lavington, Adams Arcade, Dagoretti, Kibera, Ngong town | Ngong town: Kajiado. Check: Ngong could sit under zone 7 |
| 9 | Waiyaki Way and Westlands | inner to middle | Westlands, Parklands, Kangemi, Mountain View, Uthiru | Nairobi. Kinoo and Kikuyu are under Kiambu (B3) |
| 10 | Limuru Road and Kiambu Road | middle | Gigiri, Runda, Muthaiga North, Ridgeways, Spring Valley | Nairobi. Runda straddles Kiambu. Thindigua and Kirigiti are under Kiambu (B2) |
| 11 | Juja Road (inner northeast) | inner | Mathare, Huruma, Kariobangi, Dandora, Kiamaiko | Nairobi. Check: Dandora and Kariobangi could sit under Eastlands |

### B. Kiambu County

| # | Zone | Band | Areas | Notes |
|---|---|---|---|---|
| 1 | Kiambu: Thika Road side | outer | Ruiru, Juja, Kahawa Wendani, Membley, Kimbo, Tatu City, Thika town | Kahawa Sukari borderline (listed under A2) |
| 2 | Kiambu: Kiambu Road side | middle to outer | Kiambu town, Ndenderu, Thindigua, Kirigiti, Ngewa | |
| 3 | Kiambu: Waiyaki Way and Nakuru highway | outer | Kikuyu, Kinoo, Regen, Muguga, Limuru, Gachie, Zambezi | |
| 4 | Kiambu: other residential | outer | Banana, Karuri, Ruaka, Githunguri, Gatundu, Ndumberi | Check: Ruaka is reached via Limuru Road and could sit under A10 |

### C. Pick Up Mtaani

A Kenyan delivery service for small online businesses with Android and iOS apps: 150+ collection
points, rider doorstep delivery, CBD shelf rental, pay on delivery and tracking
(https://new.pickupmtaani.com/, agents page https://new.pickupmtaani.com/agents). The homepage
mentions a 3-day collection period (FAQ not confirmed). The sender pays delivery in the app via
M-Pesa; no buyer-side fee is published. Ask Pick Up Mtaani for its current rate card and collection
rules before launch. The shop offers one Pick Up Mtaani point in Nairobi at KES 0 to the buyer.

### D. Price references (not pricing)

No current published courier rate cards were found (Sendy, Pick Up Mtaani, Fargo, G4S, Wells Fargo,
Glovo, Uber Connect). Old references only: Sendy in 2019 had about KES 250 base plus about KES 30
per km, later a flat KES 250 in Nairobi (https://hapakenya.com/2019/04/02/sendy-lowers-charges-by-80-in-a-bid-to-attract-and-retain-clients);
a supermarket's zoned delivery fees reported by Business Daily (undated) are not courier prices.
Get written quotes per zone from the shop's own riders.

Owner decisions: zones are managed from the desk and seeded with this grouping; a zone without a
fee is not offered at checkout; Nairobi pickup is one Pick Up Mtaani store at KES 0.
