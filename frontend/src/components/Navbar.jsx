import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Leaf, Sun, Moon, Menu, X, Globe } from "lucide-react";
import { useAuth } from "../context/useAuth";
import { useTheme } from "../context/useTheme";

const NAV_ITEMS = [
  { to: "/dashboard", key: "nav.dashboard" },
  { to: "/recommend", key: "nav.recommend" },
  { to: "/history", key: "nav.history" },
  { to: "/models", key: "nav.models" },
  { to: "/research", key: "nav.research" },
  { to: "/profile", key: "nav.profile" },
];

export default function Navbar() {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === "kn" ? "en" : "kn");
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const linkClass = ({ isActive }) =>
    `text-sm font-medium transition-colors px-1 py-2 border-b-2 ${
      isActive
        ? "border-[var(--color-sage)] text-[var(--color-sage)]"
        : "border-transparent text-[var(--color-soil)] hover:text-[var(--color-sage)]"
    }`;

  return (
    <header className="card sticky top-0 z-40 border-x-0 border-t-0 rounded-none">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <Leaf className="w-6 h-6 text-[var(--color-sage)]" strokeWidth={2.25} />
            <span className="font-display text-lg font-semibold">{t("app.name")}</span>
          </div>

          {isAuthenticated && (
            <nav className="hidden md:flex items-center gap-6">
              {NAV_ITEMS.map((item) => (
                <NavLink key={item.to} to={item.to} className={linkClass}>
                  {t(item.key)}
                </NavLink>
              ))}
            </nav>
          )}

          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={toggleLanguage}
              aria-label="Toggle language"
              className="flex items-center gap-1 text-sm px-2 py-1.5 rounded-md hover:bg-[var(--color-soil-light)]/20 text-[var(--color-soil)]"
            >
              <Globe className="w-4 h-4" />
              {i18n.language === "kn" ? "ಕನ್ನಡ" : "EN"}
            </button>
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="p-1.5 rounded-md hover:bg-[var(--color-soil-light)]/20 text-[var(--color-soil)]"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            {isAuthenticated && (
              <button onClick={handleLogout} className="text-sm font-medium text-[var(--color-danger)] px-2">
                {t("nav.logout")}
              </button>
            )}
          </div>

          <button
            className="md:hidden p-2"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden pb-4 flex flex-col gap-3">
            {isAuthenticated &&
              NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={linkClass}
                  onClick={() => setMobileOpen(false)}
                >
                  {t(item.key)}
                </NavLink>
              ))}
            <div className="flex items-center gap-4 pt-2 border-t border-[var(--color-soil)]/15">
              <button onClick={toggleLanguage} className="flex items-center gap-1 text-sm text-[var(--color-soil)]">
                <Globe className="w-4 h-4" />
                {i18n.language === "kn" ? "ಕನ್ನಡ" : "EN"}
              </button>
              <button onClick={toggleTheme} className="flex items-center gap-1 text-sm text-[var(--color-soil)]">
                {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                {t(`theme.${theme}`)}
              </button>
              {isAuthenticated && (
                <button onClick={handleLogout} className="text-sm font-medium text-[var(--color-danger)]">
                  {t("nav.logout")}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
