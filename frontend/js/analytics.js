async function loadAnalytics() {

    // --- Get today's data ---
    const today = new Date().toISOString().split("T")[0];
    const dashboard = await apiCall(`/dashboard?date=${today}`);
  
    // --- Chart 1: Sales vs Purchase ---
    const ctx1 = document.getElementById("chart1");
  
    new Chart(ctx1, {
      type: "bar",
      data: {
        labels: ["Purchase", "Sales"],
        datasets: [{
          label: "Amount",
          data: [dashboard.purchase, dashboard.sales],
        }]
      }
    });
  
    // --- Chart 2: Top Debtors ---
    const debtors = await apiCall("/top-debtors");
  
    const names = debtors.top_debtors.map(d => d.party_name);
    const values = debtors.top_debtors.map(d => d.balance);
  
    const ctx2 = document.getElementById("chart2");
  
    new Chart(ctx2, {
      type: "pie",
      data: {
        labels: names,
        datasets: [{
          data: values
        }]
      }
    });
  }
  