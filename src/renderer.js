const wrapper = document.getElementById("file-description");

const sanitize = (str) => {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
};

const title = () => {
  return `
    <h2 id="result-title">Results</h2>
  `;
};

const getObjectDisplay = (obj) => {
  const props = obj
    .map(
      (f) =>
        `
      <div class="value-object-prop">
        <span class="value-object-key">${sanitize(f.key)}</span>:
        <span class="value-object-value">${getValueToDisplay(f)}</span>
      </div>
    `,
    )
    .join("");
  return `
    <div class="value-object-line">
      ${props}
    </div>
  `;
};

const getValueToDisplay = (prop) => {
  if (prop == null) {
    return undefined;
  }
  if (typeof prop !== "object") {
    if (typeof prop === "string") {
      return `"${sanitize(prop)}"`;
    }
    return `${sanitize(prop)}`;
  }
  switch (prop.kind) {
    case "array":
      if (!prop.items.length) {
        return "no element";
      }
      if (typeof prop.items[0] === "number") {
        return prop.items.join(" ");
      }
      return prop.items.map(getValueToDisplay).join(" ");
    case "struct":
    case "bits":
      return getObjectDisplay(prop.fields);
    case "flags":
      return getObjectDisplay(prop.flags);
    default:
      if (typeof prop.value === "string") {
        return `"${sanitize(prop.value)}"`;
      }
      return `${sanitize(prop.value)}`;
  }
};

const BoxTitle = (box) =>
  `
    <div class="box-title">
      <span class="box-name">${sanitize(box.name)}</span>
      <span class="box-alias">("${sanitize(box.type)}")</span>
      <span class="box-size">${sanitize(box.size)} bytes</span>
    </div>
  `;

const BoxDescription = (box) =>
  `
    <div class="box-description">
      ${sanitize(box.description)}
    </div>
  `;

const BoxValue = (value) => {
  return `
    <div class="box-value-entry">
      <span class="box-value-key">${sanitize(value.key)}</span>:
      <span class="box-value-value">${getValueToDisplay(value)}</span>
    </div>
  `;
};

const BoxValues = (box) => (box.values || []).map((v) => BoxValue(v)).join("");

const Box = (box) => {
  const children = (box.children || []).map(Box).join("");
  return `
    <div class="box">
      ${BoxTitle(box)}
      ${BoxDescription(box)}
      ${BoxValues(box)}
      ${children}
    </div>
  `;
};

export default (arr = []) => {
  console.log("rendering...", arr);
  wrapper.style.display = "none";
  wrapper.innerHTML = title() + arr.map(Box).join("");
  wrapper.style.display = "block";
};
