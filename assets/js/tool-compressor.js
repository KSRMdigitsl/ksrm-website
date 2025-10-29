// tool-compressor.js — Image compressor (JPEG/WEBP/PNG) + GZIP any file (CompressionStream)
(function(){
  // ---------- helpers ----------
  const $ = (id) => document.getElementById(id);
  const fmtBytes = (b) => {
    if (isNaN(b)) return "—";
    const u = ["B","KB","MB","GB"];
    let i = 0, n = b;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return `${n.toFixed( (i===0)?0:2 )} ${u[i]}`;
  };

  // simple event helper
  const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

  // state
  let imageFiles = [];   // File[]
  let gzipFiles  = [];   // File[]
  let results = [];      // [{ kind: 'image'|'gzip', name, blob, origSize, outSize, url, previewUrl? }]

  // ---------- tabs ----------
  const tabs = document.querySelectorAll(".tab-btn");
  tabs.forEach(btn=>{
    on(btn, "click", ()=>{
      tabs.forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.dataset.tab;
      $("tab-images").style.display = (tab==="images") ? "block" : "none";
      $("tab-gzip").style.display   = (tab==="gzip")   ? "block" : "none";
    });
  });

  // ---------- image picking / drop ----------
  function wireDropzone(dzEl, onFiles){
    ["dragenter","dragover"].forEach(ev=>{
      on(dzEl, ev, e => { e.preventDefault(); e.stopPropagation(); dzEl.classList.add("drag"); });
    });
    ["dragleave","drop"].forEach(ev=>{
      on(dzEl, ev, e => { e.preventDefault(); e.stopPropagation(); dzEl.classList.remove("drag"); });
    });
    on(dzEl, "drop", e => {
      const files = Array.from(e.dataTransfer.files || []);
      onFiles(files);
    });
  }
  wireDropzone($("dz-images"), files => {
    const imgs = files.filter(f => /^image\//.test(f.type));
    imageFiles = imageFiles.concat(imgs);
    renderResultsPlaceholder();
  });
  wireDropzone($("dz-gzip"), files => {
    gzipFiles = gzipFiles.concat(files);
    renderResultsPlaceholder();
  });

  on($("pick-images"), "change", e => {
    const files = Array.from(e.target.files || []);
    const imgs = files.filter(f => /^image\//.test(f.type));
    imageFiles = imageFiles.concat(imgs);
    e.target.value = "";
    renderResultsPlaceholder();
  });
  on($("pick-gzip"), "change", e => {
    const files = Array.from(e.target.files || []);
    gzipFiles = gzipFiles.concat(files);
    e.target.value = "";
    renderResultsPlaceholder();
  });

  // quality display
  on($("quality"), "input", () => { $("quality-val").textContent = Number($("quality").value).toFixed(2); });

  // ---------- image compression ----------
  async function compressImageFile(file, { format, quality, maxw, maxh }) {
    const dataURL = await fileToDataURL(file);
    const img = await loadImage(dataURL);

    // compute target dimensions
    let { width, height } = img;
    const limitW = Number(maxw||0), limitH = Number(maxh||0);
    if (limitW>0 || limitH>0) {
      const wr = limitW>0 ? (limitW / width) : 1;
      const hr = limitH>0 ? (limitH / height) : 1;
      const r = Math.min(wr||1, hr||1, 1);
      width = Math.floor(width * r);
      height = Math.floor(height * r);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await canvasToBlob(canvas, format, quality);
    const previewUrl = await canvasToDataURL(canvas, "image/webp", 0.8); // small preview for card
    const outName = renameWithExt(file.name, mimeToExt(format));
    return { blob, previewUrl, outName };
  }

  function fileToDataURL(file){
    return new Promise((res, rej)=>{
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = rej;
      fr.readAsDataURL(file);
    });
  }
  function loadImage(dataURL){
    return new Promise((res, rej)=>{
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = dataURL;
    });
  }
  function canvasToBlob(canvas, type, quality){
    return new Promise((res, rej)=>{
      canvas.toBlob(blob => {
        if (!blob) rej(new Error("Canvas toBlob failed"));
        else res(blob);
      }, type, quality);
    });
  }
  function canvasToDataURL(canvas, type, quality){
    return Promise.resolve(canvas.toDataURL(type, quality));
  }
  function mimeToExt(mime){
    if (mime==="image/webp") return "webp";
    if (mime==="image/jpeg") return "jpg";
    if (mime==="image/png") return "png";
    return "bin";
  }
  function renameWithExt(name, ext){
    const dot = name.lastIndexOf(".");
    if (dot>0) return name.slice(0, dot) + "." + ext;
    return name + "." + ext;
  }

  // ---------- gzip ----------
  const hasCompressionStream = ("CompressionStream" in window);

  async function gzipFile(file){
    if (!hasCompressionStream) throw new Error("CompressionStream not supported in this browser");
    const cs = new CompressionStream("gzip");
    const out = file.stream().pipeThrough(cs);
    const blob = await new Response(out).blob();
    const outName = file.name + ".gz";
    return { blob, outName };
  }

  // ---------- render results ----------
  function renderResultsPlaceholder(){
    const resultsEl = $("results");
    const empty = imageFiles.length===0 && gzipFiles.length===0 && results.length===0;
    if (!resultsEl) return;

    if (empty) {
      resultsEl.innerHTML = `
        <div class="card">
          <div class="meta" style="text-align:center">
            <small>No files yet. Drop some images or files to get started.</small>
          </div>
        </div>`;
      $("summary").style.display = "none";
      return;
    }

    // show current picked (pending) + processed results
    const pending = [
      ...imageFiles.map(f => ({ kind:"image", name:f.name, origSize:f.size })),
      ...gzipFiles.map(f => ({ kind:"gzip",  name:f.name, origSize:f.size }))
    ];

    const cards = [
      ...results.map(r => cardHTMLProcessed(r)),
      ...pending.map(p => cardHTMLPending(p))
    ].join("");

    resultsEl.innerHTML = cards;

    // summary
    const orig = [...results].reduce((a,b)=>a + (b.origSize||0), 0) + pending.reduce((a,b)=>a + (b.origSize||0), 0);
    const comp = [...results].reduce((a,b)=>a + (b.outSize||0), 0);
    $("kpi-orig").textContent = fmtBytes(orig);
    $("kpi-comp").textContent = fmtBytes(comp);
    $("kpi-saved").textContent = (orig>0 && comp>0) ? `${((1 - comp/orig)*100).toFixed(1)}%` : "—";
    $("summary").style.display = "grid";

    // wire per-card actions
    results.forEach((r, idx) => {
      const dlBtn = document.querySelector(`#dl-${idx}`);
      const rmBtn = document.querySelector(`#rm-${idx}`);
      if (dlBtn) on(dlBtn, "click", () => downloadBlob(r.blob, r.name));
      if (rmBtn) on(rmBtn, "click", () => { results.splice(idx,1); renderResultsPlaceholder(); });
    });
  }

  function cardHTMLPending(p){
    const tag = p.kind === "image" ? "Image (pending)" : "GZIP (pending)";
    return `
      <div class="card">
        <img class="thumb" alt="" src="" style="display:none" />
        <div class="meta">
          <div><strong>${escapeHTML(p.name)}</strong></div>
          <small>${tag}</small>
          <small>Original: ${fmtBytes(p.origSize || 0)}</small>
        </div>
        <div class="actions">
          <button class="btn-primary" disabled>Waiting…</button>
        </div>
      </div>
    `;
  }

  function cardHTMLProcessed(r){
    const idx = results.indexOf(r);
    const tag = r.kind === "image" ? "Image" : "GZIP";
    const preview = r.previewUrl ? `<img class="thumb" alt="" src="${r.previewUrl}" />` : `<div class="thumb"></div>`;
    const saved = (r.origSize>0) ? `${((1 - r.outSize/r.origSize)*100).toFixed(1)}%` : "—";
    return `
      <div class="card">
        ${preview}
        <div class="meta">
          <div><strong title="${escapeHTML(r.name)}">${escapeHTML(r.name)}</strong></div>
          <small>${tag}</small>
          <small>Original: ${fmtBytes(r.origSize||0)} &nbsp;•&nbsp; Compressed: ${fmtBytes(r.outSize||0)}</small>
          <small>Saved: ${saved}</small>
        </div>
        <div class="actions">
          <button id="dl-${idx}" class="btn-primary">Download</button>
          <button id="rm-${idx}" class="btn-primary" style="background:#94A3B8">Remove</button>
        </div>
      </div>
    `;
  }

  function escapeHTML(s){ return s.replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }

  function downloadBlob(blob, name){
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 0);
  }

  // ---------- run actions ----------
  on($("run-images"), "click", async ()=>{
    if (imageFiles.length === 0) { alert("Please add some images first."); return; }
    const format = $("format").value;
    const quality = Number($("quality").value || "0.8");
    const maxw = Number($("maxw").value || "0");
    const maxh = Number($("maxh").value || "0");

    // process sequentially to avoid memory spikes
    for (const f of imageFiles) {
      try {
        const { blob, previewUrl, outName } = await compressImageFile(f, { format, quality, maxw, maxh });
        results.unshift({
          kind: "image",
          name: outName,
          blob,
          origSize: f.size,
          outSize: blob.size,
          url: null,
          previewUrl
        });
      } catch(e) {
        console.error("Compress error:", e);
        alert(`Failed to compress ${f.name}`);
      }
      renderResultsPlaceholder();
    }
    imageFiles = [];
    renderResultsPlaceholder();
  });

  on($("clear-images"), "click", ()=>{
    imageFiles = [];
    renderResultsPlaceholder();
  });

  on($("run-gzip"), "click", async ()=>{
    if (gzipFiles.length === 0) { alert("Please add some files first."); return; }
    if (!hasCompressionStream) { alert("GZIP not supported in this browser (CompressionStream). Try Chrome or Edge."); return; }

    for (const f of gzipFiles) {
      try {
        const { blob, outName } = await gzipFile(f);
        results.unshift({
          kind: "gzip",
          name: outName,
          blob,
          origSize: f.size,
          outSize: blob.size,
          url: null
        });
      } catch(e) {
        console.error("GZIP error:", e);
        alert(`Failed to gzip ${f.name}`);
      }
      renderResultsPlaceholder();
    }
    gzipFiles = [];
    renderResultsPlaceholder();
  });

  on($("clear-gzip"), "click", ()=>{
    gzipFiles = [];
    renderResultsPlaceholder();
  });

  // init
  renderResultsPlaceholder();
})();
