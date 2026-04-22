const dashboardCharts = {
  trend: null,
  profit: null,
  leakage: null
};

async function loadDashboard() {
  const date = document.getElementById("dashboardDate").value;

  if (!date) return showToast("Select date");

  try {
    const data = await apiCall(`/dashboard?date=${date}`);
    if (data.error) {
      showToast(data.error);
      return;
    }

    setValue("sales", data.sales);
    setValue("purchase", data.purchase);
    setValue("profit", data.profit);
    setKgValue("leakage", data.leakage);
    setValue("receivable", data.receivable);
    setValue("payable", data.payable);
    setValue("outstanding", data.total_outstanding);

    // --- Date range (last 7 days)
    const today = parseDateInput(date);
    const start = new Date(today);
    start.setDate(start.getDate() - 6);

    const startStr = formatDateInput(start);

    drawCanvasMessage("trendChart", "Loading...");
    drawCanvasMessage("profitChart", "Loading...");
    drawCanvasMessage("leakageChart", "Loading...");

    const trendUrl = `/analytics/trend?start_date=${startStr}&end_date=${date}`;
    const leakageUrl = `/analytics/leakage?start_date=${startStr}&end_date=${date}`;
    const inventoryUrl = `/inventory/by-item?date=${date}`;

    const cachedTrend = getCachedResponse(trendUrl);
    const cachedInventory = getCachedResponse(inventoryUrl);
    if (cachedTrend) {
      renderCharts(cachedTrend, []);
      generateInsights(data, cachedTrend);
    }
    if (cachedInventory) renderInventory(cachedInventory.inventory || []);

    optionalApiCall(trendUrl, [], "GET", null, { loader: false, cache: true }).then(trend => {
      renderCharts(trend, []);
      generateInsights(data, trend);
    });
    optionalApiCall(leakageUrl, [], "GET", null, { loader: false, cache: true }).then(leakage => {
      renderLeakageOnly(leakage);
    });
    optionalApiCall(inventoryUrl, { inventory: [] }, "GET", null, { loader: false, cache: true }).then(inventory => {
      renderInventory(inventory.inventory || []);
    });

  } catch (e) {
    console.error(e);
    showToast("Dashboard failed to load");
  }

  function renderLeakageOnly(leakage) {
    leakage = Array.isArray(leakage) ? leakage : [];
    if (typeof Chart === "undefined") {
      drawCanvasMessage("leakageChart", "Charts are unavailable. Check internet connection.");
      return;
    }

    if (dashboardCharts.leakage) {
      dashboardCharts.leakage.destroy();
      dashboardCharts.leakage = null;
    }

    if (leakage.length > 0) {
      dashboardCharts.leakage = new Chart(document.getElementById("leakageChart"), {
        type: "line",
        data: {
          labels: leakage.map(d => d.date),
          datasets: [
            { label: "Leakage", data: leakage.map(d => d.leakage || 0) }
          ]
        }
      });
    } else {
      drawCanvasMessage("leakageChart", "No leakage data");
    }
  }
}

function setValue(id, value) {
  document.getElementById(id).innerText =
    "₹ " + Number(value || 0).toLocaleString();
}

function setKgValue(id, value) {
  document.getElementById(id).innerText =
    Number(value || 0).toLocaleString() + " kg";
}

function renderCharts(trend, leakage) {
    destroyDashboardCharts();

    trend = Array.isArray(trend) ? trend : [];
    leakage = Array.isArray(leakage) ? leakage : [];

    if (typeof Chart === "undefined") {
      drawCanvasMessage("trendChart", "Charts are unavailable. Check internet connection.");
      drawCanvasMessage("profitChart", "Charts are unavailable. Check internet connection.");
      drawCanvasMessage("leakageChart", "Charts are unavailable. Check internet connection.");
      return;
    }

    const dates = trend.map(d => d.date);
    const sales = trend.map(d => d.sales || 0);
    const purchase = trend.map(d => d.purchase || 0);
    const profit = trend.map(d => d.profit ?? ((d.sales || 0) - (d.purchase || 0)));

    if (!trend || trend.length === 0) {
      console.warn("No trend data");
      drawCanvasMessage("trendChart", "No sales or purchase data");
      drawCanvasMessage("profitChart", "No profit data");
      return;
    }

    dashboardCharts.trend = new Chart(document.getElementById("trendChart"), {
      type: "line",
      data: {
        labels: dates,
        datasets: [
          { label: "Sales", data: sales, borderColor: "#2f7f96", backgroundColor: "rgb(47 127 150 / 0.12)", tension: 0.35 },
          { label: "Purchase", data: purchase, borderColor: "#b86f20", backgroundColor: "rgb(184 111 32 / 0.12)", tension: 0.35 }
        ]
      }
    });

    dashboardCharts.profit = new Chart(document.getElementById("profitChart"), {
      type: "line",
      data: {
        labels: dates,
        datasets: [
          {
            label: "Profit",
            data: profit,
            borderColor: "#23785b",
            backgroundColor: "rgb(35 120 91 / 0.12)",
            fill: true,
            tension: 0.35
          }
        ]
      }
    });

    if (leakage && leakage.length > 0) {
      dashboardCharts.leakage = new Chart(document.getElementById("leakageChart"), {
        type: "line",
        data: {
          labels: leakage.map(d => d.date),
          datasets: [
            { label: "Leakage", data: leakage.map(d => d.leakage || 0) }
          ]
        }
      });
    } else {
      drawCanvasMessage("leakageChart", "No leakage data");
    }
  }

  function destroyDashboardCharts() {
    Object.keys(dashboardCharts).forEach(key => {
      if (dashboardCharts[key]) {
        dashboardCharts[key].destroy();
        dashboardCharts[key] = null;
      }
    });
  }

  function parseDateInput(value) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function generateInsights(today, trend) {

    const list = document.getElementById("insightsList");
    if (!list) return;

    list.innerHTML = "";

    if (!trend || trend.length < 2) {
      addInsight("Not enough data for insights");
      return;
    }

    const last = trend[trend.length - 1];
    const prev = trend[trend.length - 2];

    const profitToday = (last.sales || 0) - (last.purchase || 0);
    const profitPrev = (prev.sales || 0) - (prev.purchase || 0);

    if (profitToday > profitPrev) {
      addInsight("Profit increased vs previous day");
    } else {
      addInsight("Profit decreased vs previous day");
    }

    if ((today.leakage || 0) > 50) {
      addInsight("High leakage detected");
    }

    if ((today.total_outstanding || 0) > 100000) {
      addInsight("Outstanding is high. Review collections.");
    }
  }

  function addInsight(text) {
    const li = document.createElement("li");
    li.innerText = text;
    document.getElementById("insightsList").appendChild(li);
  }

  function renderInventory(rows) {
    const body = document.getElementById("inventoryBody");
    if (!body) return;

    rows = Array.isArray(rows) ? rows : [];
    body.innerHTML = "";

    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="7" class="empty">No inventory data</td></tr>`;
      return;
    }

    rows.forEach(row => {
      const tr = document.createElement("tr");
      appendDashboardCell(tr, row.item);
      appendDashboardCell(tr, `${Number(row.opening_weight || 0).toLocaleString()} kg`);
      appendDashboardCell(tr, `${Number(row.purchase_weight || 0).toLocaleString()} kg`);
      appendDashboardCell(tr, `${Number(row.sales_weight || 0).toLocaleString()} kg`);
      appendDashboardCell(tr, `${Number(row.expected_closing_weight || row.closing_weight || 0).toLocaleString()} kg`);
      appendDashboardCell(tr, row.actual_closing_weight === null ? "-" : `${Number(row.actual_closing_weight || 0).toLocaleString()} kg`);
      appendDashboardCell(tr, row.leakage === null ? "-" : `${Number(row.leakage || 0).toLocaleString()} kg`);
      body.appendChild(tr);
    });
  }

  function appendDashboardCell(row, value) {
    const cell = document.createElement("td");
    cell.innerText = value ?? "";
    row.appendChild(cell);
  }
