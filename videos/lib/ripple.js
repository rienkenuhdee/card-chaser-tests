// Injected before the app's scripts: a fading circle at every touch point, so a viewer sees each tap. Drawn in a layer
// that takes no events (pointer-events: none), so the app never sees it.
(() => {
  const ring = (x, y) => {
    const d = document.createElement("div");
    d.setAttribute("aria-hidden", "true");
    d.style.cssText = `position:fixed;left:${x - 26}px;top:${y - 26}px;width:52px;height:52px;border-radius:50%;` +
      "background:rgba(255,255,255,.38);border:3px solid rgba(18,18,18,.6);box-shadow:0 0 0 2px rgba(255,255,255,.75);" +
      "pointer-events:none;z-index:2147483647;transform:scale(.45);opacity:1;" +
      "transition:transform 600ms cubic-bezier(.2,.7,.3,1),opacity 600ms ease-out";
    document.documentElement.appendChild(d);
    requestAnimationFrame(() => requestAnimationFrame(() => { d.style.transform = "scale(1.55)"; d.style.opacity = "0"; }));
    setTimeout(() => d.remove(), 800);
  };
  addEventListener("touchstart", (e) => { for (const t of e.changedTouches) ring(t.clientX, t.clientY); }, { capture: true, passive: true });
})();
