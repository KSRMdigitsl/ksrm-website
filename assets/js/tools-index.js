// tools-index.js — render all enabled tools from /data/ui.json
(async function(){
  async function fetchJSON(path, fallback=[]) {
    try {
      const r = await fetch(path + "?v=" + Date.now());
      if (!r.ok) throw 0;
      return await r.json();
    } catch { return fallback; }
  }
  const ui = await fetchJSON("../data/ui.json", { tool_cards: [] });
  const grid = document.getElementById("tools-grid");
  if (!grid) return;

  grid.innerHTML = (ui.tool_cards || [])
    .filter(t => t.enabled)
    .sort((a,b)=>(a.order||0)-(b.order||0))
    .map(t => `
      <div class="tool-card">
        <div>
          <h3>${t.title}</h3>
          <p>${t.desc}</p>
        </div>
        <a href="${t.href}">${t.cta_label || "Open tool"}</a>
      </div>
    `)
    .join("");
})();
