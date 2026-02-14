export type TranslateProvider = "libretranslate" | "mymemory" | "none";

type TranslateInput = {
  text: string;
  source: string;
  target: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeLocale(locale: string) {
  return locale.trim().toLowerCase().split("-")[0] || "en";
}

function getProvider(): TranslateProvider {
  const raw = (process.env.TRANSLATE_PROVIDER || "none").toLowerCase();
  if (raw === "libretranslate" || raw === "mymemory" || raw === "none") return raw;
  return "none";
}

async function translateWithLibreTranslate(input: TranslateInput) {
  const baseUrl = process.env.TRANSLATE_BASE_URL?.trim();
  if (!baseUrl) throw new Error("TRANSLATE_BASE_URL is missing for LibreTranslate.");

  const endpoint = `${baseUrl.replace(/\/+$/, "")}/translate`;
  const payload: Record<string, string> = {
    q: input.text,
    source: normalizeLocale(input.source),
    target: normalizeLocale(input.target),
    format: "text",
  };
  if (process.env.TRANSLATE_API_KEY?.trim()) payload.api_key = process.env.TRANSLATE_API_KEY.trim();

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`LibreTranslate failed (${response.status}): ${details || "unknown error"}`);
  }

  const data = (await response.json()) as { translatedText?: string };
  if (!data?.translatedText) throw new Error("LibreTranslate returned an empty translation.");
  return data.translatedText;
}

async function translateWithMyMemory(input: TranslateInput) {
  const source = normalizeLocale(input.source);
  const target = normalizeLocale(input.target);
  const url = new URL("https://api.mymemory.translated.net/get");
  url.searchParams.set("q", input.text);
  url.searchParams.set("langpair", `${source}|${target}`);

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`MyMemory failed (${response.status}): ${details || "unknown error"}`);
  }

  const data = (await response.json()) as {
    responseData?: { translatedText?: string };
    responseStatus?: number;
    responseDetails?: string;
  };
  if (data.responseStatus && data.responseStatus !== 200) {
    throw new Error(`MyMemory error: ${data.responseDetails || `status ${data.responseStatus}`}`);
  }
  const translated = data.responseData?.translatedText;
  if (!translated) throw new Error("MyMemory returned an empty translation.");
  return translated;
}

export async function translateText(input: TranslateInput) {
  const provider = getProvider();
  const source = normalizeLocale(input.source);
  const target = normalizeLocale(input.target);

  if (!input.text?.trim() || source === target || provider === "none") {
    return {
      provider,
      translatedText: input.text,
      translated: false,
    };
  }

  const translatedText =
    provider === "libretranslate"
      ? await translateWithLibreTranslate({ ...input, source, target })
      : await translateWithMyMemory({ ...input, source, target });

  return {
    provider,
    translatedText,
    translated: true,
  };
}

export async function translateTextBatch(
  texts: string[],
  source: string,
  target: string,
  delayMs = 220,
) {
  const results: string[] = [];
  const errors: string[] = [];

  for (const text of texts) {
    if (!text?.trim()) {
      results.push(text);
      continue;
    }

    try {
      const translated = await translateText({ text, source, target });
      results.push(translated.translatedText);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Unknown translation error");
      results.push(text);
    }

    await sleep(delayMs);
  }

  return { results, errors, provider: getProvider() };
}

export function getActiveTranslateProvider() {
  return getProvider();
}
