# Signature moments

One distinctive layout or interaction per page, borrowed from archive and print culture rather
than from other shops. Each entry names the page, the moment, where it is borrowed from, and the
component that carries it. Provisional until the owner reviews the pages at 390, 768 and 1440 px.

## Navigation: the card-catalogue drawer front

- **Moment:** the header is a drawer front. Sections are file tabs along its bottom edge; the open
  tab sits forward and joins the page, the others sit back on darker stock. Where the drawer pull
  would be is the archive-number jump: type `142` and land on `NBO-0142`.
- **Borrowed from:** library card-catalogue drawers and their typed label holders.
- **Carried by:** `components/layout/IndexNav.tsx`, `components/layout/ArchiveJump.tsx`,
  `app/jump/route.ts`. The jump is a plain GET form and works without JavaScript.
- **Avoids:** the sticky blurred top bar. The header scrolls away with the page.

## Latest (`/`): the register opened at its last entry

- **Moment:** the page opens on the newest piece, its archive number set at wall-label scale
  beside the photograph, as if just stencilled. When an accession is scheduled, its clock sits on
  a ruled line underneath. The pieces filed before it follow as a contact sheet.
- **Borrowed from:** museum accession registers and crate stencils.
- **Carried by:** `app/(shop)/page.tsx`, `components/archive/ArchiveNumber.tsx`.
- **Avoids:** the centred hero with a slogan and two buttons.

## Archive (`/archive`): the contact sheet with grease pencil

- **Moment:** pieces are frames on a contact sheet. Frames keep their order and numbers, prints
  vary in proportion and stand on a shared baseline, and the editor's marks stay on the sheet:
  frames filed in the last 7 days have their number circled in signal ink, claimed frames are
  crossed through corner to corner and stamped.
- **Borrowed from:** photographers' contact sheets marked up with a china marker.
- **Carried by:** `components/archive/ContactSheetGrid.tsx`, `components/archive/ClaimedStamp.tsx`.
  Filters live in a drawer (`FilterDrawer.tsx`) that is a GET form, so every view has a URL;
  sort, active filters and paging are plain links (`ArchiveControls.tsx`).
- **Avoids:** identical cards in a uniform grid, hover-scale on images. Frames are not reordered
  to fill gaps, because that would scramble the frame numbers.

## Item (`/item/[archiveNo]`): the object file

- **Moment:** the record reads like a museum object file. The label card is label stock with a
  punched corner and one fact per ruled line; the price is a sticker stuck on slightly crooked,
  the only place signal ink appears as a fill. Measurements are drawn as tape lines to scale
  against the longest, so the garment's shape reads before the numbers. Flaws are numbered
  exhibits beside their close-ups. A claimed piece keeps the whole record under a large stamp
  that says where it went.
- **Borrowed from:** museum wall labels, condition reports, tailors' tape.
- **Carried by:** `components/archive/LabelCard.tsx`, `MeasurementTable.tsx`, `FlawGallery.tsx`,
  `PhotoSheet.tsx`.
- **Avoids:** the swipe carousel (every photo is on the page, captioned with what it shows) and
  the size-guide modal (measurements are on the record).

## Accessions (`/drops`): the ledger

- **Moment:** each release is one ruled line in a register, its two-digit number set large in
  the margin like a hand-numbered entry. A scheduled one is numbered in signal ink and carries a
  departures-board clock on the same line.
- **Borrowed from:** accession ledgers, station departure boards.
- **Carried by:** `app/(shop)/drops/page.tsx`, `components/archive/DropCountdown.tsx`.

## Accession (`/drops/[number]`): the sealed drawer

- **Moment:** before release the page shows the register entry, the clock and how many pieces are
  filed inside, but not the pieces. At the release time the drawer opens to the full contact
  sheet, claimed pieces included, as the permanent record of the batch.
- **Borrowed from:** sealed archive boxes with an opening date.
- **Carried by:** `app/(shop)/drops/[number]/page.tsx`, `components/archive/DropHeader.tsx`.
