const form = document.querySelector("#analyzeForm");
const urlInput = document.querySelector("#urlInput");
const analyzeButton = document.querySelector("#analyzeButton");
const errorBox = document.querySelector("#errorBox");
const reportPanel = document.querySelector("#reportPanel");
const themeToggle = document.querySelector("#themeToggle");

let currentReport = null;

const storedTheme = localStorage.getItem("insightpdf-theme");
if (storedTheme === "dark" || (!storedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
  document.documentElement.classList.add("dark");
}

themeToggle.addEventListener("click", () => {
  document.documentElement.classList.toggle("dark");
  localStorage.setItem(
    "insightpdf-theme",
    document.documentElement.classList.contains("dark") ? "dark" : "light"
  );
});

document.querySelectorAll("[data-url]").forEach((button) => {
  button.addEventListener("click", () => {
    urlInput.value = button.dataset.url;
    urlInput.focus();
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setError("");
  setLoading(true);

  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: urlInput.value })
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to analyze this URL.");
    }

    currentReport = data;
    renderReport(data);
  } catch (error) {
    setError(error.message || "Unable to analyze this URL.");
    renderEmpty();
  } finally {
    setLoading(false);
  }
});

function setLoading(enabled) {
  analyzeButton.disabled = enabled;
  analyzeButton.textContent = enabled ? "Analyzing..." : "Analyze";
  if (enabled) {
    reportPanel.innerHTML = `
      <div class="loading-state">
        <h2>Extracting and building report...</h2>
        <p>Beautiful Soup is reading the public HTML and preparing your report.</p>
      </div>
    `;
  }
}

function setError(message) {
  errorBox.textContent = message;
  errorBox.classList.toggle("hidden", !message);
}

function renderEmpty() {
  reportPanel.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">PDF</div>
      <h2>Your report preview will appear here</h2>
      <p>InsightPDF organizes public webpage data, insights, and up to 5 links for more information.</p>
    </div>
  `;
}

function renderReport(report) {
  reportPanel.innerHTML = `
    <div class="report-header">
      <div>
        <div class="domain">${escapeHtml(report.sourceDomain)}</div>
        <h2>${escapeHtml(report.title)}</h2>
        <div class="muted">${new Date(report.extractedAt).toLocaleString()}</div>
      </div>
      <button class="primary-button" type="button" id="downloadPdf">Download PDF</button>
    </div>

    <section class="section">
      <h3>Summary</h3>
      <p class="muted">${escapeHtml(report.summary)}</p>
    </section>

    <section class="section">
      <h3>Key Insights</h3>
      ${report.keyInsights.map((insight) => `
        <div class="insight"><span class="check">✓</span><span>${escapeHtml(insight)}</span></div>
      `).join("")}
    </section>

    ${renderHeadings(report.headings)}
    ${renderMoreLinks(report.moreInfoLinks)}

    <div class="metrics">
      <div class="metric"><span>Words extracted</span><strong>${Number(report.wordCount).toLocaleString()}</strong></div>
      <div class="metric"><span>More info links</span><strong>${report.moreInfoLinks.length}</strong></div>
      <div class="metric"><span>Mode</span><strong>${report.aiEnabled ? "AI" : "Fallback"}</strong></div>
    </div>
  `;

  document.querySelector("#downloadPdf").addEventListener("click", downloadPdf);
}

function renderHeadings(headings) {
  if (!headings.length) return "";
  return `
    <section class="section">
      <h3>Important Headings</h3>
      <div class="heading-list">
        ${headings.slice(0, 10).map((heading) => `<span class="heading-pill">${escapeHtml(heading)}</span>`).join("")}
      </div>
    </section>
  `;
}

function renderMoreLinks(links) {
  if (!links.length) return "";
  return `
    <section class="section">
      <h3>Find More Information</h3>
      ${links.slice(0, 5).map((link, index) => `
        <a class="link-card" href="${escapeAttribute(link.href)}" target="_blank" rel="noreferrer">
          <span class="link-title"><span class="rank">${index + 1}</span>${escapeHtml(link.label)} ↗</span>
          ${link.description ? `<span class="muted">${escapeHtml(link.description)}</span>` : ""}
          <span class="url-line">${escapeHtml(link.href)}</span>
        </a>
      `).join("")}
    </section>
  `;
}

async function downloadPdf() {
  if (!currentReport) return;

  const response = await fetch("/api/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ report: currentReport })
  });

  if (!response.ok) {
    setError("Unable to generate the PDF.");
    return;
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slugify(currentReport.title || "insightpdf-report")}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 70);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
