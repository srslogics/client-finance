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

let retailItemSuggestTimer = null;
let retailCustomerSuggestTimer = null;
let currentRetailBill = null;
let retailDraftDirty = false;
let retailBillCompleted = false;

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

  addRetailItemRow();
  renderRetailShortcuts();
  refreshRetailBillNumber();
  renderRetailPreviewFromForm();
  loadRetailBills();
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
    const data = await optionalApiCall(
      `/retail-bills/next-number?date=${encodeURIComponent(date)}`,
      { bill_number: "1" },
      "GET",
      null,
      { cache: false }
    );
    billNumber.value = data.bill_number || "1";
    renderRetailPreviewFromForm();
  } catch (e) {
    console.error(e);
  }
}

function addRetailItemRow(item = null) {
  const container = document.getElementById("retailItemRows");
  if (!container) return;

  const row = document.createElement("div");
  row.className = "retail-item-row";
  row.innerHTML = `
    <input type="text" class="retailItemName" placeholder="Item name" list="retailItemSuggestions" autocomplete="off" oninput="suggestRetailItems(this); recalcRetailLine(this)">
    <input type="number" class="retailQty" placeholder="NAG" min="0" step="0.01" oninput="recalcRetailLine(this)">
    <select class="retailUnit" onchange="recalcRetailLine(this)">
      <option value="KGS">KGS</option>
      <option value="PCS">PCS</option>
    </select>
    <input type="number" class="retailWeight" placeholder="Weight (kg)" min="0" step="0.001" oninput="recalcRetailLine(this)">
    <input type="number" class="retailRate" placeholder="Rate" min="0" step="0.01" oninput="recalcRetailLine(this)">
    <input type="number" class="retailAmount" placeholder="Amount" min="0" step="0.01" oninput="renderRetailPreviewFromForm()">
    <button type="button" onclick="removeRetailItemRow(this)">Remove</button>
  `;
  container.appendChild(row);

  if (item) {
    row.querySelector(".retailItemName").value = item.item_name || "";
    row.querySelector(".retailQty").value = item.quantity || "";
    row.querySelector(".retailUnit").value = item.unit || "KGS";
    row.querySelector(".retailWeight").value = item.weight || "";
    row.querySelector(".retailRate").value = item.rate || "";
    row.querySelector(".retailAmount").value = item.amount || "";
  }

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
    button.closest(".retail-item-row")?.querySelectorAll("input").forEach(input => {
      input.value = "";
    });
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

  const qtyInput = row.querySelector(".retailQty");
  const unitInput = row.querySelector(".retailUnit");
  const weightInput = row.querySelector(".retailWeight");
  const rateInput = row.querySelector(".retailRate");
  const amountInput = row.querySelector(".retailAmount");

  const quantity = Number(qtyInput?.value || 0);
  const unit = unitInput?.value || "KGS";
  let weight = Number(weightInput?.value || 0);
  const rate = Number(rateInput?.value || 0);

  if (unit === "KGS" && quantity > 0 && weight <= 0) {
    weight = quantity;
    weightInput.value = quantity;
  }

  const base = weight > 0 ? weight : quantity;
  if (rate > 0 && base > 0) {
    amountInput.value = (base * rate).toFixed(2);
  }

  retailDraftDirty = true;
  retailBillCompleted = false;
  renderRetailPreviewFromForm();
}

function collectRetailItemsFromForm() {
  return Array.from(document.querySelectorAll(".retail-item-row"))
    .map(row => ({
      item_name: row.querySelector(".retailItemName")?.value.trim(),
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
  const rawPaidAmount = document.getElementById("retailPaidAmount")?.value;
  const paidAmount = Math.min(
    rawPaidAmount === "" && paymentMode !== "Credit" ? totalAmount : Number(rawPaidAmount || 0),
    totalAmount
  );
  const outstandingAmount = Math.max(totalAmount - paidAmount, 0);

  return {
    bill_number: document.getElementById("retailBillNumber")?.value.trim() || "Draft",
    date: document.getElementById("retailDate")?.value || formatDateInput(new Date()),
    time: new Date().toLocaleTimeString("en-GB"),
    cashier_name: document.getElementById("retailCashier")?.value.trim() || "admin",
    customer_name: document.getElementById("retailCustomerName")?.value.trim() || "",
    customer_phone: document.getElementById("retailCustomerPhone")?.value.trim() || "",
    customer_address: document.getElementById("retailCustomerAddress")?.value.trim() || "",
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

function markRetailDraftDirty() {
  retailDraftDirty = true;
  retailBillCompleted = false;
  renderRetailPreviewFromForm();
}

function renderRetailPreview(bill, isDraft = false) {
  const preview = document.getElementById("retailPreview");
  if (!preview) return;

  if (!bill || !(bill.items || []).length) {
    preview.innerHTML = `<div class="thermal-empty">Add retail items to preview the printed bill.</div>`;
    return;
  }

  const itemsHtml = (bill.items || []).map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(item.item_name)}</td>
      <td>${formatBillQuantity(item.nag || item.quantity, item.unit)}</td>
      <td>${formatBillRate(item.rate)}</td>
      <td>${formatBillMoney(item.amount)}</td>
    </tr>
  `).join("");

  preview.innerHTML = `
    <div class="thermal-bill">
      <div class="thermal-center">
        <div class="thermal-label">INVOICE</div>
        <h3>${escapeHtml(RETAIL_SHOP_PROFILE.name)}</h3>
        <p>${escapeHtml(RETAIL_SHOP_PROFILE.proprietor)}</p>
        <p>${escapeHtml(RETAIL_SHOP_PROFILE.address)}</p>
        <p>${escapeHtml(RETAIL_SHOP_PROFILE.phone)}</p>
      </div>

      <div class="thermal-meta">
        <div><span>Bill no</span><strong>${escapeHtml(bill.bill_number)}</strong></div>
        <div><span>Date</span><strong>${formatDisplayDate(bill.date)}</strong></div>
        <div><span>Time</span><strong>${escapeHtml(bill.time || new Date().toLocaleTimeString("en-GB"))}</strong></div>
        <div><span>Cashier</span><strong>${escapeHtml(bill.cashier_name || "admin")}</strong></div>
      </div>

      ${(bill.customer_name || bill.customer_phone || bill.customer_address) ? `
        <div class="thermal-customer">
          ${bill.customer_name ? `<p><strong>Customer:</strong> ${escapeHtml(bill.customer_name)}</p>` : ""}
          ${bill.customer_phone ? `<p><strong>Phone:</strong> ${escapeHtml(bill.customer_phone)}</p>` : ""}
          ${bill.customer_address ? `<p><strong>Address:</strong> ${escapeHtml(bill.customer_address)}</p>` : ""}
        </div>
      ` : ""}

      <table class="thermal-items-table">
        <thead>
          <tr>
            <th>Sl</th>
            <th>Item Name</th>
            <th>NAG</th>
            <th>Rate</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>

      <div class="thermal-summary">
        <p><span>Total Item(s)</span><strong>${bill.items.length}</strong></p>
        <p><span>Total NAG</span><strong>${formatBillNag(bill.total_nag || bill.total_quantity || 0)}</strong></p>
        <p><span>Total Weight</span><strong>${Number(bill.total_weight || 0).toFixed(3)} kg</strong></p>
        <p class="thermal-total"><span>TOTAL</span><strong>${formatBillMoney(bill.total_amount)}</strong></p>
        <p><span>${escapeHtml(bill.payment_mode || "Cash")} Payment</span><strong>${formatBillMoney(bill.paid_amount)}</strong></p>
        <p><span>Outstanding Balance</span><strong>${formatBillMoney(bill.outstanding_amount)}</strong></p>
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
    const data = await optionalApiCall(
      `/retail-bills${query ? `?${query}` : ""}`,
      { results: [] },
      "GET",
      null,
      { cache: false }
    );

    if (!data.results?.length) {
      body.innerHTML = `<tr><td colspan="8" class="empty">No retail bills for this date</td></tr>`;
      return;
    }

    body.innerHTML = "";
    data.results.forEach(bill => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${escapeHtml(bill.bill_number)}</td>
        <td>${formatDisplayDate(bill.date)}</td>
        <td>${escapeHtml(bill.customer_name || "Walk-in Customer")}</td>
        <td>${escapeHtml(bill.payment_mode || "Cash")}</td>
        <td>${formatBillMoney(bill.total_amount)}</td>
        <td>${formatBillMoney(bill.paid_amount)}</td>
        <td>${formatBillMoney(bill.outstanding_amount)}</td>
        <td><button type="button" onclick="openRetailBill('${bill.id}')">View / Print</button></td>
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
    const data = await apiCall(`/retail-bills/${billId}`, "GET", null, {}, { cache: false });
    if (data.error) {
      showToast(data.error);
      return;
    }

    currentRetailBill = data;
    retailDraftDirty = false;
    retailBillCompleted = true;
    renderRetailPreview(currentRetailBill);
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
          body { margin: 0; font-family: Arial, sans-serif; background: white; }
          .bill { width: 80mm; margin: 0 auto; padding: 8px 10px 14px; color: #111; }
          .thermal-center { text-align: center; }
          .thermal-label, .thermal-badge { font-size: 11px; letter-spacing: 1.5px; margin-bottom: 4px; text-transform: uppercase; }
          h3 { margin: 0; font-size: 24px; }
          p { margin: 2px 0; font-size: 12px; }
          .thermal-meta, .thermal-summary, .thermal-customer, .thermal-footer, .thermal-notes { margin-top: 10px; border-top: 1px dashed #555; padding-top: 8px; }
          .thermal-meta div, .thermal-summary p { display: flex; justify-content: space-between; gap: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
          th, td { padding: 4px 0; text-align: left; vertical-align: top; }
          th:last-child, td:last-child, th:nth-last-child(2), td:nth-last-child(2), th:nth-last-child(3), td:nth-last-child(3) { text-align: right; }
          .thermal-total { border-top: 1px dashed #555; margin-top: 6px; padding-top: 6px; font-weight: 700; }
          .thermal-footer { text-align: center; margin-top: 14px; }
        </style>
      </head>
      <body>
        <div class="bill">${document.getElementById("retailPreview")?.innerHTML || ""}</div>
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
  document.getElementById("retailPaymentMode").value = "Cash";
  document.getElementById("retailCashier").value = "admin";

  addRetailItemRow();
  currentRetailBill = null;
  retailDraftDirty = false;
  retailBillCompleted = false;
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

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
