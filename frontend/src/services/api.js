import axios from "axios";

const API = axios.create({
  baseURL: "http://127.0.0.1:5000",
});

// Upload Video
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

// Chat
export const askQuestion = async (videoId, question) => {
  const response = await API.post("/chat", {
    video_id: videoId,
    question: question,
  });

  return response.data;
};

// Health
export const checkHealth = async () => {
  const response = await API.get("/health");
  return response.data;
};

// Get Summary (Optional)
export const getSummary = async (videoId) => {
  const response = await API.get(`/summary/${videoId}`);
  return response.data;
};