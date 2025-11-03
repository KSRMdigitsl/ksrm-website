/* salary.js — KSRM Digital Salary Calculator (2024–25) */

const els = {
  salary:  document.getElementById('salary'),
  pen:     document.getElementById('pen'),
  region:  document.getElementById('region'),
  loan:    document.getElementById('loan'),

  chipMonth: document.getElementById('chipMonth'),
  chipYear:  document.getElementById('chipYear'),
  chipMonth2: document.getElementById('chipMonth2'),
  chipYear2:  document.getElementById('chipYear2'),

  chipTake: document.getElementById('chipTake'),
  chipRate: document.getElementById('chipRate'),

  rGross: document.getElementById('rGross'),
  rTake:  document.getElementById('rTake'),
  rTax:   document.getElementById('rTax'),
  rNI:    document.getElementById('rNI'),
  rPen:   document.getElementById('rPen'),

  btnCopy:  document.getElementById('btnCopy'),
  btnReset: document.getElementById('btnReset')
};

// ----- thresholds (2024–25) -----
const PA = 12570;                // personal allowance
const PA_TAPER_FROM = 100000;    // allowance taper start
const PA_ZERO_AT    = 125140;    // allowance gone

const BASIC_BAND = 37700;        // EW/NI/W higher threshold
const NI_PT = 12570;             // NI primary threshold (annualised)
const NI_UEL = 50270;            // NI upper earnings limit
const NI_MAIN = 0.08;            // NI main 8%
const NI_ADD  = 0.02;            // NI additional 2%

// Student loan (approx current thresholds)
const SL = {
  plan1: {thr: 22015, rate:0.09},
  plan2: {thr: 27295, rate:0.09},
  plan4: {thr: 27660, rate:0.09},
  pgl:   {thr: 21000, rate:0.06}
};

let period = 'month'; // default view

// ----- helpers -----
const fmt = n => n.toLocaleString('en-GB',{style:'currency',currency:'GBP'});

function clampPA(income){
  if (income <= PA_TAPER_FROM) return PA;
  if (income >= PA_ZERO_AT)   return 0;
  // £1 of allowance lost for each £2 over 100k
  const reduce = Math.floor((income - PA_TAPER_FROM)/2);
  return Math.max(0, PA - reduce);
}

function taxEWNI(income, empPen){
  const pa  = clampPA(income);
  const taxBase = Math.max(0, income - empPen - pa);
  const basic = Math.min(taxBase, BASIC_BAND) * 0.20;
  const higherBase = Math.max(0, Math.min(taxBase - BASIC_BAND, (125140 - BASIC_BAND)));
  const addBase = Math.max(0, taxBase - BASIC_BAND - higherBase);
  return basic + higherBase*0.40 + addBase*0.45;
}

function taxSCT(income, empPen){
  const pa = clampPA(income);
  let taxable = Math.max(0, income - empPen - pa);
  const bands = [
    {up:14976, rate:0.19},
    {up:26756, rate:0.20},
    {up:43662, rate:0.21},
    {up:75000, rate:0.42},
    {up:125140, rate:0.45},
    {up:Infinity, rate:0.48},
  ];
  let prev = 0, t = 0;
  for(const b of bands){
    if (taxable<=0) break;
    const width = (b.up===Infinity ? Infinity : b.up - prev);
    const slice = Math.min(taxable, width);
    t += slice*b.rate;
    taxable -= slice;
    prev = b.up;
  }
  return t;
}

function ni(income, empPen){
  const base = Math.max(0, income - empPen);
  const main = Math.max(0, Math.min(base, NI_UEL) - NI_PT) * NI_MAIN;
  const add  = Math.max(0, base - NI_UEL) * NI_ADD;
  return main + add;
}

function loan(income, plan){
  if (plan === 'none') return 0;
  const p = SL[plan]; if (!p) return 0;
  const excess = Math.max(0, income - p.thr);
  return excess * p.rate;
}

// ----- breakdown helpers -----
function taxBandsEWNI(income, empPen) {
  const pa = clampPA(income);
  let taxable = Math.max(0, income - empPen - pa);
  const bands = [
    {label:"Basic rate (20%)",  limit:BASIC_BAND,            rate:0.20},
    {label:"Higher rate (40%)", limit:125140 - BASIC_BAND,   rate:0.40},
    {label:"Additional (45%)",  limit:Infinity,              rate:0.45},
  ];
  const rows = [];
  for (const b of bands) {
    if (taxable <= 0) break;
    const slice = Math.min(taxable, b.limit);
    rows.push({ label:b.label, amount:slice*b.rate });
    taxable -= slice;
  }
  return rows;
}

function taxBandsSCT(income, empPen){
  const pa = clampPA(income);
  let taxable = Math.max(0, income - empPen - pa);
  const raw = [
    {label:"Starter (19%)",      upTo:14976,  rate:0.19},
    {label:"Basic (20%)",        upTo:26756,  rate:0.20},
    {label:"Intermediate (21%)", upTo:43662,  rate:0.21},
    {label:"Higher (42%)",       upTo:75000,  rate:0.42},
    {label:"Top (45%)",          upTo:125140, rate:0.45},
    {label:"Advanced (48%)",     upTo:Infinity, rate:0.48},
  ];
  const rows = [];
  let prev = 0;
  for(const b of raw){
    if (taxable<=0) break;
    const width = (b.upTo===Infinity?Infinity:b.upTo - prev);
    const slice = Math.min(taxable, width);
    rows.push({label:b.label, amount:slice*b.rate});
    taxable -= slice;
    prev = b.upTo;
  }
  return rows;
}

function niBands(income, empPen){
  const niIncome = Math.max(0, income - empPen);
  const mainBase = Math.max(0, Math.min(niIncome, NI_UEL) - NI_PT);
  const addBase  = Math.max(0, niIncome - NI_UEL);
  return [
    {label:"NI main (8%)", amount: mainBase * NI_MAIN},
    {label:"NI add. (2%)", amount: addBase  * NI_ADD}
  ];
}

function renderBreakdown({period, income, empPen, region, plan}){
  const div = document.getElementById('bk');
  if (!div) return;

  const rowsTax = (region==='SCT') ? taxBandsSCT(income, empPen) : taxBandsEWNI(income, empPen);
  const rowsNI  = niBands(income, empPen);
  const slVal   = loan(income, plan);

  const taxTotal = rowsTax.reduce((s,r)=>s+r.amount,0);
  const niTotal  = rowsNI.reduce((s,r)=>s+r.amount,0);
  const takeHome = income - empPen - taxTotal - niTotal - slVal;

  const divBy = (period==='month') ? 12 : 1;
  const money = n => fmt(n/divBy);

  let html = `
  <style>
    #bk table{width:100%;border-collapse:separate;border-spacing:0 8px}
    #bk td{padding:10px 12px;background:#fff;border:1px solid #e5e7eb;border-radius:10px}
    #bk td:first-child{font-weight:600;background:#f8fafc;color:#6b7280;width:52%}
    #bk .sub{font-weight:500;color:#6b7280}
  </style>
  <table>
    <tr><td>Gross pay</td><td style="text-align:right">${money(income)}</td></tr>
    <tr><td>Employee pension</td><td style="text-align:right">${money(empPen)}</td></tr>
    <tr><td>Income tax (total)</td><td style="text-align:right">${money(taxTotal)}</td></tr>
  `;

  rowsTax.forEach(r=>{
    if (r.amount>0.5) html += `<tr><td class="sub">— ${r.label}</td><td style="text-align:right">${money(r.amount)}</td></tr>`;
  });

  html += `<tr><td>National Insurance (total)</td><td style="text-align:right">${money(niTotal)}</td></tr>`;
  rowsNI.forEach(r=>{
    if (r.amount>0.5) html += `<tr><td class="sub">— ${r.label}</td><td style="text-align:right">${money(r.amount)}</td></tr>`;
  });

  if (plan!=='none' && slVal>0.5) {
    const map = {plan1:'Plan 1', plan2:'Plan 2', plan4:'Plan 4', pgl:'Postgraduate'};
    html += `<tr><td>Student loan (${map[plan]||plan})</td><td style="text-align:right">${money(slVal)}</td></tr>`;
  }

  html += `<tr><td>Take-home pay</td><td style="text-align:right">${money(takeHome)}</td></tr></table>`;
  div.innerHTML = html;
}

// ----- main calc -----
function calc(){
  const s = +els.salary.value || 0;
  const pPct = +els.pen.value || 0;
  const empPen = s * (pPct/100);
  const reg = els.region.value;
  const plan = els.loan.value;

  const tax = reg==='SCT' ? taxSCT(s, empPen) : taxEWNI(s, empPen);
  const niV = ni(s, empPen);
  const loanV = loan(s, plan);
  const take  = s - empPen - tax - niV - loanV;

  const div = (period==='month') ? 12 : 1;

  els.rGross.textContent = fmt(s/div);
  els.rTax.textContent   = fmt(tax/div);
  els.rNI.textContent    = fmt(niV/div);
  els.rPen.textContent   = fmt(empPen/div);
  els.rTake.textContent  = fmt(take/div);

  const eff = s>0 ? ((s - take)/s*100) : 0;
  els.chipTake.textContent = fmt(take/div);
  els.chipRate.textContent = eff.toFixed(1) + '%';

  // highlight chips
  [els.chipMonth, els.chipMonth2].forEach(el=>el.classList.toggle('is-on', period==='month'));
  [els.chipYear, els.chipYear2].forEach(el=>el.classList.toggle('is-on', period==='year'));

  // render detailed table
  renderBreakdown({period, income:s, empPen, region:reg, plan});
}

// ----- events -----
function wire(){
  // presets
  document.querySelectorAll('[data-preset]').forEach(btn=>{
    btn.addEventListener('click',()=>{ els.salary.value = btn.dataset.preset; calc(); });
  });

  // period toggles (top and inputs area)
  [els.chipMonth, els.chipMonth2].forEach(el=>{
    el.addEventListener('click',()=>{ period='month'; calc(); });
  });
  [els.chipYear, els.chipYear2].forEach(el=>{
    el.addEventListener('click',()=>{ period='year'; calc(); });
  });

  // inputs
  [els.salary, els.pen, els.region, els.loan].forEach(el=> el.addEventListener('input', calc));

  // copy link
  els.btnCopy.addEventListener('click', ()=>{
    const params = new URLSearchParams({
      s: els.salary.value || 0,
      per: period,
      pen: els.pen.value || 0,
      r: els.region.value,
      sl: els.loan.value
    });
    const url = `${location.origin}${location.pathname}?${params.toString()}`;
    navigator.clipboard.writeText(url);
    els.btnCopy.textContent = 'Copied!'; setTimeout(()=>els.btnCopy.textContent='Copy link',1200);
  });

  // reset
  els.btnReset.addEventListener('click', ()=>{
    els.salary.value = '';
    els.pen.value = '5';
    els.region.value = 'EWNI';
    els.loan.value = 'none';
    period = 'month';
    calc();
  });

  // querystring -> state
  const q = new URLSearchParams(location.search);
  if (q.has('s')) els.salary.value = q.get('s');
  if (q.has('pen')) els.pen.value = q.get('pen');
  if (q.has('r')) els.region.value = q.get('r');
  if (q.has('sl')) els.loan.value = q.get('sl');
  if (q.has('per')) period = (q.get('per')==='year'?'year':'month');

  calc();
}

wire();
