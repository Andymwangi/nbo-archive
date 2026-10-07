import { HOLD_MINUTES, MAX_ACTIVE_HOLDS } from "@/lib/api/holds";

/*
  The information pages linked from the footer. Everything here is either a fact about how the
  archive works (taken from the brief and from how the system behaves) or is marked as waiting for
  the owner. Nothing is invented: where a fee, a window or a partner is not known yet, the page
  says so plainly instead of guessing.

  Pages with `draft: true` show a banner until the owner has reviewed and replaced the text.
*/

export type PageSection = {
  heading: string;
  paragraphs?: string[];
  list?: string[];
  /** Two-column rows, e.g. a size table. */
  rows?: [string, string][];
};

export type InfoPage = {
  eyebrow: string;
  title: string;
  lede: string;
  draft?: boolean;
  sections: PageSection[];
};

export const DRAFT_NOTE =
  "Draft, awaiting the owner's review. The details below will be confirmed before the shop takes payment online.";

const TO_CONFIRM = "To be confirmed by the owner.";

export const aboutPage: InfoPage = {
  eyebrow: "About",
  title: "An archive that happens to sell.",
  lede: "nboarchive is high-quality thrifted clothing, catalogued in Nairobi: polos, jackets, sweaters, hoodies and tees, mostly one of each.",
  sections: [
    {
      heading: "Every piece is an accession",
      paragraphs: [
        "Each garment gets an archive number, like NBO-0142, the day it is filed. The number never changes and is never reused, so a piece you saw on Instagram is always one search away.",
        "Before a piece goes on the rail it is inspected, cleaned and measured flat. Its condition is graded, and every flaw we find is listed and photographed close up.",
      ],
    },
    {
      heading: "Why it works this way",
      paragraphs: [
        "Thrift is bought without trying anything on. So the record has to do the work a fitting room would: real measurements, honest condition, the label and the fabric tag in the photos.",
        "Most pieces are one of one. When one is claimed it stays in the archive with a stamp, so you can see what has come through.",
      ],
    },
    {
      heading: "Accessions",
      paragraphs: [
        "New pieces arrive in numbered releases called accessions. Each one is announced with an opening time; join the drop list in the footer to hear when the next one opens.",
      ],
    },
  ],
};

export const holdsPage: InfoPage = {
  eyebrow: "Help",
  title: "How holds work",
  lede: "Every piece is one of one, so instead of a cart there is a hold: one tap keeps a piece for you while you pay.",
  sections: [
    {
      heading: "The basics",
      list: [
        `A hold lasts ${HOLD_MINUTES} minutes from the moment you tap Place on hold. The clock on the page counts down the time left.`,
        "While you hold a piece, nobody else can hold or buy it. Other visitors see it as on hold, with roughly when it comes back.",
        `You can hold up to ${MAX_ACTIVE_HOLDS} pieces at once.`,
        "Changed your mind? Tap Let it go and the piece goes straight back on the rail.",
        "If the time runs out, the piece goes back on the rail on its own.",
      ],
    },
    {
      heading: "Where your holds live",
      paragraphs: [
        "Your holds are tied to this browser, not to an account. The Holds page lists every piece you are holding and the time left on each; it is in the menu, and in the tab bar on a phone.",
      ],
    },
    {
      heading: "Paying",
      paragraphs: [
        "Paying online, by M-Pesa, opens in a coming update. Until then a hold keeps a piece off the rail for the time on its clock.",
      ],
    },
  ],
};

export const sizingPage: InfoPage = {
  eyebrow: "Help",
  title: "Size and condition guide",
  lede: "Thrifted tags are unreliable, so every piece is measured flat. Compare our numbers with a top you already own and it will fit the way you expect.",
  sections: [
    {
      heading: "How we measure",
      rows: [
        ["Chest", "Pit to pit: across the front, armpit seam to armpit seam, laid flat."],
        ["Length", "From the collar seam at the back of the neck straight down to the hem."],
        ["Shoulder", "Shoulder seam to shoulder seam across the back."],
        ["Sleeve", "From the shoulder seam to the end of the cuff."],
      ],
      paragraphs: ["All measurements are in centimetres, taken with the garment laid flat."],
    },
    {
      heading: "Compare with something you own",
      list: [
        "Pick a top that fits you the way you like.",
        "Lay it flat on a table, buttons or zip closed.",
        "Measure pit to pit and collar to hem the way we do.",
        "Compare with the numbers on the piece's record: the closer they are, the closer the fit.",
      ],
    },
    {
      heading: "Sizes by chest",
      paragraphs: [
        "The size filter in the archive uses the measured chest, not the tag. These bands are provisional while the owner confirms them.",
      ],
      rows: [
        ["XS", "under 48 cm"],
        ["S", "48 to 51 cm"],
        ["M", "52 to 55 cm"],
        ["L", "56 to 59 cm"],
        ["XL", "60 to 63 cm"],
        ["XXL", "64 cm and over"],
      ],
    },
    {
      heading: "Condition grades",
      rows: [
        ["Mint", "Looks unworn. No visible flaws."],
        ["Excellent", "Very light wear. Nothing noticeable at normal distance."],
        ["Good", "Honest wear: small flaws are listed and photographed."],
        [
          "Worn-in",
          "Visible character, such as fade or small marks. Priced accordingly, always fully disclosed.",
        ],
      ],
    },
  ],
};

export const policyPages = {
  shipping: {
    eyebrow: "Policies",
    title: "Shipping and delivery",
    lede: "We deliver within Kenya.",
    draft: true,
    sections: [
      {
        heading: "Where we deliver",
        paragraphs: [
          "Delivery is within Kenya only.",
          `Delivery zones, fees and how long each zone takes: ${TO_CONFIRM}`,
        ],
      },
      {
        heading: "Pickup",
        paragraphs: [`Whether a Nairobi pickup or meet-up point is offered: ${TO_CONFIRM}`],
      },
      {
        heading: "Tracking",
        paragraphs: [
          "Once online checkout opens, every order gets an order number you can use to follow it.",
        ],
      },
    ],
  },
  returns: {
    eyebrow: "Policies",
    title: "Returns and exchanges",
    lede: "Every piece is described, measured and photographed so you know exactly what is coming.",
    draft: true,
    sections: [
      {
        heading: "Before you buy",
        list: [
          "Check the measurements against a top you own (see the size and condition guide).",
          "Read the condition grade and every listed flaw; each one has a close-up photo.",
          "If something is unclear, ask before you hold or pay.",
        ],
      },
      {
        heading: "Returns and exchanges",
        paragraphs: [
          `Whether returns or exchanges are accepted, the window and the conditions: ${TO_CONFIRM}`,
        ],
      },
    ],
  },
  privacy: {
    eyebrow: "Policies",
    title: "Privacy",
    lede: "We keep as little about you as the shop needs, and nothing for advertising.",
    draft: true,
    sections: [
      {
        heading: "What we store",
        list: [
          "A random key in a cookie when you place a hold, so your holds stay yours. It is not linked to your name and page scripts cannot read it.",
          "A cookie that remembers whether you chose the light or dark theme.",
          "If you join the drop list: your WhatsApp number and/or email, when you agreed, and the wording you agreed to.",
          "The network address a request came from, used briefly to stop abuse such as repeated sign-up attempts.",
        ],
      },
      {
        heading: "What we do not do",
        list: [
          "No advertising trackers and no selling or sharing your details.",
          "Drop list messages are only about drops opening.",
        ],
      },
      {
        heading: "Your rights",
        paragraphs: [
          "Under Kenya's Data Protection Act 2019 you can ask what we hold about you, ask us to correct or delete it, and withdraw consent at any time. You can leave the drop list yourself below.",
          `Who to contact about your data: ${TO_CONFIRM}`,
        ],
      },
    ],
  },
  terms: {
    eyebrow: "Policies",
    title: "Terms",
    lede: "How buying from the archive works.",
    draft: true,
    sections: [
      {
        heading: "The pieces",
        list: [
          "Pieces are thrifted and mostly one of one. Photos, measurements, condition grade and listed flaws describe the actual garment you receive.",
          "Prices are in Kenyan shillings.",
        ],
      },
      {
        heading: "Holds",
        list: [
          `A hold reserves a piece for ${HOLD_MINUTES} minutes; it is not a purchase.`,
          `You can hold up to ${MAX_ACTIVE_HOLDS} pieces at once. A hold that runs out ends on its own.`,
        ],
      },
      {
        heading: "Orders, payment and delivery",
        paragraphs: [`Payment terms, cancellations and delivery responsibilities: ${TO_CONFIRM}`],
      },
    ],
  },
} satisfies Record<string, InfoPage>;

export type PolicySlug = keyof typeof policyPages;
