// tool-currency.js — Live rates with offline fallback (Frankfurter API primary)
(() => {
  const $ = id => document.getElementById(id);
  const money = (n, code) => {
    try { return new Intl.NumberFormat('en-GB', { style:'currency', currency: code || 'GBP' }).format(n); }
    catch { return n.toFixed(2) + ' ' + (code||''); }
  };

  // Major ISO 4217 set (trimmed for clarity)
  const CURRENCIES = [
    'GBP','USD','EUR','INR','AUD','CAD','CHF','JPY','NZD','SEK','NOK','DKK','PLN','CZK','HUF','TRY','ZAR','CNY','HKD','SGD','AED','SAR','QAR','ILS','MXN','BRL','CLP','COP','THB','MYR','IDR','KRW','TWD','PHP','RUB'
  ];

  // Offline fallback rates (base: GBP). Update periodically.
  const FALLBACK = {
    base: 'GBP',
    date: '2024-10-01',
    rates: {
      USD: 1.30, EUR: 1.15, INR: 108.0, AUD: 2.00, CAD: 1.76, CHF: 1.13, JPY: 195.0,
      NZD: 2.18, SEK: 13.50, NOK: 14.00, DKK: 8.60, PLN: 4.96, CZK: 28.3, HUF: 487,
      TRY: 42.0, ZAR: 23.5, CNY: 9.45, HKD: 10.17, SGD: 1.77, AED: 4.77, SAR: 4.88,
      QAR: 4.74, ILS: 4.85, MXN: 22.0, BRL: 6.7, CLP: 1190, COP: 5140, THB: 47.0,
      MYR: 6.2, IDR: 20500, KRW: 1720, TWD: 41.0, PHP: 74.0, RUB: 120.0
    }
  };

  // Populate selects
  function fillSelects() {
    const from = $('from'), to = $('to');
    from.innerHTML = CURRENCIES.map(c => `<option value="${c}">${c}</option>`).join('');
    to.innerHTML   = CURRENCIES.map(c => `<option value="${c}">${c}</option>`).join('');
    from.value = 'GBP';
    to.value   = 'USD';
  }

  async function fetchLive(base, symbols) {
    // Frankfurter: free, CORS, no key needed
    const url = `https://api.frankfurter.app/latest?from=${encodeURIComponent(base)}&to=${encodeURIComponent(symbols.join(','))}`;
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error('rate fetch failed');
    return await r.json(); // {amount:1, base:'GBP', date:'YYYY-MM-DD', rates:{USD:1.2,...}}
  }

  function fallbackRates(base, symbols) {
    // Convert FALLBACK (base GBP) to arbitrary base
    const baseToGBP = (code) => {
      if (code === 'GBP') return 1;
      // rate[code] = amount of that currency for 1 GBP, so 1 base unit in GBP = 1 / rate[base]
      return 1 / FALLBACK.rates[code];
    };
    const gbpPerBase = baseToGBP(base); // GBP per 1 base
    const out = {};
    for (const s of symbols) {
      if (s === base) { out[s] = 1; continue; }
      // 1 base -> GBP -> target
      const gbpPerTarget = baseToGBP(s);
      out[s] = gbpPerBase / gbpPerTarget;
    }
    return { base, date: FALLBACK.date, rates: out, source: 'offline' };
  }

  async function getRate(base, to) {
    if (base === to) return { rate:1, date: new Date().toISOString().slice(0,10), source:'same' };
    try {
      const live = await fetchLive(base, [to]);
      return { rate: live.rates[to], date: live.date, source: 'live' };
    } catch(e) {
      const fb = fallbackRates(base, [to]);
      return { rate: fb.rates[to], date: fb.date, source: 'offline' };
    }
  }

  async function convert() {
    const amt = parseFloat($('amount').value) || 0;
    const from = $('from').value;
    const to = $('to').value;

    const { rate, date, source } = await getRate(from, to);
    const out = amt * rate;

    $('kpi-out').textContent  = money(out, to);
    $('kpi-rate').textContent = `1 ${from} = ${rate.toFixed(6)} ${to}`;
    $('kpi-src').textContent  = source === 'live' ? 'Live (Frankfurter)' : (source === 'offline' ? 'Offline fallback' : '—');
    $('kpi-date').textContent = date;

    $('rateLine').innerHTML = `Rate used: <code>1 ${from} = ${rate.toFixed(6)} ${to}</code> • Source: <strong>${$('kpi-src').textContent}</strong> • Date: ${date}`;
  }

  function swap() {
    const a = $('from').value, b = $('to').value;
    $('from').value = b; $('to').value = a;
    convert();
  }

  // Bind events
  document.addEventListener('DOMContentLoaded', () => {
    fillSelects();
    $('btnCalc').addEventListener('click', convert);
    $('btnSwap').addEventListener('click', swap);
    $('amount').addEventListener('keyup', e => { if (e.key === 'Enter') convert(); });
    // auto-run once
    convert();
  });
})();
