/**
 * @param {string|number|bigint} s
 */
export function esc(s) {
  const d = document.createElement("div");
  d.appendChild(document.createTextNode(String(s)));
  return d.innerHTML;
}

/**
 * @param {number} n
 */
export function fmtBytes(n) {
  const b = Number(n);
  if (b < 1024) {
    return `${b} B`;
  }
  if (b < 1_048_576) {
    return `${(b / 1024).toFixed(1)} KB`;
  }
  return `${(b / 1_048_576).toFixed(2)} MB`;
}

/**
 * @param {string} tag
 * @param {string=} cls
 * @param {string=} html
 * @returns {HTMLElement}
 */
export function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) {
    e.className = cls;
  }
  if (html) {
    e.innerHTML = html;
  }
  return e;
}
