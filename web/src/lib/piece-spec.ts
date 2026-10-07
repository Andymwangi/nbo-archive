import type { Category } from "@/lib/api/catalog";

/*
  Garment rules the desk forms need, mirrored from api/apps/catalog/specs.py. The API is the
  authority and validates again; this copy only shapes the form and catches typos before a
  round trip.
*/

export const measurementKeys = ["chest", "length", "shoulder", "sleeve"] as const;
export type MeasurementKey = (typeof measurementKeys)[number];
export const MEASUREMENT_MIN_CM = 1;
export const MEASUREMENT_MAX_CM = 200;
export const EXTRA_TEXT_MAX = 80;

/** A list of accepted values, or null for short free text. */
export type ExtraSpec = readonly string[] | null;

export const categoryExtras: Record<Category, Record<string, ExtraSpec>> = {
  polo: {
    collar_condition: null,
    placket_condition: null,
    knit_type: ["pique", "jersey"],
  },
  jacket: {
    jacket_type: null,
    closure_condition: null,
    lining_condition: null,
    insulation: null,
  },
  sweater: {
    fibre: ["wool", "cotton", "acrylic", "blend"],
    pilling_level: ["none", "light", "moderate", "heavy"],
    neckline: ["crew", "v-neck", "quarter-zip", "cardigan"],
  },
  hoodie: {
    style: ["zip", "pullover"],
    hood_condition: null,
    print_condition: null,
    fleece_weight: null,
  },
  tee: {
    graphic: ["graphic", "plain"],
    print_condition: null,
    stitch: ["single", "double"],
  },
};

export const measurementField = (key: MeasurementKey) => `m_${key}`;
export const extraField = (key: string) => `x_${key}`;

type Parsed<T> = { value: T; errors: Record<string, string> };

/** Read `m_chest`... from a form. Blank fields are left out, which clears them on save. */
export function measurementsFromForm(form: FormData): Parsed<Record<string, number>> {
  const value: Record<string, number> = {};
  const errors: Record<string, string> = {};
  for (const key of measurementKeys) {
    const field = measurementField(key);
    const raw = String(form.get(field) ?? "").trim();
    if (!raw) continue;
    const number = Number(raw);
    if (!/^\d+$/.test(raw) || number < MEASUREMENT_MIN_CM || number > MEASUREMENT_MAX_CM) {
      errors[field] = `Whole centimetres, ${MEASUREMENT_MIN_CM} to ${MEASUREMENT_MAX_CM}.`;
      continue;
    }
    value[key] = number;
  }
  return { value, errors };
}

/** Read `x_<extra>` fields for one category. Blank fields are left out. */
export function extrasFromForm(category: Category, form: FormData): Parsed<Record<string, string>> {
  const value: Record<string, string> = {};
  const errors: Record<string, string> = {};
  for (const [key, choices] of Object.entries(categoryExtras[category])) {
    const field = extraField(key);
    const raw = String(form.get(field) ?? "").trim();
    if (!raw) continue;
    if (choices && !choices.includes(raw)) {
      errors[field] = "Pick one of the listed options.";
    } else if (raw.length > EXTRA_TEXT_MAX) {
      errors[field] = `Keep it under ${EXTRA_TEXT_MAX} characters.`;
    } else {
      value[key] = raw;
    }
  }
  return { value, errors };
}
