async function loadDashboard() {
    const date = document.getElementById("date").value;
  
    if (!date) return showToast("Select date");
  
    const data = await apiCall(`/dashboard?date=${date}`);
  
    setValue("sales", data.sales);
    setValue("purchase", data.purchase);
    setValue("profit", data.profit);
    document.getElementById("leakage").innerText = data.leakage + " kg";
    setValue("outstanding", data.total_outstanding);
  
    // --- Load trends (last 7 days)
    const today = new Date(date);
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
  
    const startStr = start.toISOString().split("T")[0];
  
    const trend = await apiCall(`/analytics/trend?start_date=${startStr}&end_date=${date}`);
    const leakage = await apiCall(`/analytics/leakage?start_date=${startStr}&end_date=${date}`);
  
    renderCharts(trend, leakage);
    generateInsights(data, trend);
  }
  
  function setValue(id, value) {
    document.getElementById(id).innerText =
      "₹ " + Number(value).toLocaleString();
  }

  function renderCharts(trend, leakage) {

    const dates = trend.map(d => d.date);
    const sales = trend.map(d => d.sales);
    const purchase = trend.map(d => d.purchase);
    const profit = trend.map(d => d.sales - d.purchase);
  
    new Chart(document.getElementById("trendChart"), {
      type: "line",
      data: {
        labels: dates,
        datasets: [
          { label: "Sales", data: sales },
          { label: "Purchase", data: purchase }
        ]
      }
    });
  
    new Chart(document.getElementById("profitChart"), {
      type: "line",
      data: {
        labels: dates,
        datasets: [
          { label: "Profit", data: profit }
        ]
      }
    });
  
    new Chart(document.getElementById("leakageChart"), {
      type: "line",
      data: {
        labels: leakage.map(d => d.date),
        datasets: [
          { label: "Leakage", data: leakage.map(d => d.leakage) }
        ]
      }
    });
  }

  function generateInsights(today, trend) {

    const list = document.getElementById("insightsList");
    list.innerHTML = "";
  
    const last = trend[trend.length - 1];
    const prev = trend[trend.length - 2];
  
    if (prev) {
      const profitToday = last.sales - last.purchase;
      const profitPrev = prev.sales - prev.purchase;
  
      if (profitToday > profitPrev) {
        addInsight("Profit increased vs yesterday 📈");
      } else {
        addInsight("Profit decreased vs yesterday ⚠️");
      }
    }
  
    if (today.leakage > 50) {
      addInsight("High leakage detected 🚨");
    }
  
    if (today.total_outstanding > 100000) {
      addInsight("Outstanding is high — cash risk ⚠️");
    }
  }
  
  function addInsight(text) {
    const li = document.createElement("li");
    li.innerText = text;
    document.getElementById("insightsList").appendChild(li);
  }
  