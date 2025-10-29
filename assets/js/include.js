// include.js — robust partial loader for header/footer from any folder depth
// Tries ./partials, ../partials, ../../partials, and /partials

(function () {
  const VERSION = "v2"; // bump to refresh cache

  const headerPaths = [
    "partials/header.html",
    "../partials/header.html",
    "../../partials/header.html",
    "/partials/header.html"
  ];

  const footerPaths = [
    "partials/footer.html",
    "../partials/footer.html",
    "../../partials/footer.html",
    "/partials/footer.html"
  ];

  async function fetchFirst(paths) {
    for (const p of paths) {
      try {
        const res = await fetch(`${p}?v=${VERSION}`, { cache: "no-cache" });
        if (res.ok) return await res.text();
      } catch (_) { /* try next */ }
    }
    return "";
  }

  async function inject() {
    const headerEl = document.querySelector("header[data-include]");
    const footerEl = document.querySelector("footer[data-include]");

    if (headerEl) {
      const html = await fetchFirst(headerPaths);
      if (html) headerEl.innerHTML = html;
    }
    if (footerEl) {
      const html = await fetchFirst(footerPaths);
      if (html) footerEl.innerHTML = html;
    }
  }

  if (document.readyState !== "loading") inject();
  else document.addEventListener("DOMContentLoaded", inject);
})();
