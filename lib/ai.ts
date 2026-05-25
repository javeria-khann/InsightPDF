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
    return {
      summary: ensureString(parsed.summary) || createFallbackSummary(page.text),
      keyInsights: ensureStringArray(parsed.keyInsights).slice(0, 6),
      sections: ensureSections(parsed.sections).slice(0, 4),
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
          page.headings.slice(0, 6).join(", ") ||
          "The page did not expose many clear headings, so the report focuses on body text."
      },
      {
        label: "Content Notes",
        body: `InsightPDF extracted roughly ${page.wordCount.toLocaleString()} words from the public webpage.`
      }
    ],
    aiEnabled: false
  };
}

function createFallbackSummary(text: string) {
  const words = text.split(/\s+/).slice(0, 95).join(" ");
  return `${words}${text.split(/\s+/).length > 95 ? "..." : ""}`;
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
