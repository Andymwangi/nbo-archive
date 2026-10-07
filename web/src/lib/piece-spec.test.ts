import { describe, expect, it } from "vitest";

import { categories } from "@/lib/api/catalog";
import { categoryExtras, extrasFromForm, measurementsFromForm } from "@/lib/piece-spec";

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

describe("measurementsFromForm", () => {
  it("keeps whole centimetres and leaves blanks out", () => {
    const { value, errors } = measurementsFromForm(
      form({ m_chest: " 55 ", m_length: "72", m_shoulder: "", m_sleeve: "" }),
    );
    expect(value).toEqual({ chest: 55, length: 72 });
    expect(errors).toEqual({});
  });

  it.each(["54.5", "0", "201", "abc", "-3", "1e2"])("rejects %s", (raw) => {
    const { value, errors } = measurementsFromForm(form({ m_chest: raw }));
    expect(value).toEqual({});
    expect(errors.m_chest).toBeDefined();
  });

  it("accepts the range edges", () => {
    expect(measurementsFromForm(form({ m_chest: "1", m_sleeve: "200" })).value).toEqual({
      chest: 1,
      sleeve: 200,
    });
  });
});

describe("extrasFromForm", () => {
  it("reads only the category's own fields", () => {
    const { value, errors } = extrasFromForm(
      "polo",
      form({ x_knit_type: "pique", x_collar_condition: " Crisp ", x_fibre: "wool" }),
    );
    expect(value).toEqual({ knit_type: "pique", collar_condition: "Crisp" });
    expect(errors).toEqual({});
  });

  it("rejects values outside a choice list and over-long text", () => {
    const { errors } = extrasFromForm("sweater", form({ x_fibre: "silk", x_neckline: "crew" }));
    expect(Object.keys(errors)).toEqual(["x_fibre"]);
    const long = extrasFromForm("jacket", form({ x_jacket_type: "x".repeat(81) }));
    expect(long.errors.x_jacket_type).toBeDefined();
  });

  it("covers every category", () => {
    for (const category of categories) {
      expect(Object.keys(categoryExtras[category]).length).toBeGreaterThan(0);
    }
  });
});
