const RETAIL_SHOP_PROFILE = {
  name: "NP Chicken Shop",
  proprietor: "Prop. Sandeep S. Alag (Appu)",
  address: "Shop No. 58, Kamaal Chowk Bazaar, Nagpur",
  phone: "9371291195 / 7972329562"
};

const RETAIL_SHORTCUT_ITEMS = [
  "CB",
  "BB",
  "COCREL",
  "DESI",
  "LEGOAN",
  "LOOS"
];
const RETAIL_PENDING_STORAGE_KEY = "stockpilot.retail.pending";

let retailItemSuggestTimer = null;
let retailCustomerSuggestTimer = null;
let currentRetailBill = null;
let retailDraftDirty = false;
let retailBillCompleted = false;
let retailConnectivityListenersAttached = false;

function initRetailPage() {
  const dateInput = document.getElementById("retailDate");
  if (!dateInput) return;

  dateInput.value = formatDateInput(new Date());
  dateInput.addEventListener("change", async () => {
    await refreshRetailBillNumber();
    loadRetailBills();
  });

  const formIds = [
    "retailBillNumber",
    "retailCashier",
    "retailSettlementType",
    "retailPaymentMode",
    "retailCustomerName",
    "retailCustomerPhone",
    "retailCustomerAddress",
    "retailPaidAmount",
    "retailNotes"
  ];

  formIds.forEach(id => {
    const input = document.getElementById(id);
    if (!input) return;
    input.addEventListener("input", markRetailDraftDirty);
    input.addEventListener("change", markRetailDraftDirty);
  });

  const settlementType = document.getElementById("retailSettlementType");
  if (settlementType) {
    settlementType.addEventListener("change", handleRetailSettlementTypeChange);
  }

  attachRetailConnectivityListeners();
  addRetailItemRow();
  renderRetailShortcuts();
  renderRetailOfflineBanner();
  syncRetailSettlementUi();
  refreshRetailBillNumber();
  renderRetailPreviewFromForm();
  loadRetailBills();
  syncPendingRetailBills(true);
}

function renderRetailShortcuts() {
  const container = document.getElementById("retailShortcutItems");
  if (!container) return;

  container.innerHTML = "";
  RETAIL_SHORTCUT_ITEMS.forEach(itemName => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "retail-shortcut-chip";
    button.innerText = itemName;
    button.onclick = () => addShortcutRetailItem(itemName);
    container.appendChild(button);
  });
}

async function refreshRetailBillNumber() {
  const date = document.getElementById("retailDate")?.value;
  const billNumber = document.getElementById("retailBillNumber");
  if (!date || !billNumber) return;

  try {
    let nextNumber = "1";

    if (navigator.onLine) {
      const data = await optionalApiCall(
        `/retail-bills/next-number?date=${encodeURIComponent(date)}`,
        { bill_number: "1" },
        "GET",
        null,
        { cache: false }
      );
      nextNumber = data.bill_number || "1";
    }

    billNumber.value = computeNextRetailBillNumber(date, nextNumber);
    renderRetailPreviewFromForm();
  } catch (e) {
    console.error(e);
    billNumber.value = computeNextRetailBillNumber(date, "1");
  }
}

function addRetailItemRow(item = null) {
  const container = document.getElementById("retailItemRows");
  if (!container) return;

  const row = document.createElement("div");
  row.className = "retail-item-row";
  row.innerHTML = `
    <input type="text" class="retailItemName" placeholder="Item name" list="retailItemSuggestions" autocomplete="off" oninput="suggestRetailItems(this); recalcRetailLine(this)">
    <select class="retailLineType" onchange="handleRetailLineTypeChange(this)">
      <option value="STANDARD">Regular</option>
      <option value="DRESSED">Dressed Chicken</option>
    </select>
    <input type="number" class="retailQty" placeholder="NAG" min="0" step="0.01" oninput="recalcRetailLine(this)">
    <select class="retailUnit" onchange="recalcRetailLine(this)">
      <option value="KGS">KGS</option>
      <option value="PCS">PCS</option>
    </select>
    <input type="number" class="retailWeight" placeholder="Weight (kg)" min="0" step="0.001" oninput="recalcRetailLine(this)">
    <input type="number" class="retailRate" placeholder="Rate" min="0" step="0.01" oninput="recalcRetailLine(this)">
    <input type="number" class="retailAmount" placeholder="Amount" min="0" step="0.01" oninput="markRetailAmountDirty(this)">
    <button type="button" onclick="removeRetailItemRow(this)">Remove</button>
  `;
  container.appendChild(row);

  if (item) {
    row.querySelector(".retailItemName").value = item.item_name || "";
    row.querySelector(".retailLineType").value = (item.line_type || "STANDARD").toUpperCase();
    row.querySelector(".retailQty").value = item.nag || item.quantity || "";
    row.querySelector(".retailUnit").value = item.unit || "KGS";
    row.querySelector(".retailWeight").value = item.weight || "";
    row.querySelector(".retailRate").value = item.rate || "";
    row.querySelector(".retailAmount").value = item.amount || "";
  }

  syncRetailLineUi(row);
  retailDraftDirty = true;
  retailBillCompleted = false;
  renderRetailPreviewFromForm();
}

function addShortcutRetailItem(itemName) {
  const rows = Array.from(document.querySelectorAll(".retail-item-row"));
  let targetRow = rows.find(row => !row.querySelector(".retailItemName")?.value.trim());

  if (!targetRow) {
    addRetailItemRow();
    targetRow = Array.from(document.querySelectorAll(".retail-item-row")).at(-1);
  }

  const itemInput = targetRow?.querySelector(".retailItemName");
  const qtyInput = targetRow?.querySelector(".retailQty");
  const unitSelect = targetRow?.querySelector(".retailUnit");

  if (!itemInput || !qtyInput || !unitSelect) return;

  itemInput.value = itemName;
  if (!qtyInput.value) qtyInput.value = "1";
  if (!unitSelect.value) unitSelect.value = "KGS";

  retailDraftDirty = true;
  retailBillCompleted = false;
  recalcRetailLine(itemInput);
}

function removeRetailItemRow(button) {
  const rows = document.querySelectorAll(".retail-item-row");
  if (rows.length <= 1) {
    const row = button.closest(".retail-item-row");
    row?.querySelectorAll("input").forEach(input => {
      input.value = "";
    });
    const lineTypeSelect = row?.querySelector(".retailLineType");
    const unitSelect = row?.querySelector(".retailUnit");
    if (lineTypeSelect) lineTypeSelect.value = "STANDARD";
    if (unitSelect) unitSelect.value = "KGS";
    syncRetailLineUi(row);
    retailDraftDirty = true;
    retailBillCompleted = false;
    renderRetailPreviewFromForm();
    return;
  }

  button.closest(".retail-item-row")?.remove();
  retailDraftDirty = true;
  retailBillCompleted = false;
  renderRetailPreviewFromForm();
}

function recalcRetailLine(source) {
  const row = source?.closest(".retail-item-row");
  if (!row) return;

  const lineTypeInput = row.querySelector(".retailLineType");
  const qtyInput = row.querySelector(".retailQty");
  const unitInput = row.querySelector(".retailUnit");
  const weightInput = row.querySelector(".retailWeight");
  const rateInput = row.querySelector(".retailRate");
  const amountInput = row.querySelector(".retailAmount");

  const lineType = lineTypeInput?.value || "STANDARD";
  const quantity = Number(qtyInput?.value || 0);
  const unit = unitInput?.value || "KGS";
  let weight = Number(weightInput?.value || 0);
  let rate = Number(rateInput?.value || 0);
  let amount = Number(amountInput?.value || 0);

  if (lineType === "DRESSED") {
    if (unitInput) unitInput.value = "KGS";

    if (weight > 0 && amount > 0) {
      rate = amount / weight;
      rateInput.value = rate.toFixed(2);
    } else if (weight > 0 && rate > 0 && source !== amountInput) {
      amount = weight * rate;
      amountInput.value = amount.toFixed(2);
    } else if (weight <= 0 || amount <= 0) {
      rateInput.value = "";
    }
  } else {
    if (unit === "KGS" && quantity > 0 && weight <= 0) {
      weight = quantity;
      weightInput.value = quantity;
    }

    const base = weight > 0 ? weight : quantity;
    if (rate > 0 && base > 0 && source !== amountInput) {
      amountInput.value = (base * rate).toFixed(2);
    } else if (amount > 0 && base > 0 && source === amountInput) {
      rateInput.value = (amount / base).toFixed(2);
    }
  }

  retailDraftDirty = true;
  retailBillCompleted = false;
  renderRetailPreviewFromForm();
}

function collectRetailItemsFromForm() {
  return Array.from(document.querySelectorAll(".retail-item-row"))
    .map(row => ({
      item_name: row.querySelector(".retailItemName")?.value.trim(),
      line_type: row.querySelector(".retailLineType")?.value || "STANDARD",
      nag: Number(row.querySelector(".retailQty")?.value || 0),
      quantity: Number(row.querySelector(".retailQty")?.value || 0),
      unit: row.querySelector(".retailUnit")?.value || "KGS",
      weight: Number(row.querySelector(".retailWeight")?.value || 0),
      rate: Number(row.querySelector(".retailRate")?.value || 0),
      amount: Number(row.querySelector(".retailAmount")?.value || 0)
    }))
    .filter(item => item.item_name && item.quantity > 0);
}

function buildRetailBillFromForm() {
  const items = collectRetailItemsFromForm();
  const totalAmount = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalNag = items.reduce((sum, item) => sum + Number(item.nag || item.quantity || 0), 0);
  const totalWeight = items.reduce((sum, item) => sum + Number(item.weight || (item.unit === "KGS" ? item.nag || item.quantity : 0) || 0), 0);
  const paymentMode = document.getElementById("retailPaymentMode")?.value || "Cash";
  const settlementType = document.getElementById("retailSettlementType")?.value || "paid";
  const rawPaidAmount = document.getElementById("retailPaidAmount")?.value;
  let paidAmount = Math.min(
    rawPaidAmount === "" && paymentMode !== "Credit" ? totalAmount : Number(rawPaidAmount || 0),
    totalAmount
  );

  if (settlementType === "paid") {
    paidAmount = totalAmount;
  } else if (settlementType === "credit") {
    paidAmount = 0;
  }

  const outstandingAmount = Math.max(totalAmount - paidAmount, 0);

  return {
    bill_number: document.getElementById("retailBillNumber")?.value.trim() || "Draft",
    date: document.getElementById("retailDate")?.value || formatDateInput(new Date()),
    time: new Date().toLocaleTimeString("en-GB"),
    cashier_name: document.getElementById("retailCashier")?.value.trim() || "admin",
    customer_name: document.getElementById("retailCustomerName")?.value.trim() || "",
    customer_phone: document.getElementById("retailCustomerPhone")?.value.trim() || "",
    customer_address: document.getElementById("retailCustomerAddress")?.value.trim() || "",
    settlement_type: settlementType,
    payment_mode: paymentMode,
    paid_amount: paidAmount,
    outstanding_amount: outstandingAmount,
    requires_customer: outstandingAmount > 0,
    total_amount: totalAmount,
    total_nag: totalNag,
    total_quantity: totalNag,
    total_weight: totalWeight,
    notes: document.getElementById("retailNotes")?.value.trim() || "",
    items
  };
}

function renderRetailPreviewFromForm() {
  renderRetailPreview(buildRetailBillFromForm(), true);
}

function markRetailAmountDirty() {
  retailDraftDirty = true;
  retailBillCompleted = false;
  renderRetailPreviewFromForm();
}

function markRetailDraftDirty() {
  retailDraftDirty = true;
  retailBillCompleted = false;
  renderRetailPreviewFromForm();
}

function handleRetailSettlementTypeChange() {
  syncRetailSettlementUi();
  markRetailDraftDirty();
}

function syncRetailSettlementUi() {
  const settlementType = document.getElementById("retailSettlementType");
  const paymentMode = document.getElementById("retailPaymentMode");
  const paidAmount = document.getElementById("retailPaidAmount");

  if (!settlementType || !paymentMode || !paidAmount) return;

  const mode = settlementType.value || "paid";

  if (mode === "credit") {
    paymentMode.value = "Credit";
    paidAmount.value = "0";
    paidAmount.disabled = true;
    paidAmount.placeholder = "Paid amount (0 for credit)";
  } else if (mode === "paid") {
    if (paymentMode.value === "Credit") paymentMode.value = "Cash";
    paidAmount.disabled = true;
    paidAmount.value = "";
    paidAmount.placeholder = "Paid automatically as full bill";
  } else {
    if (paymentMode.value === "Credit") paymentMode.value = "Cash";
    paidAmount.disabled = false;
    paidAmount.placeholder = "Paid amount";
  }
}

function populateRetailFormFromBill(bill) {
  const rows = document.getElementById("retailItemRows");
  if (!rows || !bill) return;

  document.getElementById("retailDate").value = bill.date || formatDateInput(new Date());
  document.getElementById("retailBillNumber").value = bill.bill_number || "";
  document.getElementById("retailCashier").value = bill.cashier_name || "admin";
  const totalAmount = Number(bill.total_amount || 0);
  const paidAmount = Number(bill.paid_amount || 0);
  let settlementType = "partial";
  if (paidAmount <= 0) settlementType = "credit";
  else if (paidAmount >= totalAmount) settlementType = "paid";
  document.getElementById("retailSettlementType").value = settlementType;
  document.getElementById("retailPaymentMode").value = bill.payment_mode || "Cash";
  document.getElementById("retailCustomerName").value = bill.customer_name || "";
  document.getElementById("retailCustomerPhone").value = bill.customer_phone || "";
  document.getElementById("retailCustomerAddress").value = bill.customer_address || "";
  document.getElementById("retailPaidAmount").value = bill.paid_amount ?? "";
  document.getElementById("retailNotes").value = bill.notes || "";
  syncRetailSettlementUi();
  if (settlementType === "partial") {
    document.getElementById("retailPaidAmount").value = bill.paid_amount ?? "";
  }

  rows.innerHTML = "";
  (bill.items || []).forEach(item => addRetailItemRow(item));

  if (!(bill.items || []).length) {
    addRetailItemRow();
  }

  currentRetailBill = bill;
  retailDraftDirty = false;
  retailBillCompleted = true;
  renderRetailPreview(currentRetailBill);
}

function renderRetailPreview(bill, isDraft = false) {
  const preview = document.getElementById("retailPreview");
  if (!preview) return;

  if (!bill || !(bill.items || []).length) {
    preview.innerHTML = `<div class="thermal-empty">Add retail items to preview the printed bill.</div>`;
    return;
  }

  preview.innerHTML = getRetailReceiptMarkup(bill);
}

async function saveRetailBill() {
  const draft = buildRetailBillFromForm();

  if (!draft.date) {
    showToast("Select bill date");
    return;
  }

  if (!draft.items.length) {
    showToast("Add at least one item");
    return;
  }

  if (draft.outstanding_amount > 0 && !draft.customer_name) {
    showToast("Enter customer name for credit retail bill");
    return;
  }

  try {
    const data = await apiCall("/retail-bills", "POST", JSON.stringify({
      date: draft.date,
      bill_number: draft.bill_number,
      cashier_name: draft.cashier_name,
      customer_name: draft.customer_name,
      customer_phone: draft.customer_phone,
      customer_address: draft.customer_address,
      payment_mode: draft.payment_mode,
      paid_amount: draft.paid_amount,
      notes: draft.notes,
      items: draft.items
    }), { "Content-Type": "application/json" });

    if (data.error) {
      showToast(data.error);
      return null;
    }

    currentRetailBill = data.bill;
    retailDraftDirty = false;
    retailBillCompleted = true;
    renderRetailPreview(currentRetailBill);
    showToast(`Retail bill ${currentRetailBill.bill_number} saved`);
    await loadRetailBills();
    return currentRetailBill;
  } catch (e) {
    console.error(e);
    if (shouldQueueRetailOffline(e)) {
      const offlineBill = queueRetailBillForSync(draft);
      currentRetailBill = offlineBill;
      retailDraftDirty = false;
      retailBillCompleted = true;
      renderRetailPreview(currentRetailBill);
      renderRetailOfflineBanner();
      await loadRetailBills();
      showToast(`Saved offline. Bill ${offlineBill.bill_number} will sync later.`);
      return offlineBill;
    }

    showToast("Retail bill save failed");
    return null;
  }
}

async function loadRetailBills() {
  const date = document.getElementById("retailDate")?.value;
  const body = document.getElementById("retailBillsBody");
  if (!body) return;

  body.innerHTML = `<tr><td colspan="8" class="empty">Loading retail bills...</td></tr>`;

  try {
    const params = new URLSearchParams();
    if (date) params.set("date", date);
    const query = params.toString();
    const pendingBills = getPendingRetailBills().filter(bill => !date || bill.date === date);
    const data = navigator.onLine
      ? await optionalApiCall(
          `/retail-bills${query ? `?${query}` : ""}`,
          { results: [] },
          "GET",
          null,
          { cache: false }
        )
      : { results: [] };

    const mergedResults = mergeRetailBillResults(data.results || [], pendingBills);

    if (!mergedResults.length) {
      body.innerHTML = `<tr><td colspan="8" class="empty">No retail bills for this date</td></tr>`;
      return;
    }

    body.innerHTML = "";
    mergedResults.forEach(bill => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${escapeHtml(bill.bill_number)}</td>
        <td>${formatDisplayDate(bill.date)}</td>
        <td>${escapeHtml(bill.customer_name || "Walk-in Customer")}</td>
        <td>${escapeHtml(formatRetailBillMode(bill))}</td>
        <td>${formatBillMoney(bill.total_amount)}</td>
        <td>${formatBillMoney(bill.paid_amount)}</td>
        <td>${formatBillMoney(bill.outstanding_amount)}</td>
        <td><button type="button" onclick="openRetailBill('${bill.id}')">${bill.local_only ? "View / Print" : "View / Print"}</button></td>
      `;
      body.appendChild(row);
    });
  } catch (e) {
    console.error(e);
    body.innerHTML = `<tr><td colspan="8" class="empty">Retail bills failed to load</td></tr>`;
  }
}

async function openRetailBill(billId) {
  try {
    if (String(billId).startsWith("local-")) {
      const localBill = getPendingRetailBills().find(bill => bill.id === billId);
      if (!localBill) {
        showToast("Offline bill not found");
        return;
      }
      populateRetailFormFromBill(localBill);
      return;
    }

    const data = await apiCall(`/retail-bills/${billId}`, "GET", null, {}, { cache: false });
    if (data.error) {
      showToast(data.error);
      return;
    }

    populateRetailFormFromBill(data);
  } catch (e) {
    console.error(e);
    showToast("Unable to open retail bill");
  }
}

async function printCurrentRetailBill() {
  let bill = currentRetailBill;
  const draft = buildRetailBillFromForm();

  if (!bill || retailDraftDirty) {
    bill = await saveRetailBill();
  }

  if (!bill || !(bill.items || []).length) {
    showToast("No bill ready to print");
    return;
  }

  const printWindow = window.open("", "_blank", "width=420,height=820");
  if (!printWindow) {
    showToast("Allow popups to print bill");
    return;
  }

  printWindow.document.write(`
    <html>
      <head>
        <title>Retail Bill ${escapeHtml(bill.bill_number)}</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          body { margin: 0; font-family: "Courier New", monospace; background: white; color: #111; }
          .bill { width: 76mm; margin: 0 auto; padding: 4mm 2.5mm 5mm; }
          .thermal-bill { width: 100%; color: #111; }
          .thermal-label, .thermal-header-mini, .thermal-rule, .thermal-note-mini { text-align: center; }
          .thermal-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
          .thermal-center { text-align: center; }
          .thermal-center h3 { margin: 2px 0 3px; font-size: 18px; line-height: 1.1; }
          .thermal-center p { margin: 1px 0; font-size: 11px; line-height: 1.25; }
          .thermal-header-mini { margin-top: 2px; font-size: 10px; }
          .thermal-meta-grid { margin-top: 7px; font-size: 11px; }
          .thermal-meta-row { display: flex; justify-content: space-between; gap: 8px; margin: 1px 0; }
          .thermal-customer { margin-top: 6px; font-size: 11px; }
          .thermal-customer p { margin: 1px 0; }
          .thermal-rule { margin: 6px 0 4px; font-size: 10px; letter-spacing: 0; }
          .thermal-items-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 10px; }
          .thermal-items-table th, .thermal-items-table td { padding: 2px 0; vertical-align: top; }
          .thermal-items-table th { font-weight: 700; }
          .thermal-items-table th:nth-child(1), .thermal-items-table td:nth-child(1) { width: 8%; text-align: left; }
          .thermal-items-table th:nth-child(2), .thermal-items-table td:nth-child(2) { width: 33%; text-align: left; overflow-wrap: anywhere; }
          .thermal-items-table th:nth-child(3), .thermal-items-table td:nth-child(3) { width: 18%; text-align: right; }
          .thermal-items-table th:nth-child(4), .thermal-items-table td:nth-child(4) { width: 13%; text-align: right; }
          .thermal-items-table th:nth-child(5), .thermal-items-table td:nth-child(5) { width: 12%; text-align: right; }
          .thermal-items-table th:nth-child(6), .thermal-items-table td:nth-child(6) { width: 16%; text-align: right; }
          .thermal-summary { margin-top: 6px; font-size: 11px; }
          .thermal-summary p, .thermal-summary-row { display: flex; justify-content: space-between; gap: 10px; margin: 2px 0; }
          .thermal-total { margin-top: 4px; padding-top: 4px; border-top: 1px dashed #666; font-weight: 700; }
          .thermal-notes, .thermal-note-mini { margin-top: 6px; font-size: 10px; line-height: 1.25; }
          .thermal-footer { margin-top: 10px; text-align: center; font-size: 11px; }
          .thermal-footer p { margin: 1px 0; }
        </style>
      </head>
      <body>
        <div class="bill">${getRetailReceiptMarkup(bill)}</div>
        <script>
          window.onload = function () {
            window.print();
            setTimeout(function () { window.close(); }, 250);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();

  currentRetailBill = bill;
  retailDraftDirty = false;
  retailBillCompleted = true;
}

function resetRetailForm() {
  const draftHasItems = collectRetailItemsFromForm().length > 0;
  if (draftHasItems && !retailBillCompleted) {
    showToast("Save or print this bill before starting a new one");
    return;
  }

  const rows = document.getElementById("retailItemRows");
  if (rows) rows.innerHTML = "";

  document.getElementById("retailCustomerName").value = "";
  document.getElementById("retailCustomerPhone").value = "";
  document.getElementById("retailCustomerAddress").value = "";
  document.getElementById("retailPaidAmount").value = "";
  document.getElementById("retailNotes").value = "";
  document.getElementById("retailSettlementType").value = "paid";
  document.getElementById("retailPaymentMode").value = "Cash";
  document.getElementById("retailCashier").value = "admin";
  syncRetailSettlementUi();

  addRetailItemRow();
  currentRetailBill = null;
  retailDraftDirty = false;
  retailBillCompleted = false;
  renderRetailOfflineBanner();
  refreshRetailBillNumber();
}

function suggestRetailItems(input) {
  const suggestions = document.getElementById("retailItemSuggestions");
  const query = input?.value.trim() || "";

  clearTimeout(retailItemSuggestTimer);

  if (!suggestions || query.length < 1) {
    if (suggestions) suggestions.innerHTML = "";
    return;
  }

  retailItemSuggestTimer = setTimeout(async () => {
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
  }, 180);
}

function suggestRetailCustomers() {
  const input = document.getElementById("retailCustomerName");
  const suggestions = document.getElementById("retailCustomerSuggestions");
  const query = input?.value.trim() || "";

  clearTimeout(retailCustomerSuggestTimer);

  if (!suggestions || query.length < 2) {
    if (suggestions) suggestions.innerHTML = "";
    return;
  }

  retailCustomerSuggestTimer = setTimeout(async () => {
    try {
      const data = await optionalApiCall(`/party/search?name=${encodeURIComponent(query)}`, { results: [] });
      suggestions.innerHTML = "";
      (data.results || []).forEach(party => {
        const option = document.createElement("option");
        option.value = party.name;
        suggestions.appendChild(option);
      });
    } catch (e) {
      console.error(e);
      suggestions.innerHTML = "";
    }
  }, 200);
}

function formatBillQuantity(quantity, unit) {
  if (unit === "PCS") {
    return formatBillNag(quantity);
  }

  return `${Number(quantity || 0).toFixed(3)} ${unit}`;
}

function formatBillNag(value) {
  return Number(value || 0).toFixed(0);
}

function formatBillRate(value) {
  return Number(value || 0).toFixed(2);
}

function formatBillMoney(value) {
  return Number(value || 0).toFixed(2);
}

function getRetailReceiptMarkup(bill) {
  const itemsHtml = (bill.items || []).map((item, index) => {
    const lineType = (item.line_type || "STANDARD").toUpperCase();
    const quantityText = `${formatBillNag(item.nag || item.quantity || 0)}${lineType === "DRESSED" ? " NAG" : ""}`;
    const kgsText = Number(item.weight || 0).toFixed(3);
    const mrpText = lineType === "DRESSED" ? "0.00" : formatBillRate(item.rate);
    return `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(item.item_name)}</td>
        <td>${escapeHtml(quantityText)}</td>
        <td>${mrpText}</td>
        <td>${formatBillRate(item.rate)}</td>
        <td>${formatBillMoney(item.amount)}</td>
      </tr>
      <tr class="thermal-subrow">
        <td></td>
        <td colspan="2">KGS ${kgsText}</td>
        <td colspan="3">${lineType === "DRESSED" ? "Dressed Chicken" : item.unit || "KGS"}</td>
      </tr>
    `;
  }).join("");

  const customerBlock = (bill.customer_name || bill.customer_phone || bill.customer_address) ? `
    <div class="thermal-customer">
      ${bill.customer_name ? `<p><strong>Customer Name</strong> : ${escapeHtml(bill.customer_name)}</p>` : ""}
      ${bill.customer_phone ? `<p><strong>Phone</strong> : ${escapeHtml(bill.customer_phone)}</p>` : ""}
      ${bill.customer_address ? `<p><strong>Customer Add</strong> : ${escapeHtml(bill.customer_address)}</p>` : ""}
    </div>
  ` : "";

  return `
    <div class="thermal-bill">
      <div class="thermal-label">INVOICE</div>
      <div class="thermal-center">
        <h3>${escapeHtml(RETAIL_SHOP_PROFILE.name)}</h3>
        <p>${escapeHtml(RETAIL_SHOP_PROFILE.proprietor)}</p>
        <p>${escapeHtml(RETAIL_SHOP_PROFILE.address)}</p>
        <p>Mob. ${escapeHtml(RETAIL_SHOP_PROFILE.phone)}</p>
      </div>

      <div class="thermal-meta-grid">
        <div class="thermal-meta-row"><span>Bill no</span><span>${escapeHtml(bill.bill_number)}</span></div>
        <div class="thermal-meta-row"><span>Date</span><span>${formatDisplayDate(bill.date)}</span></div>
        <div class="thermal-meta-row"><span>Time</span><span>${escapeHtml(bill.time || new Date().toLocaleTimeString("en-GB"))}</span></div>
        <div class="thermal-meta-row"><span>Cashier</span><span>${escapeHtml(bill.cashier_name || "admin")}</span></div>
      </div>

      ${customerBlock}

      <div class="thermal-rule">----------------------------------------------</div>
      <table class="thermal-items-table">
        <thead>
          <tr>
            <th>Sl</th>
            <th>Item Name</th>
            <th>Qty</th>
            <th>MRP</th>
            <th>Rate</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <div class="thermal-rule">----------------------------------------------</div>

      <div class="thermal-summary">
        <p><span>Total Item(s): ${bill.items.length}</span><span>/Qty : ${formatBillNag(bill.total_nag || bill.total_quantity || 0)}</span></p>
        <p><span>Total Kgs</span><strong>${Number(bill.total_weight || 0).toFixed(3)}</strong></p>
        <p class="thermal-total"><span>TOTAL</span><strong>${formatBillMoney(bill.total_amount)}</strong></p>
        <p><span>${escapeHtml(bill.payment_mode || "Cash")} Payment</span><strong>${formatBillMoney(bill.paid_amount)}</strong></p>
        <p><span>Outstanding balance</span><strong>${formatBillMoney(bill.outstanding_amount)}</strong></p>
      </div>

      ${bill.requires_customer && !bill.customer_name ? `<div class="thermal-notes">Known customer name is required when this bill has credit outstanding.</div>` : ""}
      ${bill.notes ? `<div class="thermal-notes">${escapeHtml(bill.notes)}</div>` : ""}

      <div class="thermal-footer">
        <p>Thank You</p>
        <p>Visit Again</p>
      </div>
    </div>
  `;
}

function handleRetailLineTypeChange(input) {
  const row = input?.closest(".retail-item-row");
  if (!row) return;
  syncRetailLineUi(row);
  recalcRetailLine(input);
}

function syncRetailLineUi(row) {
  const lineType = row?.querySelector(".retailLineType")?.value || "STANDARD";
  const unitInput = row?.querySelector(".retailUnit");
  const weightInput = row?.querySelector(".retailWeight");
  const rateInput = row?.querySelector(".retailRate");

  if (!unitInput || !weightInput || !rateInput) return;

  if (lineType === "DRESSED") {
    unitInput.value = "KGS";
    unitInput.disabled = true;
    weightInput.placeholder = "Dressed kgs";
    rateInput.placeholder = "Auto avg rate / kg";
    rateInput.readOnly = true;
  } else {
    unitInput.disabled = false;
    weightInput.placeholder = "Weight (kg)";
    rateInput.placeholder = "Rate";
    rateInput.readOnly = false;
  }
}

function getPendingRetailBills() {
  try {
    return JSON.parse(localStorage.getItem(RETAIL_PENDING_STORAGE_KEY) || "[]");
  } catch (e) {
    console.error("Failed to parse pending retail bills", e);
    return [];
  }
}

function setPendingRetailBills(bills) {
  localStorage.setItem(RETAIL_PENDING_STORAGE_KEY, JSON.stringify(bills));
}

function queueRetailBillForSync(draft) {
  const pendingBills = getPendingRetailBills();
  const localId = `local-${Date.now()}`;
  const offlineBill = {
    ...draft,
    id: localId,
    local_only: true,
    sync_status: "Pending Sync",
    payment_mode: draft.payment_mode || "Cash",
    pending_since: new Date().toISOString(),
    last_error: "No internet connection"
  };

  pendingBills.push(offlineBill);
  setPendingRetailBills(pendingBills);
  renderRetailOfflineBanner();
  return offlineBill;
}

function shouldQueueRetailOffline(error) {
  if (!navigator.onLine) return true;
  const message = String(error?.message || error || "");
  return message.includes("Network") || message.includes("fetch");
}

function computeNextRetailBillNumber(date, baseline = "1") {
  const pendingBills = getPendingRetailBills().filter(bill => bill.date === date);
  const maxPending = pendingBills.reduce((maxValue, bill) => {
    const digits = Number(String(bill.bill_number || "").replace(/\D/g, "")) || 0;
    return Math.max(maxValue, digits);
  }, 0);
  const baseValue = Number(String(baseline || "1").replace(/\D/g, "")) || 1;
  return String(Math.max(baseValue, maxPending + 1));
}

function mergeRetailBillResults(serverBills, pendingBills) {
  const merged = [...pendingBills, ...serverBills];
  return merged.sort((a, b) => {
    if ((a.date || "") !== (b.date || "")) return (b.date || "").localeCompare(a.date || "");
    return Number(String(b.bill_number || "").replace(/\D/g, "")) - Number(String(a.bill_number || "").replace(/\D/g, ""));
  });
}

function renderRetailOfflineBanner() {
  const banner = document.getElementById("retailOfflineBanner");
  if (!banner) return;

  const pendingCount = getPendingRetailBills().length;
  if (navigator.onLine && pendingCount === 0) {
    banner.style.display = "none";
    banner.innerHTML = "";
    return;
  }

  const statusText = navigator.onLine
    ? `${pendingCount} retail bill${pendingCount === 1 ? "" : "s"} waiting to sync.`
    : `Offline mode. ${pendingCount} retail bill${pendingCount === 1 ? "" : "s"} saved locally.`;

  banner.className = `notice ${navigator.onLine ? "warning" : "info"}`;
  banner.style.display = "block";
  banner.innerHTML = `
    <strong>${statusText}</strong>
    <div class="offline-banner-actions">
      <button type="button" onclick="syncPendingRetailBills()">${navigator.onLine ? "Sync Now" : "Retry When Online"}</button>
    </div>
  `;
}

async function syncPendingRetailBills(silent = false) {
  if (!navigator.onLine) {
    renderRetailOfflineBanner();
    return;
  }

  const pendingBills = getPendingRetailBills();
  if (!pendingBills.length) {
    renderRetailOfflineBanner();
    return;
  }

  const remaining = [];
  let syncedCount = 0;

  for (const bill of pendingBills) {
    try {
      const response = await apiCall("/retail-bills", "POST", JSON.stringify({
        date: bill.date,
        bill_number: bill.bill_number,
        cashier_name: bill.cashier_name,
        customer_name: bill.customer_name,
        customer_phone: bill.customer_phone,
        customer_address: bill.customer_address,
        payment_mode: bill.payment_mode,
        paid_amount: bill.paid_amount,
        notes: bill.notes,
        items: bill.items
      }), { "Content-Type": "application/json" }, { loader: false });

      if (response?.error) {
        remaining.push({ ...bill, last_error: response.error });
        continue;
      }

      if (currentRetailBill?.id === bill.id) {
        currentRetailBill = response.bill;
        populateRetailFormFromBill(response.bill);
      }
      syncedCount += 1;
    } catch (e) {
      remaining.push({ ...bill, last_error: String(e?.message || e || "Sync failed") });
    }
  }

  setPendingRetailBills(remaining);
  renderRetailOfflineBanner();
  await loadRetailBills();
  await refreshRetailBillNumber();

  if (!silent && syncedCount > 0) {
    showToast(`${syncedCount} offline retail bill${syncedCount === 1 ? "" : "s"} synced`);
  }
}

function attachRetailConnectivityListeners() {
  if (retailConnectivityListenersAttached) return;

  window.addEventListener("online", () => {
    renderRetailOfflineBanner();
    syncPendingRetailBills();
  });
  window.addEventListener("offline", () => {
    renderRetailOfflineBanner();
  });

  retailConnectivityListenersAttached = true;
}

function formatRetailBillMode(bill) {
  const mode = bill.payment_mode || "Cash";
  return bill.local_only ? `${mode} • Pending` : mode;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
