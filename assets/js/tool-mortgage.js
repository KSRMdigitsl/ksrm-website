// tool-mortgage.js — UK mortgage (EMI, LTV, Stamp Duty bands) + stacked chart
(() => {
  const $ = id => document.getElementById(id);
  const money = n => isNaN(n) ? "—" : n.toLocaleString("en-GB",{style:"currency",currency:"GBP",maximumFractionDigits:2});

  // Stamp Duty (England & NI) bands — simplified, indicative
  // Source concept: standard residential bands; first-time buyer relief; +3% surcharge for additional property.
  function calcStampDuty(price, buyerType) {
    const bands = [
      { up: 250000, rate: 0.00 },
      { up: 925000, rate: 0.05 },
      { up: 1500000, rate: 0.10 },
      { up: Infinity, rate: 0.12 },
    ];
    const fTBands = [
      { up: 425000, rate: 0.00 },
      { up: 625000, rate: 0.05 },
      { up: Infinity, rate: 0.05 }, // above threshold, FTB relief doesn't apply; treated like standard 5% for remainder
    ];

    let tax = 0;
    if (buyerType === 'first') {
      // relief up to £425k, property price must be ≤ £625k to qualify
      if (price <= 625000) {
        let remaining = price, prev = 0;
        for (const b of fTBands) {
          const slice = Math.max(0, Math.min(remaining, b.up - prev));
          tax += slice * b.rate;
          remaining -= slice;
          prev = b.up;
          if (remaining <= 0) break;
        }
        return Math.max(0, tax);
      }
      // else fall through to standard bands
    }

    // standard bands
    let remaining = price, prev = 0;
    for (const b of bands) {
      const slice = Math.max(0, Math.min(remaining, b.up - prev));
      tax += slice * b.rate;
      remaining -= slice;
      prev = b.up;
      if (remaining <= 0) break;
    }

    if (buyerType === 'addl') {
      tax += price * 0.03; // 3% surcharge
    }
    return Math.max(0, tax);
  }

  function emi(P, annualRate, months){
    const r = (annualRate/100)/12;
    if (r === 0) return P / months;
    return P * r * Math.pow(1+r, months) / (Math.pow(1+r, months) - 1);
  }

  function buildSchedule(amount, annualRate, termMonths, startMonth){
    const r = (annualRate/100)/12;
    const pay = emi(amount, annualRate, termMonths);
    let bal = amount;
    const rows = [];
    const start = startMonth ? new Date(startMonth + "-01") : new Date();

    for (let i=1; i<=termMonths; i++){
      const interest = r === 0 ? 0 : bal * r;
      let princ = pay - interest;
      if (i === termMonths) princ = bal; // round last
      bal = Math.max(0, bal - princ);

      const dt = new Date(start); dt.setMonth(dt.getMonth() + (i-1));
      rows.push({ idx:i, date:dt, payment:pay, principal:princ, interest, balance:bal });
    }
    return { rows, pay };
  }

  let chart;
  function drawChart(rows){
    const cv = $('mortChart');
    if (!cv || !window.Chart) return;
    const labels = rows.map(r => r.idx);
    const principal = rows.map(r => r.principal);
    const interest  = rows.map(r => r.interest);
    const balance   = rows.map(r => r.balance);

    if (chart) chart.destroy();
    chart = new Chart(cv.getContext('2d'), {
      data: {
        labels,
        datasets: [
          { type:'bar', label:'Principal (monthly)', data: principal, stack:'pay', order:2 },
          { type:'bar', label:'Interest (monthly)',  data: interest,  stack:'pay', order:2 },
          { type:'line', label:'Remaining balance',  data: balance, yAxisID:'y1', tension:0.25, pointRadius:0, borderWidth:2, order:1 }
        ]
      },
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins: {
          legend: { position:'bottom' },
          tooltip: { callbacks:{ label:(c)=> `${c.dataset.label}: ${money(c.parsed.y)}` } }
        },
        scales: {
          x: { stacked:true, ticks:{ maxRotation:0, autoSkip:true, maxTicksLimit:12 } },
          y: { stacked:true, ticks:{ callback:v=>money(v) } },
          y1:{ position:'right', grid:{ drawOnChartArea:false }, ticks:{ callback:v=>money(v) } }
        }
      }
    });
  }

  function render(){
    const price = parseFloat($('price').value);
    const depositPct = parseFloat($('depositPct').value);
    const rate = parseFloat($('rate').value);
    const termY = parseInt($('termY').value, 10);
    const buyerType = $('buyerType').value;
    const start = $('startMonth').value;

    if (!(price>0) || !(depositPct>=0 && depositPct<=100) || !(rate>=0) || !(termY>0)) {
      alert('Please enter valid values.'); return;
    }

    const deposit = price * (depositPct/100);
    const loan = price - deposit;
    const ltv = loan / price * 100;
    const months = termY * 12;

    const { rows, pay } = buildSchedule(loan, rate, months, start);
    const totalPay = pay * months;
    const totalInt = totalPay - loan;
    const sdlt = calcStampDuty(price, buyerType);

    $('kpi-deposit').textContent = money(deposit);
    $('kpi-mort').textContent    = money(loan);
    $('kpi-ltv').textContent     = `${ltv.toFixed(1)}%`;
    $('kpi-emi').textContent     = money(pay);
    $('kpi-int').textContent     = money(totalInt);
    $('kpi-sdlt').textContent    = money(sdlt);

    $('tbody').innerHTML = rows.map(r => `
      <tr>
        <td>${r.idx}</td>
        <td>${money(r.payment)}</td>
        <td>${money(r.principal)}</td>
        <td>${money(r.interest)}</td>
        <td>${money(r.balance)}</td>
      </tr>
    `).join('');

    drawChart(rows);
  }

  $('calc').addEventListener('click', render);
  $('reset').addEventListener('click', () => {
    $('price').value = 350000;
    $('depositPct').value = 20;
    $('rate').value = 5.50;
    $('termY').value = 25;
    $('buyerType').value = 'home';
    $('startMonth').value = '';
    ['kpi-deposit','kpi-mort','kpi-ltv','kpi-emi','kpi-int','kpi-sdlt'].forEach(id => $(id).textContent = '—');
    $('tbody').innerHTML = `<tr><td colspan="5" style="text-align:center;color:#6B7280;padding:16px">Run a calculation to see the schedule.</td></tr>`;
    if (chart) { chart.destroy(); chart = null; }
  });

  // Demo run
  window.addEventListener('load', () => { try { render(); } catch(e){ console.warn(e); } });
})();
