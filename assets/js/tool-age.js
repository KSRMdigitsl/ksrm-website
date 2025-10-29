// tool-age.js — exact age + next birthday + zodiac (TZ aware)
(function () {
  const $ = id => document.getElementById(id);

  // Populate time zones (fallback to browser TZ)
  function fillTimeZones() {
    const sel = $("timeZone");
    const guess = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const zones = [
      "UTC","Europe/London","Europe/Dublin","Europe/Paris","Europe/Berlin","Europe/Madrid",
      "Europe/Rome","America/New_York","America/Chicago","America/Denver","America/Los_Angeles",
      "Asia/Dubai","Asia/Kolkata","Asia/Singapore","Asia/Hong_Kong","Asia/Tokyo","Australia/Sydney"
    ];
    sel.innerHTML = zones.map(z => `<option value="${z}">${z}</option>`).join("");
    sel.value = zones.includes(guess) ? guess : "Europe/London";
  }

  function parseDateInput(value, tz) {
    // Treat date inputs as local date at midnight in target TZ
    if (!value) return null;
    // Construct ISO date in UTC then shift to TZ by using Date-only string.
    // Using Temporal if available would be cleaner, but we’ll keep it simple:
    // Interpret value as YYYY-MM-DD in the selected TZ by creating a Date from components.
    const [y,m,d] = value.split("-").map(Number);
    // Create a date at noon UTC to avoid DST edge, then format to tz and back.
    const utc = new Date(Date.UTC(y, (m-1), d, 12, 0, 0));
    return new Date(utc.toLocaleString("en-GB", { timeZone: tz }));
  }

  function diffYMD(from, to) {
    // Returns {years, months, days} diff ignoring time
    let y = to.getFullYear() - from.getFullYear();
    let m = to.getMonth() - from.getMonth();
    let d = to.getDate() - from.getDate();

    if (d < 0) {
      const prevMonth = new Date(to.getFullYear(), to.getMonth(), 0);
      d += prevMonth.getDate();
      m -= 1;
    }
    if (m < 0) {
      m += 12;
      y -= 1;
    }
    return { y, m, d };
  }

  function startOfDay(date, tz) {
    const y = date.getFullYear(), mo = date.getMonth(), d = date.getDate();
    const atNoon = new Date(Date.UTC(y, mo, d, 12, 0, 0));
    return new Date(atNoon.toLocaleString("en-GB", { timeZone: tz }));
  }

  function formatDate(d, tz) {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: tz, year: "numeric", month: "short", day: "2-digit", weekday: "short"
    }).format(d);
  }

  function zodiacFrom(md) {
    // md = month*100 + day (1-based)
    const z = [
      [120, "Capricorn"], [219, "Aquarius"], [321, "Pisces"], [420, "Aries"], [521, "Taurus"],
      [621, "Gemini"], [723, "Cancer"], [823, "Leo"], [923, "Virgo"], [1023, "Libra"],
      [1122, "Scorpio"], [1222, "Sagittarius"], [1231, "Capricorn"]
    ];
    for (let i=0;i<z.length;i++) if (md <= z[i][0]) return z[i][1];
    return "Capricorn";
  }

  function calc() {
    const tz = $("timeZone").value;
    const dobStr = $("dob").value;
    const asofStr = $("asof").value;

    if (!dobStr) { alert("Please select your date of birth."); return; }

    const dob = startOfDay(parseDateInput(dobStr, tz), tz);
    const asof = asofStr ? startOfDay(parseDateInput(asofStr, tz), tz) : startOfDay(new Date(), tz);

    if (asof < dob) { alert("‘As of’ date cannot be before date of birth."); return; }

    // Y/M/D exact
    const ymd = diffYMD(dob, asof);

    // Raw milliseconds
    const ms = asof - dob;
    const days  = Math.floor(ms / 86400000);
    const weeks = Math.floor(days / 7);
    const hours = Math.floor(ms / 3600000);

    // Next birthday
    const nextYear = asof.getMonth() > dob.getMonth() || (asof.getMonth() === dob.getMonth() && asof.getDate() > dob.getDate())
      ? asof.getFullYear() + 1 : asof.getFullYear();
    // Handle Feb 29 gracefully: if not leap year, use Feb 28
    const nbdMonth = dob.getMonth();
    const nbdDay = dob.getDate();
    let nextBD = new Date(nextYear, nbdMonth, nbdDay);
    if (nbdMonth === 1 && nbdDay === 29) { // Feb 29
      const isLeap = (nextYear % 4 === 0 && (nextYear % 100 !== 0 || nextYear % 400 === 0));
      nextBD = new Date(nextYear, 1, isLeap ? 29 : 28);
    }
    const nextBDSOD = startOfDay(nextBD, tz);
    const daysToBD = Math.ceil((nextBDSOD - asof) / 86400000);

    // Zodiac
    const md = (dob.getMonth()+1)*100 + dob.getDate();
    const zodiac = zodiacFrom(md);

    // Render
    $("summary").style.display = "grid";
    $("details").style.display = "block";
    $("kpi-ymd").textContent = `${ymd.y} years, ${ymd.m} months, ${ymd.d} days`;
    $("kpi-next").textContent = `${formatDate(nextBDSOD, tz)} (${daysToBD} day${daysToBD===1?"":"s"} to go)`;
    $("age-weeks").textContent = `That is approximately ${weeks.toLocaleString()} weeks old.`;
    $("age-days").textContent  = `Or ${days.toLocaleString()} days old.`;
    $("age-hours").textContent = `Or ${hours.toLocaleString()} hours old.`;
    $("zodiac").textContent    = `Zodiac sign: ${zodiac}.`;
  }

  $("calc").addEventListener("click", calc);
  $("reset").addEventListener("click", () => {
    $("dob").value = "";
    $("asof").value = "";
    fillTimeZones();
    $("summary").style.display = "none";
    $("details").style.display = "none";
  });

  document.addEventListener("DOMContentLoaded", () => {
    fillTimeZones();
    // Pre-fill DOB example for a quick demo (optional; comment out if not wanted)
    // $("dob").value = "2000-01-01";
  });
})();
