const DEFAULT_BASE_URL = "https://stockpilot-backend-bvq9.onrender.com";
const BASE_URL = (
  window.STOCKPILOT_API_URL ||
  localStorage.getItem("STOCKPILOT_API_URL") ||
  DEFAULT_BASE_URL
).replace(/\/$/, "");

let activeRequests = 0;

async function apiCall(url, method = "GET", body = null, headers = {}) {
    showLoading(requestMessage(method, url));

    const options = {
      method: method,
      headers: headers,
    };

    try {
      if (body) {
        options.body = body;
      }

      const res = await fetchWithRetry(BASE_URL + url, options);

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const data = await res.json();

      if (data && data.error) {
        console.warn("API returned an error:", data.error);
      }

      return data;
    } finally {
      hideLoading();
    }
  }

async function optionalApiCall(url, fallback, method = "GET", body = null) {
  try {
    return await apiCall(url, method, body);
  } catch (e) {
    console.warn(`Optional API unavailable: ${url}`, e);
    return fallback;
  }
}

async function fetchWithRetry(url, options, attempts = 2) {
  let lastError;

  for (let attempt = 0; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (response.ok || response.status < 500 || attempt === attempts) {
        return response;
      }
    } catch (e) {
      lastError = e;
      if (attempt === attempts) throw e;
    }

    await wait(1200 * (attempt + 1));
  }

  throw lastError || new Error("Network request failed");
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function showLoading(message = "Processing...") {
  activeRequests += 1;
  const loader = document.getElementById("globalLoader");
  const text = document.getElementById("loaderText");

  if (text) text.innerText = message;
  if (loader) {
    loader.classList.add("show");
    loader.setAttribute("aria-hidden", "false");
  }
}

function hideLoading() {
  activeRequests = Math.max(0, activeRequests - 1);
  if (activeRequests > 0) return;

  const loader = document.getElementById("globalLoader");
  if (loader) {
    loader.classList.remove("show");
    loader.setAttribute("aria-hidden", "true");
  }
}

async function withLoading(message, callback) {
  showLoading(message);
  try {
    return await callback();
  } finally {
    hideLoading();
  }
}

function requestMessage(method, url) {
  if (method === "POST") return "Processing...";
  if (url.includes("analytics")) return "Loading analytics...";
  if (url.includes("dashboard")) return "Loading dashboard...";
  if (url.includes("ledger") || url.includes("party")) return "Loading ledger...";
  if (url.includes("reports")) return "Preparing report...";
  return "Loading...";
}
