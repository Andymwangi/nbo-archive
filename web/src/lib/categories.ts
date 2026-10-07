/*
  The garment categories, in the order the archive lists them. A plain module with no
  dependencies, so client components (the header, the phone menu) can import it without pulling
  the API client and its schemas into the browser bundle.
*/
export const categories = ["polo", "jacket", "sweater", "hoodie", "tee"] as const;
export type Category = (typeof categories)[number];
