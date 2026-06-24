import apiClient from "./client";

export async function getModelPerformance() {
  const { data } = await apiClient.get("/models/performance");
  return data;
}

export async function runExplainabilityBenchmark(payload) {
  const { data } = await apiClient.post("/research/explainability", payload);
  return data;
}
