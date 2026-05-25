export type ReportData = {
  url: string;
  title: string;
  description: string;
  summary: string;
  keyInsights: string[];
  headings: string[];
  sections: {
    label: string;
    body: string;
  }[];
  extractedAt: string;
  wordCount: number;
  sourceDomain: string;
  aiEnabled: boolean;
};
