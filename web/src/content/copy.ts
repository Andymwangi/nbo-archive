/*
  Every user-facing string lives here so tone can be reviewed in one place.
  Voice: dry, curious, confident. Light Swahili/Sheng where it falls naturally, never forced.
*/

export const copy = {
  brand: {
    name: "nboarchive",
    backRoom: "Back room",
  },

  errors: {
    network: "Could not reach the archive. Check your connection and try again.",
    unexpected: "Something in the back room slipped. Try again in a moment.",
    throttled: "Too many tries in a short time. Give it a few minutes.",
    sessionEnded: "Your session ended. Reload the page and sign in again.",
  },

  login: {
    eyebrow: "Staff only",
    title: "The back room",
    lede: "Drop your staff email. We send a one-time link, valid for 15 minutes. No passwords to forget.",
    emailLabel: "Staff email",
    emailHint: "The address the owner added you with.",
    submit: "Send my link",
    submitting: "Sending",
    sentTitle: "Check your inbox",
    sentBody: (email: string) =>
      `If ${email} is on the staff list, a link is on its way. It works once. Open it on this phone or any other.`,
    sentAgain: "Use a different email",
    expired: "Your session ran out. Sign in again to pick up where you left off.",
    invalidEmail: "That does not look like an email address.",
  },

  verify: {
    eyebrow: "One-time link",
    title: "Karibu ndani.",
    lede: "One tap and you are in. The link stops working after this.",
    submit: "Open the back room",
    submitting: "Opening",
    missingToken: "This link is missing its key. Request a fresh one.",
    invalid: "This link has been used or has expired. Links work once, for 15 minutes.",
    retry: "Try again",
    requestNew: "Request a new link",
  },

  desk: {
    eyebrow: "Back room",
    greeting: (name: string) => (name ? `Sasa, ${name.split(" ")[0]}.` : "Sasa."),
    signedInAs: "Signed in as",
    signOut: "Sign out",
    denied: "That room is for the owner. Ask them if you need in.",
    sectionsTitle: "Rooms",
    staffRoom: "Staff",
    staffRoomNote: "Who has keys, and what each key opens.",
    nothingYetTitle: "More rooms are being fitted",
    nothingYetBody: "Listing, drops and orders open here as each one is finished.",
  },

  staff: {
    eyebrow: "Back room / Staff",
    title: "Staff",
    add: "Add staff",
    addTitle: "Hand out a key",
    addLede: "They get a sign-in link by email straight away.",
    nameLabel: "Name",
    emailLabel: "Email",
    phoneLabel: "Phone (optional)",
    phoneHint: "Kenyan mobile, e.g. 0712 345 678.",
    roleLabel: "Role",
    create: "Add and send link",
    creating: "Adding",
    created: (email: string) => `${email} added. Their link is on its way.`,
    roleDescriptions: {
      owner: "Everything, including staff and money.",
      editor: "Lists items, runs drops.",
      packer: "Sees paid orders, packs and dispatches.",
    },
    columns: { person: "Person", role: "Role", lastSeen: "Last in" },
    neverSignedIn: "Not yet",
    you: "you",
    inactive: "Key returned",
    changeRole: "Change role",
    save: "Save",
    deactivate: "Take key back",
    reactivate: "Give key back",
    empty: "Only you so far. Add the people who help you list and pack.",
    count: (n: number) => (n === 1 ? "1 person" : `${n} people`),
    gone: "That person is no longer on the list. Reload to see the current staff.",
    roleRequired: "Pick a role.",
    saved: "Saved.",
    selfRoleLocked: "Another owner can change your role.",
    deactivateLabel: (name: string) => `Take key back from ${name}`,
    reactivateLabel: (name: string) => `Give key back to ${name}`,
    roleLabelFor: (name: string) => `Role for ${name}`,
    previous: "Previous page",
    next: "Next page",
  },

  system: {
    notFoundEyebrow: "Not in the index",
    notFoundTitle: "No accession under that number.",
    notFoundBody: "Either it never existed or someone filed it somewhere strange.",
    notFoundBack: "Back to the archive",
    errorEyebrow: "Misfiled",
    errorTitle: "Something went wrong on our side.",
    errorBody: "It is not you. Try again; if it keeps happening, the team will see it.",
    retry: "Try again",
  },
} as const;
