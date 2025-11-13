// Add this function to the bottom of your tool-emi.js file
let chartInstance = null;
function drawChart(rows) {
  const ctx = document.getElementById('chart').getContext('2d');
  
  // Destroy existing chart instance if it exists
  if (chartInstance) {
    chartInstance.destroy();
  }

  const data = {
    labels: rows.map(r => r.idx % 6 === 0 ? r.idx : ''), // Label every 6th month for cleaner look
    datasets: [
      {
        label: 'Principal Paid',
        data: rows.map(r => r.principal),
        backgroundColor: '#46B2FF', // Tech Blue
        stack: 'Stack 1',
      },
      {
        label: 'Interest Paid',
        data: rows.map(r => r.interest),
        backgroundColor: '#F97316', // Orange
        stack: 'Stack 1',
      }
    ]
  };

  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          stacked: true,
          title: {
            display: true,
            text: 'Month'
          },
          grid: {
            display: false,
          }
        },
        y: {
          stacked: true,
          title: {
            display: true,
            text: 'Payment Amount (£)'
          }
        }
      },
      plugins: {
        tooltip: {
            callbacks: {
                label: function(context) {
                    let label = context.dataset.label || '';
                    if (label) {
                        label += ': ';
                    }
                    if (context.parsed.y !== null) {
                        label += money(context.parsed.y);
                    }
                    return label;
                }
            }
        }
      }
    }
  });
}