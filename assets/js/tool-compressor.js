// tool-compressor.js — KSRM Digital
(() => {
  const $ = sel => document.querySelector(sel);
  const tbody = $('#tbody');
  const fmt = b => {
    if (b == null || isNaN(b)) return '—';
    const units = ['B','KB','MB','GB']; let i = 0; let n = b;
    while (n >= 1024 && i < units.length-1){ n/=1024; i++; }
    return `${n.toFixed( (i===0)?0:2 )} ${units[i]}`;
  };

  const state = {
    files: [],           // File[]
    outputs: []          // { name, blob, href, size, origSize, isImage }
  };

  // --- UI wiring ---
  const fileInput = $('#file');
  const drop = $('#drop');
  const btnRun = $('#btnRun');
  const btnClear = $('#btnClear');
  const btnZip = $('#btnZip');
  const quality = $('#quality');
  const qv = $('#qv');
  const maxw = $('#maxw');
  const maxh = $('#maxh');
  const format = $('#format');

  quality.addEventListener('input', () => qv.textContent = (+quality.value).toFixed(2));

  drop.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', e => addFiles(e.target.files));

  drop.addEventListener('dragover', e => { e.preventDefault(); drop.style.background='#EEF2FF'; });
  drop.addEventListener('dragleave', e => { drop.style.background='#F8FAFF'; });
  drop.addEventListener('drop', e => {
    e.preventDefault(); drop.style.background='#F8FAFF';
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
  });

  btnRun.addEventListener('click', compressAll);
  btnClear.addEventListener('click', clearAll);
  btnZip.addEventListener('click', downloadZip);

  function addFiles(fileList){
    for (const f of fileList){
      state.files.push(f);
    }
    renderTableSkeleton();
  }

  function clearAll(){
    state.files = [];
    state.outputs.forEach(o => URL.revokeObjectURL(o.href));
    state.outputs = [];
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#6B7280;padding:16px">Add files to begin.</td></tr>`;
  }

  function renderTableSkeleton(){
    if (state.files.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#6B7280;padding:16px">Add files to begin.</td></tr>`;
      return;
    }
    tbody.innerHTML = state.files.map((f, idx) => `
      <tr id="row-${idx}">
        <td>${f.name}</td>
        <td id="prev-${idx}">—</td>
        <td>${fmt(f.size)}</td>
        <td id="comp-${idx}">—</td>
        <td id="save-${idx}">—</td>
        <td class="out-actions" id="dl-${idx}">—</td>
      </tr>
    `).join('');
  }

  async function compressAll(){
    if (state.files.length === 0) return;

    // cleanup previous outputs
    state.outputs.forEach(o => URL.revokeObjectURL(o.href));
    state.outputs = [];

    for (let i=0; i<state.files.length; i++){
      const f = state.files[i];
      if (f.type.startsWith('image/')){
        await handleImage(f, i);
      } else {
        await handleGzip(f, i);
      }
    }
  }

  function getTargetFormat(file){
    const sel = format.value;
    if (sel !== 'auto') return sel;
    // Auto: if PNG or WEBP keep type, else JPEG for heavy photos
    if (file.type === 'image/png' || file.type === 'image/webp') return file.type;
    return 'image/jpeg';
  }

  function computeTargetSize(w, h, maxW, maxH){
    if (!maxW && !maxH) return {w, h};
    let tw = w, th = h;
    if (maxW && tw > maxW){
      const s = maxW / tw; tw = maxW; th = Math.round(th * s);
    }
    if (maxH && th > maxH){
      const s = maxH / th; th = maxH; tw = Math.round(tw * s);
    }
    return { w: tw, h: th };
  }

  function loadImage(file){
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  async function handleImage(file, idx){
    try{
      const img = await loadImage(file);
      const q = Math.min(1, Math.max(0.1, +quality.value || 0.7));
      const outType = getTargetFormat(file);

      const mw = parseInt(maxw.value,10) || 0;
      const mh = parseInt(maxh.value,10) || 0;
      const t = computeTargetSize(img.naturalWidth, img.naturalHeight, mw, mh);

      const canvas = document.createElement('canvas');
      canvas.width = t.w; canvas.height = t.h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, t.w, t.h);

      const blob = await new Promise(res => canvas.toBlob(res, outType, q));
      const href = URL.createObjectURL(blob);
      const name = renameWithExt(file.name, outType);

      // preview
      $('#prev-'+idx).innerHTML = `<img class="thumb" src="${href}" alt="">`;
      // sizes
      $('#comp-'+idx).textContent = fmt(blob.size);
      const saved = Math.max(0, file.size - blob.size);
      $('#save-'+idx).textContent = `${fmt(saved)} (${((saved/file.size)*100).toFixed(1)}%)`;
      // download
      $('#dl-'+idx).innerHTML = `<a class="btn" href="${href}" download="${name}">Download</a>`;

      state.outputs.push({ name, blob, href, size: blob.size, origSize: file.size, isImage:true });
      URL.revokeObjectURL(img.src);
    }catch(e){
      console.warn('Image compress failed', e);
      $('#comp-'+idx).textContent = 'Error';
      $('#dl-'+idx).textContent = '—';
    }
  }

  function renameWithExt(name, mime){
    const base = name.replace(/\.[^.]+$/, '');
    if (mime === 'image/jpeg') return base + '.jpg';
    if (mime === 'image/webp') return base + '.webp';
    if (mime === 'image/png')  return base + '.png';
    return name;
  }

  async function handleGzip(file, idx){
    try{
      const buf = await file.arrayBuffer();
      const gz = pako.gzip(new Uint8Array(buf));
      const blob = new Blob([gz], { type: 'application/gzip' });
      const href = URL.createObjectURL(blob);
      const name = file.name + '.gz';

      $('#prev-'+idx).textContent = '—';
      $('#comp-'+idx).textContent = fmt(blob.size);
      const saved = Math.max(0, file.size - blob.size);
      $('#save-'+idx).textContent = `${fmt(saved)} (${file.size ? ((saved/file.size)*100).toFixed(1) : '0.0'}%)`;
      $('#dl-'+idx).innerHTML = `<a class="btn" href="${href}" download="${name}">Download</a>`;

      state.outputs.push({ name, blob, href, size: blob.size, origSize: file.size, isImage:false });
    }catch(e){
      console.warn('GZIP failed', e);
      $('#comp-'+idx).textContent = 'Error';
      $('#dl-'+idx).textContent = '—';
    }
  }

  async function downloadZip(){
    if (!state.outputs.length){ alert('Nothing to download.'); return; }
    const zip = new JSZip();
    state.outputs.forEach(o => zip.file(o.name, o.blob));
    const blob = await zip.generateAsync({ type:'blob' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href; a.download = 'compressed_files.zip';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(href);
  }
})();
