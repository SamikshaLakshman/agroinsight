import apiClient from "./client";

export async function getRecommendation({ nitrogen, phosphorus, potassium, ph }) {
  const { data } = await apiClient.post("/recommend", {
    nitrogen,
    phosphorus,
    potassium,
    ph,
  });
  return data;
}

export async function getLimeExplanation(historyId) {
  const { data } = await apiClient.get(`/recommend/explain/lime/${historyId}`);
  return data;
}
