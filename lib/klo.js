/**
 * @param {Object|string} node1
 * @param {Object|string} node2
 * @returns {Boolean}
 */
const hasNodeChanged = (node1, node2) =>
  typeof node1 !== typeof node2 ||
    typeof node1 === "string" && node1 !== node2 ||
    node1.type !== node2.type;

/**
 * @param {string}
 * @returns {Boolean}
 */
const isEventPropName = propName =>
  /^on/.test(propName);

/**
 * @param {string} eventName
 * @returns {string}
 */
const formatEventName = eventName =>
  eventName.slice(2).toLowerCase();

/**
 * @param {HTMLElement} $target
 * @param {Object} newNode
 */
const addEventListeners = ($target, props) =>
  Object.keys(props).forEach(propName => {
    if (isEventPropName(propName)) {
      const eventName = formatEventName(propName);
      const propValue = props[propName];
      $target.addEventListener(eventName, propValue);
    }
  });

/**
 * @param {Object|string} node
 * @returns {HTMLElement}
 */
const createElement = node => {
  if (typeof node === "string") {
    return document.createTextNode(node);
  }

  const { type, props, children } = node;

  const $el = document.createElement(type);
  setProps($el, props);
  addEventListeners($el, props);

  children
    .map(createElement)
    .forEach(el => $el.appendChild(el));

  return $el;
};

/**
 * @param {HTMLElement} $parent
 * @param {Object|string} newNode
 * @param {Object|string} oldNode
 * @param {Number} [indexOfNodeInParent=0]
 */
const update = ($parent, newNode, oldNode, indexOfNodeInParent = 0) => {
  if (!oldNode) {
    const $childNode = createElement(newNode);
    $parent.appendChild($childNode);
  }

  else if (!newNode) {
    const $childNodeToRemove = $parent.childNode[indexOfNodeInParent];
    $parent.removeChild($childNodeToRemove);
  }

  else if (hasNodeChanged(newNode, oldNode)) {
    const $childNode = createElement(newNode);
    const $childNodeToReplace = $parent.childNode[indexOfNodeInParent];
    $parent.replaceChild($childNode, $childNodeToReplace);
  }

  else if (newNode.type) {
    const $newParent = $parent.childNode[indexOfNodeInParent];
    updateProps($newParent, newNode.props, oldNode.props);

    const numberOfChildrenInNewNode = newNode.children.length;
    const numberOfChildrenInOldNode = oldNode.children.length;

    for (
      let i = 0;
      i < numberOfChildrenInNewNode || i < numberOfChildrenInOldNode;
      i++
    ) {
      update($newParent, newNode.children[i], oldNode.children[i], i);
    }
  }
};

/**
 * @param {HTMLElement} $target
 * @param {string} propName
 * @param {*} propValue
 */
const setBooleanProperty = ($target, propName, propValue) => {
  if (propValue) {
    $target.setAttribute(propName, propValue);
    $target[propName] = true;
  } else {
    $target[propName] = false;
  }
};

/**
 * @param {HTMLElement} $target
 * @param {string} propName
 */
const removeBooleanProperty = ($target, propName) => {
  $target.removeAttribute(propName);
  $target[propName] = false;
};

/**
 * @param {HTMLElement} $target
 * @param {string} propName
 * @param {*} propValue
 */
const setProperty = ($target, propName, propValue) => {
  if (isEventPropName(propName)) { // TODO
    return;
  }

  else if (propName === "className") {
    $target.setAttribute("class", propValue);
  }

  else if (typeof propName === "boolean") {
    setBooleanProperty($target, propName, propValue);
  }

  else {
    $target.setAttribute(propName, propValue);
  }
};

/**
 * @param {HTMLElement} $target
 * @param {string} propName
 * @param {*} oldPropValue
 * @param {*} newPropValue
 */
const updateProperty = ($target, propName, oldPropValue, newPropValue) => {
  if (!newPropValue) {
    removeProperty($target, propName, oldPropValue);
  }

  else if (oldPropValue === void 0 || newPropValue !== oldPropValue) {
    setProperty($target, propName, newPropValue);
  }
};

/**
 * @param {HTMLElement} $target
 * @param {Object} oldProps
 * @param {Object} newProps
 */
const updateProps = ($target, oldProps, newProps) => {
  const props = Object.assign({}, newProps, oldProps);
  Object.keys(props)
    .forEach(propName => {
      updateProperty($target, propName, newProps[propName], oldProps[propName]);
    });
};

/**
 * @param {HTMLElement} $target
 * @param {string} propName
 * @param {*} propValue
 */
const removeProperty = ($target, propName, propValue) => {
  if (isEventPropName(propName)) { // TODO
    return;
  }

  if (propName === "className") {
    $target.removeAttribute("class");
  } else if (typeof propValue === "boolean") {
    removeBooleanProperty($target, name);
  } else {
    $target.removeAttribute(name);
  }
};

/**
 * @param {HTMLElement} $target
 * @param {Object} props
 */
const setProps = ($target, props) =>
  Object.keys(props)
    .forEach(propName => setProperty($target, propName, props[propName]));

/**
 * @param {string|Function} type
 * @param {Object} props
 * @param {...(string|Function)} children
 * @returns {Object}
 */
const jsxFormatter = (type, props, ...children) =>
  ({
    type,
    props: props || {},
    children,
  });

const toto = (nodeType, nodeProps, nodeChildren) => {
  if (nodeType instanceof Controller) {
    const controller = new nodeType(nodeProps);
    controller.beforeMount();

    const ret = controller.render();

    // TODO

    controller.afterMount();
  }

  else if (typeof nodeType === "function") {
    const ret = nodeType(nodeProps);
  }
};

class Controller {
  constructor(props = {}) {
    if (typeof props !== "object") {
      throw new Error("If defined, props should be an object");
    }
    this.props = props || {}; // (if null)
    this.$el = null;
    this._events = {};
    this._timeouts = [];
    this._intervals = [];
  }

  beforeMount() {}
  afterMount() {}
  beforeUnmount() {}

  bindTimeout(timeoutInSeconds, cb) {
    const id = setTimeout(timeoutInSeconds, cb);
    this._timeouts.push(id);
  }

  bindInterval(intervalInSeconds, cb) {
    const id = setInterval(intervalInSeconds, cb);
    this._intervals.push(id);
  }

  bindEvent(eventName, cb) {
    if (!eventName) {
      throw new Error("Bad event name.");
    }
    if (!(this.$el instanceof window.HTMLElement)) {
      throw new Error("Wait for the component to be mounted before binding an event");
    }

    if (!this._events[eventName]) {
      this._events[eventName] = [];
    }
    this._events[eventName].push(cb);

    this.$el.addEventListener(eventName, cb);
  }

  // unbindEvent(eventName, cb) {
  //   if (cb) {
  //     this.$el.removeEventListener(eventName, cb);

  //     if (this._events[eventName] && !this._events[eventName].length) {
  //       delete this._events[eventName];
  //     }
  //     return;
  //   }

  //   if (this._events[eventName]) {
  //     for (let i = this._events[eventName].length - 1; i >= 0; i--) {
  //       this.$el.removeEventListener(eventName, this._events[eventName][i]);
  //     }
  //   }
  // }

  updateState(stateUpdate) {
    this.state = Object.assign({}, stateUpdate || {});

    // TODO update implementation?
  }

  render() {
    throw new Error("render not implemented.");
  }
}

class bouton extends klo.Controller {
  beforeMount() {
    this.state = { toggle: false };
  }

  afterMount() {
    this.bindEvent("click", evt => {
      this.updateState({ toggle: !!this.state.toggle });
    });
  }

  render() {
  }
}

export {
  createElement,
  update,
  jsxFormatter,
};
