const BASE_URL = "http://127.0.0.1:8000";

async function apiCall(url, method = "GET", body = null) {
  const options = {
    method: method,
  };

  if (body) {
    options.body = body;
  }

  const res = await fetch(BASE_URL + url, options);
  return await res.json();
}
