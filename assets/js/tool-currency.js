// tool-currency.js — resilient Currency Converter (symbols + multi-API + cache + fallbacks)
(function () {
  const $ = id => document.getElementById(id);
  const fmt = (n, cur) =>
    n.toLocaleString(undefined, { style: "currency", currency: cur, maximumFractionDigits: 2 });

  const CACHE_RATES_KEY = "ksrm_fx_cache_rates";
  const CACHE_RATES_HOURS = 1;

  // Fallback currency codes if all symbol sources fail
  const FALLBACK_SYMBOLS = [
    "GBP","USD","EUR","INR","AUD","CAD","NZD","JPY","CHF","CNY","HKD","SGD","ZAR","AED","SAR",
    "SEK","NOK","DKK","PLN","CZK","HUF","TRY","MXN","BRL","ILS","KRW","TWD","THB","MYR","IDR","PHP","RUB"
  ];

  // Primary & secondary APIs
  const API = {
    symbols1: "https://api.exchangerate.host/symbols",
    latest1:  base => `https://api.exchangerate.host/latest?base=${encodeURIComponent(base)}`,
    // fallback (note: different JSON shape)
    latest2:  base => `https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`
  };

  async function fetchJSON(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.json();
  }

  // ---- SYMBOLS ----
  async function getSymbols() {
    try {
      const data = await fetchJSON(API.symbols1);
      if (data && data.symbols) return Object.keys(data.symbols).sort();
      throw new Error("No symbols in response");
    } catch (err) {
      console.warn("Symbols fetch failed, using fallback list:", err);
      return FALLBACK_SYMBOLS;
    }
  }

  // ---- RATES CACHE ----
  function loadCachedRates(base) {
    try {
      const raw = localStorage.getItem(CACHE_RATES_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || obj.base !== base) return null;
      if (Date.now() - obj.ts > CACHE_RATES_HOURS * 3600 * 1000) return null;
      return obj.rates;
    } catch { return null; }
  }
  function saveCachedRates(base, rates) {
    try { localStorage.setItem(CACHE_RATES_KEY, JSON.stringify({ base, ts: Date.now(), rates })); } catch {}
  }

  // ---- RATES (multi-source) ----
  async function getRates(base) {
    // cache first
    const cached = loadCachedRates(base);
    if (cached) return cached;

    // primary
    try {
      const data = await fetchJSON(API.latest1(base));
      if (data && data.rates) {
        saveCachedRates(base, data.rates);
        return data.rates;
      }
      throw new Error("No rates in primary response");
    } catch (e1) {
      console.warn("Primary rates API failed, trying fallback:", e1);
      // secondary
      try {
        const data2 = await fetchJSON(API.latest2(base));
        if (data2 && data2.result === "success" && data2.rates) {
          saveCachedRates(base, data2.rates);
          return data2.rates;
        }
        throw new Error("No rates in fallback response");
      } catch (e2) {
        console.error("Both rate APIs failed:", e2);
        throw e2;
      }
    }
  }

  // ---- UI wiring ----
  async function populateSelects() {
    const codes = await getSymbols();
    const fromSel = $("from");
    const toSel   = $("to");

    fromSel.innerHTML = codes.map(c => `<option value="${c}">${c}</option>`).join("");
    toSel.innerHTML   = codes.map(c => `<option value="${c}">${c}</option>`).join("");

    fromSel.value = codes.includes("GBP") ? "GBP" : codes[0];
    toSel.value   = codes.includes("USD") ? "USD" : (codes[1] || codes[0]);
  }

  async function convert() {
    const amount = parseFloat($("amount").value || "0");
    const from = $("from").value;
    const to   = $("to").value;
    if (!(amount > 0)) { alert("Enter a valid amount."); return; }

    try {
      const rates = await getRates(from);
      const rate  = rates[to];
      if (!rate) throw new Error("Rate not available for selected currency");

      const result = amount * rate;
      $("summary").style.display = "grid";
      $("kpi-result").textContent = fmt(result, to);
      $("kpi-rate").textContent   = `1 ${from} = ${rate.toFixed(4)} ${to}`;
      $("updated").textContent    = `Last updated: ${new Date().toLocaleString()}`;
    } catch (err) {
      $("summary").style.display = "grid";
      $("kpi-result").textContent = "—";
      $("kpi-rate").textContent   = "Live rate unavailable";
      $("updated").textContent    = "Could not fetch rates right now. Please try again.";
      alert("Could not fetch live rates. Please try again shortly.");
    }
  }

  $("convert").addEventListener("click", convert);
  $("reset").addEventListener("click", async () => {
    $("amount").value = 100;
    await populateSelects();
    $("summary").style.display = "none";
    $("updated").textContent = "";
  });
  $("swap").addEventListener("click", () => {
    const a = $("from").value;
    $("from").value = $("to").value;
    $("to").value = a;
  });

  document.addEventListener("DOMContentLoaded", populateSelects);
})();
