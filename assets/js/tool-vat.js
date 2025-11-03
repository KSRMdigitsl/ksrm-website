// tool-vat.js — Add/remove VAT with presets and quantity
(() => {
  const $ = id => document.getElementById(id);
  const money = n => isNaN(n) ? "—" : n.toLocaleString("en-GB",{ style:"currency", currency:"GBP", maximumFractionDigits:2 });

  const presetSel = $('preset');
  const rateInput = $('rate');
  const amount = $('amount');
  const qty = $('qty');
  const btnCalc = $('calc');
  const btnReset = $('reset');

  function setPreset(){
    const v = presetSel.value;
    if (v === 'custom') {
      rateInput.removeAttribute('readonly');
      rateInput.focus();
    } else {
      rateInput.value = parseFloat(v).toFixed(2);
      rateInput.setAttribute('readonly','readonly');
    }
  }
  presetSel.addEventListener('change', setPreset);
  setPreset();

  function getMode(){
    const el = document.querySelector('input[name="mode"]:checked');
    return el ? el.value : 'exclusive';
  }

  function compute(){
    const q = Math.max(1, parseInt(qty.value,10) || 1);
    const ratePct = Math.max(0, parseFloat(rateInput.value) || 0);
    const baseAmt = Math.max(0, parseFloat(amount.value) || 0) * q;
    const mode = getMode();

    let net = 0, vat = 0, gross = 0;

    if (mode === 'exclusive') {
      // amount is net; add VAT
      net = baseAmt;
      vat = net * (ratePct/100);
      gross = net + vat;
    } else {
      // amount is gross; remove VAT
      gross = baseAmt;
      net = ratePct === 0 ? gross : (gross / (1 + ratePct/100));
      vat = gross - net;
    }

    $('kpi-net').textContent   = money(net);
    $('kpi-vat').textContent   = money(vat);
    $('kpi-gross').textContent = money(gross);
    $('kpi-rate').textContent  = `${ratePct.toFixed(2)}% • ${mode === 'exclusive' ? 'Exclusive (added)' : 'Inclusive (removed)'}`;
  }

  btnCalc.addEventListener('click', compute);
  amount.addEventListener('keyup', e => { if (e.key === 'Enter') compute(); });
  rateInput.addEventListener('keyup', e => { if (e.key === 'Enter') compute(); });
  qty.addEventListener('keyup', e => { if (e.key === 'Enter') compute(); });

  btnReset.addEventListener('click', () => {
    amount.value = "100.00";
    qty.value = "1";
    presetSel.value = "20";
    setPreset();
    document.querySelector('input[name="mode"][value="exclusive"]').checked = true;
    ['kpi-net','kpi-vat','kpi-gross','kpi-rate'].forEach(id => $(id).textContent = '—');
  });

  // First render
  window.addEventListener('load', () => { try { compute(); } catch(e){ console.warn(e); } });
})();
