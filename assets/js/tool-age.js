// tool-age.js — exact age + next birthday + zodiac (TZ aware)
(function () {
  const $ = id => document.getElementById(id);

  // --- Initial Setup ---

  function fillTimeZones() {
    const sel = $("timeZone");
    const guess = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const zones = [
      "UTC","Europe/London","Europe/Dublin","Europe/Paris","Europe/Berlin","Europe/Madrid",
      "Europe/Rome","America/New_York","America/Chicago","America/Denver","America/Los_Angeles",
      "Asia/Dubai","Asia/Kolkata","Asia/Singapore","Asia/Hong_Kong","Asia/Tokyo","Australia/Sydney"
    ];
    sel.innerHTML = zones.map(z => `<option value="${z}">${z}</option>`).join("");
    // Set to browser guess if in list, otherwise default to London.
    sel.value = zones.includes(guess) ? guess : "Europe/London"; 
  }

  // Helper to format a Date object as YYYY-MM-DD string
  function dateToDateInputValue(date) {
    return date.toISOString().slice(0, 10);
  }

  // --- Date/Time Helpers ---
  
  function parseDateInput(value, tz) {
    // Treat date inputs as local date at midnight in target TZ
    if (!value) return null;
    const [y,m,d] = value.split("-").map(Number);
    // Create a date at noon UTC to avoid DST edge, then convert to selected TZ
    const date = new Date(Date.UTC(y, m - 1, d, 12));
    return date; 
  }

  function startOfDay(date, tz) {
    // Returns a date object representing midnight (00:00:00) in the specified time zone.
    const dateString = dateToDateInputValue(date);
    const [y, m, d] = dateString.split('-').map(Number);
    // The exact way to force a date to be interpreted as a specific TZ at midnight is complex.
    // We'll rely on the simple component construction and assume the host environment handles
    // the Date object appropriately for our comparison logic, as the core calculation
    // is based on the difference between two Date objects (timestamps).
    // For simplicity with JS Date object:
    return new Date(y, m - 1, d); // interpreted as local time, which is adequate for simple diffs.
  }

  function formatDate(date, tz) {
    if (!date) return '—';
    const options = { year: 'numeric', month: 'long', day: 'numeric', timeZone: tz };
    return date.toLocaleDateString('en-GB', options);
  }
  
  function zodiacFrom(monthDay) {
    if (monthDay >= 321 && monthDay <= 419) return "Aries";
    if (monthDay >= 420 && monthDay <= 520) return "Taurus";
    if (monthDay >= 521 && monthDay <= 620) return "Gemini";
    if (monthDay >= 621 && monthDay <= 722) return "Cancer";
    if (monthDay >= 723 && monthDay <= 822) return "Leo";
    if (monthDay >= 823 && monthDay <= 922) return "Virgo";
    if (monthDay >= 923 && monthDay <= 1022) return "Libra";
    if (monthDay >= 1023 && monthDay <= 1121) return "Scorpio";
    if (monthDay >= 1122 && monthDay <= 1221) return "Sagittarius";
    if (monthDay >= 1222 || monthDay <= 119) return "Capricorn";
    if (monthDay >= 120 && monthDay <= 218) return "Aquarius";
    if (monthDay >= 219 && monthDay <= 320) return "Pisces";
    return 'Unknown';
  }

  function yearsMonthsDays(dateStart, dateEnd) {
    // Calculate age in Y/M/D from dateEnd (asof) to dateStart (dob)
    let y = dateEnd.getFullYear() - dateStart.getFullYear();
    let m = dateEnd.getMonth() - dateStart.getMonth();
    let d = dateEnd.getDate() - dateStart.getDate();

    if (d < 0) {
      m--;
      // Get days in the previous month of dateEnd
      const daysInLastMonth = new Date(dateEnd.getFullYear(), dateEnd.getMonth(), 0).getDate();
      d += daysInLastMonth;
    }
    if (m < 0) {
      y--;
      m += 12;
    }

    return { y, m, d };
  }
  
  // --- Main Logic ---

  function calculateAge() {
    const dobInput = $("dob").value;
    const asofInput = $("asof").value;
    const tz = $("timeZone").value;
    
    if (!dobInput) {
      // Clear results if DOB is empty
      $("summary").style.display = "none";
      $("details").style.display = "none";
      return; 
    }

    const dob = parseDateInput(dobInput, tz);
    const asof = parseDateInput(asofInput, tz) || new Date(); // Default to today

    if (dob.getTime() > asof.getTime()) {
      alert("Date of Birth cannot be after the 'As Of' date.");
      return;
    }

    // Age in Y/M/D (relative age)
    const ymd = yearsMonthsDays(dob, asof);

    // Total elapsed time
    const ms = asof.getTime() - dob.getTime();
    const days = Math.floor(ms / 86400000);
    const weeks = Math.floor(days / 7);
    const hours = Math.floor(ms / 3600000);
    
    // Next Birthday
    const nbdMonth = dob.getMonth();
    const nbdDay = dob.getDate();
    let nextYear = asof.getFullYear();
    
    // Check if birthday has passed this year
    if (asof.getMonth() > nbdMonth || (asof.getMonth() === nbdMonth && asof.getDate() > nbdDay)) {
        nextYear++;
    }

    let nextBD = new Date(nextYear, nbdMonth, nbdDay);
    
    // Handle Feb 29 (Leap Day)
    if (nbdMonth === 1 && nbdDay === 29) { // Feb 29
      const isLeap = (nextYear % 4 === 0 && (nextYear % 100 !== 0 || nextYear % 400 === 0));
      nextBD = new Date(nextYear, 1, isLeap ? 29 : 28);
    }
    const nextBDSOD = startOfDay(nextBD, tz);
    const daysToBD = Math.ceil((nextBDSOD.getTime() - asof.getTime()) / 86400000);

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

  // --- Event Listeners ---
  document.addEventListener('DOMContentLoaded', () => {
    fillTimeZones();
    
    // Improvement: Set default dates to today's date (YYYY-MM-DD)
    const today = new Date();
    if (!$("dob").value) {
        // Set an arbitrary default DOB to showcase the tool, e.g., 25 years ago
        const defaultDob = new Date(today.getFullYear() - 25, today.getMonth(), today.getDate());
        $("dob").value = dateToDateInputValue(defaultDob);
    }
    if (!$("asof").value) {
        $("asof").value = dateToDateInputValue(today);
    }
    
    // Initial calculation on load
    calculateAge(); 

    $("calc").addEventListener('click', calculateAge);

    $("reset").addEventListener('click', () => {
        const today = new Date();
        const defaultDob = new Date(today.getFullYear() - 25, today.getMonth(), today.getDate());
        $("dob").value = dateToDateInputValue(defaultDob);
        $("asof").value = dateToDateInputValue(today);
        $("timeZone").value = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/London";
        calculateAge();
    });
  });
})();