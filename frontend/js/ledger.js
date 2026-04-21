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
        const names = data.results.map(p => p.name).join(", ");
        body.innerHTML = `<tr><td colspan="4" class="empty"></td></tr>`;
        body.querySelector("td").innerText = `Multiple matches found:\n${names}`;
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

        appendCell(tr, row.date);
        appendCell(tr, row.type);
        appendCell(tr, formatMoney(row.amount), typeClass);
        appendCell(tr, formatMoney(row.balance));

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

  function appendCell(row, value, className = "") {
    const cell = document.createElement("td");
    cell.innerText = value ?? "";
    if (className) cell.className = className;
    row.appendChild(cell);
  }

