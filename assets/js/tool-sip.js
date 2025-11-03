// tool-sip.js — Monthly SIP with lump sum, yearly step-up, inflation adjustment + growth chart
(function(){
  const $ = id => document.getElementById(id);
  const fmt = n => isNaN(n) ? "—" : n.toLocaleString("en-GB",{style:"currency",currency:"GBP",maximumFractionDigits:2});
  const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;

  function calcSIP({ monthly, years, rate, inflation, lumpSum, stepupPct }) {
    const nYears = Math.max(1, parseInt(years,10) || 0);
    const nMonths = nYears * 12;
    const r_m = (parseFloat(rate)||0) / 100 / 12; // monthly CAGR
    const infl_y = (parseFloat(inflation)||0) / 100;

    let balance = 0;
    let investedCum = 0;

    // Start with lump sum (compounds for full term)
    const L = Math.max(0, parseFloat(lumpSum)||0);
    balance += L;
    investedCum += L;

    const rows = [];
    let monthContribution = Math.max(0, parseFloat(monthly)||0);

    // points for chart
    const points = [];

    for (let y = 1; y <= nYears; y++) {
      let investedYear = 0;

      for (let m = 1; m <= 12; m++) {
        balance *= (1 + r_m);       // grow
        balance += monthContribution; // contribute
        investedYear += monthContribution;

        // push monthly point for smoother chart
        const monthIndex = (y-1)*12 + m;
        points.push({ month: monthIndex, invested: investedCum + investedYear, value: balance });
      }

      investedCum += investedYear;

      rows.push({
        year: y,
        investedYear: round2(investedYear),
        investedCum: round2(investedCum),
        endBalance: round2(balance),
        gains: round2(balance - investedCum)
      });

      // apply step-up for next year
      const step = Math.max(0, parseFloat(stepupPct)||0) / 100;
      monthContribution = monthContribution * (1 + step);
    }

    const fv = round2(balance);
    const totalInvested = round2(investedCum);
    const gains = round2(fv - totalInvested);
    const realFV = infl_y > 0 ? round2(fv / Math.pow(1 + infl_y, nYears)) : fv;

    return { fv, totalInvested, gains, realFV, rows, points };
  }

  // Chart
  let chart;
  function drawChart(points){
    const cv = $("sipChart");
    if (!cv || !window.Chart) return;

    const labels = points.map(p => p.month);
    const invested = points.map(p => p.invested);
    const value = points.map(p => p.value);

    if (chart) { chart.destroy(); }
    chart = new Chart(cv.getContext("2d"), {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: "Invested", data: invested, tension: 0.25 },
          { label: "Value", data: value, tension: 0.25 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom" },
          tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${fmt(ctx.parsed.y)}` } }
        },
        scales: {
          y: { ticks: { callback: v => fmt(v) } },
          x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } }
        }
      }
    });
  }

  function render() {
    const monthly   = $("monthly")?.value ?? 0;
    const years     = $("years")?.value ?? 0;
    const rate      = $("rate")?.value ?? 0;
    const inflation = $("inflation")?.value ?? 0;
    const lumpsum   = $("lumpsum")?.value ?? 0;
    const stepup    = $("stepup")?.value ?? 0;

    // Basic validation
    if (!(monthly >= 0) || !(years > 0) || !(rate >= 0) || !(inflation >= 0) || !(lumpsum >= 0) || !(stepup >= 0)) {
      alert("Please enter valid positive numbers.");
      return;
    }

    const out = calcSIP({ monthly, years, rate, inflation, lumpSum:lumpsum, stepupPct:stepup });

    // KPIs
    $("kpi-invested").textContent = fmt(out.totalInvested);
    $("kpi-fv").textContent       = fmt(out.fv);
    $("kpi-gain").textContent     = fmt(out.gains);
    $("kpi-real").textContent     = fmt(out.realFV);

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

    // Chart
    drawChart(out.points);
  }

  // Bind
  $("calc")?.addEventListener("click", render);
  $("reset")?.addEventListener("click", () => {
    $("monthly").value = 300;
    $("years").value = 15;
    $("rate").value = 10;
    $("inflation").value = 4;
    $("lumpsum").value = 0;
    $("stepup").value = 0;
    render();
  });

  // First draw after page fully loads (ensures Chart.js is ready)
  window.addEventListener("load", () => { try { render(); } catch(e) { console.warn(e); } });
})();
