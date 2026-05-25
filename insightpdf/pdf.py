from __future__ import annotations

from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def build_pdf(report: dict) -> BytesIO:
    buffer = BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=0.65 * inch,
        leftMargin=0.65 * inch,
        topMargin=0.65 * inch,
        bottomMargin=0.65 * inch,
    )
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="SectionTitle",
            parent=styles["Heading2"],
            textColor=colors.HexColor("#145350"),
            spaceBefore=14,
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="BodyTextClean",
            parent=styles["BodyText"],
            leading=15,
            spaceAfter=7,
        )
    )

    story = [
        _hero(report, styles),
        Spacer(1, 16),
        Paragraph("Summary", styles["SectionTitle"]),
        Paragraph(_escape(report.get("summary", "")), styles["BodyTextClean"]),
        Paragraph("Key Insights", styles["SectionTitle"]),
    ]

    for index, insight in enumerate(report.get("keyInsights", []), start=1):
        story.append(Paragraph(f"{index}. {_escape(insight)}", styles["BodyTextClean"]))

    headings = report.get("headings", [])[:10]
    if headings:
        story.append(Paragraph("Important Headings", styles["SectionTitle"]))
        for heading in headings:
            story.append(Paragraph(f"- {_escape(heading)}", styles["BodyTextClean"]))

    links = report.get("moreInfoLinks", [])[:5]
    if links:
        story.append(Paragraph("Find More Information", styles["SectionTitle"]))
        for index, link in enumerate(links, start=1):
            description = f" - {_escape(link.get('description', ''))}" if link.get("description") else ""
            story.append(
                Paragraph(
                    f'{index}. <b>{_escape(link.get("label", ""))}</b>{description}<br/><link href="{_escape(link.get("href", ""))}">{_escape(link.get("href", ""))}</link>',
                    styles["BodyTextClean"],
                )
            )

    for section in report.get("sections", []):
        story.append(Paragraph(_escape(section.get("label", "")), styles["SectionTitle"]))
        story.append(Paragraph(_escape(section.get("body", "")), styles["BodyTextClean"]))

    story.append(Spacer(1, 16))
    story.append(Paragraph(f"Source: {_escape(report.get('url', ''))}", styles["BodyTextClean"]))
    story.append(Paragraph(f"Generated: {_escape(report.get('extractedAt', ''))}", styles["BodyTextClean"]))

    document.build(story)
    buffer.seek(0)
    return buffer


def _hero(report: dict, styles) -> Table:
    title = Paragraph("<font color='white'><b>InsightPDF Report</b></font>", styles["Title"])
    domain = Paragraph(f"<font color='white'>{_escape(report.get('sourceDomain', ''))}</font>", styles["BodyText"])
    table = Table([[title], [domain]], colWidths=[7.0 * inch])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#0f172a")),
                ("BOX", (0, 0), (-1, -1), 0, colors.HexColor("#0f172a")),
                ("TOPPADDING", (0, 0), (-1, -1), 18),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 18),
                ("LEFTPADDING", (0, 0), (-1, -1), 20),
            ]
        )
    )
    return table


def _escape(value: str) -> str:
    return (
        str(value or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )
