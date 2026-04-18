async function searchLedger() {
    const name = document.getElementById("party").value;
  
    if (!name) {
      showToast("Enter party name");
      return;
    }
  
    const body = document.getElementById("ledgerBody");
    const total = document.getElementById("totalBalance");
  
    // --- Loading state
    body.innerHTML = `<tr><td colspan="4" class="empty">Loading...</td></tr>`;
    total.innerText = "₹ 0";
  
    try {
      const data = await apiCall(`/party/ledger?name=${encodeURIComponent(name)}`);
  
      // --- Multiple matches case
      if (data.multiple_matches) {
        body.innerHTML = `
          <tr>
            <td colspan="4" class="empty">
              Multiple matches found:<br>
              ${data.results.map(p => p.name).join(", ")}
            </td>
          </tr>
        `;
        return;
      }
  
      // --- No data
      if (!data.ledger || data.ledger.length === 0) {
        body.innerHTML = `<tr><td colspan="4" class="empty">No records found</td></tr>`;
        return;
      }
  
      // --- Total balance
      total.innerText = formatMoney(data.total_balance);
  
      // --- Populate table
      body.innerHTML = "";
  
      data.ledger.forEach(row => {
        const tr = document.createElement("tr");
  
        const typeClass = row.type === "PAYMENT" ? "credit" : "debit";
  
        tr.innerHTML = `
          <td>${row.date}</td>
          <td>${row.type}</td>
          <td class="${typeClass}">${formatMoney(row.amount)}</td>
          <td>${formatMoney(row.balance)}</td>
        `;
  
        body.appendChild(tr);
      });
  
    } catch (e) {
      console.error(e);
      body.innerHTML = `<tr><td colspan="4" class="empty">Error loading data</td></tr>`;
      showToast("Ledger fetch failed");
    }
  }

  function formatMoney(value) {
    return "₹ " + Number(value || 0).toLocaleString();
  }
  