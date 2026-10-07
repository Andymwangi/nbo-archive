import { describe, expect, it } from "vitest";

import {
  archiveHref,
  countActiveFilters,
  parseArchiveFilters,
  pieceCardSchema,
} from "@/lib/api/catalog";

describe("parseArchiveFilters", () => {
  it("reads repeated and comma-separated values", () => {
    const filters = parseArchiveFilters({
      category: ["polo", "jacket"],
      size: "m",
      brand: "Lacoste, Fila",
      colour: ["Navy", "Navy"],
      sort: "-price",
      page: "3",
      include_claimed: "true",
    });
    expect(filters).toMatchObject({
      category: ["polo", "jacket"],
      size: ["m"],
      brand: ["Lacoste", "Fila"],
      colour: ["Navy"],
      sort: "-price",
      page: 3,
      includeClaimed: true,
    });
  });

  it("drops unknown and malformed values instead of failing", () => {
    const filters = parseArchiveFilters({
      category: ["polo", "trousers"],
      size: "huge",
      condition: "worn_in",
      sort: "random",
      page: "-2",
      drop: "abc",
      price_min: "1e3",
      price_max: "4500",
      include_claimed: "yes",
    });
    expect(filters).toEqual({
      category: ["polo"],
      size: [],
      condition: ["worn_in"],
      brand: [],
      colour: [],
      era: [],
      drop: undefined,
      priceMin: undefined,
      priceMax: 4500,
      includeClaimed: false,
      sort: "newest",
      page: 1,
    });
  });

  it("treats page zero as the first page", () => {
    expect(parseArchiveFilters({ page: "0" }).page).toBe(1);
  });
});

describe("archiveHref", () => {
  it("round-trips through the parser and leaves defaults out", () => {
    const filters = parseArchiveFilters({
      category: ["tee"],
      size: ["s", "m"],
      era: "1990s",
      sort: "number",
      page: "2",
    });
    const href = archiveHref(filters);
    expect(href).toBe("/archive?category=tee&size=s&size=m&era=1990s&sort=number&page=2");

    const params = new URL(href, "http://x").searchParams;
    const back = parseArchiveFilters(
      Object.fromEntries([...new Set(params.keys())].map((key) => [key, params.getAll(key)])),
    );
    expect(back).toEqual(filters);
  });

  it("is the bare archive when nothing is set", () => {
    expect(archiveHref(parseArchiveFilters({}))).toBe("/archive");
  });

  it("counts every active filter but not sort or page", () => {
    const filters = parseArchiveFilters({
      category: ["tee", "polo"],
      price_min: "1000",
      include_claimed: "true",
      sort: "price",
      page: "4",
    });
    expect(countActiveFilters(filters)).toBe(4);
  });
});

describe("pieceCardSchema", () => {
  const card = {
    archive_no: "NBO-0142",
    title: "Navy pique polo",
    category: "polo",
    brand: "Lacoste",
    tagged_size: "L",
    chest_band: "",
    colour: "Navy",
    era: "",
    condition_grade: "excellent",
    price_kes: 2800,
    status: "live",
    drop_number: null,
    published_at: "2026-10-01T09:00:00+03:00",
    is_placeholder: true,
    cover: null,
  };

  it("accepts a piece with no chest band, era or cover", () => {
    expect(pieceCardSchema.parse(card).archive_no).toBe("NBO-0142");
  });

  it("rejects statuses the public API never sends", () => {
    expect(pieceCardSchema.safeParse({ ...card, status: "draft" }).success).toBe(false);
  });
});
