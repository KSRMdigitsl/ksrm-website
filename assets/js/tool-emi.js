// tool-emi.js — EMI calculator with amortization table + stacked chart
(function(){
  const $ = id => document.getElementById(id);
  const money = n => isNaN(n) ? "—" : n.toLocaleString("en-GB", { style:"currency", currency:"GBP", maximumFractionDigits:2 });

  function calcEMI(P, annualRate, nMonths){
    const r = (annualRate/100)/12;
    if (r === 0) return P / nMonths;
    return P * r * Math.pow(1+r, nMonths) / (Math.pow(1+r, nMonths) - 1);
  }

  function buildSchedule(P, annualRate, nMonths, startMonthStr){
    const r = (annualRate/100)/12;
    const emi = calcEMI(P, annualRate, nMonths);
    let balance = P;
    const rows = [];
    const start = startMonthStr ? new Date(startMonthStr + "-01") : new Date();

    for (let m=1; m<=nMonths; m++){
      const interest = r === 0 ? 0 : balance * r;
      let principal = emi - interest;
      if (m === nMonths) principal = balance;      // fix last row rounding
      balance = Math.max(0, balance - principal);

      const dt = new Date(start);
      dt.setMonth(dt.getMonth() + (m-1));
      rows.push({
        idx: m,
        date: dt,
        payment: emi,
        principal,
        interest,
        balance
      });
    }
    const totalPay = emi * nMonths;
    const totalInterest = totalPay - P;
    const payoffDate = new Date(start); payoffDate.setMonth(payoffDate.getMonth() + (nMonths-1));
    return { emi, totalPay, totalInterest, payoffDate, rows };
  }

  // ----- Chart -----
  let chart;
  function drawChart(rows){
    const cv = $("emiChart");
    if (!cv || !window.Chart) return;

    const labels = rows.map(r => r.idx);
    const principal = rows.map(r => r.principal);
    const interest  = rows.map(r => r.interest);
    const balance   = rows.map(r => r.balance);

    if (chart) chart.destroy();

    chart = new Chart(cv.getContext("2d"), {
      data: {
        labels,
        datasets: [
          // Stacked bars: monthly principal vs interest
          { type:"bar", label:"Principal (monthly)", data: principal, stack:"pay", order: 2 },
          { type:"bar", label:"Interest (monthly)",  data: interest,  stack:"pay", order: 2 },
          // Line: remaining balance
          { type:"line", label:"Remaining balance", data: balance, yAxisID:"y1", tension:0.25, pointRadius:0, borderWidth:2, order:1 }
        ]
      },
      options: {
        responsive:true,
        maintainAspectRatio:false,
        plugins: {
          legend: { position:"bottom" },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${money(ctx.parsed.y)}`
            }
          }
        },
        scales: {
          x: { stacked:true, ticks: { maxRotation:0, autoSkip:true, maxTicksLimit: 12 } },
          y: { stacked:true, ticks: { callback:v => money(v) } },
          y1:{ position:"right", grid:{ drawOnChartArea:false }, ticks:{ callback:v => money(v) } }
        }
      }
    });
  }

  function render(){
    const amount = parseFloat($("amount").value);
    const rate   = parseFloat($("rate").value);
    const term   = parseInt($("term").value, 10);
    const start  = $("start").value; // yyyy-mm

    if (!(amount>0) || !(rate>=0) || !(term>0)) {
      alert("Please enter a valid amount, interest rate, and term in months.");
      return;
    }

    const out = buildSchedule(amount, rate, term, start);

    $("kpi-emi").textContent      = money(out.emi);
    $("kpi-interest").textContent = money(out.totalInterest);
    $("kpi-total").textContent    = money(out.totalPay);
    $("kpi-date").textContent     = out.payoffDate.toLocaleDateString(undefined, { year:"numeric", month:"short" });

    $("tbody").innerHTML = out.rows.map(r => `
      <tr>
        <td>${r.idx}</td>
        <td>${money(r.payment)}</td>
        <td>${money(r.principal)}</td>
        <td>${money(r.interest)}</td>
        <td>${money(r.balance)}</td>
      </tr>
    `).join("");

    drawChart(out.rows);
  }

  $("calc").addEventListener("click", render);
  $("reset").addEventListener("click", () => {
    $("amount").value = 25000;
    $("rate").value   = 8.5;
    $("term").value   = 36;
    $("start").value  = "";
    $("kpi-emi").textContent = $("kpi-interest").textContent = $("kpi-total").textContent = $("kpi-date").textContent = "—";
    $("tbody").innerHTML = `<tr><td colspan="5" style="text-align:center;color:#6B7280;padding:16px">Run a calculation to see the schedule.</td></tr>`;
    if (chart) { chart.destroy(); chart = null; }
  });

  // Demo render on load
  window.addEventListener("load", () => { try { render(); } catch(e){ console.warn(e); } });
})();
