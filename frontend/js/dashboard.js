async function loadDashboard() {
    const date = document.getElementById("date").value;
  
    const data = await apiCall(`/dashboard?date=${date}`);
  
    document.getElementById("dashboardOutput").innerText =
      JSON.stringify(data, null, 2);
  }
  