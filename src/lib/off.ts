const DEFAULT_OFF_BASE_URL = "https://world.openfoodfacts.org";
const DEFAULT_OFF_USER_AGENT = "MealMom/1.0 (tom@tomdolega.com)";

export type OffNutritionPer100g = {
  kcal: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carbs_g: number | null;
  sugar_g: number | null;
  fiber_g: number | null;
  salt_g: number | null;
};

export type OffSearchItem = {
  barcode: string;
  name: string;
  brands: string | null;
  quantity: string | null;
  nutriscore: string | null;
  nova: number | null;
  image_url: string | null;
  allergens: string[];
  categories: string[];
  nutrition_per_100g: OffNutritionPer100g;
  nutriments_raw: Record<string, unknown>;
};

export type OffProductCore = {
  barcode: string;
  name: string;
  brands: string | null;
  quantity: string | null;
  image_url: string | null;
  nutriscore: string | null;
  nova: number | null;
  categories: string[];
  allergens: string[];
  labels: string[];
  serving_size: string | null;
  nutrition_per_100g: OffNutritionPer100g;
};

export function getOffBaseUrl() {
  return process.env.OFF_BASE_URL || DEFAULT_OFF_BASE_URL;
}

export function getOffUserAgent() {
  return process.env.OFF_USER_AGENT || DEFAULT_OFF_USER_AGENT;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function splitCsv(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseNutriments(nutriments: Record<string, unknown> | null | undefined): OffNutritionPer100g {
  const data = nutriments || {};
  return {
    kcal: asNumber(data["energy-kcal_100g"] ?? data.energy_kcal_100g),
    protein_g: asNumber(data.proteins_100g),
    fat_g: asNumber(data.fat_100g),
    carbs_g: asNumber(data.carbohydrates_100g),
    sugar_g: asNumber(data.sugars_100g),
    fiber_g: asNumber(data.fiber_100g),
    salt_g: asNumber(data.salt_100g),
  };
}

export function simplifyOffSearchPayload(payload: unknown): OffSearchItem[] {
  const products = (payload as { products?: Array<Record<string, unknown>> })?.products || [];
  return products
    .map((product) => {
      const barcode = asString(product.code);
      if (!barcode) return null;
      return {
        barcode,
        name: asString(product.product_name_pl) || asString(product.product_name_en) || asString(product.product_name) || "Unknown product",
        brands: asString(product.brands),
        quantity: asString(product.quantity),
        nutriscore: asString(product.nutriscore_grade),
        nova: asNumber(product.nova_group),
        image_url: asString(product.image_front_small_url) || asString(product.image_small_url),
        allergens: splitCsv(product.allergens_tags || product.allergens),
        categories: splitCsv(product.categories_tags || product.categories),
        nutrition_per_100g: parseNutriments((product.nutriments || null) as Record<string, unknown> | null),
        nutriments_raw: ((product.nutriments || {}) as Record<string, unknown>),
      };
    })
    .filter((item): item is OffSearchItem => Boolean(item));
}

export function simplifyOffProductPayload(payload: unknown, barcode: string): OffProductCore | null {
  const product = (payload as { product?: Record<string, unknown> })?.product;
  if (!product) return null;

  return {
    barcode,
    name: asString(product.product_name_pl) || asString(product.product_name_en) || asString(product.product_name) || "Unknown product",
    brands: asString(product.brands),
    quantity: asString(product.quantity),
    image_url: asString(product.image_front_url) || asString(product.image_url),
    nutriscore: asString(product.nutriscore_grade),
    nova: asNumber(product.nova_group),
    categories: splitCsv(product.categories_tags || product.categories),
    allergens: splitCsv(product.allergens_tags || product.allergens),
    labels: splitCsv(product.labels_tags || product.labels),
    serving_size: asString(product.serving_size),
    nutrition_per_100g: parseNutriments((product.nutriments || null) as Record<string, unknown> | null),
  };
}

export async function fetchOffSearch(q: string, lc = "pl", page = 1, pageSize = 12) {
  const url = new URL(`${getOffBaseUrl().replace(/\/+$/, "")}/cgi/search.pl`);
  url.searchParams.set("search_terms", q);
  url.searchParams.set("search_simple", "1");
  url.searchParams.set("action", "process");
  url.searchParams.set("json", "1");
  url.searchParams.set("page_size", String(pageSize));
  url.searchParams.set("page", String(page));
  url.searchParams.set(
    "fields",
    "code,product_name,product_name_pl,product_name_en,brands,quantity,nutriscore_grade,nova_group,image_front_small_url,image_small_url,allergens_tags,categories_tags,nutriments",
  );
  url.searchParams.set("lc", lc);

  const response = await fetch(url.toString(), {
    headers: { "User-Agent": getOffUserAgent() },
    next: { revalidate: 0 },
  });
  if (!response.ok) throw new Error(`OFF search failed: ${response.status}`);
  return response.json();
}

export async function fetchOffProduct(barcode: string, lc = "pl") {
  const url = new URL(`${getOffBaseUrl().replace(/\/+$/, "")}/api/v2/product/${encodeURIComponent(barcode)}`);
  url.searchParams.set(
    "fields",
    "code,product_name,product_name_pl,product_name_en,brands,quantity,nutriscore_grade,nova_group,image_front_url,image_url,allergens_tags,categories_tags,labels_tags,serving_size,nutriments",
  );
  url.searchParams.set("lc", lc);

  const response = await fetch(url.toString(), {
    headers: { "User-Agent": getOffUserAgent() },
    next: { revalidate: 0 },
  });
  if (!response.ok) throw new Error(`OFF product failed: ${response.status}`);
  return response.json();
}
