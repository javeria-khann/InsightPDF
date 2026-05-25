import * as cheerio from "cheerio";

const MAX_TEXT_LENGTH = 12000;

export type ExtractedPage = {
  title: string;
  description: string;
  headings: string[];
  text: string;
  wordCount: number;
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
      Accept: "text/html,application/xhtml+xml"
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

  const html = await response.text();
  const $ = cheerio.load(html);

  $("script, style, noscript, svg, canvas, iframe, form, nav, footer, aside").remove();

  const title =
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

  const articleText = clean(
    $("article").text() ||
      $("main").text() ||
      $("[role='main']").text() ||
      $("body").text()
  );

  const text = articleText.slice(0, MAX_TEXT_LENGTH);
  const wordCount = text ? text.split(/\s+/).length : 0;

  if (wordCount < 80) {
    throw new Error("Not enough readable text was found on this page.");
  }

  return {
    title,
    description,
    headings,
    text,
    wordCount
  };
}

function clean(value?: string) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}
