// tool-sip.js — Monthly SIP with lump sum, yearly step-up, inflation adjustment (corpus & yearly table)
(function(){
  const $ = id => document.getElementById(id);
  const fmt = n => isNaN(n) ? "—" : n.toLocaleString(undefined,{style:"currency",currency:"GBP",maximumFractionDigits:2});
  const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;

  function calcSIP({
    monthly, years, rate, inflation, lumpSum, stepupPct
  }) {
    const nMonths = years * 12;
    const r_m = rate / 100 / 12; // monthly CAGR
    const infl_y = inflation / 100;

    let balance = 0;
    let investedCum = 0;

    // Start with lump sum (compounds for full term)
    balance += lumpSum;
    investedCum += lumpSum;

    const rows = [];
    let monthContribution = monthly;

    for (let y = 1; y <= years; y++) {
      let investedYear = 0;

      for (let m = 1; m <= 12; m++) {
        // contribute at end of month (typical SIP assumption)
        balance *= (1 + r_m);
        balance += monthContribution;
        investedYear += monthContribution;
      }

      investedCum += investedYear;

      rows.push({
        year: y,
        investedYear: round2(investedYear),
        investedCum: round2(investedCum),
        endBalance: round2(balance),
        gains: round2(balance - investedCum)
      });

      // apply step-up to monthly contribution for the next year
      monthContribution *= (1 + stepupPct/100);
    }

    const fv = round2(balance);
    const totalInvested = round2(investedCum);
    const gains = round2(fv - totalInvested);
    const realFV = infl_y > 0 ? round2(fv / Math.pow(1 + infl_y, years)) : fv;

    return { fv, totalInvested, gains, realFV, rows };
  }

  function render() {
    const monthly = parseFloat($("monthly").value || "0");
    const years = parseInt($("years").value || "0", 10);
    const rate = parseFloat($("rate").value || "0");
    const inflation = parseFloat($("inflation").value || "0");
    const lumpSum = parseFloat($("lumpsum").value || "0");
    const stepupPct = parseFloat($("stepup").value || "0");

    if (!(monthly >= 0) || !(years > 0) || !(rate >= 0) || !(inflation >= 0) || !(lumpSum >= 0) || !(stepupPct >= 0)) {
      alert("Please enter valid positive numbers.");
      return;
    }

    const out = calcSIP({ monthly, years, rate, inflation, lumpSum, stepupPct });

    // KPIs
    $("kpi-invested").textContent = fmt(out.totalInvested);
    $("kpi-fv").textContent = fmt(out.fv);
    $("kpi-gain").textContent = fmt(out.gains);
    $("kpi-real").textContent = fmt(out.realFV);

    // Table
    $("tbody").innerHTML = out.rows.map(r => `
      <tr>
        <td>${r.year}</td>
        <td>${fmt(r.investedYear)}</td>
        <td>${fmt(r.investedCum)}</td>
        <td>${fmt(r.endBalance)}</td>
        <td>${fmt(r.gains)}</td>
      </tr>
    `).join("");
  }

  $("calc").addEventListener("click", render);
  $("reset").addEventListener("click", () => {
    $("monthly").value = 300;
    $("years").value = 15;
    $("rate").value = 10;
    $("inflation").value = 4;
    $("lumpsum").value = 0;
    $("stepup").value = 0;
    render();
  });

  window.addEventListener("load", () => { try { render(); } catch {} });
})();
