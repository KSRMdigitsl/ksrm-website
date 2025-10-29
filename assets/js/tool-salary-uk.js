// tool-salary-uk.js — UK salary calculator with Student Loans + Scotland bands (2024–25)
(function(){
  const $ = id => document.getElementById(id);
  const fmt = (n) => isNaN(n) ? "—" : n.toLocaleString(undefined,{style:"currency",currency:"GBP",maximumFractionDigits:2});
  const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

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
    rates: { basic: 0.20, higher: 0.40, additional: 0.45 },
    higherThreshold: PA_ZERO_AT     // additional starts above this effective level
  };

  // Scotland bands (after PA) — 2024–25
  const SCT = {
    // taxable bands (amounts after PA). Values here reflect published 24/25 bands.
    bands: [
      { name:"Starter", rate:0.19, upTo: 2306 },     // £12,571–£14,876
      { name:"Basic", rate:0.20, upTo: 11685 },      // £14,877–£26,561
      { name:"Intermediate", rate:0.21, upTo: 17100 },// £26,562–£43,662
      { name:"Higher", rate:0.42, upTo: 31338 },     // £43,663–£75,000  (approx band size)
      { name:"Advanced", rate:0.45, upTo: (PA_ZERO_AT - PA) - (2306+11685+17100+31338) }, // to £125,140
      { name:"Top", rate:0.48, upTo: Infinity }      // over £125,140
    ]
  };

  // Class 1 NI (employee) 2024–25 (annualised)
  const NI = {
    PT: 12570,   // primary threshold
    UEL: 50270,  // upper earnings limit
    main: 0.08,  // 8%
    upper: 0.02  // 2%
  };

  // Student Loan plan defaults (editable in UI)
  const SL_DEFAULTS = {
    plan1: { threshold: 22015, rate: 9 },
    plan2: { threshold: 27295, rate: 9 },
    plan4: { threshold: 27660, rate: 9 },  // Scotland UG
    plan5: { threshold: 25000, rate: 9 },  // England/Wales (from 2023 starters)
    pgl:   { threshold: 21000, rate: 6 }   // Postgraduate Loan
  };

  // ======= HELPERS =======

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

    // higher band size up to additional threshold
    const higherBandSize = Math.max(0, (PA_ZERO_AT - pa - RUK.basicLimit));
    const higher = Math.min(Math.max(0, taxable), higherBandSize);
    tax += higher * RUK.rates.higher;
    taxable -= higher;

    // anything left is additional
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
      const repayBase = Math.max(0, annualGross - ugThreshold);
      total += repayBase * (ugRatePct/100);
    }
    if (pglEnabled) {
      const repayBasePGL = Math.max(0, annualGross - pglThreshold);
      total += repayBasePGL * (pglRatePct/100);
    }
    return round2(Math.max(0, total));
  }

  // ======= MAIN CALC =======
  function calcAll() {
    const salary = parseFloat($("salary").value || "0");
    const period = $("period").value;

    const pensionPct = Math.max(0, parseFloat($("pensionPct").value || "0"))/100;
    const employerPct = Math.max(0, parseFloat($("pensionEmployer").value || "0"))/100;

    const region = $("region").value;

    // Student loan inputs
    const planKey = $("slPlan").value;
    const ugThreshold = parseFloat($("slThreshold").value || "0");
    const ugRatePct = parseFloat($("slRate").value || "0");
    const pglEnabled = $("pglEnabled").checked;
    const pglThreshold = parseFloat($("pglThreshold").value || "0");
    const pglRatePct = parseFloat($("pglRate").value || "0");

    // Annualise (salary is annual already)
    const grossYear = salary;

    // Pension (employee, pre-tax; does not change NI in this version)
    const pensionEmployeeYear = round2(grossYear * pensionPct);
    const pensionEmployerYear = round2(grossYear * employerPct);

    // Adjusted Net for income tax (salary minus pre-tax employee pension)
    const adjustedNet = Math.max(0, grossYear - pensionEmployeeYear);

    // Income tax
    const incomeTaxYear = region === "Scotland"
      ? tax_Scotland(adjustedNet)
      : tax_rUK(adjustedNet);

    // NI (based on gross)
    const niYear = employeeNI(grossYear);

    // Student Loan (based on gross earnings above threshold(s))
    const slYear = studentLoan(grossYear, planKey, ugThreshold, ugRatePct, pglEnabled, pglThreshold, pglRatePct);

    const netYear = round2(grossYear - incomeTaxYear - niYear - pensionEmployeeYear - slYear);

    // Period conversions
    const grossPer = yearToPer[period](grossYear);
    const taxPer   = yearToPer[period](incomeTaxYear);
    const niPer    = yearToPer[period](niYear);
    const slPer    = yearToPer[period](slYear);
    const penPer   = yearToPer[period](pensionEmployeeYear);
    const empPer   = yearToPer[period](pensionEmployerYear);
    const netPer   = yearToPer[period](netYear);

    // KPIs
    $("kpi-gross").textContent   = fmt(grossPer);
    $("kpi-net").textContent     = fmt(netPer);
    $("kpi-tax").textContent     = fmt(taxPer);
    $("kpi-ni").textContent      = fmt(niPer);
    $("kpi-sl").textContent      = fmt(slPer);
    $("kpi-pension").textContent = fmt(penPer);
    $("kpi-emp").textContent     = fmt(empPer);

    // Table
    $("col-per").textContent = `Per ${period}`;
    const rows = [
      ["Gross pay", grossPer, grossYear],
      ["Income tax", -taxPer, -incomeTaxYear],
      ["NI (employee)", -niPer, -niYear],
      ["Student loan", -slPer, -slYear],
      ["Pension (employee)", -penPer, -pensionEmployeeYear],
      ["Employer pension", empPer, pensionEmployerYear],
      ["Take-home", netPer, netYear]
    ];
    $("tbody").innerHTML = rows.map(r => `
      <tr>
        <td>${r[0]}</td>
        <td>${fmt(r[1])}</td>
        <td>${fmt(r[2])}</td>
      </tr>
    `).join("");
  }

  // Auto-fill Student Loan thresholds/rates when plan changes (editable afterwards)
  function applyPlanDefaults() {
    const key = $("slPlan").value;
    if (key === "none") return;
    const d = SL_DEFAULTS[key];
    if (!d) return;
    $("slThreshold").value = d.threshold;
    $("slRate").value = d.rate;
  }

  // Events
  $("calc").addEventListener("click", calcAll);
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
    calcAll();
  });
  $("slPlan").addEventListener("change", applyPlanDefaults);

  // Init defaults + first calc
  window.addEventListener("load", () => {
    $("slThreshold").value = SL_DEFAULTS.plan2.threshold;
    $("slRate").value = SL_DEFAULTS.plan2.rate;
    $("pglThreshold").value = SL_DEFAULTS.pgl.threshold;
    $("pglRate").value = SL_DEFAULTS.pgl.rate;
    try { calcAll(); } catch {}
  });
})();
