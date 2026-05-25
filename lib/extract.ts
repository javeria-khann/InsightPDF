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
  text: string;
  wordCount: number;
  lowText: boolean;
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

  const notableLinks = $("a[href]")
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
    headings.join(". "),
    notableLinks.map((link) => `${link.label}: ${link.href}`).join(". ")
  ]
    .filter(Boolean)
    .join(". ");

  const bodyWordCount = articleText.split(/\s+/).filter(Boolean).length;
  const lowTextBody =
    bodyWordCount > 0 && notableLinks.length < 3 && articleText.length < 500 ? articleText : "";
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
