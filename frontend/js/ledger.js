async function searchLedger() {
    const name = document.getElementById("party").value;
  
    const data = await apiCall(`/party/ledger?name=${name}`);
  
    const tbody = document.querySelector("#ledgerTable tbody");
    tbody.innerHTML = "";
  
    if (!data.ledger) {
      tbody.innerHTML = "<tr><td colspan='4'>No data</td></tr>";
      return;
    }
  
    data.ledger.forEach(row => {
      const tr = document.createElement("tr");
  
      tr.innerHTML = `
        <td>${row.date}</td>
        <td>${row.type}</td>
        <td>${row.amount}</td>
        <td>${row.balance}</td>
      `;
  
      tbody.appendChild(tr);
    });
  }
  