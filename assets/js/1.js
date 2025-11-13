// tool-salary-uk.js — UK salary calculator with Student Loans + Scotland bands (2024–25)
// UI upgrades: live updates, deep-linking, share link, animated bars.
(function(){
  const $  = id => document.getElementById(id);
  const qs = sel => document.querySelector(sel);
  const fmt = n => isNaN(n) ? "—" : n.toLocaleString(undefined,{style:"currency",currency:"GBP",maximumFractionDigits:2});
  const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;

  // Period helpers
  const yearToPer = {
    year: x => x,
    month: x => x/12,
    week: x => x/52
  };

  // ======= CONSTANTS (2024–25) =======
  const PA = 12570;                     // Personal Allowance
  const PA_TAPER_START = 100000;        // taper £1 for every £2 above this
  const PA_ZERO_AT = 125140;

  // rUK bands (after PA)
  const RUK = {
    basicLimit: 37700,              // 20%
    rates: { basic: 0.20, higher: 0.40, additional: 0.45 }
  };

  // Scotland bands (after PA)
  const SCT = {
    bands: [
      { name:"Starter", rate:0.19, upTo: 2306 },
      { name:"Basic", rate:0.20, upTo: 11685 },
      { name:"Intermediate", rate:0.21, upTo: 17100 },
      { name:"Higher", rate:0.42, upTo: 31338 },
      { name:"Advanced", rate:0.45, upTo: (PA_ZERO_AT - PA) - (2306+11685+17100+31338) },
      { name:"Top", rate:0.48, upTo: Infinity }
    ]
  };

  // Class 1 NI (employee) 2024–25 (annualised)
  const NI = { PT: 12570, UEL: 50270, main: 0.08, upper: 0.02 };

  // Student Loan plan defaults (editable in UI)
  const SL_DEFAULTS = {
    plan1: { threshold: 22015, rate: 9 },
    plan2: { threshold: 27295, rate: 9 },
    plan4: { threshold: 27660, rate: 9 },
    plan5: { threshold: 25000, rate: 9 },
    pgl:   { threshold: 21000, rate: 6 }
  };

  // ======= TAX HELPERS =======
  function personalAllowance(adjustedNet) {
    if (adjustedNet <= PA_TAPER_START) return PA;
    if (adjustedNet >= PA_ZERO_AT) return 0;
    const reduction = Math.floor((adjustedNet - PA_TAPER_START) / 2);
    return Math.max(0, PA - reduction);
  }

  function tax_rUK(adjustedNet) {
    const pa = personalAllowance(adjustedNet);
    let taxable = Math.max(0, adjustedNet - pa);
    let tax = 0;

    const basic = Math.min(taxable, RUK.basicLimit);
    tax += basic * RUK.rates.basic;
    taxable -= basic;

    const higherBandSize = Math.max(0, (PA_ZERO_AT - pa - RUK.basicLimit));
    const higher = Math.min(Math.max(0, taxable), higherBandSize);
    tax += higher * RUK.rates.higher;
    taxable -= higher;

    if (taxable > 0) tax += taxable * RUK.rates.additional;
    return round2(tax);
  }

  function tax_Scotland(adjustedNet) {
    const pa = personalAllowance(adjustedNet);
    let taxable = Math.max(0, adjustedNet - pa);
    if (taxable <= 0) return 0;

    let tax = 0;
    for (const band of SCT.bands) {
      const slice = Math.min(taxable, band.upTo);
      tax += slice * band.rate;
      taxable -= slice;
      if (taxable <= 0) break;
    }
    return round2(tax);
  }

  function employeeNI(annualGross) {
    const earnings = Math.max(0, annualGross - NI.PT);
    if (earnings <= 0) return 0;
    const band1 = Math.min(annualGross, NI.UEL) - NI.PT; // PT..UEL
    const band2 = Math.max(0, annualGross - NI.UEL);
    const ni = Math.max(0, band1) * NI.main + band2 * NI.upper;
    return round2(ni);
  }

  function studentLoan(annualGross, planKey, ugThreshold, ugRatePct, pglEnabled, pglThreshold, pglRatePct) {
    let total = 0;
    if (planKey && planKey !== "none") {
      total += Math.max(0, annualGross - ugThreshold) * (ugRatePct/100);
    }
    if (pglEnabled) {
      total += Math.max(0, annualGross - pglThreshold) * (pglRatePct/100);
    }
    return round2(Math.max(0, total));
  }

  // ======= CALC + RENDER =======
  function readInputs() {
    return {
      salary: parseFloat($("salary").value || "0"),
      period: $("period").value,
      pensionPct: Math.max(0, parseFloat($("pensionPct").value || "0"))/100,
      employerPct: Math.max(0, parseFloat($("pensionEmployer").value || "0"))/100,
      region: $("region").value,
      slPlan: $("slPlan").value,
      slThreshold: parseFloat($("slThreshold").value || "0"),
      slRate: parseFloat($("slRate").value || "0"),
      pglEnabled: $("pglEnabled").checked,
      pglThreshold: parseFloat($("pglThreshold").value || "0"),
      pglRate: parseFloat($("pglRate").value || "0"),
    };
  }

  function calcAll(model) {
    const grossYear = model.salary;

    const pensionEmployeeYear = round2(grossYear * model.pensionPct);
    const pensionEmployerYear = round2(grossYear * model.employerPct);

    const adjustedNet = Math.max(0, grossYear - pensionEmployeeYear);

    const incomeTaxYear = model.region === "Scotland"
      ? tax_Scotland(adjustedNet)
      : tax_rUK(adjustedNet);

    const niYear = employeeNI(grossYear);
    const slYear = studentLoan(
      grossYear,
      model.slPlan,
      model.slThreshold,
      model.slRate,
      model.pglEnabled,
      model.pglThreshold,
      model.pglRate
    );

    const netYear = round2(grossYear - incomeTaxYear - niYear - pensionEmployeeYear - slYear);

    // per period
    const per = yearToPer[model.period];
    const out = {
      perText: model.period,
      grossPer: per(grossYear),
      netPer: per(netYear),
      taxPer: per(incomeTaxYear),
      niPer: per(niYear),
      slPer: per(slYear),
      penPer: per(pensionEmployeeYear),
      empPer: per(pensionEmployerYear),
      annual: {grossYear, netYear, incomeTaxYear, niYear, slYear, pensionEmployeeYear, pensionEmployerYear}
    };
    return out;
  }

  function render(out, model) {
    // KPIs
    $("kpi-gross").textContent   = fmt(out.grossPer);
    $("kpi-net").textContent     = fmt(out.netPer);
    $("kpi-tax").textContent     = fmt(out.taxPer);
    $("kpi-ni").textContent      = fmt(out.niPer);
    $("kpi-sl").textContent      = fmt(out.slPer);
    $("kpi-pension").textContent = fmt(out.penPer);

    // Bars – relative to gross
    const base = out.annual.grossYear || 1;
    const setBar = (id, value) => { $(id).style.width = Math.min(100, Math.max(0, (value/base)*100)).toFixed(2) + "%"; };
    setBar("bar-tax", out.annual.incomeTaxYear);
    setBar("bar-ni",  out.annual.niYear);
    setBar("bar-sl",  out.annual.slYear);
    setBar("bar-pen", out.annual.pensionEmployeeYear);
    $("bl-tax").textContent = fmt(out.taxPer);
    $("bl-ni").textContent  = fmt(out.niPer);
    $("bl-sl").textContent  = fmt(out.slPer);
    $("bl-pen").textContent = fmt(out.penPer);

    // Table
    $("col-per").textContent = `Per ${model.period}`;
    const rows = [
      ["Gross pay", out.grossPer, out.annual.grossYear],
      ["Income tax", -out.taxPer, -out.annual.incomeTaxYear],
      ["NI (employee)", -out.niPer, -out.annual.niYear],
      ["Student loan", -out.slPer, -out.annual.slYear],
      ["Pension (employee)", -out.penPer, -out.annual.pensionEmployeeYear],
      ["Employer pension", out.empPer, out.annual.pensionEmployerYear],
      ["Take-home", out.netPer, out.annual.netYear]
    ];
    $("tbody").innerHTML = rows.map(r => `
      <tr>
        <td>${r[0]}</td>
        <td>${fmt(r[1])}</td>
        <td>${fmt(r[2])}</td>
      </tr>`).join("");

    // small helpers
    $("perLabel").textContent = `Showing: ${model.period}`;
  }

  // ======= UX HELPERS =======
  const debounce = (fn,ms=200) => {
    let t; return (...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);};
  };

  // Deep-linking (read)
  function loadFromQuery() {
    const p = new URLSearchParams(location.search);
    const readNum = (key, def) => (p.has(key) ? Number(p.get(key)) : def);
    const readBool = (key, def) => (p.has(key) ? p.get(key)==="1" : def);
    if (p.size===0) return;

    $("salary").value = readNum("s", 52000);
    $("period").value = p.get("per") || "month";
    $("pensionPct").value = readNum("pen", 5);
    $("pensionEmployer").value = readNum("emp", 3);
    $("region").value = p.get("r") || "rUK";
    $("slPlan").value = p.get("sl") || "none";
    $("slThreshold").value = readNum("th", SL_DEFAULTS.plan2.threshold);
    $("slRate").value = readNum("sr", SL_DEFAULTS.plan2.rate);
    $("pglEnabled").checked = readBool("pgl", false);
    $("pglThreshold").value = readNum("pth", SL_DEFAULTS.pgl.threshold);
    $("pglRate").value = readNum("pr", SL_DEFAULTS.pgl.rate);
  }

  // Deep-linking (write)
  function toQuery(model){
    const p = new URLSearchParams();
    p.set("s", model.salary);
    p.set("per", model.period);
    p.set("pen", Math.round(model.pensionPct*1000)/10);
    p.set("emp", Math.round(model.employerPct*1000)/10);
    p.set("r", model.region);
    p.set("sl", model.slPlan);
    p.set("th", model.slThreshold);
    p.set("sr", model.slRate);
    p.set("pgl", model.pglEnabled ? "1":"0");
    p.set("pth", model.pglThreshold);
    p.set("pr", model.pglRate);
    return `?${p.toString()}`;
  }

  function copyShareLink(model){
    const url = location.origin + location.pathname + toQuery(model);
    navigator.clipboard.writeText(url).then(()=>{
      const t = $("toast");
      t.textContent = "Link copied";
      t.classList.add("show");
      setTimeout(()=>t.classList.remove("show"), 1400);
    }).catch(()=>{ /* ignore */ });
  }

  function applyPlanDefaults() {
    const key = $("slPlan").value;
    if (key === "none") return;
    const d = SL_DEFAULTS[key];
    if (!d) return;
    $("slThreshold").value = d.threshold;
    $("slRate").value = d.rate;
  }

  // ======= INIT + EVENTS =======
  function doCalc(){
    const model = readInputs();
    const out = calcAll(model);
    render(out, model);
    // keep URL updated (but don’t spam history)
    const q = toQuery(model);
    if (q !== location.search) history.replaceState(null,"",q);
  }
  const live = debounce(doCalc, 140);

  window.addEventListener("load", () => {
    // Defaults for SL fields
    $("slThreshold").value = SL_DEFAULTS.plan2.threshold;
    $("slRate").value = SL_DEFAULTS.plan2.rate;
    $("pglThreshold").value = SL_DEFAULTS.pgl.threshold;
    $("pglRate").value = SL_DEFAULTS.pgl.rate;

    // Read deep-link (if any)
    loadFromQuery();

    // Initial calc
    doCalc();

    // Buttons
    $("calc").addEventListener("click", doCalc);
    $("reset").addEventListener("click", () => {
      $("salary").value = 52000;
      $("period").value = "month";
      $("pensionPct").value = 5;
      $("pensionEmployer").value = 3;
      $("region").value = "rUK";
      $("slPlan").value = "none";
      $("slThreshold").value = SL_DEFAULTS.plan2.threshold;
      $("slRate").value = SL_DEFAULTS.plan2.rate;
      $("pglEnabled").checked = false;
      $("pglThreshold").value = SL_DEFAULTS.pgl.threshold;
      $("pglRate").value = SL_DEFAULTS.pgl.rate;
      doCalc();
    });
    $("share").addEventListener("click", () => copyShareLink(readInputs()));
    $("slPlan").addEventListener("change", () => { applyPlanDefaults(); live(); });

    // Live updates on input changes
    ["salary","period","pensionPct","pensionEmployer","region",
     "slThreshold","slRate","pglEnabled","pglThreshold","pglRate"
    ].forEach(id => {
      const el = $(id);
      const ev = (el.tagName === "SELECT" || el.type==="checkbox") ? "change":"input";
      el.addEventListener(ev, live);
    });
  });
})();
