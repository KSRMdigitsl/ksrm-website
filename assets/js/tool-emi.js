// tool-emi.js — EMI calculator with amortization table
(function(){
  const $ = id => document.getElementById(id);
  const fmt = (n, currency=true) => {
    if (isNaN(n)) return "—";
    return currency
      ? n.toLocaleString(undefined, { style: "currency", currency: "GBP", maximumFractionDigits: 2 })
      : n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  function calcEMI(P, annualRate, nMonths) {
    const r = (annualRate/100) / 12;
    if (r === 0) return P / nMonths;             // interest-free case
    return P * r * Math.pow(1+r, nMonths) / (Math.pow(1+r, nMonths) - 1);
  }

  function buildSchedule(P, annualRate, nMonths, startMonthStr) {
    const r = (annualRate/100) / 12;
    const emi = calcEMI(P, annualRate, nMonths);
    let balance = P;
    const rows = [];
    const start = startMonthStr ? new Date(startMonthStr + "-01") : new Date();

    for (let m = 1; m <= nMonths; m++) {
      const interest = r === 0 ? 0 : balance * r;
      let principal = emi - interest;
      if (m === nMonths) {                 // fix last-row rounding
        principal = balance;
      }
      balance = Math.max(0, balance - principal);

      const date = new Date(start);
      date.setMonth(date.getMonth() + (m-1));

      rows.push({
        idx: m,
        date: date,
        payment: emi,
        principal,
        interest,
        balance
      });
    }
    const totalPay = emi * nMonths;
    const totalInterest = totalPay - P;
    const payoffDate = new Date(start);
    payoffDate.setMonth(payoffDate.getMonth() + (nMonths-1));
    return { emi, totalPay, totalInterest, payoffDate, rows };
  }

  function render() {
    const amount = parseFloat($("amount").value);
    const rate = parseFloat($("rate").value);
    const term = parseInt($("term").value, 10);
    const start = $("start").value; // yyyy-mm

    if (!(amount>0) || !(rate>=0) || !(term>0)) {
      alert("Please enter a valid amount, interest rate, and term in months.");
      return;
    }

    const out = buildSchedule(amount, rate, term, start);
    $("kpi-emi").textContent = fmt(out.emi);
    $("kpi-interest").textContent = fmt(out.totalInterest);
    $("kpi-total").textContent = fmt(out.totalPay);
    $("kpi-date").textContent = out.payoffDate.toLocaleDateString(undefined, { year:"numeric", month:"short" });

    const tbody = $("tbody");
    tbody.innerHTML = out.rows.map(r => `
      <tr>
        <td>${r.idx}</td>
        <td>${fmt(r.payment)}</td>
        <td>${fmt(r.principal)}</td>
        <td>${fmt(r.interest)}</td>
        <td>${fmt(r.balance)}</td>
      </tr>
    `).join("");
  }

  $("calc").addEventListener("click", render);
  $("reset").addEventListener("click", () => {
    $("amount").value = 25000;
    $("rate").value = 8.5;
    $("term").value = 36;
    $("start").value = "";
    $("kpi-emi").textContent = $("kpi-interest").textContent = $("kpi-total").textContent = $("kpi-date").textContent = "—";
    $("tbody").innerHTML = `<tr><td colspan="5" style="text-align:center;color:#6B7280;padding:16px">Run a calculation to see the schedule.</td></tr>`;
  });

  // Auto-calc once on load for demo
  window.addEventListener("load", () => {
    try { render(); } catch {}
  });
})();
