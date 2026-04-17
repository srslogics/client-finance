const BASE_URL = "https://stockpilot-backend-bvq9.onrender.com";

async function apiCall(url, method = "GET", body = null) {
    const options = {
      method: method,
    };
  
    if (body) {
      options.body = body;
    }
  
    const res = await fetch(BASE_URL + url, options);
  
    if (!res.ok) {
      throw new Error("API error");
    }
  
    return await res.json();
  }
  
