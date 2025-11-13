// ... inside the render function after calculating sdlt
const totalRepaid = totalPay; // Total principal + interest
const fullCost = parseFloat(price) + sdlt + totalInt; // Full cost = Price + SDLT + Total Interest

$('kpi-deposit').textContent = money(deposit);
$('kpi-mort').textContent    = money(loan);
$('kpi-ltv').textContent     = `${ltv.toFixed(1)}%`;
$('kpi-emi').textContent     = money(pay);
$('kpi-int').textContent     = money(totalInt);
$('kpi-sdlt').textContent    = money(sdlt);
// NEW KPIs
$('kpi-total-repaid').textContent = money(totalRepaid); 
$('kpi-full-cost').textContent    = money(fullCost);

$('tbody').innerHTML = rows.map(r => `...`).join('');

drawChart(rows);
// ... rest of the render function