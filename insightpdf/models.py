from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from urllib.parse import urlparse


@dataclass
class Link:
    label: str
    href: str
    description: str = ""

    def to_dict(self) -> dict[str, str]:
        return {
            "label": self.label,
            "href": self.href,
            "description": self.description,
        }


@dataclass
class Section:
    label: str
    body: str

    def to_dict(self) -> dict[str, str]:
        return {"label": self.label, "body": self.body}


@dataclass
class ReportContent:
    summary: str
    key_insights: list[str]
    sections: list[Section]
    ai_enabled: bool


@dataclass
class ExtractedPage:
    url: str
    title: str
    description: str
    headings: list[str]
    notable_links: list[Link]
    search_results: list[Link]
    text: str
    word_count: int
    low_text: bool
    source_domain: str = field(init=False)

    def __post_init__(self) -> None:
        host = urlparse(self.url).hostname or ""
        self.source_domain = host.removeprefix("www.")

    def more_info_links(self) -> list[Link]:
        links = [*self.search_results, *self.notable_links]
        seen: set[str] = set()
        unique: list[Link] = []
        for link in links:
            if not link.href or link.href in seen:
                continue
            seen.add(link.href)
            unique.append(link)
            if len(unique) == 5:
                break
        return unique

    def to_report(self, content: ReportContent) -> dict:
        return {
            "url": self.url,
            "title": self.title,
            "description": self.description,
            "summary": content.summary,
            "keyInsights": content.key_insights,
            "headings": self.headings,
            "notableLinks": [link.to_dict() for link in self.notable_links],
            "searchResults": [link.to_dict() for link in self.search_results],
            "moreInfoLinks": [link.to_dict() for link in self.more_info_links()],
            "sections": [section.to_dict() for section in content.sections],
            "extractedAt": datetime.now(timezone.utc).isoformat(),
            "wordCount": self.word_count,
            "sourceDomain": self.source_domain,
            "aiEnabled": content.ai_enabled,
        }
