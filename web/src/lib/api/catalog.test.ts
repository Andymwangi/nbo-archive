import { describe, expect, it, vi } from "vitest";

import {
  archiveHref,
  countActiveFilters,
  getPiece,
  parseArchiveFilters,
  pieceCardSchema,
  pieceSchema,
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
      availability: ["on_hold", "lost"],
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
      availability: ["on_hold"],
      sort: "newest",
      page: 1,
    });
  });

  it("treats page zero as the first page", () => {
    expect(parseArchiveFilters({ page: "0" }).page).toBe(1);
  });
});

describe("archiveHref", () => {
  it("keeps availability choices in the link and counts them as filters", () => {
    const filters = parseArchiveFilters({ availability: ["on_rail", "claimed"] });
    expect(archiveHref(filters)).toBe("/archive?availability=on_rail&availability=claimed");
    expect(countActiveFilters(filters)).toBe(2);
  });

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

describe("pieceSchema", () => {
  const record = {
    archive_no: "NBO-0142",
    title: "Navy pique polo",
    category: "polo",
    brand: "Lacoste",
    tagged_size: "L",
    chest_band: "l",
    colour: "Navy",
    era: "",
    condition_grade: "excellent",
    price_kes: 2800,
    status: "held",
    published_at: "2026-10-01T09:00:00+03:00",
    is_placeholder: false,
    fit_note: "",
    fabric_composition: "100% cotton",
    measurements: { chest: 57 },
    category_extras: {},
    cleaned_at: null,
    provenance_note: "",
    drop: null,
    images: [],
    flaws: [],
    claimed: null,
    related: [],
  };

  it("reads when a held piece comes back", () => {
    const parsed = pieceSchema.parse({ ...record, hold: { expires_at: "2026-10-07T12:15:00Z" } });
    expect(parsed.hold?.expires_at).toBe("2026-10-07T12:15:00Z");
  });

  it("still reads a cached record written before holds existed", () => {
    expect(pieceSchema.parse(record).hold).toBeNull();
  });
});

describe("getPiece", () => {
  it("tags the canonical archive number whatever spelling it is asked for", async () => {
    vi.stubEnv("API_INTERNAL_URL", "http://api:8000");
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: { code: "not_found", message: "Not found." } }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    for (const spelling of ["142", "nbo-0142", "NBO-0142"]) {
      expect(await getPiece(spelling)).toBeNull();
    }
    const tags = fetchMock.mock.calls.map(
      (call) => (call as unknown as [string, { next: { tags: string[] } }])[1].next.tags,
    );
    expect(tags).toEqual(Array(3).fill(["catalog", "piece:NBO-0142"]));
  });
});
