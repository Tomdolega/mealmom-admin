import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const DEFAULTS = {
  country: "Poland",
  lang: "pl",
  pageSize: 100,
  pages: 1,
  delayMs: 250,
  max: null,
  dryRun: false,
};

function parseArgs(argv) {
  const args = { ...DEFAULTS };

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];

    if (key === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (key === "--country" && value) {
      args.country = value;
      i += 1;
      continue;
    }
    if (key === "--lang" && value) {
      args.lang = value;
      i += 1;
      continue;
    }
    if (key === "--page-size" && value) {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed > 0) args.pageSize = parsed;
      i += 1;
      continue;
    }
    if (key === "--pages" && value) {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed > 0) args.pages = parsed;
      i += 1;
      continue;
    }
    if (key === "--delay-ms" && value) {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed >= 0) args.delayMs = parsed;
      i += 1;
      continue;
    }
    if (key === "--max" && value) {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed > 0) args.max = parsed;
      i += 1;
    }
  }

  args.pageSize = Math.max(1, Math.min(Number(args.pageSize) || DEFAULTS.pageSize, 100));
  args.pages = Math.max(1, Number(args.pages) || DEFAULTS.pages);
  args.delayMs = Math.max(0, Number(args.delayMs) || DEFAULTS.delayMs);
  if (args.max !== null) args.max = Math.max(1, Number(args.max));

  return args;
}

const options = parseArgs(process.argv.slice(2));

function buildUrl(country, pageSize, page, lang) {
  return `https://world.openfoodfacts.org/cgi/search.pl?search_simple=1&action=process&tagtype_0=countries&tag_contains_0=contains&tag_0=${encodeURIComponent(
    country,
  )}&json=1&page_size=${pageSize}&page=${page}&lc=${encodeURIComponent(lang)}`;
}

function getProductName(product) {
  return product.product_name || product.product_name_pl || product.product_name_en || "Unnamed";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

async function run() {
  console.log(
    `Starting OFF seed: country=${options.country}, lang=${options.lang}, pageSize=${options.pageSize}, pages=${options.pages}, delayMs=${options.delayMs}, max=${options.max ?? "none"}, dryRun=${options.dryRun}`,
  );

  const supabase = options.dryRun ? null : makeSupabaseClient();

  let fetchedTotal = 0;
  let writtenTotal = 0;
  let pageFetched = 0;
  const allProducts = [];

  for (let page = 1; page <= options.pages; page += 1) {
    const url = buildUrl(options.country, options.pageSize, page, options.lang);
    console.log(`Request page ${page}: ${url}`);

    const res = await fetch(url, {
      headers: {
        "User-Agent": process.env.OFF_USER_AGENT || "MealMomAdmin/1.0 (email@example.com)",
      },
    });
    if (!res.ok) {
      throw new Error(`OFF request failed for page ${page}: ${res.status}`);
    }

    const data = await res.json();
    let products = Array.isArray(data.products) ? data.products : [];

    if (products.length === 0) {
      console.log(`Page ${page}: returned 0 products, stopping early.`);
      break;
    }

    if (options.max !== null) {
      const remaining = options.max - fetchedTotal;
      if (remaining <= 0) {
        console.log("Reached --max before processing this page, stopping.");
        break;
      }
      if (products.length > remaining) {
        products = products.slice(0, remaining);
      }
    }

    fetchedTotal += products.length;
    pageFetched += 1;
    allProducts.push(...products);

    console.log(`Page ${page}: returned ${products.length}, fetched total=${fetchedTotal}`);

    if (!options.dryRun) {
      const rows = products.map((p) => ({
        source: "openfoodfacts",
        external_id: p.id || p._id || p.code,
        country: options.country,
        lang: options.lang,
        name: getProductName(p),
        brand: p.brands || null,
        categories: p.categories || null,
        image_url: p.image_url || null,
        energy_kcal_100: p.nutriments?.energy_kcal_100g || null,
        protein_g_100: p.nutriments?.proteins_100g || null,
        fat_g_100: p.nutriments?.fat_100g || null,
        carbs_g_100: p.nutriments?.carbohydrates_100g || null,
        fiber_g_100: p.nutriments?.fiber_100g || null,
        salt_g_100: p.nutriments?.salt_100g || null,
        sugar_g_100: p.nutriments?.sugars_100g || null,
        raw: p,
      }));

      const { error } = await supabase
        .from("products_cache")
        .upsert(rows, { onConflict: "source,external_id,lang" });

      if (error) {
        console.error("Supabase error:", error);
        process.exit(1);
      }

      writtenTotal += rows.length;
      console.log(`Page ${page}: upserted ${rows.length}, running upserted total=${writtenTotal}`);
    } else {
      writtenTotal += products.length;
      console.log(`Page ${page}: dry-run, would upsert ${products.length}, running total=${writtenTotal}`);
    }

    if (options.max !== null && fetchedTotal >= options.max) {
      console.log(`Reached --max=${options.max}, stopping pagination.`);
      break;
    }

    if (page < options.pages && options.delayMs > 0) {
      await sleep(options.delayMs);
    }
  }

  const expected = options.pageSize * options.pages;
  const firstProductName = allProducts.length > 0 ? getProductName(allProducts[0]) : "-";
  const lastProductName = allProducts.length > 0 ? getProductName(allProducts[allProducts.length - 1]) : "-";

  console.log(`Pages fetched: ${pageFetched}`);
  console.log(`Expected pageSize*pages: ${expected}`);
  console.log(`Fetched total: ${fetchedTotal}`);
  console.log(`First product name: ${firstProductName}`);
  console.log(`Last product name: ${lastProductName}`);
  console.log(`Total upserted: ${writtenTotal}${options.dryRun ? " (dry-run)" : ""}`);
}

run().catch((error) => {
  console.error("Seed script failed:", error);
  process.exit(1);
});
