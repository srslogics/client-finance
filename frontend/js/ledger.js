let partySuggestTimer = null;

async function searchLedger() {
    const name = document.getElementById("party").value;
    const startDate = document.getElementById("ledgerStartDate")?.value;
    const endDate = document.getElementById("ledgerEndDate")?.value;

    if (!name) {
      showToast("Enter party name");
      return;
    }

    const body = document.getElementById("ledgerBody");
    const total = document.getElementById("totalBalance");

    // --- Loading state
    body.innerHTML = `<tr><td colspan="7" class="empty">Loading...</td></tr>`;
    total.innerText = "₹ 0";

    try {
      const params = new URLSearchParams({ name });
      if (startDate) params.set("start_date", startDate);
      if (endDate) params.set("end_date", endDate);

      const data = await apiCall(`/party/ledger?${params.toString()}`);

      if (data.error) {
        body.innerHTML = `<tr><td colspan="7" class="empty"></td></tr>`;
        body.querySelector("td").innerText = data.error;
        showToast(data.error);
        return;
      }

      // --- Multiple matches case
      if (data.multiple_matches) {
        const names = data.results.map(p => p.name).join(", ");
        body.innerHTML = `<tr><td colspan="7" class="empty"></td></tr>`;
        body.querySelector("td").innerText = `Multiple matches found:\n${names}`;
        return;
      }

      // --- No data
      if (!data.ledger || data.ledger.length === 0) {
        body.innerHTML = `<tr><td colspan="7" class="empty">No records found</td></tr>`;
        return;
      }

      // --- Total balance
      total.innerText = formatMoney(data.total_balance);

      // --- Populate table
      body.innerHTML = "";

      data.ledger.forEach(row => {
        const tr = document.createElement("tr");

        const typeClass = row.type.startsWith("PAYMENT") ? "credit" : "debit";

        appendCell(tr, row.date);
        appendCell(tr, row.type);
        appendCell(tr, row.category || "-");
        appendCell(tr, row.item || "-");
        appendCell(tr, row.payment_mode || "NA");
        appendCell(tr, formatMoney(row.amount), typeClass);
        appendCell(tr, formatMoney(row.balance));

        body.appendChild(tr);
      });

    } catch (e) {
      console.error(e);
      body.innerHTML = `<tr><td colspan="7" class="empty">Error loading data</td></tr>`;
      showToast("Ledger fetch failed");
    }
  }

  function suggestParties() {
    const input = document.getElementById("party");
    const suggestions = document.getElementById("partySuggestions");
    const name = input?.value.trim();

    if (!suggestions) return;

    clearTimeout(partySuggestTimer);

    if (!name || name.length < 2) {
      suggestions.innerHTML = "";
      return;
    }

    partySuggestTimer = setTimeout(async () => {
      try {
        const data = await apiCall(`/party/search?name=${encodeURIComponent(name)}`);
        suggestions.innerHTML = "";

        (data.results || []).forEach(party => {
          const option = document.createElement("option");
          option.value = party.name;
          option.label = party.type ? `${party.name} (${party.type})` : party.name;
          suggestions.appendChild(option);
        });
      } catch (e) {
        console.error(e);
        suggestions.innerHTML = "";
      }
    }, 250);
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
