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
      meta.innerHTML = `<strong>${data.meta?.nag_available ? "NAG values are available for this sheet." : "Some older records were saved without NAG, so blank NAG cells mean count was not captured on that day."}</strong><br>Retail bills created from Retail Billing are included automatically under Retail and Retail Dressed. Retail credit customers are shown separately below the stock summary.`;

      if (data.metric_cards?.length) {
        content.appendChild(createMetricCardStrip(data.metric_cards));
      }

      content.appendChild(createSheetSection(`Opening Stock ${formatDisplayDate(date)}`, data.opening_stock));
      content.appendChild(createSheetSection("Purchase Stock", data.purchase_stock));

      (data.sales_sections || []).forEach(section => {
        content.appendChild(createSheetSection(section.title, section));
      });

      if (data.retail_credit_sheet?.rows?.length) {
        content.appendChild(createRetailCreditSection("Retail Credit Customers", data.retail_credit_sheet.rows, data.retail_credit_sheet.total));
      }

      content.appendChild(createFinalSummarySection(data.final_stock));

      if (data.rate_analysis) {
        const sections = [
          createRateAnalysisSection("Avg Buy Rate by Hen Type", data.rate_analysis.purchase_by_hen_type || [], false),
          createRateAnalysisSection("Avg Sale Rate by Category", data.rate_analysis.sales_by_category || [], false),
          createRateAnalysisSection("Avg Sale Rate by Hen Type in Each Category", data.rate_analysis.sales_by_hen_type_category || [], true)
        ].filter(Boolean);
        sections.forEach(section => content.appendChild(section));
      }

      if (data.business_controls) {
        const controls = [
          createCategoryMixSection("Category Mix", data.business_controls.category_mix || []),
          createItemPerformanceSection("Hen Type Performance", data.business_controls.item_performance || [])
        ].filter(Boolean);
        controls.forEach(section => content.appendChild(section));
      }
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

function createMetricCardStrip(cards) {
  const wrapper = document.createElement("div");
  wrapper.className = "daily-metric-strip";

  cards.forEach(card => {
    const metric = document.createElement("div");
    metric.className = "summary-box daily-metric-card";
    const prefix = card.prefix || "";
    const suffix = card.suffix || "";
    metric.innerHTML = `
      <span>${card.label || ""}</span>
      <h2>${prefix}${formatNumber(card.value)}${suffix}</h2>
      ${card.subvalue ? `<p>${card.subvalue}</p>` : ""}
    `;
    wrapper.appendChild(metric);
  });

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

function createRetailCreditSection(title, rows, totals) {
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
        <th>Customer</th>
        <th>Bill No</th>
        <th>Total</th>
        <th>Paid</th>
        <th>Outstanding</th>
        <th>Mode</th>
      </tr>
    </thead>
  `;

  const body = document.createElement("tbody");
  (rows || []).forEach(row => body.appendChild(createRetailCreditRow(row)));
  if (totals) body.appendChild(createRetailCreditRow(totals, true));
  table.appendChild(body);
  tableWrap.appendChild(table);
  wrapper.appendChild(tableWrap);
  return wrapper;
}

function createRateAnalysisSection(title, rows, showCategoryAndGoods = false) {
  if (!rows.length) return null;

  const wrapper = document.createElement("div");
  wrapper.className = "daily-sheet-section";

  const heading = document.createElement("h3");
  heading.innerText = title;
  wrapper.appendChild(heading);

  const tableWrap = document.createElement("div");
  tableWrap.className = "table-card daily-sheet-table";

  const table = document.createElement("table");
  table.innerHTML = showCategoryAndGoods
    ? `
      <thead>
        <tr>
          <th>Category</th>
          <th>Hen Type</th>
          <th>Avg Rate</th>
          <th>Kgs</th>
          <th>Amount</th>
        </tr>
      </thead>
    `
    : `
      <thead>
        <tr>
          <th>Label</th>
          <th>Avg Rate</th>
          <th>Kgs</th>
          <th>Amount</th>
        </tr>
      </thead>
    `;

  const body = document.createElement("tbody");
  rows.forEach(row => {
    const tr = document.createElement("tr");
    if (showCategoryAndGoods) {
      appendDailyCell(tr, row.category || "", "analysis-text");
      appendDailyCell(tr, row.goods || "", "analysis-text");
    } else {
      appendDailyCell(tr, row.label || "", "analysis-text");
    }
    appendDailyCell(tr, formatNumber(row.avg_rate));
    appendDailyCell(tr, formatNumber(row.weight));
    appendDailyCell(tr, formatMoneyCompact(row.amount));
    body.appendChild(tr);
  });

  table.appendChild(body);
  tableWrap.appendChild(table);
  wrapper.appendChild(tableWrap);
  return wrapper;
}

function createCategoryMixSection(title, rows) {
  if (!rows.length) return null;

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
        <th>Category</th>
        <th>Kgs</th>
        <th>Amount</th>
        <th>Avg Rate</th>
        <th>Kg Share</th>
        <th>Sale Share</th>
      </tr>
    </thead>
  `;

  const body = document.createElement("tbody");
  rows.forEach(row => {
    const tr = document.createElement("tr");
    appendDailyCell(tr, row.category || "", "analysis-text");
    appendDailyCell(tr, formatNumber(row.weight));
    appendDailyCell(tr, formatMoneyCompact(row.amount));
    appendDailyCell(tr, formatNumber(row.avg_rate));
    appendDailyCell(tr, `${formatNumber(row.weight_share)}%`);
    appendDailyCell(tr, `${formatNumber(row.amount_share)}%`);
    body.appendChild(tr);
  });

  table.appendChild(body);
  tableWrap.appendChild(table);
  wrapper.appendChild(tableWrap);
  return wrapper;
}

function createItemPerformanceSection(title, rows) {
  if (!rows.length) return null;

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
        <th>Hen Type</th>
        <th>Buy Kg</th>
        <th>Sale Kg</th>
        <th>Buy Rate</th>
        <th>Sale Rate</th>
        <th>Spread</th>
        <th>Est. Profit</th>
      </tr>
    </thead>
  `;

  const body = document.createElement("tbody");
  rows.forEach(row => {
    const tr = document.createElement("tr");
    appendDailyCell(tr, row.item || "", "analysis-text");
    appendDailyCell(tr, formatNumber(row.purchase_kg));
    appendDailyCell(tr, formatNumber(row.sales_kg));
    appendDailyCell(tr, formatNumber(row.buy_rate));
    appendDailyCell(tr, formatNumber(row.sell_rate));
    appendDailyCell(tr, formatNumber(row.spread));
    appendDailyCell(tr, formatMoneyCompact(row.gross_profit));
    body.appendChild(tr);
  });

  table.appendChild(body);
  tableWrap.appendChild(table);
  wrapper.appendChild(tableWrap);
  return wrapper;
}

function createRetailCreditRow(row, isTotal = false) {
  const tr = document.createElement("tr");
  if (isTotal) tr.className = "sheet-total-row";

  appendDailyCell(tr, row.customer_name || row.label || "");
  appendDailyCell(tr, row.bill_number || "-");
  appendDailyCell(tr, formatMoneyCompact(row.total_amount));
  appendDailyCell(tr, formatMoneyCompact(row.paid_amount));
  appendDailyCell(tr, formatMoneyCompact(row.outstanding_amount));
  appendDailyCell(tr, row.payment_mode || (isTotal ? "-" : "Credit"));
  return tr;
}

function appendDailyCell(row, value, className = "") {
  const cell = document.createElement("td");
  if (className) cell.className = className;
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
