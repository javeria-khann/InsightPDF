from pathlib import Path

from flask import Flask, jsonify, render_template, request, send_file
from dotenv import load_dotenv

from .ai import create_report_content
from .pdf import build_pdf
from .scraper import fetch_and_extract, validate_public_url


def create_app() -> Flask:
    load_dotenv()
    project_root = Path(__file__).resolve().parent.parent

    app = Flask(
        __name__,
        template_folder=str(project_root / "templates"),
        static_folder=str(project_root / "static"),
    )

    @app.get("/")
    def index():
        return render_template("index.html")

    @app.post("/api/analyze")
    def analyze():
        try:
            payload = request.get_json(silent=True) or {}
            url = str(payload.get("url", "")).strip()
            if not url:
                return jsonify({"error": "A URL is required."}), 400

            parsed_url = validate_public_url(url)
            page = fetch_and_extract(parsed_url)
            content = create_report_content(page)
            report = page.to_report(content)
            return jsonify(report)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        except Exception:
            return jsonify({"error": "Something went wrong while analyzing this URL."}), 500

    @app.post("/api/pdf")
    def pdf():
        payload = request.get_json(silent=True) or {}
        report = payload.get("report")
        if not isinstance(report, dict):
            return jsonify({"error": "Report data is required."}), 400

        pdf_file = build_pdf(report)
        filename = f"{slugify(report.get('title') or 'insightpdf-report')}.pdf"
        return send_file(
            pdf_file,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=filename,
        )

    return app


def slugify(value: str) -> str:
    clean = "".join(char.lower() if char.isalnum() else "-" for char in value)
    parts = [part for part in clean.split("-") if part]
    return "-".join(parts)[:70] or "insightpdf-report"
