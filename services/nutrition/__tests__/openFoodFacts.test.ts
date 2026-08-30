/**
 * OPEN FOOD FACTS — the barcode rung.
 *
 * Three properties matter more than everything else in this file, and all three
 * are about a number that reaches a daily total:
 *
 *  1. UNITS. Open Food Facts stores every `_100g` field in grams; the app's
 *     panel is in label units. A missed ×1000 puts 0.5 mg of sodium where 500
 *     belongs, and nothing downstream would look wrong — the renal and
 *     hypertension diets are built on exactly that figure. Every factor is
 *     pinned here against `NUTRIENT_META`'s own declared unit.
 *
 *  2. NOTHING IS PROMOTED. A declared label is `branded`. No payload, however
 *     malformed or hostile, may produce a `usda` source or an fdcId, and an
 *     obviously half-transcribed label must land on a WEAKER rung, never a
 *     stronger one. Same invariant the USDA rung is held to in foodLookup.test.
 *
 *  3. IMPOSSIBLE NUMBERS ARE DROPPED, NOT CLAMPED. The characteristic
 *     crowd-data error is a misplaced decimal. Clamping 400 g of fat to 100
 *     would assert a figure nobody measured; dropping it leaves the nutrient
 *     honestly unknown, which the panel already models.
 *
 * The barcode checksum is tested too, because it is the cheapest correctness
 * gain in the feature: a misread caught on device is "try that scan again"
 * instead of "this product isn't in the database", which is a lie about the
 * database and sends the user down the wrong path.
 */
import { describe, expect, it } from "vitest";

import { NUTRIENT_META, type NutrientKey } from "../../../models/nutrients";
import {
  OFF_NUTRIENTS,
  candidateFromProduct,
  fetchBarcode,
  isPlausiblePer100g,
  isValidBarcode,
  normalizeBarcode,
  openFoodFactsUrl,
  panelFromNutriments,
  type FetchLike,
  type OffProduct,
} from "../OpenFoodFacts";

// ============================================================================
// BARCODES
// ============================================================================

describe("barcode validation", () => {
  // Real, checksum-valid codes.
  const VALID = [
    "5000112552126", // EAN-13
    "0012000161155", // EAN-13 (UPC-A with leading zero)
    "012000161155", // UPC-A, 12 digits
    "96385074", // EAN-8
    "00012000161155", // GTIN-14
  ];

  it.each(VALID)("accepts %s", (code) => {
    expect(isValidBarcode(code)).toBe(true);
  });

  it("strips separators before validating", () => {
    // A UPC-A printed on a package is routinely written in groups.
    expect(isValidBarcode("0 12000 16115 5")).toBe(true);
    expect(normalizeBarcode("0 12000-16115 5")).toBe("012000161155");
  });

  it("rejects a single transposed digit", () => {
    // The whole reason to run the checksum on device.
    expect(isValidBarcode("5000112552162")).toBe(false);
  });

  it("rejects a wrong check digit", () => {
    expect(isValidBarcode("5000112552127")).toBe(false);
  });

  it("rejects lengths that are not GS1 numeric formats", () => {
    // A QR code or Code-128 label scans fine and means nothing here.
    expect(isValidBarcode("123")).toBe(false);
    expect(isValidBarcode("1234567890")).toBe(false);
    expect(isValidBarcode("")).toBe(false);
    expect(isValidBarcode("ABCDEFGH")).toBe(false);
  });
});

// ============================================================================
// UNITS — the ×1000 that must never go missing
// ============================================================================

describe("nutrient unit conversion", () => {
  /**
   * Open Food Facts normalises to grams. So the factor for any key is fixed by
   * the unit the app declares for that same key: mg is 1000, mcg is 1e6, g is 1.
   * Deriving the expectation from NUTRIENT_META rather than restating the table
   * means this test disagrees with the map when either side changes.
   */
  const EXPECTED_BY_UNIT: Record<string, number> = { g: 1, mg: 1000, mcg: 1e6 };

  it.each(Object.entries(OFF_NUTRIENTS))(
    "%s converts grams into the unit the app declares",
    (key, spec) => {
      const unit = NUTRIENT_META[key as NutrientKey].unit;
      expect(
        spec!.factor,
        `${key} is declared in ${unit}; Open Food Facts stores grams, so the ` +
          `factor must be ${EXPECTED_BY_UNIT[unit]}`,
      ).toBe(EXPECTED_BY_UNIT[unit]);
    },
  );

  it("never maps a nutrient the app does not model", () => {
    for (const key of Object.keys(OFF_NUTRIENTS)) {
      expect(key in NUTRIENT_META).toBe(true);
    }
  });

  it("does not map alcohol or water", () => {
    // alcohol_100g is percent by volume, not grams — converting needs a density
    // assumption. water_100g is not populated for packaged goods. Both are
    // deliberately absent rather than guessed.
    expect(OFF_NUTRIENTS.alcohol).toBeUndefined();
    expect(OFF_NUTRIENTS.water).toBeUndefined();
  });

  it("reads a real panel in the app's units", () => {
    const panel = panelFromNutriments({
      "energy-kcal_100g": 380,
      proteins_100g: 8.2,
      carbohydrates_100g: 60,
      fat_100g: 11,
      "saturated-fat_100g": 4.5,
      fiber_100g: 6.1,
      sugars_100g: 22,
      sodium_100g: 0.42, // 420 mg
      calcium_100g: 0.35, // 350 mg
      iron_100g: 0.0082, // 8.2 mg
      "vitamin-d_100g": 0.0000042, // 4.2 mcg
      "vitamin-b12_100g": 0.0000021, // 2.1 mcg
      "vitamin-c_100g": 0.024, // 24 mg
    });

    expect(panel.calories).toBe(380);
    expect(panel.protein).toBeCloseTo(8.2, 5);
    expect(panel.sodium).toBeCloseTo(420, 5);
    expect(panel.calcium).toBeCloseTo(350, 5);
    expect(panel.iron).toBeCloseTo(8.2, 5);
    expect(panel.vitaminD).toBeCloseTo(4.2, 5);
    expect(panel.vitaminB12).toBeCloseTo(2.1, 5);
    expect(panel.vitaminC).toBeCloseTo(24, 5);
  });

  it("converts kilojoules when kcal is absent", () => {
    expect(panelFromNutriments({ "energy-kj_100g": 1590 }).calories).toBeCloseTo(
      380.02,
      1,
    );
  });

  it("refuses an ambiguous energy field with no unit", () => {
    // energy_100g alone could be either; a wrong guess is a 4.184x error.
    expect(panelFromNutriments({ energy_100g: 1590 }).calories).toBeUndefined();
    expect(
      panelFromNutriments({ energy_100g: 1590, energy_unit: "kJ" }).calories,
    ).toBeCloseTo(380.02, 1);
  });

  it("derives sodium from salt only when sodium is missing", () => {
    // European labels print salt, US labels print sodium; this is the single
    // most clinically important number the app tracks.
    const fromSalt = panelFromNutriments({ salt_100g: 1.25 });
    expect(fromSalt.sodium).toBeCloseTo(500, 5);

    // A declared sodium always wins over a derived one.
    const both = panelFromNutriments({ salt_100g: 1.25, sodium_100g: 0.3 });
    expect(both.sodium).toBeCloseTo(300, 5);
  });

  it("reads numerics stored as strings on older entries", () => {
    expect(panelFromNutriments({ "energy-kcal_100g": "250" }).calories).toBe(250);
  });
});

// ============================================================================
// IMPOSSIBLE NUMBERS
// ============================================================================

describe("plausibility gate", () => {
  it("rejects what physics rejects", () => {
    expect(isPlausiblePer100g("fat", 100)).toBe(true);
    expect(isPlausiblePer100g("fat", 400)).toBe(false);
    expect(isPlausiblePer100g("calories", 884)).toBe(true); // pure fat
    expect(isPlausiblePer100g("calories", 5000)).toBe(false);
    expect(isPlausiblePer100g("protein", -3)).toBe(false);
    expect(isPlausiblePer100g("calories", Number.NaN)).toBe(false);
    expect(isPlausiblePer100g("calories", Number.POSITIVE_INFINITY)).toBe(false);
  });

  it("has no ceiling for nutrients where any value is possible", () => {
    expect(isPlausiblePer100g("vitaminC", 10000)).toBe(true);
  });

  it("drops an implausible value instead of clamping it", () => {
    // Clamping would assert a figure nobody measured. Absent is honest.
    const panel = panelFromNutriments({
      "energy-kcal_100g": 250,
      fat_100g: 400,
      protein_100g: 10,
    });
    expect(panel.calories).toBe(250);
    expect(panel.fat).toBeUndefined();
  });

  it("drops a product whose energy figure is impossible", () => {
    const c = candidateFromProduct(
      { product_name: "Broken Entry", nutriments: { "energy-kcal_100g": 90000 } },
      "5000112552126",
    );
    expect(c).toBeNull();
  });
});

// ============================================================================
// NOTHING IS PROMOTED
// ============================================================================

const CEREAL: OffProduct = {
  code: "5000112552126",
  product_name: "Crunchy Oat Clusters",
  brands: "Northgate",
  serving_size: "45 g",
  serving_quantity: 45,
  nutriments: {
    "energy-kcal_100g": 380,
    fat_100g: 11,
    carbohydrates_100g: 60,
    proteins_100g: 8,
    sodium_100g: 0.42,
  },
};

describe("candidateFromProduct", () => {
  it("produces a branded source, never a measured reference one", () => {
    const c = candidateFromProduct(CEREAL, "5000112552126")!;
    expect(c.source.kind).toBe("branded");
    // The one direction with no recovery: a label must not become a lab assay.
    expect(c.source).not.toHaveProperty("fdcId");
    expect(JSON.stringify(c.source)).not.toContain("usda");
  });

  it("scales the panel to the declared serving weight", () => {
    const c = candidateFromProduct(CEREAL, "5000112552126")!;
    expect(c.servingGrams).toBe(45);
    expect(c.nutrients.calories).toBe(171); // 380 * 0.45
    expect(c.nutrients.protein).toBeCloseTo(3.6, 2);
    expect(c.nutrients.sodium).toBeCloseTo(189, 0);
    // per100g is kept so a different portion can rescale exactly.
    expect(c.per100g?.calories).toBe(380);
  });

  it("is measured when the package declares a serving weight", () => {
    expect(candidateFromProduct(CEREAL, "5000112552126")!.confidence).toBe(
      "measured",
    );
  });

  it("falls to portion-estimated when the serving weight is unknown", () => {
    const { serving_quantity: _drop, ...noServing } = CEREAL;
    const c = candidateFromProduct(noServing, "5000112552126")!;
    expect(c.confidence).toBe("portion-estimated");
    // 100 g is a real, honest serving — the food is still fully usable.
    expect(c.servingGrams).toBeNull();
    expect(c.nutrients.calories).toBe(380);
  });

  it("falls to macros-only when the label was half transcribed", () => {
    // Energy typed in, fat and carbs never entered. The numbers present are
    // probably right; claiming "measured" over them overstates what we know.
    const c = candidateFromProduct(
      {
        product_name: "Half-entered Snack",
        serving_quantity: 30,
        nutriments: { "energy-kcal_100g": 500, proteins_100g: 5 },
      },
      "5000112552126",
    )!;
    expect(c.confidence).toBe("macros-only");
  });

  it("rejects a product with no name and one with no energy", () => {
    expect(
      candidateFromProduct({ nutriments: { "energy-kcal_100g": 100 } }, "96385074"),
    ).toBeNull();
    expect(
      candidateFromProduct({ product_name: "Mystery", nutriments: {} }, "96385074"),
    ).toBeNull();
  });

  it("qualifies the name with the brand, without repeating it", () => {
    expect(candidateFromProduct(CEREAL, "5000112552126")!.name).toBe(
      "Crunchy Oat Clusters (Northgate)",
    );
    const own = candidateFromProduct(
      { ...CEREAL, product_name: "Northgate Oat Clusters" },
      "5000112552126",
    )!;
    expect(own.name).toBe("Northgate Oat Clusters");
  });

  it("carries the barcode so a re-scan resolves locally", () => {
    // The local-first rule for this ladder depends entirely on this field.
    expect(candidateFromProduct(CEREAL, "5000112552126")!.barcode).toBe(
      "5000112552126",
    );
  });

  it("ignores a pack size mis-parsed as a serving", () => {
    const c = candidateFromProduct(
      { ...CEREAL, serving_quantity: 5000 },
      "5000112552126",
    )!;
    expect(c.servingGrams).toBeNull();
    expect(c.confidence).toBe("portion-estimated");
  });
});

// ============================================================================
// FAILING WELL
// ============================================================================

/** A fetch that answers with one canned body. */
const stub = (status: number, body: unknown): FetchLike =>
  async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });

describe("fetchBarcode", () => {
  it("refuses an invalid code without touching the network", async () => {
    let called = false;
    const never: FetchLike = async () => {
      called = true;
      throw new Error("should not be called");
    };
    expect(await fetchBarcode("1234567890", { fetchImpl: never })).toEqual({
      status: "invalid",
    });
    expect(called).toBe(false);
  });

  it("maps a found product", async () => {
    const res = await fetchBarcode("5000112552126", {
      fetchImpl: stub(200, { status: 1, product: CEREAL }),
    });
    expect(res.status).toBe("ok");
    if (res.status === "ok") expect(res.candidate.name).toContain("Oat Clusters");
  });

  it("reports a missing product as not-found, on either signal", async () => {
    expect(
      (await fetchBarcode("5000112552126", { fetchImpl: stub(404, {}) })).status,
    ).toBe("not-found");
    expect(
      (
        await fetchBarcode("5000112552126", {
          fetchImpl: stub(200, { status: 0, status_verbose: "product not found" }),
        })
      ).status,
    ).toBe("not-found");
  });

  it("separates 'no usable nutrition' from 'not in the database'", async () => {
    // Different sentences, different next moves for someone in an aisle.
    const res = await fetchBarcode("5000112552126", {
      fetchImpl: stub(200, {
        status: 1,
        product: { product_name: "Photo Only", nutriments: {} },
      }),
    });
    expect(res.status).toBe("no-nutrition");
    if (res.status === "no-nutrition") expect(res.name).toBe("Photo Only");
  });

  it("never throws — a dead network becomes a status", async () => {
    const dead: FetchLike = async () => {
      throw new Error("Network request failed");
    };
    const res = await fetchBarcode("5000112552126", { fetchImpl: dead });
    expect(res.status).toBe("failed");
    if (res.status === "failed") expect(res.message).toContain("Network");
  });

  it("treats a server error as retryable rather than as a missing product", async () => {
    const res = await fetchBarcode("5000112552126", { fetchImpl: stub(503, {}) });
    expect(res.status).toBe("failed");
  });
});

describe("openFoodFactsUrl", () => {
  it("points at the public product page so the entry can be checked", () => {
    expect(openFoodFactsUrl("5000112552126")).toBe(
      "https://world.openfoodfacts.org/product/5000112552126",
    );
  });
});
