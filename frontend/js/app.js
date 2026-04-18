function loadPage(page) {

    const content = document.getElementById("content");
    const title = document.getElementById("pageTitle");
  
    // --- Active menu highlight ---
    document.querySelectorAll(".menu button").forEach(btn => btn.classList.remove("active"));
    document.getElementById(`menu-${page}`).classList.add("active");
  
    if (page === "upload") {
      title.innerText = "Upload & Process";
  
      content.innerHTML = `
            <div class="container">

                <div class="section">
                <h2>Step 1: Upload Vendor Data</h2>
                <div class="upload-box">
                    <input type="file" id="vendorFile">
                    <button onclick="uploadVendor()">Upload</button>
                </div>
                </div>

                <div class="section">
                <h2>Step 2: Upload Dealer Data</h2>
                <div class="upload-box">
                    <input type="file" id="dealerFile">
                    <button onclick="uploadDealer()">Upload</button>
                </div>
                </div>

                <div class="section">
                <h2>Step 3: Process Day</h2>
                <div class="upload-box">
                    <input type="date" id="date">
                    <input type="number" id="stock" placeholder="Actual Stock (kg)">
                    <button onclick="processDay()">Process</button>
                </div>
                </div>

            </div>
            `;

    }
  
    else if (page === "dashboard") {
      title.innerText = "Dashboard";
  
      content.innerHTML = `
        <div class="container">

            <div class="card filter">
            <input type="date" id="date">
            <button onclick="loadDashboard()">Load</button>
            </div>

            <div class="grid">

            <div class="metric blue">
                <span>Purchase</span>
                <h2 id="purchase">₹ 0</h2>
            </div>

            <div class="metric green">
                <span>Sales</span>
                <h2 id="sales">₹ 0</h2>
            </div>

            <div class="metric profit">
                <span>Profit</span>
                <h2 id="profit">₹ 0</h2>
            </div>

            <div class="metric red">
                <span>Leakage</span>
                <h2 id="leakage">₹ 0</h2>
            </div>

            <div class="metric dark">
                <span>Outstanding</span>
                <h2 id="outstanding">₹ 0</h2>
            </div>

            </div>

        </div>
        `;

    }
  
    else if (page === "ledger") {
      title.innerText = "Ledger";
  
      content.innerHTML = `
        <div class="container">

            <!-- Search -->
            <div class="card search-card">
            <input type="text" id="party" placeholder="Search party...">
            <button onclick="searchLedger()">Search</button>
            </div>

            <!-- Summary -->
            <div class="summary">
            <div class="summary-box">
                <span>Total Balance</span>
                <h2 id="totalBalance">₹ 0</h2>
            </div>
            </div>

            <!-- Table -->
            <div class="card table-card">
            <table>
                <thead>
                <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Balance</th>
                </tr>
                </thead>
                <tbody id="ledgerBody">
                <tr>
                    <td colspan="4" class="empty">No data yet</td>
                </tr>
                </tbody>
            </table>
            </div>

        </div>
        `;

    }
  

    else if (page === "analytics") {
        title.innerText = "Analytics";
      
        content.innerHTML = `
          <div class="container">
      
            <!-- Filters -->
            <div class="card filter">
              <input type="date" id="startDate">
              <input type="date" id="endDate">
              <button onclick="loadAnalytics()">Load</button>
            </div>
      
            <!-- Charts -->
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
      }
      
}
  
  // --- Set today's date ---
  window.onload = () => {
    loadPage("dashboard");
  
    const today = new Date().toLocaleDateString();
    document.getElementById("todayDate").innerText = today;
  };

  function showToast(message) {
    const toast = document.getElementById("toast");
    toast.innerText = message;
    toast.style.display = "block";
  
    setTimeout(() => {
      toast.style.display = "none";
    }, 2000);
  }
  