import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Leaf, Sun, Moon } from "lucide-react";
import { useAuth } from "../context/useAuth";
import { useTheme } from "../context/useTheme";

export default function Register() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    confirmPassword: "",
    city: "",
    state: "",
    land_area_acres: "",
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError(t("auth.passwordMismatch"));
      return;
    }

    setIsSubmitting(true);
    try {
      await register({
        full_name: form.full_name,
        email: form.email,
        password: form.password,
        city: form.city,
        state: form.state,
        land_area_acres: form.land_area_acres ? parseFloat(form.land_area_acres) : null,
      });
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.error || t("auth.registrationFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 relative">
      <button
        onClick={toggleTheme}
        aria-label="Toggle theme"
        className="absolute top-4 right-4 p-2 rounded-md hover:bg-[var(--color-soil-light)]/20 text-[var(--color-soil)]"
      >
        {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <Leaf className="w-9 h-9 text-[var(--color-sage)] mb-2" />
          <h1 className="text-2xl font-display font-semibold">{t("auth.registerTitle")}</h1>
          <p className="text-sm text-[var(--color-soil)] mt-1 text-center">
            {t("auth.registerSubtitle")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 flex flex-col gap-4">
          {error && (
            <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger)]/10 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <div>
            <label className="text-sm font-medium block mb-1">{t("auth.fullName")}</label>
            <input required value={form.full_name} onChange={update("full_name")} className="input-field w-full px-3 py-2" />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">{t("auth.email")}</label>
            <input type="email" required value={form.email} onChange={update("email")} className="input-field w-full px-3 py-2" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1">{t("auth.password")}</label>
              <input type="password" required value={form.password} onChange={update("password")} className="input-field w-full px-3 py-2" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">{t("auth.confirmPassword")}</label>
              <input type="password" required value={form.confirmPassword} onChange={update("confirmPassword")} className="input-field w-full px-3 py-2" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1">{t("auth.city")}</label>
              <input value={form.city} onChange={update("city")} className="input-field w-full px-3 py-2" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">{t("auth.state")}</label>
              <input value={form.state} onChange={update("state")} className="input-field w-full px-3 py-2" />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">{t("auth.landArea")}</label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={form.land_area_acres}
              onChange={update("land_area_acres")}
              className="input-field w-full px-3 py-2"
            />
          </div>

          <button type="submit" disabled={isSubmitting} className="btn-primary py-2.5 mt-2">
            {isSubmitting ? t("common.loading") : t("auth.registerButton")}
          </button>
        </form>

        <p className="text-sm text-center mt-4 text-[var(--color-soil)]">
          {t("auth.haveAccount")}{" "}
          <Link to="/login" className="text-[var(--color-sage)] font-medium">
            {t("auth.loginLink")}
          </Link>
        </p>
      </div>
    </div>
  );
}
