async function searchLedger() {
    const name = document.getElementById("party").value;
  
    const data = await apiCall(`/party/ledger?name=${name}`);
  
    document.getElementById("ledgerOutput").innerText =
      JSON.stringify(data, null, 2);
  }
  