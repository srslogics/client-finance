async function loadAnalytics() {

    const start = document.getElementById("startDate").value;
    const end = document.getElementById("endDate").value;
  
    if (!start || !end) {
      showToast("Select date range");
      return;
    }
  
    // --- Trend ---
    const trend = await apiCall(`/analytics/trend?start_date=${start}&end_date=${end}`);
  
    const dates = trend.map(d => d.date);
    const sales = trend.map(d => d.sales);
    const purchase = trend.map(d => d.purchase);
  
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
  
    // --- Leakage ---
    const leakage = await apiCall(`/analytics/leakage?start_date=${start}&end_date=${end}`);
  
    new Chart(document.getElementById("leakageChart"), {
      type: "line",
      data: {
        labels: leakage.map(d => d.date),
        datasets: [{
          label: "Leakage",
          data: leakage.map(d => d.leakage)
        }]
      }
    });
  
    // --- Debtors ---
    const debtors = await apiCall("/top-debtors");
  
    new Chart(document.getElementById("debtorChart"), {
      type: "bar",
      data: {
        labels: debtors.top_debtors.map(d => d.party_name),
        datasets: [{
          label: "Outstanding",
          data: debtors.top_debtors.map(d => d.balance)
        }]
      }
    });
  }
  