/**
 * Return a required element from the static page shell.
 *
 * @template {Element} T
 * @param {string} id
 * @param {new (...args: any[]) => T} elementConstructor
 * @returns {T}
 */
export function requireElementById(id, elementConstructor) {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element #${id}`);
  }
  if (!(element instanceof elementConstructor)) {
    throw new TypeError(
      `Element #${id} must be a ${elementConstructor.name}, got ${element.constructor.name}`,
    );
  }
  return element;
}

/**
 * @param {string|number|bigint} s
 */
export function esc(s) {
  const d = document.createElement("div");
  d.appendChild(document.createTextNode(String(s)));
  return d.innerHTML;
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
