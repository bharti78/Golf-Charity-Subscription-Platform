const PROD_API_URL = "https://golf-charity-subscription-platform-zrcp.onrender.com";
const API_BASE =
  import.meta.env.VITE_API_URL ||
  (window.location.hostname === "localhost" ? "http://localhost:4000" : PROD_API_URL);

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path, options = {}) {
  const token = window.localStorage.getItem("golf_token");
  const isFormData = options.body instanceof FormData;
  const method = (options.method || "GET").toUpperCase();
  const fetchOptions = {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(!isFormData && method !== "GET" ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    },
    ...options
  };

  let response;
  let lastError;
  const attempts = window.location.hostname === "localhost" ? 1 : 3;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      response = await fetch(`${API_BASE}${path}`, fetchOptions);
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await wait(attempt * 1500);
      }
    }
  }

  if (!response) {
    const backendHint = window.location.hostname === "localhost"
      ? "Check that the backend is running."
      : "The backend may still be waking up on Render. Please wait a few seconds and try again.";
    throw new Error(`Could not connect to the API at ${API_BASE}. ${backendHint}`);
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }
  return data;
}

export const api = {
  getHome: () => request("/api/public/home"),
  getCharities: (search = "") => request(`/api/public/charities?search=${encodeURIComponent(search)}`),
  getCharityBySlug: (slug) => request(`/api/public/charities/${slug}`),
  signup: (payload) => request("/api/auth/signup", { method: "POST", body: JSON.stringify(payload) }),
  login: (payload) => request("/api/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  getDashboard: () => request("/api/me"),
  updateProfile: (payload) => request("/api/me/profile", { method: "PATCH", body: JSON.stringify(payload) }),
  createScore: (payload) => request("/api/me/scores", { method: "POST", body: JSON.stringify(payload) }),
  updateScore: (scoreId, payload) =>
    request(`/api/me/scores/${scoreId}`, { method: "PUT", body: JSON.stringify(payload) }),
  createDonation: (payload) =>
    request("/api/me/donations", { method: "POST", body: JSON.stringify(payload) }),
  createStripeCheckout: (payload) =>
    request("/api/stripe/checkout", { method: "POST", body: JSON.stringify(payload) }),
  createStripePortal: () => request("/api/stripe/portal", { method: "POST" }),
  confirmStripeCheckout: (payload) =>
    request("/api/stripe/checkout/confirm", { method: "POST", body: JSON.stringify(payload) }),
  cancelSubscription: () => request("/api/me/subscription/cancel", { method: "POST" }),
  renewSubscription: () => request("/api/me/subscription/renew", { method: "POST" }),
  submitVerification: ({ drawId, file }) => {
    const formData = new FormData();
    formData.append("drawId", drawId);
    formData.append("proof", file);
    return request("/api/me/verification", { method: "POST", body: formData });
  },
  getAdminOverview: () => request("/api/admin/overview"),
  simulateDraw: (mode) => request("/api/admin/draws/simulate", { method: "POST", body: JSON.stringify({ mode }) }),
  publishDraw: (mode) => request("/api/admin/draws/publish", { method: "POST", body: JSON.stringify({ mode }) }),
  createCharity: (payload) =>
    request("/api/admin/charities", { method: "POST", body: JSON.stringify(payload) }),
  updateUser: (userId, payload) =>
    request(`/api/admin/users/${userId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  updateUserScore: (userId, scoreId, payload) =>
    request(`/api/admin/users/${userId}/scores/${scoreId}`, { method: "PUT", body: JSON.stringify(payload) }),
  updateCharity: (charityId, payload) =>
    request(`/api/admin/charities/${charityId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteCharity: (charityId) => request(`/api/admin/charities/${charityId}`, { method: "DELETE" }),
  verifyWinner: (winnerId, payload) =>
    request(`/api/admin/winners/${winnerId}/verify`, { method: "POST", body: JSON.stringify(payload) }),
  payWinner: (winnerId) => request(`/api/admin/winners/${winnerId}/pay`, { method: "POST" })
};
