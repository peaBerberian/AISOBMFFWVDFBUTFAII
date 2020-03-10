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
  const props = Object.keys(obj).map(key =>
    `
      <div class="value-object-prop">
        <span class="value-object-key">${sanitize(key)}</span>:
        <span class="value-object-value">${getValueToDisplay(obj[key])}</span>
      </div>
    `,
  ).join("");
  return `
    <div class="value-object-line">
      ${props}
    </div>
  `;
};

const getValueToDisplay = (val) => {
  if (val == null) {
    return undefined;
  }
  switch (typeof val) {
  case "object":
    if (Array.isArray(val)) {
      if (!val.length) {
        return "no element";
      }
      if (typeof val[0] === "number") {
        return val.join(" ");
      }
      return val.map(getObjectDisplay).join(" ");
    }

    return getObjectDisplay(val);
  case "string":
    return `"${sanitize(val)}"`;
  }

  return sanitize(val);
};

const BoxTitle = (box) =>
  `
    <div class="box-title">
      <span class="box-name">${sanitize(box.name)}</span>
      <span class="box-alias">("${sanitize(box.alias)}")</span>
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
      <span class="box-value-key">${sanitize(value.name)}</span>:
      <span class="box-value-value">${getValueToDisplay(value.value)}</span>
    </div>
  `;
};

const BoxValues = (box) =>
  (box.values || []).map(v => BoxValue(v)).join("");

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
  wrapper.innerHTML =  title() + arr.map(Box).join("");
  wrapper.style.display = "block";
};
