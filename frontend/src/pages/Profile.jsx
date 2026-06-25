import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CheckCircle, AlertCircle } from "lucide-react";
import { useAuth } from "../context/useAuth";
import * as profileApi from "../api/profile";
import apiClient from "../api/client";

export default function Profile() {
  const { t, i18n } = useTranslation();
  const { user, updateUserInPlace, logout } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    full_name: user?.full_name || "",
    city: user?.city || "",
    state: user?.state || "",
    land_area_acres: user?.land_area_acres || "",
    preferred_language: user?.preferred_language || "en",
  });
  const [passwordForm, setPasswordForm] = useState({ current_password: "", new_password: "" });
  const [profileStatus, setProfileStatus] = useState("");
  const [passwordStatus, setPasswordStatus] = useState("");
  const [error, setError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // City validation state
  const [cityMatches, setCityMatches] = useState([]);
  const [cityValidated, setCityValidated] = useState(!!user?.city);
  const [cityChecking, setCityChecking] = useState(false);

  // Debounced city validation
  const validateCity = useCallback(async (cityValue) => {
    if (!cityValue || cityValue.length < 2) {
      setCityMatches([]);
      setCityValidated(false);
      return;
    }
    setCityChecking(true);
    try {
      const { data } = await apiClient.get("/profile/validate-city", {
        params: { city: cityValue },
      });
      setCityMatches(data.matches || []);
      // Auto-validate if the typed value matches the top result
      const topMatch = data.matches?.[0];
      if (topMatch && topMatch.city.toLowerCase() === cityValue.toLowerCase()) {
        setCityValidated(true);
      } else {
        setCityValidated(false);
      }
    } catch {
      setCityMatches([]);
      setCityValidated(false);
    } finally {
      setCityChecking(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (form.city && form.city !== user?.city) {
        validateCity(form.city);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [form.city, validateCity, user?.city]);

  const selectCity = (match) => {
    setForm((f) => ({
      ...f,
      city: match.city,
      state: match.state || f.state,
    }));
    setCityValidated(true);
    setCityMatches([]);
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setProfileStatus("");
    try {
      const updated = await profileApi.updateProfile(form);
      updateUserInPlace(updated);
      if (updated.preferred_language !== i18n.language) {
        i18n.changeLanguage(updated.preferred_language);
      }
      setCityValidated(true);
      setProfileStatus(t("profile.profileUpdated"));
    } catch (err) {
      setError(err.response?.data?.error || t("common.error"));
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setPasswordStatus("");
    try {
      await profileApi.changePassword(passwordForm.current_password, passwordForm.new_password);
      setPasswordStatus(t("profile.passwordChanged"));
      setPasswordForm({ current_password: "", new_password: "" });
    } catch (err) {
      setError(err.response?.data?.error || t("common.error"));
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await profileApi.deleteAccount();
      await logout();
      navigate("/login");
    } catch (err) {
      setError(err.response?.data?.error || t("common.error"));
    }
  };

  return (
    <div className="flex flex-col gap-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-display font-semibold">{t("profile.title")}</h1>
        <p className="text-[var(--color-soil)] mt-1">{t("profile.subtitle")}</p>
      </div>

      {error && (
        <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger)]/10 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <form onSubmit={handleProfileSubmit} className="card p-6 flex flex-col gap-4">
        <h2 className="font-display font-semibold">{t("profile.personalInfo")}</h2>

        <div>
          <label className="text-sm font-medium block mb-1">{t("profile.fullName")}</label>
          <input
            value={form.full_name}
            onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
            className="input-field w-full px-3 py-2"
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">{t("profile.email")}</label>
          <input value={user?.email || ""} disabled className="input-field w-full px-3 py-2 opacity-60" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium block mb-1">{t("profile.state")}</label>
            <input
              value={form.state}
              onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
              className="input-field w-full px-3 py-2"
            />
          </div>
          <div className="relative">
            <label className="text-sm font-medium block mb-1">
              {t("profile.city")}
              {cityChecking && <span className="text-xs text-[var(--color-soil)] ml-2">checking...</span>}
              {cityValidated && !cityChecking && form.city && (
                <CheckCircle className="w-3.5 h-3.5 text-[var(--color-success)] inline ml-1" />
              )}
              {!cityValidated && !cityChecking && form.city && form.city.length >= 2 && cityMatches.length === 0 && (
                <AlertCircle className="w-3.5 h-3.5 text-[var(--color-warning)] inline ml-1" />
              )}
            </label>
            <input
              value={form.city}
              onChange={(e) => {
                setForm((f) => ({ ...f, city: e.target.value }));
                setCityValidated(false);
              }}
              placeholder="Start typing a city name..."
              className="input-field w-full px-3 py-2"
            />
            {/* City suggestions dropdown */}
            {cityMatches.length > 0 && !cityValidated && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 card shadow-lg max-h-40 overflow-y-auto">
                {cityMatches.map((match, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => selectCity(match)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-sage)]/10 transition-colors"
                  >
                    <span className="font-medium">{match.city}</span>
                    {match.state && <span className="text-[var(--color-soil)]">, {match.state}</span>}
                    {match.country && <span className="text-[var(--color-soil)]"> ({match.country})</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium block mb-1">{t("profile.landArea")}</label>
            <input
              type="number"
              step="0.1"
              value={form.land_area_acres}
              onChange={(e) => setForm((f) => ({ ...f, land_area_acres: e.target.value }))}
              className="input-field w-full px-3 py-2 font-mono"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">{t("profile.preferredLanguage")}</label>
            <select
              value={form.preferred_language}
              onChange={(e) => setForm((f) => ({ ...f, preferred_language: e.target.value }))}
              className="input-field w-full px-3 py-2"
            >
              <option value="en">English</option>
              <option value="kn">ಕನ್ನಡ</option>
            </select>
          </div>
        </div>

        {profileStatus && (
          <div className="text-sm text-[var(--color-success)]">{profileStatus}</div>
        )}

        <button type="submit" className="btn-primary py-2.5">{t("profile.updateProfile")}</button>
      </form>

      <form onSubmit={handlePasswordSubmit} className="card p-6 flex flex-col gap-4">
        <h2 className="font-display font-semibold">{t("profile.changePassword")}</h2>

        <div>
          <label className="text-sm font-medium block mb-1">{t("profile.currentPassword")}</label>
          <input
            type="password"
            required
            value={passwordForm.current_password}
            onChange={(e) => setPasswordForm((f) => ({ ...f, current_password: e.target.value }))}
            className="input-field w-full px-3 py-2"
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">{t("profile.newPassword")}</label>
          <input
            type="password"
            required
            value={passwordForm.new_password}
            onChange={(e) => setPasswordForm((f) => ({ ...f, new_password: e.target.value }))}
            className="input-field w-full px-3 py-2"
          />
        </div>

        {passwordStatus && (
          <div className="text-sm text-[var(--color-success)]">{passwordStatus}</div>
        )}

        <button type="submit" className="btn-primary py-2.5">{t("profile.changePassword")}</button>
      </form>

      <div className="card p-6 border-[var(--color-danger)]/30 flex flex-col gap-3">
        <h2 className="font-display font-semibold text-[var(--color-danger)]">{t("profile.dangerZone")}</h2>
        <p className="text-sm text-[var(--color-soil)]">{t("profile.deleteAccountWarning")}</p>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-sm font-medium text-[var(--color-danger)] self-start"
          >
            {t("profile.deleteAccount")}
          </button>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={handleDeleteAccount}
              className="text-sm font-medium px-3 py-1.5 rounded-md bg-[var(--color-danger)] text-white"
            >
              {t("profile.confirmDeleteAccount")}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="text-sm font-medium px-3 py-1.5 rounded-md card"
            >
              {t("common.cancel")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
