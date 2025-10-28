// home.js
// Populates homepage sections using JSON data (home, ui, quotes, blog, flags)

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

  // Load all JSON files in parallel
  const [homeData, uiData, quotesData, blogData, flagsData] = await Promise.all([
    fetchJSON("/data/home.json"),
    fetchJSON("/data/ui.json"),
    fetchJSON("/data/quotes.json", []),
    fetchJSON("/data/blog.json", []),
    fetchJSON("/flags.json", {})
  ]);

  // Render Hero
  const hero = document.getElementById("hero");
  if (hero && homeData.hero) {
    hero.innerHTML = `
      <div class="container hero-wrap" style="text-align:center;padding:100px 20px;">
        <p class="hero-pill" style="color:#2563EB;font-weight:600;">${homeData.hero.pill}</p>
        <h1 style="font-family:Poppins,sans-serif;font-weight:700;font-size:2.4rem;margin:12px 0;">
          ${homeData.hero.title}
        </h1>
        <p style="color:#6B7280;max-width:640px;margin:0 auto 20px;">
          ${homeData.hero.subtitle}
        </p>
        <div class="hero-cta">
          <a href="${homeData.hero.cta_href}" class="btn-primary">${homeData.hero.cta_text}</a>
        </div>
        <div id="quote-box" style="margin-top:30px;font-style:italic;color:#475569;min-height:24px;"></div>
      </div>
    `;
  }

  // Hero Quotes rotation
  if (flagsData.hero_quotes === "on" && Array.isArray(quotesData) && quotesData.length) {
    const box = document.getElementById("quote-box");
    let index = 0;
    function showQuote() {
      const q = quotesData[index];
      box.innerHTML = `"${q.text}"${q.author ? ` — ${q.author}` : ""}`;
      index = (index + 1) % quotesData.length;
    }
    showQuote();
    setInterval(showQuote, 7000);
  }

  // Tools Grid
  const toolsGrid = document.getElementById("tools-grid");
  if (toolsGrid && uiData.tool_cards) {
    toolsGrid.innerHTML = uiData.tool_cards
      .filter(t => t.enabled)
      .sort((a,b)=>a.order-b.order)
      .map(t => `
        <div class="tool-card" style="background:#fff;border:1px solid #E5E7EB;border-radius:16px;padding:24px;box-shadow:0 4px 8px rgba(0,0,0,0.04);">
          <h3 style="color:#111827;font-weight:600;">${t.title}</h3>
          <p style="color:#374151;margin:10px 0 16px;">${t.desc}</p>
          <a href="${t.href}" style="color:#2563EB;font-weight:500;text-decoration:none;">${t.cta_label}</a>
        </div>
      `)
      .join("");
  }

  // Blog Section
  const blogSection = document.getElementById("blog-section");
  if (blogSection && blogData.length) {
    const livePosts = blogData.filter(p => p.status === "live").sort((a,b)=>new Date(b.publish_date)-new Date(a.publish_date));
    const featured = livePosts.find(p => p.pinned) || livePosts[0];
    const others = livePosts.filter(p => p.id !== featured.id).slice(0, 2);

    blogSection.innerHTML = `
      <h2 style="text-align:center;font-family:Poppins,sans-serif;">Latest from the Blog</h2>
      ${flagsData.ads_enabled && flagsData.ads_layout?.includes("above_blog") ? `<div class="ad-placeholder" style="margin:20px auto;padding:20px;border:2px dashed #E5E7EB;background:#F3F4F6;text-align:center;color:#6B7280;">Ad Placeholder (Above Blog)</div>` : ""}
      <div class="blog-grid" style="display:grid;gap:24px;max-width:1000px;margin:40px auto;">
        <div class="featured" style="grid-column:1/-1;background:#fff;border-radius:16px;box-shadow:0 4px 8px rgba(0,0,0,0.05);padding:20px;">
          <img src="${featured.image}" alt="${featured.alt}" style="width:100%;border-radius:12px;margin-bottom:16px;">
          <h3>${featured.title}</h3>
          <p>${featured.summary}</p>
          <a href="${featured.href}" style="color:#2563EB;text-decoration:none;">Read →</a>
        </div>
        ${others.map(p=>`
          <div class="blog-card" style="background:#fff;border-radius:12px;box-shadow:0 2px 6px rgba(0,0,0,0.04);padding:16px;">
            <img src="${p.image}" alt="${p.alt}" style="width:100%;border-radius:8px;margin-bottom:12px;">
            <h4>${p.title}</h4>
            <p style="color:#374151;font-size:14px;">${p.summary}</p>
            <a href="${p.href}" style="color:#2563EB;text-decoration:none;font-weight:500;">Read →</a>
          </div>
        `).join("")}
      </div>
    `;
  }

  // Optional Hero Ad
  const heroWrap = document.querySelector(".hero-wrap");
  if (flagsData.ads_enabled && flagsData.ads_layout?.includes("hero") && heroWrap) {
    const ad = document.createElement("div");
    ad.className = "ad-placeholder";
    ad.style.cssText = "margin:40px auto;padding:20px;border:2px dashed #E5E7EB;background:#F3F4F6;text-align:center;color:#6B7280;";
    ad.textContent = "Ad Placeholder (Below Hero)";
    heroWrap.appendChild(ad);
  }
})();
