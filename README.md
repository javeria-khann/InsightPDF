# InsightPDF

InsightPDF is an AI-powered SaaS-style web app that accepts a public URL, extracts important webpage content, summarizes it, and generates a clean downloadable PDF report.

## Features

- Public URL input and validation
- Webpage text and heading extraction with Cheerio
- Compact reports for low-text public pages using metadata and notable links
- Top 5 Google results for Google Search URLs when Google Search API keys are configured
- OpenAI-powered summaries and key insights
- Fallback report generation when no API key is configured
- Downloadable PDF reports with `pdf-lib`
- Responsive dashboard UI with Tailwind CSS and shadcn-style components
- Dark and light mode
- Loading states and error handling

## Tech Stack

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui-style reusable components
- OpenAI API
- Cheerio
- pdf-lib

## Getting Started

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env.local
```

Add your OpenAI key:

```bash
OPENAI_API_KEY=your_openai_api_key_here
```

Optional: add Google Programmable Search keys for reliable top-result reports from Google Search URLs:

```bash
GOOGLE_SEARCH_API_KEY=your_google_custom_search_api_key_here
GOOGLE_SEARCH_ENGINE_ID=your_google_programmable_search_engine_id_here
```

Run the app:

```bash
npm run dev
```

Open:

```bash
http://localhost:3000
```

## Safety Notes

InsightPDF only accepts public `http` and `https` URLs. It rejects localhost and common private network addresses, and it does not attempt to bypass authentication, paywalls, robots protections, or restricted pages. Pages with very little readable body text can still generate a compact report from public metadata, headings, and links. For Google Search URLs, the app uses the official Programmable Search API when keys are present and falls back to public HTML links only when they are available.

## Scripts

```bash
npm run dev
npm run build
npm run lint
```
