import axios from "axios";

const API = axios.create({
  baseURL: "http://127.0.0.1:5000",
});

// ---------------------------------------------------------------------------
// Token management
//
// Access token lives in React state (memory-only) — managed by AuthContext.
// Refresh token lives in localStorage so a page refresh can re-authenticate.
//
// Tradeoff chosen: access token in memory limits what an XSS can steal;
// refresh token in localStorage is necessary so the session survives reloads
// without requiring a re-login.  A stolen refresh token alone is less
// damaging than a stolen access token because the backend can revoke it.
// ---------------------------------------------------------------------------

let _getAccessToken = () => null;  // replaced by configureAuth
let _setAccessToken = () => {};    // replaced by configureAuth
let _clearAuth = () => {};         // replaced by configureAuth
let _isRefreshing = false;
let _failedQueue = [];

function processQueue(error, token) {
  _failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  _failedQueue = [];
}

/**
 * Called once by AuthContext on mount (and whenever the getter changes).
 * Gives the interceptor access to the current in-memory access token
 * and the ability to clear auth state when refresh fails.
 */
export function configureAuth(getAccessToken, setAccessToken, clearAuth) {
  _getAccessToken = getAccessToken;
  _setAccessToken = setAccessToken;
  _clearAuth = clearAuth;
}

// ---------------------------------------------------------------------------
// Request interceptor — attach Bearer token from memory
// ---------------------------------------------------------------------------

API.interceptors.request.use((config) => {
  const token = _getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ---------------------------------------------------------------------------
// Response interceptor — on 401, try /auth/refresh ONCE, then retry.
// Guard: if the failing request IS the refresh itself, give up immediately.
// ---------------------------------------------------------------------------

API.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config;

    // If not a 401, or we already retried, or this IS the refresh call — fail
    if (
      err.response?.status !== 401 ||
      originalRequest._retry ||
      originalRequest.url === "/auth/refresh"
    ) {
      return Promise.reject(err);
    }

    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) {
      _clearAuth();
      return Promise.reject(err);
    }

    // If a refresh is already in flight, queue this request
    if (_isRefreshing) {
      return new Promise((resolve, reject) => {
        _failedQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return API(originalRequest);
      });
    }

    originalRequest._retry = true;
    _isRefreshing = true;

    try {
      const { data } = await axios.post(
        "http://127.0.0.1:5000/auth/refresh",
        { refresh_token: refreshToken },
      );

      if (data.access_token) {
        _setAccessToken(data.access_token);
        processQueue(null, data.access_token);
        originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
        return API(originalRequest);
      }

      // Refresh returned no token — clear everything
      processQueue(new Error("Refresh failed"), null);
      _clearAuth();
      return Promise.reject(err);
    } catch (refreshErr) {
      processQueue(refreshErr, null);
      _clearAuth();
      return Promise.reject(refreshErr);
    } finally {
      _isRefreshing = false;
    }
  },
);

// ---------------------------------------------------------------------------
// Auth endpoints
// ---------------------------------------------------------------------------

export const registerUser = async (email, password) => {
  const response = await API.post("/auth/register", { email, password });
  return response.data;
};

export const loginUser = async (email, password) => {
  const response = await API.post("/auth/login", { email, password });
  return response.data;
};

export const getMe = async () => {
  const response = await API.get("/auth/me");
  return response.data;
};

/**
 * POST /auth/logout — revokes the access token on the server.
 * Pass the current access token explicitly so it can be revoked
 * even after the interceptor has already cleared it from memory.
 */
export const logoutUser = async (accessToken) => {
  const response = await API.post(
    "/auth/logout",
    {},
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  return response.data;
};

// ---------------------------------------------------------------------------
// Meetings
// ---------------------------------------------------------------------------

export const getMeetings = async () => {
  const response = await API.get("/meetings");
  return response.data;
};

export const getMeeting = async (meetingId) => {
  const response = await API.get(`/meetings/${meetingId}`);
  return response.data;
};

export const deleteMeeting = async (meetingId) => {
  const response = await API.delete(`/meetings/${meetingId}`);
  return response.data;
};

export const getTranscript = async (meetingId) => {
  const response = await API.get(`/meetings/${meetingId}/transcript`);
  return response.data;
};

export const getChatMessages = async (meetingId) => {
  const response = await API.get(`/meetings/${meetingId}/chat`);
  return response.data;
};

// ---------------------------------------------------------------------------
// Upload Video
// ---------------------------------------------------------------------------

export const uploadVideo = async (file) => {
  const formData = new FormData();
  formData.append("video", file);

  const response = await API.post("/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data;
};

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export const askQuestion = async (videoId, question) => {
  const response = await API.post("/chat", {
    video_id: videoId,
    question: question,
  });

  return response.data;
};

// ---------------------------------------------------------------------------
// Health (public)
// ---------------------------------------------------------------------------

export const checkHealth = async () => {
  const response = await API.get("/health");
  return response.data;
};

// ---------------------------------------------------------------------------
// Video blob (authenticated)
// ---------------------------------------------------------------------------

export const getVideoBlob = async (meetingId) => {
  const response = await API.get(`/meetings/${meetingId}/video`, {
    responseType: "blob",
  });
  return URL.createObjectURL(response.data);
};

// ---------------------------------------------------------------------------
// Get Summary (legacy)
// ---------------------------------------------------------------------------

export const getSummary = async (videoId) => {
  const response = await API.get(`/summary/${videoId}`);
  return response.data;
};
