const analyticsCharts = {
  trend: null,
  leakage: null,
  debtor: null,
  profitByItem: null
};

async function loadAnalytics() {

  const start = document.getElementById("startDate")?.value;
  const end = document.getElementById("endDate")?.value;

  if (!start || !end) {
    showToast("Select date range");
    return;
  }

  try {

    // --- Fetch data ---
    const trend = await optionalApiCall(`/analytics/trend?start_date=${start}&end_date=${end}`, []);
    const leakage = await optionalApiCall(`/analytics/leakage?start_date=${start}&end_date=${end}`, []);
    const debtors = await optionalApiCall("/top-debtors", { top_debtors: [] });
    const profitByItem = await optionalApiCall(`/analytics/profit-by-item?start_date=${start}&end_date=${end}`, []);

    // 🔥 Delay ensures DOM is ready
    setTimeout(() => {
      renderAnalyticsCharts(trend, leakage, debtors, profitByItem);
    }, 100);

  } catch (e) {
    console.error(e);
    showToast("Analytics failed to load");
  }
}

function renderAnalyticsCharts(trend, leakage, debtors, profitByItem) {
    destroyAnalyticsCharts();

    trend = Array.isArray(trend) ? trend : [];
    leakage = Array.isArray(leakage) ? leakage : [];
    profitByItem = Array.isArray(profitByItem) ? profitByItem : [];
    const topDebtors = Array.isArray(debtors?.top_debtors) ? debtors.top_debtors : [];

    const dates = trend.map(d => d.date);
    const sales = trend.map(d => d.sales || 0);
    const purchase = trend.map(d => d.purchase || 0);

    // --- Trend Chart ---
    if (trend && trend.length > 0) {
      analyticsCharts.trend = new Chart(document.getElementById("trendChart"), {
        type: "line",
        data: {
          labels: dates,
          datasets: [
            { label: "Sales", data: sales },
            { label: "Purchase", data: purchase }
          ]
        }
      });
    }

    // --- Leakage Chart ---
    if (leakage && leakage.length > 0) {
      analyticsCharts.leakage = new Chart(document.getElementById("leakageChart"), {
        type: "line",
        data: {
          labels: leakage.map(d => d.date),
          datasets: [{
            label: "Leakage",
            data: leakage.map(d => d.leakage || 0)
          }]
        }
      });
    }

    // --- Debtors Chart ---
    if (topDebtors.length > 0) {
      analyticsCharts.debtor = new Chart(document.getElementById("debtorChart"), {
        type: "bar",
        data: {
          labels: topDebtors.map(d => d.party_name),
          datasets: [{
            label: "Outstanding",
            data: topDebtors.map(d => d.balance || 0)
          }]
        }
      });
    }

    if (profitByItem && profitByItem.length > 0) {
      analyticsCharts.profitByItem = new Chart(document.getElementById("profitByItemChart"), {
        type: "bar",
        data: {
          labels: profitByItem.map(d => d.item),
          datasets: [{
            label: "Profit",
            data: profitByItem.map(d => d.profit || 0)
          }]
        }
      });
    }
  }

function destroyAnalyticsCharts() {
  Object.keys(analyticsCharts).forEach(key => {
    if (analyticsCharts[key]) {
      analyticsCharts[key].destroy();
      analyticsCharts[key] = null;
    }
  });
}
