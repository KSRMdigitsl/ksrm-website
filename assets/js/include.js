// include.js
// Dynamically loads /partials/header.html and /partials/footer.html into any page that includes this script.

(async function loadIncludes() {
  try {
    const headerTarget = document.querySelector("header[data-include]");
    const footerTarget = document.querySelector("footer[data-include]");

    // Load header
    if (headerTarget) {
      const res = await fetch("/partials/header.html");
      if (res.ok) {
        headerTarget.innerHTML = await res.text();
      } else {
        console.error("Header not found:", res.status);
      }
    }

    // Load footer
    if (footerTarget) {
      const res = await fetch("/partials/footer.html");
      if (res.ok) {
        footerTarget.innerHTML = await res.text();
      } else {
        console.error("Footer not found:", res.status);
      }
    }
  } catch (err) {
    console.error("Include error:", err);
  }
})();
