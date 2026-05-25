import OpenAI from "openai";
import type { ExtractedPage } from "@/lib/extract";

export type AiReport = {
  summary: string;
  keyInsights: string[];
  sections: {
    label: string;
    body: string;
  }[];
  aiEnabled: boolean;
};

export async function createAiReport(page: ExtractedPage, url: string): Promise<AiReport> {
  if (!process.env.OPENAI_API_KEY) {
    return createFallbackReport(page);
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You turn webpage text into concise business-friendly PDF report content. Return valid JSON only."
      },
      {
        role: "user",
        content: JSON.stringify({
          instructions:
            "Create a concise report with summary, 5 key insights, and 3 organized sections. Avoid invented facts.",
          url,
          title: page.title,
          description: page.description,
          headings: page.headings,
          notableLinks: page.notableLinks,
          searchResults: page.searchResults,
          contentNote: page.lowText
            ? "This page has limited readable body text, so rely on metadata, headings, search results, and public links without inventing facts."
            : "This page has readable body text.",
          text: page.text
        })
      }
    ]
  });

  const raw = completion.choices[0]?.message.content;
  if (!raw) {
    return createFallbackReport(page);
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AiReport>;
    const fallback = createFallbackReport(page);
    const keyInsights = ensureStringArray(parsed.keyInsights).slice(0, 6);
    const sections = ensureSections(parsed.sections).slice(0, 4);

    return {
      summary: ensureString(parsed.summary) || createFallbackSummary(page.text),
      keyInsights: keyInsights.length > 0 ? keyInsights : fallback.keyInsights,
      sections: sections.length > 0 ? sections : fallback.sections,
      aiEnabled: true
    };
  } catch {
    return createFallbackReport(page);
  }
}

function createFallbackReport(page: ExtractedPage): AiReport {
  const sentences = page.text.match(/[^.!?]+[.!?]+/g) ?? [page.text];
  const keyInsights = sentences
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 45)
    .slice(0, 5);

  return {
    summary: createFallbackSummary(page.text),
    keyInsights:
      keyInsights.length > 0
        ? keyInsights
        : ["The webpage contains extractable public content ready for report generation."],
    sections: [
      {
        label: "Source Overview",
        body: page.description || "The source page was analyzed for its visible public content."
      },
      {
        label: "Main Topics",
        body:
          page.searchResults.length > 0
            ? `Top public search results include ${page.searchResults
                .slice(0, 5)
                .map((result) => result.title)
                .join(", ")}.`
            : page.headings.slice(0, 6).join(", ") ||
              "The page did not expose many clear headings, so the report focuses on body text."
      },
      {
        label: "Search Results",
        body:
          page.searchResults
            .slice(0, 5)
            .map((result, index) => `${index + 1}. ${result.title} (${result.href})`)
            .join("; ") ||
          "No ranked Google results were available from the response. Add Google Programmable Search API keys for reliable top 5 results."
      },
      {
        label: "Page Headings",
        body:
          page.headings.slice(0, 6).join(", ") ||
          "The page did not expose many clear headings, so the report focuses on body text."
      },
      {
        label: "Content Notes",
        body: page.lowText
          ? `This page exposed limited readable body text, so InsightPDF used available metadata, headings, and public links to build the report.`
          : `InsightPDF extracted roughly ${page.wordCount.toLocaleString()} words from the public webpage.`
      },
      {
        label: "Notable Public Links",
        body:
          page.notableLinks
            .slice(0, 5)
            .map((link) => `${link.label} (${link.href})`)
            .join("; ") || "No notable public links were found on the page."
      }
    ],
    aiEnabled: false
  };
}

function createFallbackSummary(text: string) {
  const words = text.split(/\s+/).slice(0, 95).join(" ");
  return words
    ? `${words}${text.split(/\s+/).length > 95 ? "..." : ""}`
    : "InsightPDF found limited public information on this page, but still generated a compact report from available signals.";
}

function ensureString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function ensureStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => ensureString(item)).filter(Boolean)
    : [];
}

function ensureSections(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => ({
      label: ensureString((item as { label?: unknown }).label),
      body: ensureString((item as { body?: unknown }).body)
    }))
    .filter((item) => item.label && item.body);
}
