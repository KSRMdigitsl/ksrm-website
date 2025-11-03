// tool-pdf.js — KSRM Digital (pdf-lib based, client-side)
(() => {
  const { PDFDocument, degrees } = window.PDFLib || {};
  const $ = sel => document.querySelector(sel);
  const outBox = $('#outBox');

  // ---- Mode tabs ----
  const modeChips = $('#modeChips');
  modeChips.addEventListener('click', e => {
    const btn = e.target.closest('.chip');
    if(!btn) return;
    const mode = btn.dataset.mode;
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('is-on'));
    btn.classList.add('is-on');
    document.querySelectorAll('.mode').forEach(m => m.style.display = 'none');
    $('#mode-' + mode).style.display = '';
    outBox.innerHTML = `<div class="hint">Run a tool to see download links and thumbnails.</div>`;
  });

  // Helpers
  const readAsArrayBuffer = f => new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsArrayBuffer(f); });
  const saveBlob = (bytes, name) => {
    const blob = new Blob([bytes], {type:'application/pdf'});
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = href; a.download = name; a.click();
    setTimeout(()=>URL.revokeObjectURL(href), 5000);
    return { blob, href };
  };
  const fmtSize = b => {
    if (b == null || isNaN(b)) return '—';
    const u=['B','KB','MB','GB']; let i=0, n=b; while(n>=1024&&i<u.length-1){n/=1024;i++;}
    return `${n.toFixed(i?2:0)} ${u[i]}`;
  };

  // Basic PDF page thumbnails (placeholder: we show page numbers; proper raster preview needs extra libs)
  function renderThumbs(nPages){
    const frag = document.createDocumentFragment();
    for(let i=1;i<=nPages;i++){
      const el = document.createElement('span');
      el.className = 'thumb';
      el.textContent = `Page ${i}`;
      frag.appendChild(el);
    }
    return frag;
  }

  // ---- MERGE ----
  $('#btnMerge').addEventListener('click', async () => {
    try{
      const files = $('#mergeFiles').files;
      if(!files || !files.length) return alert('Select PDFs to merge.');

      const outPdf = await PDFDocument.create();
      let totalPages = 0;
      for (const f of files){
        const bytes = await readAsArrayBuffer(f);
        const src = await PDFDocument.load(bytes);
        const copied = await outPdf.copyPages(src, src.getPageIndices());
        copied.forEach(p => outPdf.addPage(p));
        totalPages += src.getPageCount();
      }
      const outBytes = await outPdf.save({ useObjectStreams: true });
      outBox.innerHTML = `<div><strong>Merged</strong> ${files.length} files, <strong>${totalPages}</strong> pages. <br><em>Approx size:</em> ${fmtSize(outBytes.byteLength)}</div>`;
      const { href } = saveBlob(outBytes, 'merged.pdf');
      const link = document.createElement('div');
      link.style.marginTop = '8px';
      link.innerHTML = `<a class="btn" href="${href}" download="merged.pdf">Download merged.pdf</a>`;
      outBox.appendChild(link);
      outBox.appendChild(renderThumbs(totalPages));
    }catch(err){ console.error(err); alert('Merge failed. Try smaller files or fewer at once.'); }
  });

  // ---- SPLIT ----
  function parseRanges(rangesStr, max){
    if(!rangesStr) return Array.from({length:max},(_,i)=>i+1); // all single pages
    const set = new Set();
    rangesStr.split(',').map(s=>s.trim()).forEach(part=>{
      if(!part) return;
      if(part.includes('-')){
        const [a,b] = part.split('-').map(n=>parseInt(n,10));
        if(a>=1 && b>=a && b<=max){ for(let x=a;x<=b;x++) set.add(x); }
      }else{
        const n = parseInt(part,10);
        if(n>=1 && n<=max) set.add(n);
      }
    });
    return Array.from(set).sort((a,b)=>a-b);
  }

  $('#btnSplit').addEventListener('click', async () => {
    try{
      const f = $('#splitFile').files?.[0];
      if(!f) return alert('Choose a PDF to split.');
      const bytes = await readAsArrayBuffer(f);
      const src = await PDFDocument.load(bytes);
      const n = src.getPageCount();
      const req = parseRanges($('#ranges').value, n);
      if(!req.length) return alert('No valid pages to extract.');

      const out = await PDFDocument.create();
      const copy = await out.copyPages(src, req.map(p=>p-1));
      copy.forEach(p => out.addPage(p));
      const outBytes = await out.save({ useObjectStreams: true });
      outBox.innerHTML = `<div><strong>Split</strong> selected ${req.length} page(s) from ${n}. <br><em>Approx size:</em> ${fmtSize(outBytes.byteLength)}</div>`;
      const { href } = saveBlob(outBytes, `split_${req[0]}-${req[req.length-1]}.pdf`);
      const link = document.createElement('div');
      link.style.marginTop='8px';
      link.innerHTML = `<a class="btn" href="${href}" download="split.pdf">Download split.pdf</a>`;
      outBox.appendChild(link);
      outBox.appendChild(renderThumbs(req.length));
    }catch(err){ console.error(err); alert('Split failed. Ensure the PDF is valid and not encrypted.'); }
  });

  // ---- ROTATE ----
  $('#btnRotate').addEventListener('click', async () => {
    try{
      const f = $('#rotFile').files?.[0];
      if(!f) return alert('Choose a PDF to rotate.');
      const deg = parseInt($('#rotDeg').value, 10) || 90;
      const bytes = await readAsArrayBuffer(f);
      const pdf = await PDFDocument.load(bytes);
      const pages = pdf.getPages();
      pages.forEach(p => p.setRotation(degrees(deg)));
      const outBytes = await pdf.save({ useObjectStreams: true });
      outBox.innerHTML = `<div>Rotated <strong>${pages.length}</strong> page(s) by <strong>${deg}°</strong>. <br><em>Approx size:</em> ${fmtSize(outBytes.byteLength)}</div>`;
      const { href } = saveBlob(outBytes, `rotated_${deg}.pdf`);
      const link = document.createElement('div');
      link.style.marginTop='8px';
      link.innerHTML = `<a class="btn" href="${href}" download="rotated.pdf">Download rotated.pdf</a>`;
      outBox.appendChild(link);
      outBox.appendChild(renderThumbs(pages.length));
    }catch(err){ console.error(err); alert('Rotate failed.'); }
  });

  // ---- OPTIMIZE ----
  $('#btnOptimize').addEventListener('click', async () => {
    try{
      const f = $('#optFile').files?.[0];
      if(!f) return alert('Choose a PDF to optimize.');
      const bytes = await readAsArrayBuffer(f);
      const pdf = await PDFDocument.load(bytes);
      // Re-save with object streams (may reduce size a bit)
      const outBytes = await pdf.save({ useObjectStreams: true });
      const saved = bytes.byteLength - outBytes.byteLength;
      outBox.innerHTML = `<div>Optimized: <strong>${fmtSize(bytes.byteLength)}</strong> → <strong>${fmtSize(outBytes.byteLength)}</strong> (${saved>0?((saved/bytes.byteLength*100).toFixed(1)+'% saved'):'no change'})</div>`;
      const { href } = saveBlob(outBytes, `optimized.pdf`);
      const link = document.createElement('div');
      link.style.marginTop='8px';
      link.innerHTML = `<a class="btn" href="${href}" download="optimized.pdf">Download optimized.pdf</a>`;
      outBox.appendChild(link);
    }catch(err){ console.error(err); alert('Optimize failed. Encrypted or malformed PDFs may not process.'); }
  });
})();
