/* ---------- Helpers ---------- */
const £ = (n)=> new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:2}).format(n||0);
const clamp = (v,min,max)=> Math.max(min,Math.min(max,v));
const qs = (s)=> document.querySelector(s);
const qsa = (s)=> [...document.querySelectorAll(s)];

/* ---------- Inputs ---------- */
const els = {
  gross:   qs('#gross'),
  penEmp:  qs('#penEmp'),
  penEr:   qs('#penEr'),
  region:  qs('#region'),
  segBtns: qsa('.seg__btn'),
  chipBtns:qsa('.chip'),
  loanPlan:qs('#loanPlan'),
  loanOut: qs('#loanOut'),
  kpiGross:qs('#kpiGross'),
  kpiTake: qs('#kpiTakeHome'),
  kpiTax:  qs('#kpiTax'),
  kpiNI:   qs('#kpiNI'),
  kpiPen:  qs('#kpiPen'),
  barTax:  qs('#barTax'),
  barNI:   qs('#barNI'),
  barPen:  qs('#barPen'),
  barTaxVal:qs('#barTaxVal'),
  barNIVal: qs('#barNIVal'),
  barPenVal:qs('#barPenVal'),
  pillTake: qs('#pillTakeHome'),
  fxRate:  qs('#fxRate'),
  tbGross: qs('#tbGross'), tbTax:qs('#tbTax'), tbNI:qs('#tbNI'),
  tbPen: qs('#tbPen'), tbLoan:qs('#tbLoan'), tbNet:qs('#tbNet'),
  tryBtn: qs('#btnTryPension'),
  insPenFrom: qs('#insPenFrom'), insPenTo: qs('#insPenTo'),
  copy: qs('#btnCopy'), reset:qs('#btnReset'),
};

let state = {
  period:'month',      // month|year|week|day
  gross:52000,         // annual gross
  region:'EWNI',       // EWNI|SCT
  penEmp:5,            // employee %
  penEr:3,             // employer %
  loan:'none',         // student loan plan
};

/* ---------- Very compact model (placeholder) ----------
   Replace with your full UK engine when ready.
------------------------------------------------------- */
const PERIOD_DIV = {year:1, month:12, week:52, day:260}; // 5-day working year
function annualize(periodVal){ return periodVal * (PERIOD_DIV[state.period]||12); }
function perPeriod(annual){ return annual / (PERIOD_DIV[state.period]||12); }

/* Income tax bands (extremely simplified demo) */
function modelTaxable(gross){
  const pen = gross * (state.penEmp/100);
  const taxable = Math.max(0, gross - pen - 12570); // personal allowance
  return {pen, taxable};
}
function modelIncomeTax(taxable){
  // basic 20%, higher 40% from 50,270, Scotland handled lightly
  const bands = state.region==='SCT'
    ? [{t:14549,r:0.19},{t:13471,r:0.20},{t:10395,r:0.21},{t:75995,r:0.42},{t:Infinity,r:0.45}]
    : [{t:37700,r:0.20},{t:87430,r:0.40},{t:Infinity,r:0.45}];

  let left = taxable, tax = 0;
  for(const b of bands){
    const take = Math.min(left, b.t);
    if(take<=0) break;
    tax += take*b.r;
    left -= take;
  }
  return Math.max(0,tax);
}

/* NI (employee) — very light model */
function modelNI(gross){
  // Primary threshold ~ £12,570, 8% sample rate demo
  const PT = 12570, rate = 0.08;
  const ni = Math.max(0,(gross-PT))*rate;
  return ni;
}

/* Student loan (demo thresholds) */
function modelLoan(gross){
  const over = {
    none:0, plan1: Math.max(0, gross - 22015),
    plan2: Math.max(0, gross - 27295),
    plan4: Math.max(0, gross - 27660),
    postgrad: Math.max(0, gross - 21000),
  }[state.loan] || 0;
  const rate = state.loan==='postgrad' ? 0.06 : (state.loan==='none' ? 0 : 0.09);
  return over * rate;
}

/* ---------- Render ---------- */
function compute(){
  const g = Number(String(state.gross).replace(/[^\d.]/g,''))||0;
  const {pen,taxable} = modelTaxable(g);
  const tax = modelIncomeTax(taxable);
  const ni  = modelNI(g - pen); // NI uses post-pension gross (EE)
  const loan = modelLoan(g - pen);
  const netAnnual = g - tax - ni - pen - loan;

  return {
    annual:{ gross:g, tax, ni, pen, loan, net:netAnnual },
    period:{
      gross: perPeriod(g),
      tax:   perPeriod(tax),
      ni:    perPeriod(ni),
      pen:   perPeriod(pen),
      loan:  perPeriod(loan),
      net:   perPeriod(netAnnual),
    }
  };
}
function setBar(el, val, max){
  const w = max>0 ? clamp((val/max)*100,0,100) : 0;
  el.style.width = `${w}%`;
}
function render(){
  // active period button
  els.segBtns.forEach(b=> b.classList.toggle('is-active', b.dataset.period===state.period));

  // compute
  const m = compute();
  const p = m.period;

  // KPIs + bars
  els.kpiGross.textContent = £(p.gross);
  els.kpiTake.textContent  = £(p.net);
  els.kpiTax.textContent   = £(p.tax);
  els.kpiNI.textContent    = £(p.ni);
  els.kpiPen.textContent   = £(p.pen);

  els.pillTake.textContent = £(p.net);

  const maxOut = Math.max(p.tax, p.ni, p.pen, 1);
  setBar(els.barTax, p.tax, maxOut);   els.barTaxVal.textContent = £(p.tax);
  setBar(els.barNI,  p.ni,  maxOut);   els.barNIVal.textContent  = £(p.ni);
  setBar(els.barPen, p.pen, maxOut);   els.barPenVal.textContent = £(p.pen);

  // effective tax rate vs gross
  const eff = m.annual.gross>0 ? (1 - (m.annual.net / m.annual.gross))*100 : 0;
  els.fxRate.textContent = `${eff.toFixed(1)}%`;

  // table
  els.tbGross.textContent = £(p.gross);
  els.tbTax.textContent   = £(p.tax);
  els.tbNI.textContent    = £(p.ni);
  els.tbPen.textContent   = £(p.pen);
  els.tbLoan.textContent  = £(p.loan);
  els.tbNet.textContent   = £(p.net);

  // loan field (read-only)
  els.loanOut.value = £(p.loan);

  // insights (pension suggestion)
  els.insPenFrom.textContent = `${state.penEmp}%`;
}
function pushStateToURL(){
  const u = new URL(location.href);
  u.searchParams.set('s', state.gross);
  u.searchParams.set('per', state.period);
  u.searchParams.set('emp', state.penEr);
  u.searchParams.set('r', state.region);
  u.searchParams.set('sl', state.loan);
  u.searchParams.set('p', state.penEmp);
  history.replaceState(null,'',u);
}

/* ---------- Events ---------- */
function wire(){
  // presets
  els.chipBtns.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      state.gross = Number(btn.dataset.preset);
      els.gross.value = state.gross;
      pushStateToURL(); render();
    });
  });

  // fields
  els.gross.addEventListener('input', ()=>{
    state.gross = Number(els.gross.value.replace(/[^\d.]/g,''))||0;
    pushStateToURL(); render();
  });
  els.penEmp.addEventListener('input', ()=>{
    state.penEmp = clamp(Number(els.penEmp.value)||0,0,100);
    pushStateToURL(); render();
  });
  els.penEr.addEventListener('input', ()=>{
    state.penEr = clamp(Number(els.penEr.value)||0,0,100);
    pushStateToURL(); render();
  });
  els.region.addEventListener('change', ()=>{
    state.region = els.region.value;
    pushStateToURL(); render();
  });
  els.loanPlan.addEventListener('change', ()=>{
    state.loan = els.loanPlan.value;
    pushStateToURL(); render();
  });

  // period segments + top pill (keep in sync)
  qsa('[data-period]').forEach(b=>{
    b.addEventListener('click', ()=>{
      state.period = b.dataset.period;
      pushStateToURL(); render();
    });
  });

  // Copy / Reset
  els.copy?.addEventListener('click', async ()=>{
    await navigator.clipboard.writeText(location.href);
    els.copy.textContent = 'Copied!';
    setTimeout(()=> els.copy.textContent='Copy link', 1200);
  });
  els.reset?.addEventListener('click', ()=>{
    state = {period:'month', gross:52000, region:'EWNI', penEmp:5, penEr:3, loan:'none'};
    els.gross.value = 52000; els.penEmp.value=5; els.penEr.value=3; els.region.value='EWNI'; els.loanPlan.value='none';
    pushStateToURL(); render();
  });

  // “Try it” pension nudge
  els.tryBtn?.addEventListener('click', ()=>{
    const from = clamp(Number(els.penEmp.value)||0,0,60);
    const to = clamp(from+3, 0, 60);
    els.insPenTo.textContent = `${to}%`;
    els.penEmp.value = to; state.penEmp = to;
    pushStateToURL(); render();
  });
}

/* ---------- Init (read URL) ---------- */
(function init(){
  const u = new URL(location.href);
  if(u.searchParams.has('s'))  state.gross = Number(u.searchParams.get('s'))||state.gross;
  if(u.searchParams.has('per'))state.period= u.searchParams.get('per')||state.period;
  if(u.searchParams.has('emp'))state.penEr = Number(u.searchParams.get('emp'))||state.penEr;
  if(u.searchParams.has('r'))  state.region= u.searchParams.get('r')||state.region;
  if(u.searchParams.has('sl')) state.loan  = u.searchParams.get('sl')||state.loan;
  if(u.searchParams.has('p'))  state.penEmp= Number(u.searchParams.get('p'))||state.penEmp;

  // reflect to DOM
  els.gross.value = state.gross;
  els.penEmp.value = state.penEmp;
  els.penEr.value  = state.penEr;
  els.region.value = state.region;
  els.loanPlan.value= state.loan;
  els.segBtns.forEach(b=> b.classList.toggle('is-active', b.dataset.period===state.period));

  wire(); render(); pushStateToURL();
})();
