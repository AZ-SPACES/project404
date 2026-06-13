var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// src/index.ts
function isInsideAza() {
  return typeof window !== "undefined" && typeof window.aza !== "undefined";
}
function getAza() {
  if (!isInsideAza()) {
    throw new AzaNotAvailableError(
      "window.aza is not available. Make sure your app is running inside the Aza mini app player."
    );
  }
  return window.aza;
}
function waitForAza(timeoutMs = 5e3) {
  if (isInsideAza()) {
    return Promise.resolve(window.aza);
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      window.removeEventListener("azaReady", onReady);
      reject(new AzaNotAvailableError(
        `Aza bridge did not initialise within ${timeoutMs}ms. Make sure your app is running inside the Aza mini app player.`
      ));
    }, timeoutMs);
    function onReady() {
      clearTimeout(timer);
      window.removeEventListener("azaReady", onReady);
      if (window.aza) {
        resolve(window.aza);
      } else {
        reject(new AzaNotAvailableError("azaReady fired but window.aza is still undefined."));
      }
    }
    window.addEventListener("azaReady", onReady);
  });
}
var AzaNotAvailableError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "AzaNotAvailableError";
  }
};
function useAza(timeoutMs = 5e3) {
  const React = _requireReact();
  if (!React) {
    throw new Error(
      "useAza() requires React. Install react and react-dom, or use waitForAza() instead."
    );
  }
  const [state, setState] = React.useState(
    isInsideAza() ? { status: "ready", aza: window.aza } : { status: "loading" }
  );
  React.useEffect(() => {
    if (state.status === "ready") return;
    let cancelled = false;
    waitForAza(timeoutMs).then((aza) => {
      if (!cancelled) setState({ status: "ready", aza });
    }).catch((error) => {
      if (!cancelled) setState({ status: "unavailable", error });
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}
function _requireReact() {
  try {
    if (typeof __require === "undefined") return null;
    return __require("react");
  } catch (e) {
    return null;
  }
}

export { AzaNotAvailableError, getAza, isInsideAza, useAza, waitForAza };
//# sourceMappingURL=index.mjs.map
//# sourceMappingURL=index.mjs.map