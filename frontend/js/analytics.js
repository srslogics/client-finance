const analyticsCharts = {
  trend: null,
  cashFlow: null,
  leakage: null,
  itemVolume: null,
  debtor: null,
  paymentMode: null,
  profitByItem: null
};

async function loadAnalytics() {

  const start = document.getElementById("startDate")?.value;
  const end = document.getElementById("endDate")?.value;

  if (!start || !end) {
    showToast("Select date range");
    return;
  }

  if (start > end) {
    showToast("Start date cannot be after end date");
    return;
  }

  try {

    // --- Fetch data ---
    const trend = await optionalApiCall(`/analytics/trend?start_date=${start}&end_date=${end}`, []);
    const summary = await optionalApiCall(`/analytics/summary?start_date=${start}&end_date=${end}`, null);
    const leakage = await optionalApiCall(`/analytics/leakage?start_date=${start}&end_date=${end}`, []);
    const debtors = await optionalApiCall("/top-debtors", { top_debtors: [] });
    const profitByItem = await optionalApiCall(`/analytics/profit-by-item?start_date=${start}&end_date=${end}`, []);
    const itemVolume = await optionalApiCall(`/analytics/item-volume?start_date=${start}&end_date=${end}`, []);
    const paymentModes = await optionalApiCall(`/analytics/payment-modes?start_date=${start}&end_date=${end}`, []);

    // 🔥 Delay ensures DOM is ready
    setTimeout(() => {
      renderAnalyticsSummary(summary);
      renderAnalyticsCharts(trend, leakage, debtors, profitByItem, itemVolume, paymentModes);
    }, 100);

  } catch (e) {
    console.error(e);
    showToast("Analytics failed to load");
  }
}

function renderAnalyticsSummary(summary) {
  if (!summary || summary.error) return;

  setText("analyticsSales", formatMoney(summary.sales));
  setText("analyticsPurchase", formatMoney(summary.purchase));
  setText("analyticsProfit", formatMoney(summary.profit));
  setText("analyticsCash", formatMoney(summary.net_cash));
}

function renderAnalyticsCharts(trend, leakage, debtors, profitByItem, itemVolume, paymentModes) {
    destroyAnalyticsCharts();

    trend = Array.isArray(trend) ? trend : [];
    leakage = Array.isArray(leakage) ? leakage : [];
    profitByItem = Array.isArray(profitByItem) ? profitByItem : [];
    itemVolume = Array.isArray(itemVolume) ? itemVolume : [];
    paymentModes = Array.isArray(paymentModes) ? paymentModes : [];
    const topDebtors = Array.isArray(debtors?.top_debtors) ? debtors.top_debtors : [];

    if (typeof Chart === "undefined") {
      drawCanvasMessage("trendChart", "Charts are unavailable. Check internet connection.");
      drawCanvasMessage("cashFlowChart", "Charts are unavailable. Check internet connection.");
      drawCanvasMessage("leakageChart", "Charts are unavailable. Check internet connection.");
      drawCanvasMessage("itemVolumeChart", "Charts are unavailable. Check internet connection.");
      drawCanvasMessage("debtorChart", "Charts are unavailable. Check internet connection.");
      drawCanvasMessage("paymentModeChart", "Charts are unavailable. Check internet connection.");
      drawCanvasMessage("profitByItemChart", "Charts are unavailable. Check internet connection.");
      return;
    }

    const dates = trend.map(d => d.date);
    const sales = trend.map(d => d.sales || 0);
    const purchase = trend.map(d => d.purchase || 0);
    const profit = trend.map(d => d.profit || 0);

    // --- Trend Chart ---
    if (trend && trend.length > 0) {
      analyticsCharts.trend = new Chart(document.getElementById("trendChart"), {
        type: "line",
        data: {
          labels: dates,
          datasets: [
            { label: "Sales", data: sales, borderColor: "#2f7f96", backgroundColor: "rgb(47 127 150 / 0.12)", tension: 0.35 },
            { label: "Purchase", data: purchase, borderColor: "#b86f20", backgroundColor: "rgb(184 111 32 / 0.12)", tension: 0.35 }
          ]
        }
      });
    } else {
      drawCanvasMessage("trendChart", "No sales or purchase data");
    }

    if (trend && trend.length > 0) {
      analyticsCharts.cashFlow = new Chart(document.getElementById("cashFlowChart"), {
        type: "bar",
        data: {
          labels: dates,
          datasets: [
            { label: "Sales", data: sales, backgroundColor: "#2f7f96" },
            { label: "Purchase", data: purchase, backgroundColor: "#b7791f" },
            { label: "Profit", data: profit, backgroundColor: "#1f7a5c" }
          ]
        },
        options: {
          responsive: true,
          scales: { x: { stacked: false }, y: { beginAtZero: true } }
        }
      });
    } else {
      drawCanvasMessage("cashFlowChart", "No cash movement data");
    }

    // --- Leakage Chart ---
    if (leakage && leakage.length > 0) {
      analyticsCharts.leakage = new Chart(document.getElementById("leakageChart"), {
        type: "line",
        data: {
          labels: leakage.map(d => d.date),
          datasets: [{
            label: "Leakage",
            data: leakage.map(d => d.leakage || 0),
            borderColor: "#b64a3d",
            backgroundColor: "rgb(182 74 61 / 0.12)",
            tension: 0.35
          }]
        }
      });
    } else {
      drawCanvasMessage("leakageChart", "No leakage data");
    }

    if (itemVolume.length > 0) {
      analyticsCharts.itemVolume = new Chart(document.getElementById("itemVolumeChart"), {
        type: "bar",
        data: {
          labels: itemVolume.map(d => d.item),
          datasets: [
            { label: "Purchased kg", data: itemVolume.map(d => d.purchase_kg || 0), backgroundColor: "#b7791f" },
            { label: "Sold kg", data: itemVolume.map(d => d.sales_kg || 0), backgroundColor: "#2f7f96" }
          ]
        },
        options: {
          responsive: true,
          scales: { y: { beginAtZero: true } }
        }
      });
    } else {
      drawCanvasMessage("itemVolumeChart", "No hen-type volume data");
    }

    // --- Debtors Chart ---
    if (topDebtors.length > 0) {
      analyticsCharts.debtor = new Chart(document.getElementById("debtorChart"), {
        type: "bar",
        data: {
          labels: topDebtors.map(d => d.party_name),
          datasets: [{
            label: "Outstanding",
            data: topDebtors.map(d => d.balance || 0),
            backgroundColor: "#2f7f96"
          }]
        }
      });
    } else {
      drawCanvasMessage("debtorChart", "No outstanding parties");
    }

    if (paymentModes.length > 0) {
      analyticsCharts.paymentMode = new Chart(document.getElementById("paymentModeChart"), {
        type: "doughnut",
        data: {
          labels: paymentModes.map(d => d.mode),
          datasets: [{
            label: "Payments",
            data: paymentModes.map(d => d.total || 0),
            backgroundColor: ["#2f7f96", "#1f7a5c", "#b7791f", "#b64a3d", "#334247"]
          }]
        }
      });
    } else {
      drawCanvasMessage("paymentModeChart", "No payment mode data");
    }

    if (profitByItem && profitByItem.length > 0) {
      analyticsCharts.profitByItem = new Chart(document.getElementById("profitByItemChart"), {
        type: "bar",
        data: {
          labels: profitByItem.map(d => d.item),
          datasets: [{
            label: "Profit",
            data: profitByItem.map(d => d.profit || 0),
            backgroundColor: "#23785b"
          }]
        }
      });
    } else {
      drawCanvasMessage("profitByItemChart", "No item profit data");
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

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.innerText = value;
}
