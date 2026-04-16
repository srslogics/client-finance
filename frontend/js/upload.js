function showOutput(data) {
    document.getElementById("output").innerText = JSON.stringify(data, null, 2);
  }
  
  async function uploadVendor() {
    const file = document.getElementById("vendorFile").files[0];
    const formData = new FormData();
    formData.append("file", file);
  
    const data = await apiCall("/upload/vendor", "POST", formData);
    showOutput(data);
  }
  
  async function uploadDealer() {
    const file = document.getElementById("dealerFile").files[0];
    const formData = new FormData();
    formData.append("file", file);
  
    const data = await apiCall("/upload/dealer", "POST", formData);
    showOutput(data);
  }
  
  async function processDay() {
    const date = document.getElementById("date").value;
    const stock = document.getElementById("stock").value;
  
    const data = await apiCall(`/process-day?input_date=${date}&actual_stock=${stock}`, "POST");
    showOutput(data);
  }
  