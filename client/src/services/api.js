import axios from "axios";
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || "/api" });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("kindred-token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
export async function downloadCertificate(id) {
  const { data } = await api.get(`/certificates/${id}/download`, {
    responseType: "blob",
  });
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = "Warriors-Without-Cause-certificate.pdf";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default api;
