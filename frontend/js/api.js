const DEFAULT_BASE_URL = "https://stockpilot-backend-bvq9.onrender.com";
const BASE_URL = (
  window.STOCKPILOT_API_URL ||
  localStorage.getItem("STOCKPILOT_API_URL") ||
  DEFAULT_BASE_URL
).replace(/\/$/, "");

async function apiCall(url, method = "GET", body = null, headers = {}) {
    const options = {
      method: method,
      headers: headers,
    };
  
    if (body) {
      options.body = body;
    }
  
    const res = await fetch(BASE_URL + url, options);
  
    if (!res.ok) {
      throw new Error(`API error: ${res.status}`);
    }
  
    const data = await res.json();

    if (data && data.error) {
      console.warn("API returned an error:", data.error);
    }

    return data;
  }

async function optionalApiCall(url, fallback, method = "GET", body = null) {
  try {
    return await apiCall(url, method, body);
  } catch (e) {
    console.warn(`Optional API unavailable: ${url}`, e);
    return fallback;
  }
}
  
