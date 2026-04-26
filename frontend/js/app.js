function loadPage(page) {
    const content = document.getElementById("content");
    const title = document.getElementById("pageTitle");

    if (typeof destroyDashboardCharts === "function") {
      destroyDashboardCharts();
    }
    if (typeof destroyAnalyticsCharts === "function") {
      destroyAnalyticsCharts();
    }

    // --- Active menu highlight
    document.querySelectorAll(".menu button").forEach(btn => btn.classList.remove("active"));
    const activeBtn = document.getElementById(`menu-${page}`);
    if (activeBtn) activeBtn.classList.add("active");

    // --- Upload Page
    if (page === "upload") {
      title.innerText = "Daily Entries";

      content.innerHTML = `
        <div class="container">

          <div class="page-intro">
            <span>Daily Operations</span>
            <h2>Enter, review, and process the day directly in the app</h2>
          </div>

          <div class="section">
            <div class="section-head">
              <div>
                <span>Step 1</span>
                <h2>Select Working Date</h2>
              </div>
            </div>
            <div class="upload-box">
              <input type="date" id="uploadWorkingDate">
            </div>
          </div>

          <div id="uploadStatus" class="notice" aria-live="polite"></div>
          <datalist id="itemSuggestions"></datalist>
          <datalist id="manualPartySuggestions"></datalist>

          <div class="section">
            <div class="section-head">
              <div>
                <span>Step 2</span>
                <h2>Dealer Purchases</h2>
              </div>
            </div>
            <div id="dealerEntryRows" class="stock-rows"></div>
            <div class="upload-box">
              <button onclick="addDealerEntryRow()">Add Dealer Row</button>
              <button onclick="submitDealerEntries()">Save Dealer Entries</button>
            </div>
          </div>

          <div class="section">
            <div class="section-head">
              <div>
                <span>Step 3</span>
                <h2>Vendor Sales</h2>
              </div>
            </div>
            <div id="vendorEntryRows" class="stock-rows"></div>
            <div class="upload-box">
              <button onclick="addVendorEntryRow()">Add Vendor Row</button>
              <button onclick="submitVendorEntries()">Save Vendor Entries</button>
            </div>
          </div>

          <div class="section">
            <div class="section-head">
              <div>
                <span>Step 4</span>
                <h2>Payments</h2>
              </div>
            </div>
            <div id="paymentEntryRows" class="stock-rows"></div>
            <div class="upload-box">
              <button onclick="addPaymentEntryRow()">Add Payment Row</button>
              <button onclick="submitPaymentEntries()">Save Payments</button>
            </div>
          </div>

          <div class="section">
            <div class="section-head">
              <div>
                <span>Step 5</span>
                <h2>Process Day</h2>
              </div>
            </div>
            <div class="upload-box process-day-controls">
              <input type="date" id="processDate">
            </div>
            <div id="actualStockRows" class="stock-rows">
              <div class="upload-box actual-stock-row">
                <input type="text" class="actualItem" placeholder="Hen type" list="itemSuggestions" autocomplete="off" oninput="suggestItems(this)">
                <input type="number" class="actualNag" placeholder="Actual NAG" min="0" step="1">
                <input type="number" class="actualWeight" placeholder="Actual stock (kg)" min="0" step="0.01">
              </div>
            </div>
            <div class="upload-box">
              <button onclick="addActualStockRow()">Add Hen Type</button>
              <button onclick="processDay()">Process</button>
            </div>
          </div>

          <div class="section">
            <div class="section-head">
              <div>
                <span>Initial Setup</span>
                <h2>Opening Balance</h2>
              </div>
            </div>
            <div id="openingBalanceEntryRows" class="stock-rows"></div>
            <div class="upload-box">
              <button onclick="addOpeningBalanceEntryRow()">Add Opening Balance Row</button>
              <button onclick="submitOpeningBalanceEntries()">Save Opening Balances</button>
            </div>
          </div>

          <div class="section">
            <h2>Opening Stock</h2>
            <div id="openingStockEntryRows" class="stock-rows"></div>
            <div class="upload-box">
              <button onclick="addOpeningStockEntryRow()">Add Opening Stock Row</button>
              <button onclick="submitOpeningStockEntries()">Save Opening Stock</button>
            </div>
          </div>

        </div>
      `;

      setTimeout(() => {
        const uploadWorkingDate = document.getElementById("uploadWorkingDate");
        const processDate = document.getElementById("processDate");
        if (uploadWorkingDate) uploadWorkingDate.value = formatDateInput(new Date());
        if (processDate) processDate.value = formatDateInput(new Date());
        if (uploadWorkingDate && processDate) {
          uploadWorkingDate.addEventListener("change", () => {
            if (!processDate.dataset.touched || processDate.dataset.touched === "false") {
              processDate.value = uploadWorkingDate.value;
            }
          });
          processDate.addEventListener("change", () => {
            processDate.dataset.touched = "true";
          });
        }
        if (typeof initManualEntryRows === "function") {
          initManualEntryRows();
        }
      }, 100);
    }

    // --- Dashboard Page
    else if (page === "dashboard") {
      title.innerText = "Business Dashboard";

      content.innerHTML = `
        <div class="container">

          <div class="page-intro">
            <span>Executive View</span>
            <h2>Revenue, stock movement, leakage, and outstanding balances</h2>
          </div>

          <div class="card filter toolbar">
            <input type="date" id="dashboardDate">
            <button onclick="loadDashboard()">Load</button>
          </div>

          <div class="grid kpi-grid">
            <div class="metric blue">
              <span>Revenue</span>
              <h2 id="sales">₹ 0</h2>
            </div>

            <div class="metric dark">
              <span>Cost</span>
              <h2 id="purchase">₹ 0</h2>
            </div>

            <div class="metric profit">
              <span>Profit</span>
              <h2 id="profit">₹ 0</h2>
            </div>

            <div class="metric red">
              <span>Leakage</span>
              <h2 id="leakage">0 kg</h2>
            </div>

            <div class="metric green">
              <span>Receivable</span>
              <h2 id="receivable">₹ 0</h2>
            </div>

            <div class="metric dark">
              <span>Payable</span>
              <h2 id="payable">₹ 0</h2>
            </div>

            <div class="metric green">
              <span>Total Outstanding</span>
              <h2 id="outstanding">₹ 0</h2>
            </div>
          </div>

          <div class="chart-grid">
          <div class="card chart-card">
            <h2>Sales vs Purchase Trend</h2>
            <canvas id="trendChart"></canvas>
          </div>

          <div class="card chart-card">
            <h2>Profit Trend</h2>
            <canvas id="profitChart"></canvas>
          </div>

          <div class="card chart-card">
            <h2>Leakage Trend</h2>
            <canvas id="leakageChart"></canvas>
          </div>
          </div>

          <div class="card insights">
            <h2>Insights</h2>
            <ul id="insightsList"></ul>
          </div>

          <div class="card table-card">
            <h2>Inventory By Hen Type</h2>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Opening</th>
                  <th>Purchase</th>
                  <th>Sales</th>
                  <th>Expected</th>
                  <th>Actual</th>
                  <th>Leakage</th>
                </tr>
              </thead>
              <tbody id="inventoryBody">
                <tr><td colspan="7" class="empty">No data yet</td></tr>
              </tbody>
            </table>
          </div>

        </div>
      `;

      // ✅ Auto load dashboard
      setTimeout(() => {
        const today = formatDateInput(new Date());
        document.getElementById("dashboardDate").value = today;
        loadDashboard();
      }, 100);
    }

    // --- Ledger Page
    else if (page === "ledger") {
      title.innerText = "Ledger";

      content.innerHTML = `
        <div class="container">

          <div class="page-intro">
            <span>Party Ledger</span>
            <h2>Search customer, hotel, shop, or dealer balances</h2>
          </div>

          <div class="card search-card toolbar">
            <input type="text" id="party" placeholder="Search party..." list="partySuggestions" autocomplete="off" oninput="suggestParties()">
            <datalist id="partySuggestions"></datalist>
            <input type="date" id="ledgerStartDate" aria-label="Ledger start date">
            <input type="date" id="ledgerEndDate" aria-label="Ledger end date">
            <button onclick="searchLedger()">Search</button>
          </div>

          <div class="summary">
            <div class="summary-box">
              <span>Total Balance</span>
              <h2 id="totalBalance">₹ 0</h2>
            </div>
          </div>

          <div class="grid" id="partySummary"></div>

          <div class="card table-card">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Item</th>
                  <th>Mode</th>
                  <th>Amount</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody id="ledgerBody">
                <tr>
                  <td colspan="7" class="empty">No data yet</td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>
      `;
    }

    // --- Retail Billing Page
    else if (page === "retail") {
      title.innerText = "Retail Billing";

      content.innerHTML = `
        <div class="container">

          <div class="page-intro">
            <span>Counter Billing</span>
            <h2>Create retail bills, print thermal receipts, and push sales into the daily sheet</h2>
          </div>

          <div class="retail-layout">
            <div class="section">
              <div class="section-head">
                <div>
                  <span>New Bill</span>
                  <h2>Retail Invoice</h2>
                </div>
                <button type="button" onclick="resetRetailForm()">New Bill</button>
              </div>

              <div id="retailOfflineBanner" class="notice info" style="display:none;"></div>

              <div class="retail-form-grid">
                <input type="date" id="retailDate" aria-label="Retail bill date">
                <input type="text" id="retailBillNumber" placeholder="Bill no">
                <input type="text" id="retailCashier" placeholder="Cashier name" value="admin">
                <select id="retailSettlementType">
                  <option value="paid">Paid in Full</option>
                  <option value="partial">Part Payment</option>
                  <option value="credit">Credit</option>
                </select>
                <select id="retailPaymentMode">
                  <option value="Cash">Cash</option>
                  <option value="Online">Online</option>
                  <option value="Bank">Bank</option>
                  <option value="Credit">Credit</option>
                </select>
                <input type="text" id="retailCustomerName" placeholder="Customer name (optional)" list="retailCustomerSuggestions" autocomplete="off" oninput="suggestRetailCustomers()">
                <datalist id="retailCustomerSuggestions"></datalist>
                <input type="text" id="retailCustomerPhone" placeholder="Phone (optional)">
                <input type="text" id="retailCustomerAddress" placeholder="Address (optional)">
              </div>

              <div class="retail-mode-switch" role="tablist" aria-label="Retail billing mode">
                <button type="button" id="retailModeRegular" class="retail-mode-button active" onclick="setRetailBillingMode('regular')">Regular Billing</button>
                <button type="button" id="retailModeDressed" class="retail-mode-button" onclick="setRetailBillingMode('dressed')">Dressed Billing</button>
              </div>

              <div id="retailRegularSection" class="retail-billing-panel retail-billing-section">
                <div class="retail-shortcuts">
                  <div class="retail-shortcuts-head">
                    <span>Regular Shortcuts</span>
                    <p>Tap an item to add it with its default rate.</p>
                  </div>
                  <div id="retailRegularShortcutItems" class="retail-shortcut-list"></div>
                </div>

                <div class="retail-shortcuts-head">
                  <span>Regular Billing</span>
                  <p>Regular chicken billing with automatic rate fill from shortcuts.</p>
                </div>
                <div id="retailRegularRows" class="retail-items retail-items-horizontal"></div>
                <div class="retail-item-actions">
                  <button type="button" onclick="addRegularRetailRow()">Add Regular Item</button>
                </div>
              </div>

              <div id="retailDressedSection" class="retail-billing-panel retail-billing-section" style="display:none;">
                <div class="retail-shortcuts">
                  <div class="retail-shortcuts-head">
                    <span>Dressed Shortcuts</span>
                    <p>Tap an item to add it to the dressed billing side with its default rate.</p>
                  </div>
                  <div id="retailDressedShortcutItems" class="retail-shortcut-list"></div>
                </div>

                <div class="retail-shortcuts">
                  <div class="retail-shortcuts-head">
                    <span>Available Dressed Stock</span>
                    <p>As dressed bills are saved, the remaining dressed weight goes down automatically.</p>
                  </div>
                  <div id="dressedStockSummary" class="retail-stock-summary"></div>
                </div>

                <div class="retail-shortcuts-head">
                  <span>Dressed Billing</span>
                  <p>Bill dressed chicken separately. Amount and rate stay tied to dressed kg.</p>
                </div>
                <div id="retailDressedRows" class="retail-items retail-items-horizontal"></div>
                <div class="retail-item-actions">
                  <button type="button" onclick="addDressedRetailRow()">Add Dressed Item</button>
                </div>
              </div>

              <div class="retail-billing-panel retail-setup-panel">
                <details class="retail-admin-toggle">
                  <summary>Setup Tools</summary>

                  <div class="retail-shortcut-manager">
                    <div class="retail-shortcuts-head">
                      <span>Shortcut Manager</span>
                      <p>Add your own quick items with default rate and billing type.</p>
                    </div>
                    <div class="retail-shortcut-form">
                      <input type="text" id="shortcutName" placeholder="Item name">
                      <input type="number" id="shortcutRate" placeholder="Default rate" min="0" step="0.01">
                      <select id="shortcutLineType">
                        <option value="STANDARD">Regular</option>
                        <option value="DRESSED">Dressed</option>
                      </select>
                      <select id="shortcutUnit">
                        <option value="KGS">KGS</option>
                        <option value="PCS">PCS</option>
                      </select>
                      <button type="button" onclick="saveRetailShortcut()">Save Shortcut</button>
                    </div>
                    <div id="retailShortcutManagerList" class="retail-shortcut-list retail-shortcut-list-managed"></div>
                  </div>

                  <div class="retail-shortcuts">
                    <div class="retail-shortcuts-head">
                      <span>Dressed Stock Entry</span>
                      <p>Enter live stock and available dressed weight. Bills deduct dressed weight automatically.</p>
                    </div>
                    <div id="dressedStockRows" class="retail-items"></div>
                    <div class="retail-item-actions">
                      <button type="button" onclick="addDressedStockRow()">Add Dressed Stock</button>
                      <button type="button" onclick="saveDressedStock()">Save Dressed Stock</button>
                    </div>
                  </div>
                </details>
              </div>

              <datalist id="retailItemSuggestions"></datalist>

              <div class="retail-form-grid retail-notes-grid">
                <input type="number" id="retailPaidAmount" placeholder="Paid amount" min="0" step="0.01">
                <textarea id="retailNotes" placeholder="Notes for bill or customer"></textarea>
              </div>

              <div class="report-actions retail-actions">
                <button type="button" onclick="saveRetailBill()">Save Bill</button>
                <button type="button" onclick="printCurrentRetailBill()">Print Latest Bill</button>
                <button type="button" onclick="sendCurrentRetailBill()">Send Bill</button>
              </div>
            </div>

            <div class="section retail-preview-panel">
              <div class="section-head">
                <div>
                  <span>Print Preview</span>
                  <h2>Thermal Receipt</h2>
                </div>
              </div>
              <div id="retailPreview" class="thermal-preview"></div>
            </div>
          </div>

          <div class="section">
            <div class="section-head">
              <div>
                <span>Saved Bills</span>
                <h2>Recent Retail Bills</h2>
              </div>
              <button type="button" onclick="loadRetailBills()">Refresh</button>
            </div>

            <div class="card table-card">
              <table>
                <thead>
                  <tr>
                    <th>Bill No</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Mode</th>
                    <th>Total</th>
                    <th>Paid</th>
                    <th>Outstanding</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody id="retailBillsBody">
                  <tr><td colspan="8" class="empty">No retail bills yet</td></tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>
      `;

      setTimeout(() => {
        if (typeof initRetailPage === "function") initRetailPage();
      }, 100);
    }

    // --- Daily Sheet Page
    else if (page === "daily-sheet") {
      title.innerText = "Daily Sheet";

      content.innerHTML = `
        <div class="container">

          <div class="page-intro">
            <span>Daily Trading Sheet</span>
            <h2>Opening stock, purchases, sales by section, and final stock summary</h2>
          </div>

          <div class="card filter toolbar">
            <select id="dailySheetType">
              <option value="stock">Stock Sheet</option>
              <option value="vendor">Vendor Balance Sheet</option>
              <option value="dealer">Dealer Balance Sheet</option>
            </select>
            <input type="date" id="dailySheetDate">
            <button onclick="loadDailySheet()">Load Sheet</button>
          </div>

          <div class="section daily-sheet-card">
            <div class="section-head">
              <div>
                <span>Daily Statement</span>
                <h2 id="dailySheetTitle">Opening Stock</h2>
              </div>
              <button onclick="window.print()">Print</button>
            </div>

            <div id="dailySheetMeta" class="notice info"></div>
            <div id="dailySheetContent"></div>
          </div>

        </div>
      `;

      setTimeout(() => {
        document.getElementById("dailySheetDate").value = formatDateInput(new Date());
        loadDailySheet();
      }, 100);
    }

    // --- Analytics Page
    else if (page === "analytics") {
      title.innerText = "Analytics";

      content.innerHTML = `
        <div class="container">

          <div class="page-intro">
            <span>Performance Review</span>
            <h2>Track sales, leakage, debtors, and hen-type profitability</h2>
          </div>

          <div class="card filter toolbar">
            <input type="date" id="startDate">
            <input type="date" id="endDate">
            <button onclick="loadAnalytics()">Load</button>
          </div>

          <div class="grid analytics-kpi-grid">
            <div class="metric blue">
              <span>Sales</span>
              <h2 id="analyticsSales">₹ 0</h2>
            </div>
            <div class="metric dark">
              <span>Purchase</span>
              <h2 id="analyticsPurchase">₹ 0</h2>
            </div>
            <div class="metric profit">
              <span>Profit</span>
              <h2 id="analyticsProfit">₹ 0</h2>
            </div>
            <div class="metric green">
              <span>Net Cash</span>
              <h2 id="analyticsCash">₹ 0</h2>
            </div>
          </div>

          <div class="chart-grid">
          <div class="card chart-card">
            <h2>Sales vs Purchase Trend</h2>
            <canvas id="trendChart"></canvas>
          </div>

          <div class="card chart-card">
            <h2>Cash In vs Cash Out</h2>
            <canvas id="cashFlowChart"></canvas>
          </div>

          <div class="card chart-card">
            <h2>Leakage Trend</h2>
            <canvas id="leakageChart"></canvas>
          </div>

          <div class="card chart-card">
            <h2>Purchase vs Sales Kg By Hen Type</h2>
            <canvas id="itemVolumeChart"></canvas>
          </div>

          <div class="card chart-card">
            <h2>Top Debtors</h2>
            <canvas id="debtorChart"></canvas>
          </div>

          <div class="card chart-card">
            <h2>Payment Mode Split</h2>
            <canvas id="paymentModeChart"></canvas>
          </div>

          <div class="card chart-card">
            <h2>Profit By Hen Type</h2>
            <canvas id="profitByItemChart"></canvas>
          </div>
          </div>

        </div>
      `;

      // ✅ Auto load analytics
      setTimeout(() => {
        const today = new Date();
        const past = new Date();
        past.setDate(today.getDate() - 6);

        document.getElementById("startDate").value = formatDateInput(past);
        document.getElementById("endDate").value = formatDateInput(today);

        loadAnalytics();
      }, 100);
    }

    // --- Reports Page
    else if (page === "reports") {
      title.innerText = "Reports";

      content.innerHTML = `
        <div class="container">

          <div class="page-intro">
            <span>Exports</span>
            <h2>Download financial records for review, audit, and client sharing</h2>
          </div>

          <div class="section">
            <div class="section-head">
              <div>
                <span>Report Builder</span>
                <h2>Download Financial Records</h2>
              </div>
            </div>
            <div class="report-form">
              <select id="reportType" onchange="toggleReportFields()">
                <option value="ledger">Party Ledger</option>
                <option value="transactions">All Transactions</option>
                <option value="summary">Financial Summary</option>
                <option value="outstanding">Outstanding Balances</option>
                <option value="inventory">Inventory & Leakage</option>
              </select>

              <input type="text" id="reportParty" placeholder="Party name" list="reportPartySuggestions" autocomplete="off" oninput="suggestReportParties()">
              <datalist id="reportPartySuggestions"></datalist>

              <input type="date" id="reportStartDate" aria-label="Report start date">
              <input type="date" id="reportEndDate" aria-label="Report end date">
              <input type="date" id="reportDate" aria-label="Inventory date">
            </div>

            <div class="report-actions">
              <button onclick="downloadReport('excel')">Download Excel</button>
              <button onclick="downloadReport('pdf')">Download PDF</button>
            </div>
          </div>

          <div class="grid report-summary-grid">
            <div class="metric blue">
              <span>Party Ledger</span>
              <h2>Client-wise</h2>
            </div>
            <div class="metric green">
              <span>Financial Summary</span>
              <h2>Daily totals</h2>
            </div>
            <div class="metric dark">
              <span>Outstanding</span>
              <h2>Receivable / Payable</h2>
            </div>
            <div class="metric red">
              <span>Inventory</span>
              <h2>Leakage kg</h2>
            </div>
          </div>

        </div>
      `;

      setTimeout(() => {
        const today = new Date();
        const past = new Date();
        past.setDate(today.getDate() - 6);
        document.getElementById("reportStartDate").value = formatDateInput(past);
        document.getElementById("reportEndDate").value = formatDateInput(today);
        document.getElementById("reportDate").value = formatDateInput(today);
        toggleReportFields();
      }, 100);
    }

    refreshIcons();
  }

  // --- Initial load
  window.onload = () => {
    loadPage("dashboard");

    const today = new Date().toLocaleDateString();
    document.getElementById("todayDate").innerText = today;
  };

  function formatDateInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function drawCanvasMessage(canvasId, message) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const width = canvas.clientWidth || 320;
    const height = canvas.clientHeight || 180;
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);
    ctx.font = "14px Inter, sans-serif";
    ctx.fillStyle = "#8792a7";
    ctx.textAlign = "center";
    ctx.fillText(message, width / 2, height / 2);
  }

  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }
  }

  let toastTimer = null;

  // --- Toast
  function showToast(message) {
    const toast = document.getElementById("toast");
    toast.innerText = message;
    toast.style.display = "block";

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.style.display = "none";
    }, 3200);
  }
