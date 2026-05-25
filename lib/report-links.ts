import type { ReportData } from "@/lib/types";

export type ReportLink = {
  label: string;
  href: string;
  description?: string;
};

export function getMoreInfoLinks(report: ReportData): ReportLink[] {
  const rankedSearchLinks = report.searchResults.map((result) => ({
    label: result.title,
    href: result.href,
    description: result.snippet
  }));

  const pageLinks = report.notableLinks.map((link) => ({
    label: link.label,
    href: link.href
  }));

  return [...rankedSearchLinks, ...pageLinks]
    .filter((link, index, links) => {
      return (
        link.label &&
        link.href &&
        links.findIndex((candidate) => candidate.href === link.href) === index
      );
    })
    .slice(0, 5);
}
