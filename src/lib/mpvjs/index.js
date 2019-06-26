/**
 * Corresponding JS part of mpv pepper plugin.
 * @module mpv.js
 */

"use strict";

const path = require("path");

/**
 * The MIME type associated with mpv.js plugin.
 */
const PLUGIN_MIME_TYPE = "application/x-mpvjs";

function containsNonASCII(str) {
  for (let i = 0; i < str.length; i++) {
    if (str.charCodeAt(i) > 255) {
      return true;
    }
  }
  return false;
}

/**
 * Return value to be passed to `register-pepper-plugins` switch.
 *
 * @param {string} pluginDir - Plugin directory
 * @param {string} [pluginName=mpvjs.node] - Plugin name
 * @throws {Error} Resulting path contains non-ASCII characters.
 */
function getPluginEntry(pluginDir, pluginName = "mpvjs.node") {
  const fullPluginPath = path.join(pluginDir, pluginName);
  // Try relative path to workaround ASCII-only path restriction.
  let pluginPath = path.relative(process.cwd(), fullPluginPath);
  if (path.dirname(pluginPath) === ".") {
    // "./plugin" is required only on Linux.
    if (process.platform === "linux") {
      pluginPath = `.${path.sep}${pluginPath}`;
    }
  } else {
    // Relative plugin paths doesn't work reliably on Windows, see
    // <https://github.com/Kagami/mpv.js/issues/9>.
    if (process.platform === "win32") {
      pluginPath = fullPluginPath;
    }
  }
  if (containsNonASCII(pluginPath)) {
    if (containsNonASCII(fullPluginPath)) {
      throw new Error("Non-ASCII plugin path is not supported");
    } else {
      pluginPath = fullPluginPath;
    }
  }
  return `${pluginPath};${PLUGIN_MIME_TYPE}`;
}

class MpvJs {
  /**
   * Send a command to the player.
   *
   * @param {string} cmd - Command name
   * @param {...*} args - Arguments
   */
  command(cmd, ...args) {
    args = args.map(arg => arg.toString());
    this._postData("command", [cmd].concat(args));
  }

  /**
   * Set a property to a given value.
   *
   * @param {string} name - Property name
   * @param {*} value - Property value
   */
  property(name, value) {
    const data = {
      name,
      value
    };
    this._postData("set_property", data);
  }

  /**
   * Get a notification whenever the given property changes.
   *
   * @param {string} name - Property name
   */
  observe(name) {
    this._postData("observe_property", name);
  }

  /**
   * Send a key event through mpv's input handler, triggering whatever
   * behavior is configured to that key.
   *
   * @param {KeyboardEvent} event
   */
  keypress({
    key,
    shiftKey,
    ctrlKey,
    altKey
  }) {
    // Don't need modifier events.
    if ([
        "Escape", "Shift", "Control", "Alt",
        "Compose", "CapsLock", "Meta",
      ].includes(key)) return;

    if (key.startsWith("Arrow")) {
      key = key.slice(5).toUpperCase();
      if (shiftKey) {
        key = `Shift+${key}`;
      }
    }
    if (ctrlKey) {
      key = `Ctrl+${key}`;
    }
    if (altKey) {
      key = `Alt+${key}`;
    }

    // Ignore exit keys for default keybindings settings.
    if ([
        "q", "Q", "ESC", "POWER", "STOP",
        "CLOSE_WIN", "CLOSE_WIN", "Ctrl+c",
        "AR_PLAY_HOLD", "AR_CENTER_HOLD",
      ].includes(key)) return;

    this.command("keypress", key);
  }

  /**
   * Enter fullscreen.
   */
  fullscreen() {
    this.node().webkitRequestFullscreen();
  }

  /**
   * Synchronously destroy mpv instance. You might want to call this on
   * quit in order to cleanup files currently being opened in mpv.
   */
  destroy() {
    this.node().remove();
  }

  /**
   * Return a plugin DOM node.
   *
   * @return {HTMLEmbedElement}
   */
  node() {
    return this.plugin;
  }

  constructor(mpvReady, propertyChange) {
    this.plugin = null;
    if (mpvReady && propertyChange) {
      this.onReady = mpvReady;
      this.onPropertyChange = propertyChange;
    }
  }
  _postData(type, data) {
    const msg = {
      type,
      data
    };
    this.node().postMessage(msg);
  }
  _handleMessage(e) {
    const msg = e.data;
    const {
      type,
      data
    } = msg;

    if (type === "property_change" && this.onPropertyChange) {
      const {
        name,
        value
      } = data;
      this.onPropertyChange(name, value);
    } else if (type === "ready" && this.onReady) {
      this.onReady(this);
    }
  }
  getDefProps(dopProps = {}) {
    const defaultStyle = {
      display: "block",
      width: "100%",
      height: "100%"
    };
    const props = Object.assign({}, dopProps, {
      ref: el => {
        this.plugin = el;
      },
      type: PLUGIN_MIME_TYPE,
      style: Object.assign(defaultStyle, dopProps.style),
    });
    return props;
  }
  setPluginNode(node) {
    if (node) {
      this.plugin = node;
    }
    this.node().addEventListener("message", this._handleMessage.bind(this));
  }
}

module.exports = {
  PLUGIN_MIME_TYPE,
  getPluginEntry,
  MpvJs
};
