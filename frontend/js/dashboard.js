async function loadDashboard() {
    const date = document.getElementById("date").value;
  
    if (!date) {
      alert("Select date");
      return;
    }
  
    try {
      const data = await apiCall(`/dashboard?date=${date}`);
  
      document.getElementById("purchase").innerText = format(data.purchase);
      document.getElementById("sales").innerText = format(data.sales);
      document.getElementById("profit").innerText = format(data.profit);
      document.getElementById("leakage").innerText = format(data.leakage);
      document.getElementById("outstanding").innerText = format(data.total_outstanding);
  
    } catch (e) {
      alert("Failed to load dashboard");
    }
  }
  
  function format(value) {
    return "₹ " + Number(value).toLocaleString();
  }
  
  function setValue(id, value) {
    document.getElementById(id).innerText =
      "₹ " + Number(value).toLocaleString();
  }
  
  async function loadDashboard() {
    const date = document.getElementById("date").value;
  
    const data = await apiCall(`/dashboard?date=${date}`);
  
    setValue("purchase", data.purchase);
    setValue("sales", data.sales);
    setValue("profit", data.profit);
    setValue("leakage", data.leakage);
    setValue("outstanding", data.total_outstanding);
  }
  