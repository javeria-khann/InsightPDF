export type ReportData = {
  url: string;
  title: string;
  description: string;
  summary: string;
  keyInsights: string[];
  headings: string[];
  notableLinks: {
    label: string;
    href: string;
  }[];
  searchResults: {
    title: string;
    href: string;
    snippet: string;
  }[];
  sections: {
    label: string;
    body: string;
  }[];
  extractedAt: string;
  wordCount: number;
  sourceDomain: string;
  aiEnabled: boolean;
};
