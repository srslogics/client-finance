async function uploadVendor() {
    const file = document.getElementById("vendorFile").files[0];
  
    if (!file) {
      showToast("Select a file");
      return;
    }
  
    showToast("Uploading vendor file...");
  
    const formData = new FormData();
    formData.append("file", file);
  
    try {
      const data = await apiCall("/upload/vendor", "POST", formData);
  
      if (data.error) {
        showToast("Error: " + data.error);
      } else {
        showToast(`Uploaded ${data.rows_inserted} rows ✅`);
      }
  
    } catch (e) {
      showToast("Upload failed");
    }
  }

  async function uploadDealer() {
    const file = document.getElementById("dealerFile").files[0];
  
    if (!file) {
      showToast("Select a file");
      return;
    }
  
    showToast("Uploading dealer file...");
  
    const formData = new FormData();
    formData.append("file", file);
  
    try {
      const data = await apiCall("/upload/dealer", "POST", formData);
  
      if (data.error) {
        showToast("Error: " + data.error);
      } else {
        showToast(`Uploaded ${data.rows_inserted} rows ✅`);
      }
  
    } catch (e) {
      showToast("Upload failed");
    }
  }

  async function processDay() {
    const date = document.getElementById("date").value;
    const stock = document.getElementById("stock").value;
  
    if (!date || !stock) {
      showToast("Enter date and stock");
      return;
    }
  
    showToast("Processing day...");
  
    try {
      const data = await apiCall(
        `/process-day?input_date=${date}&actual_stock=${stock}`,
        "POST"
      );
  
      if (data.error) {
        showToast("Error: " + data.error);
      } else {
        showToast(`Done. Leakage: ${data.leakage} kg`);
      }
  
    } catch (e) {
      showToast("Processing failed");
    }
  }
  