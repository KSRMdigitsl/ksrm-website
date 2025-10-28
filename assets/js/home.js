// home.js (FINAL)
// Populates homepage sections using JSON data (home, ui, quotes, blog, flags)
// NOTE: paths are RELATIVE for GitHub Pages / custom domains.

(async function initHome() {
  const fetchJSON = async (path, fallback = {}) => {
    try {
      const res = await fetch(path + "?v=" + Date.now()); // cache-bust
      if (!res.ok) throw new Error(res.status);
      return await res.json();
    } catch (err) {
      console.warn("Failed to load", path, err);
      return fallback;
    }
  };

  // Load data
  const [homeData, uiData, quotesData, blogData, flagsData] = await Promise.all([
    fetchJSON("data/home.json"),
    fetchJSON("data/ui.json"),
    fetchJSON("data/quotes.json", []),
    fetchJSON("data/blog.json", []),
    fetchJSON("flags.json", {})
  ]);

  // Render Hero
  const hero = document.getElementById("hero");
  if (hero && homeData.hero) {
    hero.innerHTML = `
      <div class="container hero-wrap">
        <p class="hero-pill">${homeData.hero.pill}</p>
        <h1>${homeData.hero.title}</h1>
        <p>${homeData.hero.subtitle}</p>
        <div class="hero-cta">
          <a href="${homeData.hero.cta_href}" class="btn-primary">${homeData.hero.cta_text}</a>
        </div>
        <div id="quote-box"></div>
      </div>
    `;
  }

  // Quotes rotation (with soft fade)
  if (flagsData.hero_quotes === "on" && Array.isArray(quotesData) && quotesData.length) {
    const box = document.getElementById("quote-box");
    let index = 0;
    const changeMs = 7000;
    box.style.opacity = 1;

    function showQuote() {
      const q = quotesData[index];
      box.style.opacity = 0;
      setTimeout(() => {
        box.innerHTML = `${q.text}${q.author ? ` — ${q.author}` : ""}`;
        box.style.opacity = 1;
      }, 200);
      index = (index + 1) % quotesData.length;
    }
    showQuote();
    setInterval(showQuote, changeMs);
  }

  // Tools Grid
  const toolsGrid = document.getElementById("tools-grid");
  if (toolsGrid && uiData.tool_cards) {
    toolsGrid.innerHTML = uiData.tool_cards
      .filter(t => t.enabled)
      .sort((a,b)=>a.order-b.order)
      .map(t => `
        <div class="tool-card">
          <div>
            <h3>${t.title}</h3>
            <p>${t.desc}</p>
          </div>
          <a href="${t.href}">${t.cta_label}</a>
        </div>
      `)
      .join("");
  }

  // Blog Section
  const blogSection = document.getElementById("blog-section");
  if (blogSection) {
    const livePosts = (blogData || [])
      .filter(p => p.status === "live")
      .sort((a,b)=>new Date(b.publish_date)-new Date(a.publish_date));

    if (livePosts.length) {
      const featured = livePosts.find(p => p.pinned) || livePosts[0];
      const others = livePosts.filter(p => p.id !== featured.id).slice(0, 2);

      blogSection.innerHTML = `
        <div class="container">
          <h2>Latest from the Blog</h2>
          ${flagsData.ads_enabled && Array.isArray(flagsData.ads_layout) && flagsData.ads_layout.includes("above_blog")
            ? `<div class="ad-placeholder" style="max-width:1000px;margin:20px auto;">Ad Placeholder (Above Blog)</div>` : ""}

          <div class="blog-grid">
            <div class="featured">
              <img src="${featured.image}" alt="${featured.alt}">
              <h3>${featured.title}</h3>
              <p>${featured.summary}</p>
              <a href="${featured.href}">Read →</a>
            </div>

            ${others.map(p => `
              <div class="blog-card">
                <img src="${p.image}" alt="${p.alt}">
                <h4>${p.title}</h4>
                <p>${p.summary}</p>
                <a href="${p.href}">Read →</a>
              </div>
            `).join("")}
          </div>
        </div>
      `;
    } else {
      blogSection.innerHTML = ""; // hide if no posts
    }
  }

  // Optional Hero Ad (below hero content)
  const heroWrap = document.querySelector(".hero-wrap");
  if (flagsData.ads_enabled && Array.isArray(flagsData.ads_layout) && flagsData.ads_layout.includes("hero") && heroWrap) {
    const ad = document.createElement("div");
    ad.className = "ad-placeholder";
    ad.style.cssText = "max-width:1000px;margin:40px auto 0;";
    ad.textContent = "Ad Placeholder (Below Hero)";
    heroWrap.parentElement.appendChild(ad);
  }
})();
