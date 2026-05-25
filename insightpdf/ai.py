from __future__ import annotations

import json
import os

from openai import OpenAI

from .models import ExtractedPage, ReportContent, Section


def create_report_content(page: ExtractedPage) -> ReportContent:
    if not os.getenv("OPENAI_API_KEY"):
        return _fallback_report(page)

    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    fallback = _fallback_report(page)

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.2,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": "Create concise business-friendly webpage report content. Return valid JSON only.",
                },
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "instructions": "Return summary, keyInsights array, and sections array with label/body. Do not invent facts.",
                            "url": page.url,
                            "title": page.title,
                            "description": page.description,
                            "headings": page.headings,
                            "searchResults": [link.to_dict() for link in page.search_results],
                            "moreInfoLinks": [link.to_dict() for link in page.more_info_links()],
                            "text": page.text,
                        }
                    ),
                },
            ],
        )
        parsed = json.loads(response.choices[0].message.content or "{}")
    except Exception:
        return fallback

    summary = _as_text(parsed.get("summary")) or fallback.summary
    key_insights = [_as_text(item) for item in parsed.get("keyInsights", []) if _as_text(item)][:6]
    sections = [
        Section(label=_as_text(item.get("label")), body=_as_text(item.get("body")))
        for item in parsed.get("sections", [])
        if isinstance(item, dict) and _as_text(item.get("label")) and _as_text(item.get("body"))
    ][:4]

    return ReportContent(
        summary=summary,
        key_insights=key_insights or fallback.key_insights,
        sections=sections or fallback.sections,
        ai_enabled=True,
    )


def _fallback_report(page: ExtractedPage) -> ReportContent:
    sentences = [sentence.strip() for sentence in page.text.replace("?", ".").replace("!", ".").split(".")]
    key_insights = [sentence for sentence in sentences if len(sentence) > 45][:5]
    if not key_insights:
        key_insights = ["InsightPDF found public information that can be used for a compact report."]

    more_links = page.more_info_links()
    sections = [
        Section("Source Overview", page.description or "The source page was analyzed for public visible information."),
        Section(
            "Main Topics",
            (
                f"Top public search results include {', '.join(link.label for link in page.search_results[:5])}."
                if page.search_results
                else ", ".join(page.headings[:6]) or "The page has limited headings, so the report uses available text and links."
            ),
        ),
        Section(
            "Find More Information",
            "; ".join(f"{index + 1}. {link.label} ({link.href})" for index, link in enumerate(more_links))
            or "No additional public links were available.",
        ),
        Section(
            "Content Notes",
            (
                "This page exposed limited readable body text, so InsightPDF used metadata, headings, and links."
                if page.low_text
                else f"InsightPDF extracted roughly {page.word_count:,} words from the public webpage."
            ),
        ),
    ]

    return ReportContent(
        summary=_fallback_summary(page.text),
        key_insights=key_insights,
        sections=sections,
        ai_enabled=False,
    )


def _fallback_summary(text: str) -> str:
    words = text.split()
    if not words:
        return "InsightPDF generated a compact report from the available public page signals."
    return " ".join(words[:95]) + ("..." if len(words) > 95 else "")


def _as_text(value) -> str:
    return value.strip() if isinstance(value, str) else ""
