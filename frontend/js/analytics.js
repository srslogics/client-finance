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

  resetAnalyticsView();

  const endpoints = {
    trend: `/analytics/trend?start_date=${start}&end_date=${end}`,
    summary: `/analytics/summary?start_date=${start}&end_date=${end}`,
    leakage: `/analytics/leakage?start_date=${start}&end_date=${end}`,
    debtors: "/top-debtors",
    profitByItem: `/analytics/profit-by-item?start_date=${start}&end_date=${end}`,
    itemVolume: `/analytics/item-volume?start_date=${start}&end_date=${end}`,
    paymentModes: `/analytics/payment-modes?start_date=${start}&end_date=${end}`
  };

  const cachedTrend = getCachedResponse(endpoints.trend);
  const cachedSummary = getCachedResponse(endpoints.summary);
  if (cachedSummary) renderAnalyticsSummary(cachedSummary);
  if (cachedTrend) renderTrendCharts(cachedTrend);

  showToast(cachedTrend ? "Refreshing analytics..." : "Loading analytics...");

  loadAnalyticsPart(endpoints.summary, null, renderAnalyticsSummary);
  loadAnalyticsPart(endpoints.trend, [], renderTrendCharts);
  loadAnalyticsPart(endpoints.leakage, [], renderLeakageChart);
  loadAnalyticsPart(endpoints.debtors, { top_debtors: [] }, renderDebtorChart);
  loadAnalyticsPart(endpoints.profitByItem, [], renderProfitByItemChart);
  loadAnalyticsPart(endpoints.itemVolume, [], renderItemVolumeChart);
  loadAnalyticsPart(endpoints.paymentModes, [], renderPaymentModeChart);
}

function renderAnalyticsSummary(summary) {
  if (!summary || summary.error) return;

  setText("analyticsSales", formatMoney(summary.sales));
  setText("analyticsPurchase", formatMoney(summary.purchase));
  setText("analyticsProfit", formatMoney(summary.profit));
  setText("analyticsCash", formatMoney(summary.net_cash));
}

async function loadAnalyticsPart(url, fallback, renderer) {
  try {
    const data = await optionalApiCall(url, fallback, "GET", null, { loader: false, cache: true });
    renderer(data);
  } catch (e) {
    console.error(e);
  }
}

function resetAnalyticsView() {
    destroyAnalyticsCharts();

    ["trendChart", "cashFlowChart", "leakageChart", "itemVolumeChart", "debtorChart", "paymentModeChart", "profitByItemChart"].forEach(id => {
      drawCanvasMessage(id, "Loading...");
    });
}

function canRenderCharts(chartIds) {
    if (typeof Chart === "undefined") {
      chartIds.forEach(id => drawCanvasMessage(id, "Charts are unavailable. Check internet connection."));
      return false;
    }
    return true;
}

function renderTrendCharts(trend) {
    trend = Array.isArray(trend) ? trend : [];
    if (!canRenderCharts(["trendChart", "cashFlowChart"])) return;

    destroyChart("trend");
    destroyChart("cashFlow");
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
}

function renderLeakageChart(leakage) {
    leakage = Array.isArray(leakage) ? leakage : [];
    if (!canRenderCharts(["leakageChart"])) return;

    destroyChart("leakage");
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
}

function renderItemVolumeChart(itemVolume) {
    itemVolume = Array.isArray(itemVolume) ? itemVolume : [];
    if (!canRenderCharts(["itemVolumeChart"])) return;

    destroyChart("itemVolume");
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
}

function renderDebtorChart(debtors) {
    const topDebtors = Array.isArray(debtors?.top_debtors) ? debtors.top_debtors : [];
    if (!canRenderCharts(["debtorChart"])) return;

    destroyChart("debtor");
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
}

function renderPaymentModeChart(paymentModes) {
    paymentModes = Array.isArray(paymentModes) ? paymentModes : [];
    if (!canRenderCharts(["paymentModeChart"])) return;

    destroyChart("paymentMode");
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
}

function renderProfitByItemChart(profitByItem) {
    profitByItem = Array.isArray(profitByItem) ? profitByItem : [];
    if (!canRenderCharts(["profitByItemChart"])) return;

    destroyChart("profitByItem");
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

function destroyChart(key) {
  if (analyticsCharts[key]) {
    analyticsCharts[key].destroy();
    analyticsCharts[key] = null;
  }
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.innerText = value;
}
