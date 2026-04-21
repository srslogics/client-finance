async function handleUpload(inputId, endpoint, label, preview = false) {
    const fileInput = document.getElementById(inputId);
    const file = fileInput.files[0];

    if (!file) {
      showToast("Select a file");
      return;
    }

    // --- Basic validation
    const allowedTypes = [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv",
      "application/csv",
      "text/plain",
      ""
    ];
    const allowedExtensions = [".csv", ".xls", ".xlsx"];
    const fileName = file.name.toLowerCase();

    if (!allowedTypes.includes(file.type) && !allowedExtensions.some(ext => fileName.endsWith(ext))) {
      showToast("Invalid file type");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast("File too large (max 5MB)");
      return;
    }

    showToast(`${preview ? "Previewing" : "Uploading"} ${label}...`);

    const formData = new FormData();
    formData.append("file", file);

    // 🔥 Disable button during upload
    toggleButtons(true);

    try {
      const url = preview ? `${endpoint}?preview=true` : endpoint;
      const data = await apiCall(url, "POST", formData);

      if (data.error) {
        showToast(data.error);
      } else {
        const skipped = data.rows_skipped ? `, ${data.rows_skipped} skipped` : "";
        const action = preview ? "preview" : "uploaded";
        showToast(`${label} ${action}: ${data.rows_inserted} rows${skipped}`);
        if (!preview) fileInput.value = ""; // reset input
      }

    } catch (e) {
      console.error(e);
      showToast("Upload failed");
    } finally {
      toggleButtons(false);
    }
  }

  function uploadVendor() {
    handleUpload("vendorFile", "/upload/vendor", "Vendor sales file");
  }

  function previewVendor() {
    handleUpload("vendorFile", "/upload/vendor", "Vendor sales file", true);
  }

  function uploadDealer() {
    handleUpload("dealerFile", "/upload/dealer", "Dealer purchase file");
  }

  function previewDealer() {
    handleUpload("dealerFile", "/upload/dealer", "Dealer purchase file", true);
  }

  function uploadPayment() {
    handleUpload("paymentFile", "/upload/payment", "Payment file");
  }

  function previewPayment() {
    handleUpload("paymentFile", "/upload/payment", "Payment file", true);
  }

  function uploadOpeningBalance() {
    handleUpload("openingBalanceFile", "/upload/opening-balance", "Opening balance file");
  }

  function previewOpeningBalance() {
    handleUpload("openingBalanceFile", "/upload/opening-balance", "Opening balance file", true);
  }

  function uploadOpeningStock() {
    handleUpload("openingStockFile", "/upload/opening-stock", "Opening stock file");
  }

  function previewOpeningStock() {
    handleUpload("openingStockFile", "/upload/opening-stock", "Opening stock file", true);
  }

  function downloadTemplate(type) {
    window.location.href = `${BASE_URL}/templates/${type}`;
  }

  async function processDay() {
    const date = document.getElementById("processDate").value;
    const rows = Array.from(document.querySelectorAll(".actual-stock-row"))
      .map(row => ({
        item_type: row.querySelector(".actualItem")?.value.trim(),
        actual_weight: row.querySelector(".actualWeight")?.value
      }))
      .filter(row => row.item_type && row.actual_weight !== "");

    if (!date || rows.length === 0) {
      showToast("Enter date and actual stock");
      return;
    }

    showToast("Processing day...");
    toggleButtons(true);

    try {
      const data = await apiCall(
        `/process-day/items?input_date=${encodeURIComponent(date)}`,
        "POST",
        JSON.stringify(rows),
        { "Content-Type": "application/json" }
      );

      if (data.error) {
        showToast(data.error);
      } else {
        showToast(`Processed. Leakage: ${Number(data.total_leakage || 0).toLocaleString()} kg`);
      }

    } catch (e) {
      console.error(e);
      showToast("Processing failed");
    } finally {
      toggleButtons(false);
    }
  }

  function toggleButtons(disable) {
    document.querySelectorAll("button").forEach(btn => {
      btn.disabled = disable;
      btn.style.opacity = disable ? 0.6 : 1;
    });
  }

  function addActualStockRow() {
    const container = document.getElementById("actualStockRows");
    const row = document.createElement("div");
    row.className = "upload-box actual-stock-row";
    row.innerHTML = `
      <input type="text" class="actualItem" placeholder="Hen type">
      <input type="number" class="actualWeight" placeholder="Actual stock (kg)" min="0" step="0.01">
      <button onclick="removeActualStockRow(this)">Remove</button>
    `;
    container.appendChild(row);
  }

  function removeActualStockRow(button) {
    button.closest(".actual-stock-row")?.remove();
  }
