async function searchLedger() {
    const name = document.getElementById("party").value;
  
    if (!name) return alert("Enter party name");
  
    const data = await apiCall(`/party/ledger?name=${name}`);
  
    const body = document.getElementById("ledgerBody");
    const total = document.getElementById("totalBalance");
  
    body.innerHTML = "";
  
    if (!data.ledger || data.ledger.length === 0) {
      body.innerHTML = `<tr><td colspan="4" class="empty">No records found</td></tr>`;
      return;
    }
  
    total.innerText = "₹ " + Number(data.total_balance).toLocaleString();
  
    data.ledger.forEach(row => {
      const tr = document.createElement("tr");
  
      const typeClass = row.type === "PAYMENT" ? "credit" : "debit";
  
      tr.innerHTML = `
        <td>${row.date}</td>
        <td>${row.type}</td>
        <td class="${typeClass}">₹ ${row.amount}</td>
        <td>₹ ${row.balance}</td>
      `;
  
      body.appendChild(tr);
    });
  }
  