# InsightPDF

InsightPDF is a Python web application that accepts a public URL, extracts important webpage information with Beautiful Soup, summarizes the content with AI or a local fallback, and generates a clean downloadable PDF report.

## Features

- Public URL input and validation
- Webpage extraction with Python, Requests, and Beautiful Soup
- OpenAI-powered summaries and fallback summaries
- Top 5 Google results for Google Search URLs when Google Programmable Search keys are configured
- Up to 5 clickable links for finding more information
- Downloadable PDF reports with ReportLab
- Responsive SaaS-style dashboard UI
- Dark and light mode
- Loading states and error handling

## Tech Stack

- Python
- Flask
- Beautiful Soup
- Requests
- OpenAI API
- ReportLab
- HTML, CSS, and JavaScript

## Getting Started

Create and activate a virtual environment:

```bash
python -m venv .venv
.venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Create a local environment file:

```bash
copy .env.example .env
```

Optional AI summaries:

```bash
OPENAI_API_KEY=your_openai_api_key_here
```

Optional reliable Google top results:

```bash
GOOGLE_SEARCH_API_KEY=your_google_custom_search_api_key_here
GOOGLE_SEARCH_ENGINE_ID=your_google_programmable_search_engine_id_here
```

Run the app:

```bash
python app.py
```

Open:

```text
http://127.0.0.1:5000
```

## Safety Notes

InsightPDF only accepts public `http` and `https` URLs. It rejects localhost and private network addresses, and it does not bypass authentication, paywalls, restricted pages, or private systems. For Google Search URLs, the app uses Google Programmable Search when keys are present and falls back to public HTML only when results are available.

## Project Structure

```text
app.py
insightpdf/
  ai.py
  models.py
  pdf.py
  scraper.py
templates/
  index.html
static/
  app.js
  styles.css
```
