from __future__ import annotations

import ipaddress
import os
import re
from urllib.parse import parse_qs, unquote, urljoin, urlparse, urlunparse

import requests
from bs4 import BeautifulSoup

from .models import ExtractedPage, Link

MAX_TEXT_LENGTH = 12_000
REQUEST_HEADERS = {
    "User-Agent": "InsightPDF/1.0 (+portfolio project; extracts public webpage text for user-requested reports)",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
}


def validate_public_url(value: str) -> str:
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("Enter a valid public URL, including https:// or http://.")

    hostname = parsed.hostname or ""
    if hostname in {"localhost", "0.0.0.0"}:
        raise ValueError("InsightPDF only analyzes public webpages.")

    try:
        ip = ipaddress.ip_address(hostname)
        if ip.is_private or ip.is_loopback or ip.is_link_local:
            raise ValueError("InsightPDF only analyzes public webpages.")
    except ValueError as exc:
        if "InsightPDF" in str(exc):
            raise

    return urlunparse(parsed)


def fetch_and_extract(url: str) -> ExtractedPage:
    response = requests.get(url, headers=REQUEST_HEADERS, timeout=20, allow_redirects=True)
    if response.status_code >= 400:
        raise ValueError(f"The page returned {response.status_code}. Try another public page.")

    content_type = response.headers.get("content-type", "")
    if "text/html" not in content_type:
        raise ValueError("This URL does not appear to be an HTML webpage.")

    soup = BeautifulSoup(response.text, "html.parser")
    for tag in soup(["script", "style", "noscript", "svg", "canvas", "iframe", "form"]):
        tag.decompose()

    parsed = urlparse(response.url)
    query = _google_query(parsed)
    title = (
        f"Google Search: {query}"
        if query
        else _first_meta(soup, "property", "og:title")
        or _clean(soup.title.get_text(" ") if soup.title else "")
        or parsed.hostname
        or "Untitled webpage"
    )
    description = _first_meta(soup, "name", "description") or _first_meta(
        soup, "property", "og:description"
    )
    headings = [
        _clean(tag.get_text(" "))
        for tag in soup.find_all(["h1", "h2", "h3"])
        if _clean(tag.get_text(" "))
    ][:16]

    raw_links = _extract_links(soup, response.url)
    search_results = _google_results(query, soup, response.url) if query else []
    notable_links = [Link(result.label, result.href, result.description) for result in search_results] if query else raw_links

    main = soup.find("article") or soup.find("main") or soup.find(attrs={"role": "main"}) or soup.body
    article_text = _clean(main.get_text(" ") if main else "")
    body_word_count = len(article_text.split())

    fallback_text = ". ".join(
        part
        for part in [
            title,
            description,
            f"Search query: {query}" if query else "",
            (
                "Top Google results were not available from the public HTML response. "
                "Configure Google Programmable Search API keys for reliable top results."
                if query and not search_results
                else ""
            ),
            ". ".join(
                f"Result {index + 1}: {link.label}. {link.description}. {link.href}"
                for index, link in enumerate(search_results)
            ),
            ". ".join(headings),
            ". ".join(f"{link.label}: {link.href}" for link in notable_links),
        ]
        if part
    )

    low_text_body = article_text if not query and body_word_count > 0 and len(notable_links) < 3 and len(article_text) < 500 else ""
    text = (
        ". ".join(part for part in [fallback_text or f"Public webpage at {parsed.hostname}", low_text_body] if part)
        if body_word_count < 80
        else article_text
    )[:MAX_TEXT_LENGTH]

    return ExtractedPage(
        url=response.url,
        title=title,
        description=description,
        headings=headings,
        notable_links=notable_links[:12],
        search_results=search_results[:5],
        text=text,
        word_count=len(text.split()),
        low_text=body_word_count < 80,
    )


def _google_results(query: str, soup: BeautifulSoup, base_url: str) -> list[Link]:
    api_results = _google_api_results(query)
    if api_results:
        return api_results
    return _parse_google_html_results(soup, base_url)


def _google_api_results(query: str) -> list[Link]:
    api_key = os.getenv("GOOGLE_SEARCH_API_KEY")
    engine_id = os.getenv("GOOGLE_SEARCH_ENGINE_ID")
    if not api_key or not engine_id:
        return []

    try:
        response = requests.get(
            "https://www.googleapis.com/customsearch/v1",
            params={"key": api_key, "cx": engine_id, "q": query, "num": 5},
            timeout=15,
        )
        response.raise_for_status()
        items = response.json().get("items", [])
    except requests.RequestException:
        return []

    return [
        Link(
            label=_clean(item.get("title", "")),
            href=_clean(item.get("link", "")),
            description=_clean(item.get("snippet", "")),
        )
        for item in items
        if _clean(item.get("title", "")) and _clean(item.get("link", ""))
    ][:5]


def _parse_google_html_results(soup: BeautifulSoup, base_url: str) -> list[Link]:
    results: list[Link] = []
    for anchor in soup.find_all("a", href=True):
        if len(results) >= 5:
            break

        label = _clean(anchor.get_text(" "))
        href = _extract_google_result_href(anchor["href"], base_url)
        if not href or len(label) < 8 or _looks_mojibake(label):
            continue

        host = urlparse(href).hostname or href
        if any(link.href == href for link in results):
            continue

        results.append(Link(label=label[:140], href=href, description=f"Public result from {host.removeprefix('www.')}"))

    return results


def _extract_links(soup: BeautifulSoup, base_url: str) -> list[Link]:
    links: list[Link] = []
    for anchor in soup.find_all("a", href=True):
        label = _clean(anchor.get_text(" "))
        if not label or len(label) < 3 or _looks_mojibake(label):
            continue

        href = _normalize_href(urljoin(base_url, anchor["href"]))
        if href.startswith(("javascript:", "mailto:")) or any(link.href == href for link in links):
            continue

        links.append(Link(label=label[:140], href=href))
        if len(links) == 12:
            break

    return links


def _extract_google_result_href(raw_href: str, base_url: str) -> str:
    try:
        parsed = urlparse(urljoin(base_url, raw_href))
        candidate = parse_qs(parsed.query).get("q", [""])[0] if parsed.path == "/url" else urlunparse(parsed)
        candidate = unquote(candidate)
        result = urlparse(candidate)
        blocked_hosts = {"google.com", "accounts.google.com", "support.google.com"}
        if result.scheme not in {"http", "https"}:
            return ""
        if any((result.hostname or "") == host or (result.hostname or "").endswith(f".{host}") for host in blocked_hosts):
            return ""
        return urlunparse(result)
    except ValueError:
        return ""


def _normalize_href(href: str) -> str:
    parsed = urlparse(href)
    if parsed.hostname and parsed.hostname.endswith("facebook.com") and parsed.path == "/l.php":
        outbound = parse_qs(parsed.query).get("u", [""])[0]
        if outbound:
            return outbound
    return href


def _google_query(parsed) -> str:
    return _clean(parse_qs(parsed.query).get("q", [""])[0]) if "google." in (parsed.hostname or "") and parsed.path == "/search" else ""


def _first_meta(soup: BeautifulSoup, attr: str, value: str) -> str:
    tag = soup.find("meta", attrs={attr: value})
    return _clean(tag.get("content", "")) if tag else ""


def _clean(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def _looks_mojibake(value: str) -> bool:
    return bool(re.search(r"[�ØÙÚÛà¤à¥à¦à¨]", value))
