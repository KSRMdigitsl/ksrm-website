// KSRM Digital — SIP Calculator with monthly compounding + annual step-up
(() => {
  const $  = s => document.querySelector(s);
  const £  = n => (n||0).toLocaleString('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:2});

  const els = {
    amt:    $('#inAmt'),
    rate:   $('#inRate'),
    years:  $('#inYears'),
    step:   $('#inStep'),
    dom:    $('#inDom'),
    value:  $('#rValue'),
    inv:    $('#rInvested'),
    gain:   $('#rGain'),
    chipSum:$('#chipSummary'),
    chipInv:$('#chipInvested'),
    chipG:  $('#chipGain'),
    btn:    $('#btnCalc'),
    canvas: $('#sipChart')
  };

  // Defaults for convenience
  if(!els.amt.value)   els.amt.value   = 500;
  if(!els.rate.value)  els.rate.value  = 10;
  if(!els.years.value) els.years.value = 15;
  if(!els.step.value)  els.step.value  = 5;

  let chart;

  function computeSIP({monthly, annualRatePct, years, stepPct}){
    // Returns: { totalInvested, totalValue, points: [{month, investedSoFar, valueSoFar}] }
    const months = Math.max(1, Math.floor(years*12));
    const r = (annualRatePct/100) / 12;        // monthly rate
    const step = Math.max(0, stepPct/100);     // annual step-up factor

    let invested = 0;
    let value = 0;
    let contrib = +monthly || 0;

    const points = [];

    for(let m=1; m<=months; m++){
      // contribution at month m
      value = value * (1 + r) + contrib;
      invested += contrib;

      // record point
      points.push({ month: m, investedSoFar: invested, valueSoFar: value });

      // step-up at end of each 12 months
      if(m % 12 === 0 && step > 0){
        contrib = contrib * (1 + step);
      }
    }

    return { totalInvested: invested, totalValue: value, points };
  }

  function drawChart(points){
    const labels = points.map(p => p.month); // month numbers
    const invested = points.map(p => p.investedSoFar);
    const value = points.map(p => p.valueSoFar);

    if(chart){ chart.destroy(); }
    chart = new Chart(els.canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Invested', data: invested, tension: 0.25 },
          { label: 'Value', data: value, tension: 0.25 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${£(ctx.parsed.y)}`
            }
          }
        },
        scales: {
          y: { ticks: { callback: v => £(v) } },
          x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } }
        }
      }
    });
  }

  function calc(){
    const monthly = +els.amt.value || 0;
    const rate    = +els.rate.value || 0;
    const years   = +els.years.value || 0;
    const step    = +els.step.value || 0;

    const res = computeSIP({ monthly, annualRatePct: rate, years, stepPct: step });

    const invested = res.totalInvested;
    const value    = res.totalValue;
    const gain     = Math.max(0, value - invested);

    els.inv.textContent   = £(invested);
    els.value.textContent = £(value);
    els.gain.textContent  = £(gain);

    els.chipInv.textContent = `Invested: ${£(invested)}`;
    els.chipSum.textContent = `Total Value: ${£(value)}`;
    els.chipG.textContent   = `Gain: ${£(gain)}`;

    drawChart(res.points);
  }

  // Wire events
  ['input','change'].forEach(evt=>{
    els.amt.addEventListener(evt, calc);
    els.rate.addEventListener(evt, calc);
    els.years.addEventListener(evt, calc);
    els.step.addEventListener(evt, calc);
    els.dom.addEventListener(evt, calc);
  });
  els.btn.addEventListener('click', calc);

  // Initial
  calc();
})();
