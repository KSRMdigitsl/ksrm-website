// tool-currency.js — Live FX converter using exchangerate.host
(function(){
  const $ = id => document.getElementById(id);
  const fmt = (n, cur) => n.toLocaleString(undefined, { style:"currency", currency:cur, maximumFractionDigits:2 });

  const CACHE_KEY = "ksrm_fx_cache";
  const CACHE_HOURS = 1;

  async function fetchRates(base="GBP") {
    const now = Date.now();
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (cached && cached.base===base && (now - cached.ts) < CACHE_HOURS*3600*1000) {
      return cached.data;
    }

    const url = `https://api.exchangerate.host/latest?base=${base}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data && data.rates) {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ base, ts:now, data:data.rates }));
      return data.rates;
    }
    throw new Error("Failed to fetch rates");
  }

  async function populateSelects() {
    const base = "GBP";
    const rates = await fetchRates(base);
    const codes = Object.keys(rates).sort();
    for (const sel of [ $("from"), $("to") ]) {
      sel.innerHTML = codes.map(c => `<option value="${c}">${c}</option>`).join("");
    }
    $("from").value = "GBP";
    $("to").value = "USD";
  }

  async function convert() {
    const amount = parseFloat($("amount").value || "0");
    const from = $("from").value;
    const to = $("to").value;
    if (!(amount>0)) { alert("Enter a valid amount."); return; }

    try {
      const rates = await fetchRates(from);
      const rate = rates[to];
      if (!rate) { alert("Rate not available."); return; }
      const result = amount * rate;

      $("summary").style.display = "grid";
      $("kpi-result").textContent = fmt(result, to);
      $("kpi-rate").textContent = `1 ${from} = ${rate.toFixed(4)} ${to}`;
      $("updated").textContent = `Last updated: ${new Date().toLocaleString()}`;
    } catch (e) {
      alert("Failed to fetch rates. Please try again.");
      console.error(e);
    }
  }

  $("convert").addEventListener("click", convert);
  $("reset").addEventListener("click", () => {
    $("amount").value = 100;
    $("from").value = "GBP";
    $("to").value = "USD";
    $("summary").style.display = "none";
    $("updated").textContent = "";
  });

  $("swap").addEventListener("click", () => {
    const a = $("from").value;
    $("from").value = $("to").value;
    $("to").value = a;
  });

  window.addEventListener("load", populateSelects);
})();
