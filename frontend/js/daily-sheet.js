async function loadDailySheet() {
  const date = document.getElementById("dailySheetDate")?.value;
  const sheetType = document.getElementById("dailySheetType")?.value || "stock";
  const title = document.getElementById("dailySheetTitle");
  const meta = document.getElementById("dailySheetMeta");
  const content = document.getElementById("dailySheetContent");

  if (!date || !title || !meta || !content) return;

  title.innerText = `${formatSheetType(sheetType)} ${formatDisplayDate(date)}`;
  meta.className = "notice info";
  meta.innerHTML = "<strong>Loading daily sheet...</strong>";
  content.innerHTML = "";

  try {
    const data = await apiCall(`/daily-sheet?date=${encodeURIComponent(date)}&sheet_type=${encodeURIComponent(sheetType)}`);

    if (data.error) {
      meta.className = "notice error";
      meta.innerHTML = `<strong>${data.error}</strong>`;
      return;
    }

    content.innerHTML = "";

    if (sheetType === "stock") {
      meta.className = "notice info";
      meta.innerHTML = `<strong>${data.meta?.nag_available ? "NAG values are available." : "NAG values are not stored in the app yet, so that column is left blank."}</strong>`;

      content.appendChild(createSheetSection(`Opening Stock ${formatDisplayDate(date)}`, data.opening_stock));
      content.appendChild(createSheetSection("Purchase Stock", data.purchase_stock));

      (data.sales_sections || []).forEach(section => {
        content.appendChild(createSheetSection(section.title, section));
      });

      content.appendChild(createFinalSummarySection(data.final_stock));
      return;
    }

    meta.className = "notice info";
    meta.innerHTML = "<strong>Old balance is the balance up to the previous day. Purchases and payment are for the selected day.</strong>";
    content.appendChild(createBalanceSheetSection(data.title || formatSheetType(sheetType), data.rows || [], data.totals));
  } catch (e) {
    console.error(e);
    meta.className = "notice error";
    meta.innerHTML = "<strong>Daily sheet failed to load.</strong>";
  }
}

function createSheetSection(title, section) {
  const wrapper = document.createElement("div");
  wrapper.className = "daily-sheet-section";

  const heading = document.createElement("h3");
  heading.innerText = title;
  wrapper.appendChild(heading);

  wrapper.appendChild(createSheetTable(section.rows || [], section.total));
  return wrapper;
}

function createSheetTable(rows, totalRow) {
  const tableWrap = document.createElement("div");
  tableWrap.className = "table-card daily-sheet-table";

  const table = document.createElement("table");
  table.innerHTML = `
    <thead>
      <tr>
        <th>Goods</th>
        <th>Nag</th>
        <th>Weight</th>
        <th>Rate</th>
        <th>Total</th>
      </tr>
    </thead>
  `;

  const body = document.createElement("tbody");
  (rows || []).forEach(row => body.appendChild(createSheetRow(row)));
  if (totalRow) body.appendChild(createSheetRow(totalRow, true));
  table.appendChild(body);
  tableWrap.appendChild(table);
  return tableWrap;
}

function createSheetRow(row, isTotal = false) {
  const tr = document.createElement("tr");
  if (isTotal) tr.className = "sheet-total-row";

  appendDailyCell(tr, row.goods || "");
  appendDailyCell(tr, row.nag === "" ? "-" : row.nag);
  appendDailyCell(tr, formatNumber(row.weight));
  appendDailyCell(tr, formatNumber(row.rate));
  appendDailyCell(tr, formatMoneyCompact(row.total));
  return tr;
}

function createFinalSummarySection(summary) {
  const wrapper = document.createElement("div");
  wrapper.className = "daily-sheet-section";

  const heading = document.createElement("h3");
  heading.innerText = "Final Stock";
  wrapper.appendChild(heading);

  const rows = [
    summary.total_purchases,
    summary.sales,
    summary.closing_stock,
    summary.actual_stock,
    summary.short_by
  ];
  wrapper.appendChild(createSheetTable(rows, null));

  const profitCard = document.createElement("div");
  profitCard.className = "summary-box sheet-profit-box";
  profitCard.innerHTML = `
    <span>Gross Profit</span>
    <h2>${formatNumber(summary.gross_profit?.rate)}%</h2>
    <p>${formatMoneyCompact(summary.gross_profit?.total)}</p>
  `;
  wrapper.appendChild(profitCard);

  return wrapper;
}

function createBalanceSheetSection(title, rows, totals) {
  const wrapper = document.createElement("div");
  wrapper.className = "daily-sheet-section";

  const heading = document.createElement("h3");
  heading.innerText = title;
  wrapper.appendChild(heading);

  const tableWrap = document.createElement("div");
  tableWrap.className = "table-card daily-sheet-table";

  const table = document.createElement("table");
  table.innerHTML = `
    <thead>
      <tr>
        <th>Party Name</th>
        <th>Old Bal</th>
        <th>Purchases</th>
        <th>Payment</th>
        <th>Balance</th>
      </tr>
    </thead>
  `;

  const body = document.createElement("tbody");
  (rows || []).forEach(row => body.appendChild(createBalanceRow(row)));
  if (totals) body.appendChild(createBalanceRow(totals, true));
  table.appendChild(body);
  tableWrap.appendChild(table);
  wrapper.appendChild(tableWrap);
  return wrapper;
}

function createBalanceRow(row, isTotal = false) {
  const tr = document.createElement("tr");
  if (isTotal) tr.className = "sheet-total-row";

  appendDailyCell(tr, row.party_name || "");
  appendDailyCell(tr, formatMoneyCompact(row.old_balance));
  appendDailyCell(tr, formatMoneyCompact(row.purchases));
  appendDailyCell(tr, formatMoneyCompact(row.payment));
  appendDailyCell(tr, formatMoneyCompact(row.balance));
  return tr;
}

function appendDailyCell(row, value) {
  const cell = document.createElement("td");
  cell.innerText = value ?? "";
  row.appendChild(cell);
}

function formatDisplayDate(date) {
  const parsed = new Date(`${date}T00:00:00`);
  return parsed.toLocaleDateString("en-GB");
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function formatMoneyCompact(value) {
  return Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatSheetType(sheetType) {
  if (sheetType === "vendor") return "Vendor Balance Sheet";
  if (sheetType === "dealer") return "Dealer Balance Sheet";
  return "Daily Sheet";
}
