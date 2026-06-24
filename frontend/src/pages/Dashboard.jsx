import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Sprout, ArrowRight, History as HistoryIcon } from "lucide-react";
import { useAuth } from "../context/useAuth";
import { listHistory } from "../api/history";

export default function Dashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [recent, setRecent] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    listHistory({ page: 1, perPage: 5 })
      .then((data) => setRecent(data.items))
      .catch(() => setRecent([]))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-display font-semibold">
          {t("dashboard.welcome", { name: user?.full_name?.split(" ")[0] || "" })}
        </h1>
        <p className="text-[var(--color-soil)] mt-1">{t("dashboard.subtitle")}</p>
      </div>

      <Link
        to="/recommend"
        className="card p-6 flex items-center justify-between hover:ring-2 hover:ring-[var(--color-sage)] transition-shadow"
      >
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-full bg-[var(--color-sage)]/15">
            <Sprout className="w-6 h-6 text-[var(--color-sage)]" />
          </div>
          <div>
            <h2 className="font-display font-semibold text-lg">{t("dashboard.quickRecommend")}</h2>
            <p className="text-sm text-[var(--color-soil)]">{t("dashboard.quickRecommendDesc")}</p>
          </div>
        </div>
        <ArrowRight className="w-5 h-5 text-[var(--color-soil)]" />
      </Link>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-lg">{t("dashboard.recentHistory")}</h2>
          {recent.length > 0 && (
            <Link to="/history" className="text-sm text-[var(--color-sage)] font-medium">
              {t("dashboard.viewAll")}
            </Link>
          )}
        </div>

        {isLoading ? (
          <p className="text-[var(--color-soil)] text-sm">{t("common.loading")}</p>
        ) : recent.length === 0 ? (
          <div className="card p-8 text-center flex flex-col items-center gap-3">
            <HistoryIcon className="w-8 h-8 text-[var(--color-soil-light)]" />
            <p className="text-[var(--color-soil)]">{t("dashboard.noHistoryYet")}</p>
            <Link to="/recommend" className="btn-primary px-4 py-2 inline-block">
              {t("dashboard.startNow")}
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {recent.map((entry) => (
              <div key={entry.id} className="card p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium capitalize">
                    {t(`crops.${entry.predicted_crop}`, { defaultValue: entry.predicted_crop })}
                  </p>
                  <p className="text-xs text-[var(--color-soil)]">
                    {new Date(entry.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className="font-mono text-sm text-[var(--color-terracotta)]">
                  {entry.top5?.[0]?.confidence}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
