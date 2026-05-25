"use client";

import {
  ArrowRight,
  CheckCircle2,
  Download,
  FileText,
  Globe2,
  Loader2,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { downloadReportPdf } from "@/lib/pdf";
import type { ReportData } from "@/lib/types";

const samples = [
  "https://www.nngroup.com/articles/",
  "https://openai.com/news/",
  "https://vercel.com/blog"
];

export default function Home() {
  const [url, setUrl] = useState("");
  const [report, setReport] = useState<ReportData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const generatedDate = useMemo(() => {
    if (!report) return "";
    return new Date(report.extractedAt).toLocaleString();
  }, [report]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setReport(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to analyze this URL.");
      }

      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to analyze this URL.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="flex items-center justify-between rounded-lg border bg-background/80 px-4 py-3 shadow-sm backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-semibold leading-tight">InsightPDF</p>
              <p className="text-xs text-muted-foreground">URL intelligence report builder</p>
            </div>
          </div>
          <ThemeToggle />
        </header>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="flex flex-col gap-6">
            <div className="py-6 sm:py-10">
              <div className="mb-4 inline-flex items-center gap-2 rounded-md border bg-card px-3 py-1 text-sm text-muted-foreground shadow-sm">
                <Sparkles className="h-4 w-4 text-secondary" />
                AI-powered webpage reporting
              </div>
              <h1 className="text-balance text-4xl font-semibold tracking-normal text-foreground sm:text-5xl">
                Turn public webpages into polished PDF reports.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
                Paste a public URL, extract the important content, generate a concise summary, and export a clean client-ready report.
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Analyze a URL</CardTitle>
                <CardDescription>
                  Works best with public articles, documentation, blogs, and company pages.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Input
                      type="url"
                      placeholder="https://example.com/article"
                      value={url}
                      onChange={(event) => setUrl(event.target.value)}
                      required
                    />
                    <Button type="submit" className="h-11 sm:w-36" disabled={loading}>
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          Analyze <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {samples.map((sample) => (
                      <button
                        key={sample}
                        type="button"
                        onClick={() => setUrl(sample)}
                        className="rounded-md border bg-background px-2.5 py-1.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      >
                        {new URL(sample).hostname.replace("www.", "")}
                      </button>
                    ))}
                  </div>
                </form>

                {error ? (
                  <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["Public URLs only", ShieldCheck],
                ["AI summary", Sparkles],
                ["PDF export", Download]
              ].map(([label, Icon]) => (
                <div key={label as string} className="rounded-lg border bg-card p-4 shadow-sm">
                  <Icon className="mb-3 h-5 w-5 text-secondary" />
                  <p className="text-sm font-medium">{label as string}</p>
                </div>
              ))}
            </div>
          </div>

          <section className="rounded-lg border bg-card p-4 shadow-soft sm:p-6">
            {loading ? (
              <LoadingState />
            ) : report ? (
              <div className="flex flex-col gap-5">
                <div className="flex flex-col justify-between gap-4 border-b pb-5 sm:flex-row sm:items-start">
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                      <Globe2 className="h-4 w-4" />
                      {report.sourceDomain}
                    </div>
                    <h2 className="text-2xl font-semibold tracking-normal">{report.title}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">{generatedDate}</p>
                  </div>
                  <Button type="button" onClick={() => downloadReportPdf(report)} className="sm:w-36">
                    <Download className="h-4 w-4" />
                    PDF
                  </Button>
                </div>

                <ReportSection title="Summary">
                  <p className="leading-7 text-muted-foreground">{report.summary}</p>
                </ReportSection>

                <ReportSection title="Key Insights">
                  <div className="grid gap-3">
                    {report.keyInsights.map((insight) => (
                      <div key={insight} className="flex gap-3 rounded-md border bg-background p-3">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                        <p className="text-sm leading-6">{insight}</p>
                      </div>
                    ))}
                  </div>
                </ReportSection>

                {report.headings.length > 0 ? (
                  <ReportSection title="Important Headings">
                    <div className="flex flex-wrap gap-2">
                      {report.headings.slice(0, 10).map((heading) => (
                        <span
                          key={heading}
                          className="rounded-md border bg-background px-3 py-1.5 text-sm text-muted-foreground"
                        >
                          {heading}
                        </span>
                      ))}
                    </div>
                  </ReportSection>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-3">
                  <Metric label="Words extracted" value={report.wordCount.toLocaleString()} />
                  <Metric label="Sections" value={report.sections.length.toString()} />
                  <Metric label="Mode" value={report.aiEnabled ? "AI" : "Fallback"} />
                </div>
              </div>
            ) : (
              <EmptyState />
            )}
          </section>
        </section>
      </div>
    </main>
  );
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-normal text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[620px] flex-col items-center justify-center rounded-md border border-dashed bg-background/60 p-8 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-md bg-muted">
        <FileText className="h-7 w-7 text-secondary" />
      </div>
      <h2 className="text-xl font-semibold">Your report preview will appear here</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        InsightPDF extracts public webpage content, organizes the important details, and prepares a downloadable PDF.
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-[620px] flex-col justify-center gap-4">
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-secondary" />
        <p className="font-medium">Extracting and building report...</p>
      </div>
      {[72, 90, 62, 84, 54].map((width, index) => (
        <div key={width} className="rounded-md border bg-background p-4">
          <div
            className="h-3 animate-pulse rounded bg-muted"
            style={{ width: `${width}%`, animationDelay: `${index * 90}ms` }}
          />
        </div>
      ))}
    </div>
  );
}
