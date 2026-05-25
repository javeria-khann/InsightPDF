import { NextResponse } from "next/server";
import { createAiReport } from "@/lib/ai";
import { fetchAndExtract, validatePublicUrl } from "@/lib/extract";
import type { ReportData } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: string };
    const url = body.url?.trim();

    if (!url) {
      return NextResponse.json({ error: "A URL is required." }, { status: 400 });
    }

    const parsed = validatePublicUrl(url);
    const page = await fetchAndExtract(parsed.toString());
    const ai = await createAiReport(page, parsed.toString());

    const report: ReportData = {
      url: parsed.toString(),
      sourceDomain: parsed.hostname.replace(/^www\./, ""),
      title: page.title,
      description: page.description,
      summary: ai.summary,
      keyInsights: ai.keyInsights,
      headings: page.headings,
      notableLinks: page.notableLinks,
      searchResults: page.searchResults,
      sections: ai.sections,
      extractedAt: new Date().toISOString(),
      wordCount: page.wordCount,
      aiEnabled: ai.aiEnabled
    };

    return NextResponse.json(report);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Something went wrong while analyzing this URL.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
