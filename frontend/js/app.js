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
  
          <div class="card">
            <h2>Vendor Upload</h2>
            <div class="row">
              <input type="file" id="vendorFile">
              <button onclick="uploadVendor()">Upload</button>
            </div>
          </div>
  
          <div class="card">
            <h2>Dealer Upload</h2>
            <div class="row">
              <input type="file" id="dealerFile">
              <button onclick="uploadDealer()">Upload</button>
            </div>
          </div>
  
          <div class="card">
            <h2>Process Day</h2>
            <div class="row">
              <input type="date" id="date">
              <input type="number" id="stock" placeholder="Actual Stock">
              <button onclick="processDay()">Process</button>
            </div>
          </div>
  
        </div>
      `;
    }
  
    if (page === "dashboard") {
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
  
    if (page === "ledger") {
      title.innerText = "Ledger";
  
      content.innerHTML = `
        <div class="container">
  
          <div class="card">
            <div class="row">
              <input type="text" id="party" placeholder="Enter party name">
              <button onclick="searchLedger()">Search</button>
            </div>
          </div>
  
          <div class="card">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody id="ledgerBody"></tbody>
            </table>
          </div>
  
        </div>
      `;
    }
  }
  
  // --- Set today's date ---
  window.onload = () => {
    loadPage("upload");
  
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
  