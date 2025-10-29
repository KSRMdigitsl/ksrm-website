// tool-pdf.js — Merge, Split, (basic) Compress PDFs in-browser with thumbnails
(function(){
  const $ = id => document.getElementById(id);
  const fmtBytes = b => {
    if (!Number.isFinite(b)) return "—";
    const u = ["B","KB","MB","GB"]; let i = 0, n = b;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return `${n.toFixed(i===0?0:2)} ${u[i]}`;
  };

  // ---------- STATE ----------
  let tab = "merge";
  let mergeFiles = [];     // [{file, ab, pages, thumbUrl, size}]
  let splitFile = null;    // same shape as element in mergeFiles
  let compressFile = null; // idem
  let outputs = [];        // [{name, blob, size, url}]

  // ---------- TABS ----------
  const tabBtns = document.querySelectorAll(".tab-btn");
  tabBtns.forEach(btn => btn.addEventListener("click", () => {
    tabBtns.forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    tab = btn.dataset.tab;
    $("tab-merge").style.display    = tab==="merge"    ? "block" : "none";
    $("tab-split").style.display    = tab==="split"    ? "block" : "none";
    $("tab-compress").style.display = tab==="compress" ? "block" : "none";
    render();
  }));

  // ---------- DROPZONES ----------
  function wireDropzone(el, onFiles) {
    ["dragenter","dragover"].forEach(ev => el.addEventListener(ev, e => {
      e.preventDefault(); e.stopPropagation(); el.classList.add("drag");
    }));
    ["dragleave","drop"].forEach(ev => el.addEventListener(ev, e => {
      e.preventDefault(); e.stopPropagation(); el.classList.remove("drag");
    }));
    el.addEventListener("drop", e => {
      const files = Array.from(e.dataTransfer.files || []).filter(f => f.type === "application/pdf");
      onFiles(files);
    });
  }

  wireDropzone($("dz-merge"), files => addMergeFiles(files));
  wireDropzone($("dz-split"), files => { if (files[0]) addSplitFile(files[0]); });
  wireDropzone($("dz-compress"), files => { if (files[0]) addCompressFile(files[0]); });

  $("pick-merge").addEventListener("change", e => {
    const files = Array.from(e.target.files || []).filter(f => f.type === "application/pdf");
    addMergeFiles(files); e.target.value = "";
  });
  $("pick-split").addEventListener("change", e => {
    const f = (e.target.files||[])[0]; if (f) addSplitFile(f); e.target.value="";
  });
  $("pick-compress").addEventListener("change", e => {
    const f = (e.target.files||[])[0]; if (f) addCompressFile(f); e.target.value="";
  });

  // ---------- LOADERS & THUMBNAILS ----------
  async function fileToArrayBuffer(file) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = rej;
      fr.readAsArrayBuffer(file);
    });
  }

  async function renderThumbFromAB(ab) {
    if (!window.pdfjsLib) return null;
    const loadingTask = pdfjsLib.getDocument({ data: ab });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 0.25 }); // small thumb
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas.toDataURL("image/webp", 0.8);
  }

  async function addMergeFiles(files) {
    for (const f of files) {
      try {
        const ab = await fileToArrayBuffer(f);
        const { PDFDocument } = window.PDFLib;
        const pdf = await PDFDocument.load(ab);
        const thumbUrl = await renderThumbFromAB(ab);
        mergeFiles.push({ file: f, ab, pages: pdf.getPageCount(), thumbUrl, size: f.size });
      } catch (e) {
        alert(`Failed to read ${f.name}`);
      }
    }
    render();
  }

  async function addSplitFile(file) {
    try {
      const ab = await fileToArrayBuffer(file);
      const { PDFDocument } = window.PDFLib;
      const pdf = await PDFDocument.load(ab);
      const thumbUrl = await renderThumbFromAB(ab);
      splitFile = { file, ab, pages: pdf.getPageCount(), thumbUrl, size: file.size };
      render();
    } catch (e) {
      alert(`Failed to read ${file.name}`);
    }
  }

  async function addCompressFile(file) {
    try {
      const ab = await fileToArrayBuffer(file);
      const { PDFDocument } = window.PDFLib;
      const pdf = await PDFDocument.load(ab);
      const thumbUrl = await renderThumbFromAB(ab);
      compressFile = { file, ab, pages: pdf.getPageCount(), thumbUrl, size: file.size };
      render();
    } catch (e) {
      alert(`Failed to read ${file.name}`);
    }
  }

  // ---------- ACTIONS ----------
  $("run-merge").addEventListener("click", async () => {
    if (mergeFiles.length < 2) { alert("Please add at least two PDFs to merge."); return; }
    try {
      const { PDFDocument } = window.PDFLib;
      const merged = await PDFDocument.create();
      for (const f of mergeFiles) {
        const src = await PDFDocument.load(f.ab);
        const pages = await merged.copyPages(src, src.getPageIndices());
        pages.forEach(p => merged.addPage(p));
      }
      const bytes = await merged.save({ useObjectStreams: true });
      const blob = new Blob([bytes], { type: "application/pdf" });
      const name = ($("mergeName").value || "merged.pdf").trim() || "merged.pdf";
      addOutput(name, blob);
    } catch (e) {
      console.error(e);
      alert("Merge failed. Please try different files.");
    }
  });

  $("run-split").addEventListener("click", async () => {
    if (!splitFile) { alert("Please add a PDF to split."); return; }
    const range = ($("splitRange").value || "").trim();
    if (!range) { alert("Enter a page range (e.g., 1-3,6,9-10)."); return; }
    const indices = parseRange(range, splitFile.pages);
    if (indices.length === 0) { alert("No valid pages in range."); return; }

    try {
      const { PDFDocument } = window.PDFLib;
      const src = await PDFDocument.load(splitFile.ab);
      const out = await PDFDocument.create();
      const pages = await out.copyPages(src, indices.map(i => i-1));
      pages.forEach(p => out.addPage(p));
      const bytes = await out.save({ useObjectStreams: true });
      const blob = new Blob([bytes], { type: "application/pdf" });
      const name = ($("splitName").value || "split.pdf").trim() || "split.pdf";
      addOutput(name, blob);
    } catch (e) {
      console.error(e);
      alert("Split failed. Please try again.");
    }
  });

  $("run-compress").addEventListener("click", async () => {
    if (!compressFile) { alert("Please add a PDF to compress."); return; }
    try {
      // Basic recompress: reload + save with object streams (often shrinks metadata/structure)
      const { PDFDocument } = window.PDFLib;
      const src = await PDFDocument.load(compressFile.ab);
      const bytes = await src.save({ useObjectStreams: true });
      const blob = new Blob([bytes], { type: "application/pdf" });
      const name = ($("compressName").value || "compressed.pdf").trim() || "compressed.pdf";
      addOutput(name, blob);
    } catch (e) {
      console.error(e);
      alert("Compress failed. Some PDFs won’t reduce without image downscaling (coming soon).");
    }
  });

  $("clear-merge").addEventListener("click", () => { mergeFiles = []; render(); });
  $("clear-split").addEventListener("click", () => { splitFile = null; render(); });
  $("clear-compress").addEventListener("click", () => { compressFile = null; render(); });

  // ---------- RANGE PARSER ----------
  function parseRange(s, max) {
    // "1-3,6,8-10" -> [1,2,3,6,8,9,10] within [1..max]
    const out = new Set();
    s.split(",").map(t => t.trim()).filter(Boolean).forEach(tok => {
      if (/^\d+$/.test(tok)) {
        const n = Number(tok); if (n>=1 && n<=max) out.add(n);
      } else {
        const m = tok.match(/^(\d+)-(\d+)$/);
        if (m) {
          let a = Number(m[1]), b = Number(m[2]);
          if (a>b) [a,b] = [b,a];
          for (let i=a;i<=b;i++) if (i>=1 && i<=max) out.add(i);
        }
      }
    });
    return Array.from(out).sort((a,b)=>a-b);
  }

  // ---------- RESULTS RENDER ----------
  function addOutput(name, blob) {
    const url = URL.createObjectURL(blob);
    outputs.unshift({ name, blob, url, size: blob.size });
    render();
  }

  function removeOutput(idx) {
    const o = outputs[idx];
    if (o && o.url) URL.revokeObjectURL(o.url);
    outputs.splice(idx,1);
  }

  function render() {
    // KPIs
    let fileCount = 0, totalSize = 0;
    if (tab === "merge") {
      fileCount = mergeFiles.length;
      totalSize = mergeFiles.reduce((a,f)=>a+(f.size||0),0);
    } else if (tab === "split") {
      fileCount = splitFile ? 1 : 0;
      totalSize = splitFile ? splitFile.size : 0;
    } else {
      fileCount = compressFile ? 1 : 0;
      totalSize = compressFile ? compressFile.size : 0;
    }
    $("kpi-count").textContent = fileCount || "—";
    $("kpi-size").textContent  = fileCount ? fmtBytes(totalSize) : "—";
    $("kpi-output").textContent = outputs.length ? fmtBytes(outputs[0].size) : "—";
    $("summary").style.display = (fileCount || outputs.length) ? "grid" : "none";

    // Cards
    const resultsEl = $("results");
    if (!resultsEl) return;

    const pendingCards = [];
    if (tab === "merge") {
      mergeFiles.forEach((f, idx) => pendingCards.push(cardFile(f, { showOrder:true, idx, list:"merge" })));
    } else if (tab === "split" && splitFile) {
      pendingCards.push(cardFile(splitFile, { list:"split" }));
    } else if (tab === "compress" && compressFile) {
      pendingCards.push(cardFile(compressFile, { list:"compress" }));
    }

    const outputCards = outputs.map((o, i) => cardOutput(o, i));
    const empty =
      pendingCards.length === 0 && outputCards.length === 0
        ? `<div class="card"><div class="meta" style="text-align:center"><small>No PDFs yet. Drop files on the left to begin.</small></div></div>`
        : "";

    resultsEl.innerHTML = outputCards.join("") + pendingCards.join("") + empty;

    // Wire output buttons
    outputs.forEach((o, i) => {
      const dl = document.querySelector(`#out-dl-${i}`);
      const rm = document.querySelector(`#out-rm-${i}`);
      dl && dl.addEventListener("click", () => {
        const a = document.createElement("a");
        a.href = o.url; a.download = o.name; document.body.appendChild(a); a.click(); a.remove();
      });
      rm && rm.addEventListener("click", () => { removeOutput(i); render(); });
    });

    // Wire reorder/remove for merge list
    if (tab === "merge") {
      mergeFiles.forEach((f, i) => {
        const up = document.querySelector(`#m-up-${i}`);
        const dn = document.querySelector(`#m-dn-${i}`);
        const rm = document.querySelector(`#m-rm-${i}`);
        up && up.addEventListener("click", () => { if (i>0) { [mergeFiles[i-1],mergeFiles[i]]=[mergeFiles[i],mergeFiles[i-1]]; render(); }});
        dn && dn.addEventListener("click", () => { if (i<mergeFiles.length-1) { [mergeFiles[i+1],mergeFiles[i]]=[mergeFiles[i],mergeFiles[i+1]]; render(); }});
        rm && rm.addEventListener("click", () => { mergeFiles.splice(i,1); render(); });
      });
    }
  }

  function cardFile(f, opts) {
    const t = f.file ? f.file.name : "PDF";
    const thumb = f.thumbUrl ? `<img class="thumb" alt="" src="${f.thumbUrl}">` : `<div class="thumb"></div>`;
    const orderBtns = opts && opts.showOrder ? `
      <div class="actions">
        <button id="m-up-${opts.idx}" class="btn-primary">↑</button>
        <button id="m-dn-${opts.idx}" class="btn-primary">↓</button>
        <button id="m-rm-${opts.idx}" class="btn-primary" style="background:#94A3B8">Remove</button>
      </div>` : ``;

    return `
      <div class="card">
        ${thumb}
        <div class="meta">
          <div><strong title="${escapeHTML(t)}">${escapeHTML(t)}</strong></div>
          <small>${f.pages || "?"} page(s) • ${fmtBytes(f.size || 0)}</small>
        </div>
        ${orderBtns}
      </div>
    `;
  }

  function cardOutput(o, idx) {
    return `
      <div class="card">
        <div class="meta">
          <div><strong title="${escapeHTML(o.name)}">${escapeHTML(o.name)}</strong></div>
          <small>Output • ${fmtBytes(o.size || 0)}</small>
        </div>
        <div class="actions">
          <button id="out-dl-${idx}" class="btn-primary">Download</button>
          <button id="out-rm-${idx}" class="btn-primary" style="background:#94A3B8">Remove</button>
        </div>
      </div>
    `;
  }

  const escapeHTML = s => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  // initial render
  render();
})();
