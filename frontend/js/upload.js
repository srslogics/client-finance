async function handleUpload(inputId, endpoint, label) {
    const fileInput = document.getElementById(inputId);
    const file = fileInput.files[0];
  
    if (!file) {
      showToast("Select a file");
      return;
    }
  
    // --- Basic validation
    const allowed = ["application/vnd.ms-excel",
                     "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                     "text/csv"];
  
    if (!allowed.includes(file.type)) {
      showToast("Invalid file type");
      return;
    }
  
    if (file.size > 5 * 1024 * 1024) {
      showToast("File too large (max 5MB)");
      return;
    }
  
    showToast(`Uploading ${label}...`);
  
    const formData = new FormData();
    formData.append("file", file);
  
    // 🔥 Disable button during upload
    toggleButtons(true);
  
    try {
      const data = await apiCall(endpoint, "POST", formData);
  
      if (data.error) {
        showToast(data.error);
      } else {
        showToast(`${label} uploaded: ${data.rows_inserted} rows ✅`);
        fileInput.value = ""; // reset input
      }
  
    } catch (e) {
      console.error(e);
      showToast("Upload failed");
    }
  
    toggleButtons(false);
  }

  function uploadVendor() {
    handleUpload("vendorFile", "/upload/vendor", "Vendor file");
  }

  function uploadDealer() {
    handleUpload("dealerFile", "/upload/dealer", "Dealer file");
  }

  async function processDay() {
    const date = document.getElementById("date").value;
    const stock = document.getElementById("stock").value;
  
    if (!date || !stock) {
      showToast("Enter date and stock");
      return;
    }
  
    showToast("Processing day...");
    toggleButtons(true);
  
    try {
      const data = await apiCall(
        `/process-day?input_date=${date}&actual_stock=${stock}`,
        "POST"
      );
  
      if (data.error) {
        showToast(data.error);
      } else {
        showToast(`Processed. Leakage: ${data.leakage} kg`);
      }
  
    } catch (e) {
      console.error(e);
      showToast("Processing failed");
    }
  
    toggleButtons(false);
  }

  function toggleButtons(disable) {
    document.querySelectorAll("button").forEach(btn => {
      btn.disabled = disable;
      btn.style.opacity = disable ? 0.6 : 1;
    });
  }
  