import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Leaf, Sun, Moon } from "lucide-react";
import { useAuth } from "../context/useAuth";
import { useTheme } from "../context/useTheme";

export default function Login() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.error || t("auth.invalidCredentials"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative">
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
          <h1 className="text-2xl font-display font-semibold">{t("auth.loginTitle")}</h1>
          <p className="text-sm text-[var(--color-soil)] mt-1 text-center">
            {t("auth.loginSubtitle")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 flex flex-col gap-4">
          {error && (
            <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger)]/10 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <div>
            <label className="text-sm font-medium block mb-1">{t("auth.email")}</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field w-full px-3 py-2"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">{t("auth.password")}</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field w-full px-3 py-2"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary py-2.5 mt-2"
          >
            {isSubmitting ? t("common.loading") : t("auth.loginButton")}
          </button>
        </form>

        <p className="text-sm text-center mt-4 text-[var(--color-soil)]">
          {t("auth.noAccount")}{" "}
          <Link to="/register" className="text-[var(--color-sage)] font-medium">
            {t("auth.signUpLink")}
          </Link>
        </p>
      </div>
    </div>
  );
}
