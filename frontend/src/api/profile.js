import apiClient from "./client";

export async function getProfile() {
  const { data } = await apiClient.get("/profile");
  return data.user;
}

export async function updateProfile(payload) {
  const { data } = await apiClient.put("/profile", payload);
  return data.user;
}

export async function changePassword(currentPassword, newPassword) {
  const { data } = await apiClient.put("/profile/password", {
    current_password: currentPassword,
    new_password: newPassword,
  });
  return data;
}

export async function deleteAccount() {
  const { data } = await apiClient.delete("/profile");
  return data;
}
