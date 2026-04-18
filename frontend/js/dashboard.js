let trendChart, profitChart, leakageChart;

async function loadDashboard() {
    const date = document.getElementById("dashboardDate").value;

  if (!date) return showToast("Select date");

  try {
    const data = await apiCall(`/dashboard?date=${date}`);

    setValue("sales", data.sales);
    setValue("purchase", data.purchase);
    setValue("profit", data.profit);
    document.getElementById("leakage").innerText = data.leakage + " kg";
    setValue("outstanding", data.total_outstanding);

    // --- Date range (last 7 days)
    const today = new Date(date);
    const start = new Date(today);
    start.setDate(start.getDate() - 6);

    const startStr = start.toISOString().split("T")[0];

    const trend = await apiCall(`/analytics/trend?start_date=${startStr}&end_date=${date}`);
    const leakage = await apiCall(`/analytics/leakage?start_date=${startStr}&end_date=${date}`);

    // 🔥 Delay ensures DOM is ready
    setTimeout(() => {
      renderCharts(trend, leakage);
      generateInsights(data, trend);
    }, 100);

  } catch (e) {
    console.error(e);
    showToast("Dashboard failed to load");
  }
}

function setValue(id, value) {
  document.getElementById(id).innerText =
    "₹ " + Number(value || 0).toLocaleString();
}

function renderCharts(trend, leakage) {

    if (!trend || trend.length === 0) {
      console.warn("No trend data");
      return;
    }
  
    const dates = trend.map(d => d.date);
    const sales = trend.map(d => d.sales || 0);
    const purchase = trend.map(d => d.purchase || 0);
    const profit = trend.map(d => (d.sales || 0) - (d.purchase || 0));
  
    // 🔥 Destroy old charts
    if (trendChart) trendChart.destroy();
    if (profitChart) profitChart.destroy();
    if (leakageChart) leakageChart.destroy();
  
    trendChart = new Chart(document.getElementById("trendChart"), {
      type: "line",
      data: {
        labels: dates,
        datasets: [
          { label: "Sales", data: sales },
          { label: "Purchase", data: purchase }
        ]
      }
    });
  
    profitChart = new Chart(document.getElementById("profitChart"), {
      type: "line",
      data: {
        labels: dates,
        datasets: [
          { label: "Profit", data: profit }
        ]
      }
    });
  
    if (leakage && leakage.length > 0) {
      leakageChart = new Chart(document.getElementById("leakageChart"), {
        type: "line",
        data: {
          labels: leakage.map(d => d.date),
          datasets: [
            { label: "Leakage", data: leakage.map(d => d.leakage || 0) }
          ]
        }
      });
    }
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
      addInsight("Profit increased vs yesterday 📈");
    } else {
      addInsight("Profit decreased vs yesterday ⚠️");
    }
  
    if ((today.leakage || 0) > 50) {
      addInsight("High leakage detected 🚨");
    }
  
    if ((today.total_outstanding || 0) > 100000) {
      addInsight("Outstanding is high — cash risk ⚠️");
    }
  }
  
  function addInsight(text) {
    const li = document.createElement("li");
    li.innerText = text;
    document.getElementById("insightsList").appendChild(li);
  }
    