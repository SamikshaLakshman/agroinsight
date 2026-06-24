import apiClient from "./client";

export async function listHistory({ page = 1, perPage = 10, crop, dateFrom, dateTo } = {}) {
  const { data } = await apiClient.get("/history", {
    params: {
      page,
      per_page: perPage,
      crop: crop || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    },
  });
  return data;
}

export async function getHistoryEntry(id) {
  const { data } = await apiClient.get(`/history/${id}`);
  return data;
}

export function getExportCsvUrl() {
  // Used as a direct download link; the browser will attach the auth header
  // only if we fetch via blob, since <a href> can't carry custom headers.
  return "/history/export/csv";
}

export async function downloadHistoryCsv() {
  const response = await apiClient.get("/history/export/csv", { responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", "agroinsight_history.csv");
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
