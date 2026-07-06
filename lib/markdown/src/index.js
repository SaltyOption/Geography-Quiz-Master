/**
 * Minimal, safe Markdown-to-HTML renderer for untrusted admin content.
 *
 * Shared by every rendering path so article bodies look the same across:
 *   - the api-server SSR routes (artifacts/api-server ssr-pages)
 *   - the prerender script (artifacts/geo-quiz/prerender.mjs)
 *   - the client article page (artifacts/geo-quiz, via dangerouslySetInnerHTML)
 *
 * Security model: the input is escaped FIRST so no raw HTML the author typed can
 * ever reach the output. Only a small set of formatting tokens (headings, bold,
 * italic, inline code, links, lists, pipe tables) are then turned into a fixed
 * allow-list of tags we generate ourselves. Link hrefs are restricted to http(s)
 * and relative URLs, so javascript:/data: and similar schemes are dropped to
 * plain text.
 */

/** Escape the four HTML-significant characters. */
export function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Whether a URL is safe to use as a link href in user/admin-authored content.
 * Only absolute http(s) URLs are allowed; javascript:, data:, and other schemes
 * are rejected so they can never become a dangerous href. This is the single
 * policy used by every render path (SSR, prerender, client) and by server-side
 * input validation.
 *
 * @param {string | null | undefined} url
 * @returns {boolean}
 */
export function isSafeHttpUrl(url) {
  return typeof url === "string" && /^https?:\/\//i.test(url.trim());
}

// Inline formatting on a line that has ALREADY been HTML-escaped.
function renderInline(text) {
  let out = text;

  // Links: [label](url). The url is already escaped; only allow http(s) and
  // root-relative targets — anything else (javascript:, data:, etc.) falls back
  // to the plain label so it can never become a dangerous href.
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, url) => {
    const isExternal = /^https?:\/\//i.test(url);
    const isRelative = url.startsWith("/");
    if (!isExternal && !isRelative) return label;
    const attrs = isExternal ? ' target="_blank" rel="noopener noreferrer"' : "";
    return `<a href="${url}"${attrs}>${label}</a>`;
  });

  // Bold before italic so ** isn't consumed by the single-* rule.
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");

  return out;
}

function isListBlock(lines, re) {
  return lines.length > 0 && lines.every((l) => re.test(l.trim()));
}

const UL_RE = /^[-*]\s+/;
const OL_RE = /^\d+\.\s+/;

// GitHub-style pipe tables: every line starts and ends with `|` (after the
// input has been escaped), and the second line is a `---`/`:---:` separator.
const TABLE_ROW_RE = /^\|.*\|$/;
const TABLE_SEP_RE = /^\|(\s*:?-{3,}:?\s*\|)+$/;

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

function isTableBlock(lines) {
  return (
    lines.length >= 2 &&
    lines.every((l) => TABLE_ROW_RE.test(l.trim())) &&
    TABLE_SEP_RE.test(lines[1].trim())
  );
}

function renderTable(lines) {
  const header = splitTableRow(lines[0]);
  const rows = lines.slice(2).map(splitTableRow);
  const thead = `<thead><tr>${header
    .map((c) => `<th>${renderInline(c)}</th>`)
    .join("")}</tr></thead>`;
  const tbody = rows.length
    ? `<tbody>${rows
        .map(
          (r) =>
            `<tr>${header
              .map((_c, i) => `<td>${renderInline(r[i] ?? "")}</td>`)
              .join("")}</tr>`,
        )
        .join("")}</tbody>`
    : "";
  return `<table>${thead}${tbody}</table>`;
}

/**
 * Render a Markdown string to a safe HTML fragment.
 *
 * @param {string | null | undefined} md
 * @returns {string}
 */
export function renderMarkdown(md) {
  if (md === null || md === undefined) return "";
  const escaped = escapeHtml(md).replace(/\r\n?/g, "\n");
  const blocks = escaped.split(/\n{2,}/);
  const out = [];

  for (const raw of blocks) {
    const block = raw.replace(/^\n+/, "").replace(/\s+$/, "");
    if (!block) continue;
    const lines = block.split("\n");

    if (lines.length === 1) {
      const h3 = lines[0].match(/^###\s+(.+)$/);
      if (h3) {
        out.push(`<h3>${renderInline(h3[1].trim())}</h3>`);
        continue;
      }
      const h2 = lines[0].match(/^##\s+(.+)$/);
      if (h2) {
        out.push(`<h2>${renderInline(h2[1].trim())}</h2>`);
        continue;
      }
      const h1 = lines[0].match(/^#\s+(.+)$/);
      if (h1) {
        out.push(`<h2>${renderInline(h1[1].trim())}</h2>`);
        continue;
      }
    }

    if (isTableBlock(lines)) {
      out.push(renderTable(lines));
      continue;
    }

    if (isListBlock(lines, UL_RE)) {
      const items = lines
        .map((l) => `<li>${renderInline(l.trim().replace(UL_RE, ""))}</li>`)
        .join("");
      out.push(`<ul>${items}</ul>`);
      continue;
    }

    if (isListBlock(lines, OL_RE)) {
      const items = lines
        .map((l) => `<li>${renderInline(l.trim().replace(OL_RE, ""))}</li>`)
        .join("");
      out.push(`<ol>${items}</ol>`);
      continue;
    }

    const paragraph = lines.map((l) => renderInline(l.trim())).join("<br>");
    out.push(`<p>${paragraph}</p>`);
  }

  return out.join("\n");
}
