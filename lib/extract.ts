import * as cheerio from "cheerio";

const MAX_TEXT_LENGTH = 12000;

export type ExtractedPage = {
  title: string;
  description: string;
  headings: string[];
  notableLinks: {
    label: string;
    href: string;
  }[];
  searchResults: SearchResult[];
  text: string;
  wordCount: number;
  lowText: boolean;
};

type SearchResult = {
  title: string;
  href: string;
  snippet: string;
};

export function validatePublicUrl(value: string) {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Enter a valid URL, including https:// or http://.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only public HTTP and HTTPS webpages are supported.");
  }

  const hostname = parsed.hostname.toLowerCase();
  const blockedHosts = ["localhost", "127.0.0.1", "0.0.0.0", "::1"];
  const privatePatterns = [
    /^10\./,
    /^192\.168\./,
    /^172\.(1[6-9]|2\d|3[0-1])\./
  ];

  if (blockedHosts.includes(hostname) || privatePatterns.some((pattern) => pattern.test(hostname))) {
    throw new Error("InsightPDF only analyzes public webpages.");
  }

  return parsed;
}

export async function fetchAndExtract(url: string): Promise<ExtractedPage> {
  const parsed = validatePublicUrl(url);
  const response = await fetch(parsed.toString(), {
    headers: {
      "User-Agent":
        "InsightPDF/1.0 (+portfolio project; extracts public webpage text for user-requested reports)",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9"
    },
    cache: "no-store",
    redirect: "follow"
  });

  if (!response.ok) {
    throw new Error(`The page returned ${response.status}. Try another public article or page.`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) {
    throw new Error("This URL does not appear to be an HTML webpage.");
  }

  const html = await decodeHtmlResponse(response);
  const $ = cheerio.load(html);

  $("script, style, noscript, svg, canvas, iframe, form, nav, footer, aside").remove();

  const searchQuery =
    parsed.hostname.includes("google.") && parsed.pathname === "/search"
      ? clean(parsed.searchParams.get("q") ?? "")
      : "";

  const title =
    (searchQuery ? `Google Search: ${searchQuery}` : "") ||
    clean($("meta[property='og:title']").attr("content")) ||
    clean($("title").first().text()) ||
    parsed.hostname;

  const description =
    clean($("meta[name='description']").attr("content")) ||
    clean($("meta[property='og:description']").attr("content")) ||
    "";

  const headings = $("h1, h2, h3")
    .map((_, el) => clean($(el).text()))
    .get()
    .filter(Boolean)
    .slice(0, 16);

  const rawNotableLinks = $("a[href]")
    .map((_, el) => {
      const label = clean($(el).text());
      const href = $(el).attr("href");
      if (!label || !href || label.length < 3 || looksMojibake(label)) {
        return null;
      }

      try {
        const absoluteHref = normalizeHref(new URL(href, parsed.toString()));
        return { label: label.slice(0, 140), href: absoluteHref };
      } catch {
        return null;
      }
    })
    .get()
    .filter((link, index, links) => {
      return (
        link &&
        !looksMojibake(link.label) &&
        !link.href.startsWith("javascript:") &&
        !link.href.startsWith("mailto:") &&
        links.findIndex((candidate) => candidate?.href === link.href) === index
      );
    })
    .slice(0, 12) as { label: string; href: string }[];

  const searchResults = searchQuery
    ? await getGoogleSearchResults(searchQuery, $, parsed.toString())
    : [];
  const notableLinks = searchQuery
    ? searchResults.map((result) => ({ label: result.title, href: result.href }))
    : rawNotableLinks;

  const articleText = clean(
    $("article").text() ||
      $("main").text() ||
      $("[role='main']").text() ||
      $("body").text()
  );

  const fallbackText = [
    title,
    description,
    searchQuery ? `Search query: ${searchQuery}` : "",
    searchQuery && searchResults.length === 0
      ? "Top Google results were not available from the public HTML response. Configure Google Programmable Search API keys for reliable top results."
      : "",
    searchResults
      .map((result, index) => `Result ${index + 1}: ${result.title}. ${result.snippet}. ${result.href}`)
      .join(". "),
    headings.join(". "),
    notableLinks.map((link) => `${link.label}: ${link.href}`).join(". ")
  ]
    .filter(Boolean)
    .join(". ");

  const bodyWordCount = articleText.split(/\s+/).filter(Boolean).length;
  const lowTextBody =
    !searchQuery && bodyWordCount > 0 && notableLinks.length < 3 && articleText.length < 500
      ? articleText
      : "";
  const text =
    bodyWordCount < 80
      ? [fallbackText || `Public webpage at ${parsed.hostname}`, lowTextBody]
          .filter(Boolean)
          .join(". ")
          .slice(0, MAX_TEXT_LENGTH)
      : articleText.slice(0, MAX_TEXT_LENGTH);
  const wordCount = text ? text.split(/\s+/).length : 0;

  return {
    title,
    description,
    headings,
    notableLinks,
    searchResults,
    text,
    wordCount,
    lowText: bodyWordCount < 80
  };
}

function clean(value?: string) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeHref(url: URL) {
  if (url.hostname.endsWith("facebook.com") && url.pathname === "/l.php") {
    const outbound = url.searchParams.get("u");
    if (outbound) {
      return outbound;
    }
  }

  return url.toString();
}

function looksMojibake(value: string) {
  return /[�ØÙÚÛà¤à¥à¦à¨]/.test(value);
}

async function getGoogleSearchResults(query: string, $: cheerio.CheerioAPI, baseUrl: string) {
  const apiResults = await getGoogleProgrammableSearchResults(query);
  if (apiResults.length > 0) {
    return apiResults;
  }

  return parseGoogleHtmlResults($, baseUrl);
}

async function getGoogleProgrammableSearchResults(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

  if (!apiKey || !searchEngineId) {
    return [];
  }

  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("cx", searchEngineId);
  url.searchParams.set("q", query);
  url.searchParams.set("num", "5");

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as {
      items?: { title?: string; link?: string; snippet?: string }[];
    };

    return (data.items ?? [])
      .map((item) => ({
        title: clean(item.title),
        href: clean(item.link),
        snippet: clean(item.snippet)
      }))
      .filter((item) => item.title && item.href)
      .slice(0, 5);
  } catch {
    return [];
  }
}

function parseGoogleHtmlResults($: cheerio.CheerioAPI, baseUrl: string): SearchResult[] {
  const results: SearchResult[] = [];

  $("a[href]").each((_, el) => {
    if (results.length >= 5) {
      return false;
    }

    const rawHref = $(el).attr("href");
    const title = clean($(el).text());
    if (!rawHref || !title || title.length < 8 || looksMojibake(title)) {
      return;
    }

    const href = extractGoogleResultHref(rawHref, baseUrl);
    if (!href || results.some((result) => result.href === href)) {
      return;
    }

    const hostname = new URL(href).hostname.replace(/^www\./, "");
    results.push({
      title: title.slice(0, 140),
      href,
      snippet: `Public result from ${hostname}`
    });
  });

  return results;
}

function extractGoogleResultHref(rawHref: string, baseUrl: string) {
  try {
    const url = new URL(rawHref, baseUrl);
    const candidate =
      url.pathname === "/url" ? url.searchParams.get("q") || url.searchParams.get("url") : url.toString();

    if (!candidate) {
      return "";
    }

    const resultUrl = new URL(candidate);
    const blockedHosts = ["google.com", "accounts.google.com", "support.google.com"];
    if (
      !["http:", "https:"].includes(resultUrl.protocol) ||
      blockedHosts.some((host) => resultUrl.hostname === host || resultUrl.hostname.endsWith(`.${host}`))
    ) {
      return "";
    }

    return resultUrl.toString();
  } catch {
    return "";
  }
}

async function decodeHtmlResponse(response: Response) {
  const bytes = await response.arrayBuffer();
  const contentType = response.headers.get("content-type") ?? "";
  const charset = contentType.match(/charset=([^;]+)/i)?.[1]?.trim();

  try {
    return new TextDecoder(charset || "utf-8").decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}
