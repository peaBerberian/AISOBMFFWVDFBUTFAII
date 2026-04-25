/**
 * @param {string} label
 * @param {string} value
 * @returns {HTMLDetailsElement}
 */
export function createCompactSource(label, value) {
  const details = document.createElement("details");
  details.className = "compact-source";

  const summary = document.createElement("summary");
  summary.className = "compact-source-summary-row";
  summary.title = value;

  const labelElt = document.createElement("span");
  labelElt.className = "compact-source-label";
  labelElt.textContent = `${label}:`;
  summary.appendChild(labelElt);

  const summaryValue = document.createElement("span");
  summaryValue.className = "compact-source-summary";
  summaryValue.textContent = summarizeSourceValue(value);
  summary.appendChild(summaryValue);

  const hint = document.createElement("span");
  hint.className = "compact-source-toggle";
  hint.textContent = "full";
  summary.appendChild(hint);

  const code = document.createElement("code");
  code.className = "compact-source-value";
  code.textContent = value;
  code.title = value;

  details.appendChild(summary);
  details.appendChild(code);
  return details;
}

/**
 * @param {string} value
 */
function summarizeSourceValue(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const pathname = url.pathname.split("/").filter(Boolean);
      const lastSegment = pathname[pathname.length - 1];
      if (lastSegment) {
        // TODO: Better algo for source summarization? We might only have a single slash
				// for one
        return `${url.hostname}/…/${lastSegment}`;
      }
      if (url.search) {
        return `${url.hostname}${url.search}`;
      }
      return url.hostname;
    } catch {
      return trimmed;
    }
  }

  const pathSegments = trimmed.split(/[\\/]/).filter(Boolean);
  return pathSegments[pathSegments.length - 1] || trimmed;
}
