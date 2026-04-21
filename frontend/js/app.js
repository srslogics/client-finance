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
      title.innerText = "Upload & Process";

      content.innerHTML = `
        <div class="container">

          <div class="section">
            <h2>Step 1: Upload Dealer Purchase Data</h2>
            <div class="upload-box">
              <input type="file" id="dealerFile" accept=".csv,.xls,.xlsx">
              <button onclick="uploadDealer()">Upload</button>
            </div>
          </div>

          <div class="section">
            <h2>Step 2: Upload Vendor Sales Data</h2>
            <div class="upload-box">
              <input type="file" id="vendorFile" accept=".csv,.xls,.xlsx">
              <button onclick="uploadVendor()">Upload</button>
            </div>
          </div>

          <div class="section">
            <h2>Step 3: Upload Payment Data</h2>
            <div class="upload-box">
              <input type="file" id="paymentFile" accept=".csv,.xls,.xlsx">
              <button onclick="uploadPayment()">Upload</button>
            </div>
          </div>

          <div class="section">
            <h2>Step 4: Process Day</h2>
            <div class="upload-box">
              <input type="date" id="processDate">
              <input type="number" id="stock" placeholder="Actual Stock (kg)">
              <button onclick="processDay()">Process</button>
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
              <span>Outstanding</span>
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
