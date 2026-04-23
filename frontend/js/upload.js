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
    setUploadStatus("info", `${preview ? "Checking" : "Uploading"} ${label}...`);

    const formData = new FormData();
    formData.append("file", file);
    const workingDate = document.getElementById("uploadWorkingDate")?.value;

    // 🔥 Disable button during upload
    toggleButtons(true);

    try {
      const params = new URLSearchParams();
      if (preview) params.set("preview", "true");
      if (workingDate) params.set("input_date", workingDate);
      const url = params.toString() ? `${endpoint}?${params.toString()}` : endpoint;
      const data = await apiCall(url, "POST", formData);

      if (data.error) {
        showToast(data.error);
        setUploadStatus("error", data.error, data.errors || []);
      } else {
        const skipped = data.rows_skipped ? `, ${data.rows_skipped} skipped` : "";
        const action = preview ? "preview" : "uploaded";
        showToast(`${label} ${action}: ${data.rows_inserted} rows${skipped}`);
        setUploadStatus(
          data.errors?.length ? "warning" : "success",
          `${label} ${action}: ${data.rows_inserted} rows${skipped}`,
          data.errors || []
        );
        if (!preview) fileInput.value = ""; // reset input
      }

    } catch (e) {
      console.error(e);
      showToast("Upload failed");
      setUploadStatus("error", "Upload failed. Check the file format and try again.");
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
    showLoading("Preparing template...");
    setTimeout(() => hideLoading(), 900);
    window.location.href = `${BASE_URL}/templates/${type}`;
  }

  async function processDay() {
    const date = document.getElementById("processDate").value;
    const rows = Array.from(document.querySelectorAll(".actual-stock-row"))
      .map(row => ({
        item_type: row.querySelector(".actualItem")?.value.trim(),
        actual_quantity: row.querySelector(".actualNag")?.value,
        actual_weight: row.querySelector(".actualWeight")?.value
      }))
      .filter(row => row.item_type && row.actual_weight !== "");

    if (!date || rows.length === 0) {
      showToast("Enter date and actual stock");
      return;
    }

    const invalidWeight = rows.some(row => Number(row.actual_weight) < 0);
    const invalidNag = rows.some(row => row.actual_quantity !== "" && Number(row.actual_quantity) < 0);
    if (invalidWeight || invalidNag) {
      showToast("Actual stock and NAG cannot be negative");
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
        setUploadStatus("error", data.error);
      } else {
        const quantityLeakage = Number(data.total_quantity_leakage || 0);
        const leakageText = `Leakage: ${Number(data.total_leakage || 0).toLocaleString()} kg${quantityLeakage ? `, ${quantityLeakage.toLocaleString()} NAG` : ""}`;
        showToast(`Processed. ${leakageText}`);
        setUploadStatus("success", `Day processed. ${leakageText}`);
      }

    } catch (e) {
      console.error(e);
      showToast("Processing failed");
      setUploadStatus("error", "Processing failed. Check backend connection and entered stock values.");
    } finally {
      toggleButtons(false);
    }
  }

  function toggleButtons(disable) {
    document.querySelectorAll("button").forEach(btn => {
      btn.disabled = disable;
      btn.classList.toggle("is-loading", disable);
    });
  }

  function addActualStockRow() {
    const container = document.getElementById("actualStockRows");
    const row = document.createElement("div");
    row.className = "upload-box actual-stock-row";
    row.innerHTML = `
      <input type="text" class="actualItem" placeholder="Hen type" list="itemSuggestions" autocomplete="off" oninput="suggestItems(this)">
      <input type="number" class="actualNag" placeholder="Actual NAG" min="0" step="1">
      <input type="number" class="actualWeight" placeholder="Actual stock (kg)" min="0" step="0.01">
      <button onclick="removeActualStockRow(this)">Remove</button>
    `;
    container.appendChild(row);
  }

  function removeActualStockRow(button) {
    button.closest(".actual-stock-row")?.remove();
  }

let itemSuggestTimer = null;

async function suggestItems(input) {
  const suggestions = document.getElementById("itemSuggestions");
  const query = input?.value.trim() || "";

  if (!suggestions) return;

  clearTimeout(itemSuggestTimer);

  if (query.length < 1) {
    suggestions.innerHTML = "";
    return;
  }

  itemSuggestTimer = setTimeout(async () => {
    try {
      const data = await optionalApiCall(`/items/search?q=${encodeURIComponent(query)}`, { results: [] });
      suggestions.innerHTML = "";

      (data.results || []).forEach(item => {
        const option = document.createElement("option");
        option.value = item;
        suggestions.appendChild(option);
      });
    } catch (e) {
      console.error(e);
      suggestions.innerHTML = "";
    }
  }, 200);
}

function setUploadStatus(type, message, errors = []) {
  const status = document.getElementById("uploadStatus");
  if (!status) return;

  status.className = `notice ${type}`;
  status.innerHTML = "";

  const title = document.createElement("strong");
  title.innerText = message;
  status.appendChild(title);

  if (errors.length) {
    const list = document.createElement("ul");
    errors.slice(0, 5).forEach(error => {
      const item = document.createElement("li");
      item.innerText = `Row ${error.row}: ${error.error}`;
      list.appendChild(item);
    });
    status.appendChild(list);
  }
}
