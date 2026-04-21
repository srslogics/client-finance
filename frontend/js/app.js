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
      title.innerText = "Daily Uploads";

      content.innerHTML = `
        <div class="container">

          <div class="section">
            <h2>Daily Templates</h2>
            <div class="upload-box">
              <button onclick="downloadTemplate('dealer')">Dealer Purchase</button>
              <button onclick="downloadTemplate('vendor')">Vendor Sales</button>
              <button onclick="downloadTemplate('payment')">Payment</button>
            </div>
          </div>

          <div class="section">
            <h2>1. Dealer Purchase File</h2>
            <div class="upload-box">
              <input type="file" id="dealerFile" accept=".csv,.xls,.xlsx">
              <button onclick="previewDealer()">Preview</button>
              <button onclick="uploadDealer()">Upload</button>
            </div>
          </div>

          <div class="section">
            <h2>2. Vendor Sales File</h2>
            <div class="upload-box">
              <input type="file" id="vendorFile" accept=".csv,.xls,.xlsx">
              <button onclick="previewVendor()">Preview</button>
              <button onclick="uploadVendor()">Upload</button>
            </div>
          </div>

          <div class="section">
            <h2>3. Payment File</h2>
            <div class="upload-box">
              <input type="file" id="paymentFile" accept=".csv,.xls,.xlsx">
              <button onclick="previewPayment()">Preview</button>
              <button onclick="uploadPayment()">Upload</button>
            </div>
          </div>

          <div class="section">
            <h2>Process Day</h2>
            <div class="upload-box process-day-controls">
              <input type="date" id="processDate">
            </div>
            <datalist id="itemSuggestions"></datalist>
            <div id="actualStockRows" class="stock-rows">
              <div class="upload-box actual-stock-row">
                <input type="text" class="actualItem" placeholder="Hen type" list="itemSuggestions" autocomplete="off" oninput="suggestItems(this)">
                <input type="number" class="actualWeight" placeholder="Actual stock (kg)" min="0" step="0.01">
              </div>
            </div>
            <div class="upload-box">
              <button onclick="addActualStockRow()">Add Hen Type</button>
              <button onclick="processDay()">Process</button>
            </div>
          </div>

          <div class="section">
            <h2>Initial Setup Templates</h2>
            <div class="upload-box">
              <button onclick="downloadTemplate('opening-balance')">Opening Balance</button>
              <button onclick="downloadTemplate('opening-stock')">Opening Stock</button>
            </div>
          </div>

          <div class="section">
            <h2>Opening Balance</h2>
            <div class="upload-box">
              <input type="file" id="openingBalanceFile" accept=".csv,.xls,.xlsx">
              <button onclick="previewOpeningBalance()">Preview</button>
              <button onclick="uploadOpeningBalance()">Upload</button>
            </div>
          </div>

          <div class="section">
            <h2>Opening Stock</h2>
            <div class="upload-box">
              <input type="file" id="openingStockFile" accept=".csv,.xls,.xlsx">
              <button onclick="previewOpeningStock()">Preview</button>
              <button onclick="uploadOpeningStock()">Upload</button>
            </div>
          </div>

        </div>
      `;
    }

    // --- Dashboard Page
    else if (page === "dashboard") {
      title.innerText = "Investor Dashboard";

      content.innerHTML = `
        <div class="container">

          <div class="card filter">
            <input type="date" id="dashboardDate">
            <button onclick="loadDashboard()">Load</button>
          </div>

          <div class="grid">
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

          <div class="card">
            <h2>Sales vs Purchase Trend</h2>
            <canvas id="trendChart"></canvas>
          </div>

          <div class="card">
            <h2>Profit Trend</h2>
            <canvas id="profitChart"></canvas>
          </div>

          <div class="card">
            <h2>Leakage Trend</h2>
            <canvas id="leakageChart"></canvas>
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
        const today = new Date().toISOString().split("T")[0];
        document.getElementById("dashboardDate").value = today;
        loadDashboard();
      }, 100);
    }

    // --- Ledger Page
    else if (page === "ledger") {
      title.innerText = "Ledger";

      content.innerHTML = `
        <div class="container">

          <div class="card search-card">
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

    // --- Analytics Page
    else if (page === "analytics") {
      title.innerText = "Analytics";

      content.innerHTML = `
        <div class="container">

          <div class="card filter">
            <input type="date" id="startDate">
            <input type="date" id="endDate">
            <button onclick="loadAnalytics()">Load</button>
          </div>

          <div class="card">
            <h2>Sales vs Purchase Trend</h2>
            <canvas id="trendChart"></canvas>
          </div>

          <div class="card">
            <h2>Leakage Trend</h2>
            <canvas id="leakageChart"></canvas>
          </div>

          <div class="card">
            <h2>Top Debtors</h2>
            <canvas id="debtorChart"></canvas>
          </div>

          <div class="card">
            <h2>Profit By Hen Type</h2>
            <canvas id="profitByItemChart"></canvas>
          </div>

        </div>
      `;

      // ✅ Auto load analytics
      setTimeout(() => {
        const today = new Date();
        const past = new Date();
        past.setDate(today.getDate() - 6);

        document.getElementById("startDate").value = past.toISOString().split("T")[0];
        document.getElementById("endDate").value = today.toISOString().split("T")[0];

        loadAnalytics();
      }, 100);
    }

    // --- Reports Page
    else if (page === "reports") {
      title.innerText = "Reports";

      content.innerHTML = `
        <div class="container">

          <div class="section">
            <h2>Download Financial Records</h2>
            <div class="upload-box report-filters">
              <select id="reportType" onchange="toggleReportFields()">
                <option value="ledger">Party Ledger</option>
                <option value="transactions">All Transactions</option>
                <option value="summary">Financial Summary</option>
                <option value="outstanding">Outstanding Balances</option>
                <option value="inventory">Inventory & Leakage</option>
              </select>

              <input type="text" id="party" placeholder="Party name" list="partySuggestions" autocomplete="off" oninput="suggestParties()">
              <datalist id="partySuggestions"></datalist>

              <input type="date" id="reportStartDate" aria-label="Report start date">
              <input type="date" id="reportEndDate" aria-label="Report end date">
              <input type="date" id="reportDate" aria-label="Inventory date">
            </div>

            <div class="upload-box report-actions">
              <button onclick="downloadReport('excel')">Download Excel</button>
              <button onclick="downloadReport('pdf')">Download PDF</button>
            </div>
          </div>

          <div class="grid">
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
        document.getElementById("reportStartDate").value = past.toISOString().split("T")[0];
        document.getElementById("reportEndDate").value = today.toISOString().split("T")[0];
        document.getElementById("reportDate").value = today.toISOString().split("T")[0];
        toggleReportFields();
      }, 100);
    }
  }

  // --- Initial load
  window.onload = () => {
    loadPage("dashboard");

    const today = new Date().toLocaleDateString();
    document.getElementById("todayDate").innerText = today;
  };

  // --- Toast
  function showToast(message) {
    const toast = document.getElementById("toast");
    toast.innerText = message;
    toast.style.display = "block";

    setTimeout(() => {
      toast.style.display = "none";
    }, 2000);
  }
