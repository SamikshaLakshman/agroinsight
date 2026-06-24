import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { listHistory, downloadHistoryCsv } from "../api/history";

export default function History() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [cropFilter, setCropFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: loading flag for an async fetch triggered by page/filter change
    setIsLoading(true);
    listHistory({ page, perPage: 10, crop: cropFilter })
      .then((data) => {
        setItems(data.items);
        setTotalPages(data.total_pages || 1);
      })
      .finally(() => setIsLoading(false));
  }, [page, cropFilter]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-semibold">{t("history.title")}</h1>
          <p className="text-[var(--color-soil)] mt-1">{t("history.subtitle")}</p>
        </div>
        <button onClick={downloadHistoryCsv} className="card px-4 py-2 flex items-center gap-2 text-sm font-medium">
          <Download className="w-4 h-4" /> {t("history.exportCsv")}
        </button>
      </div>

      <div className="relative max-w-xs">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-soil)]" />
        <input
          value={cropFilter}
          onChange={(e) => { setCropFilter(e.target.value); setPage(1); }}
          placeholder={t("history.searchPlaceholder")}
          className="input-field w-full pl-9 pr-3 py-2 text-sm"
        />
      </div>

      {isLoading ? (
        <p className="text-[var(--color-soil)] text-sm">{t("common.loading")}</p>
      ) : items.length === 0 ? (
        <p className="text-[var(--color-soil)] text-sm">{t("history.noResults")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((entry) => (
            <div key={entry.id} className="card p-4 flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="font-medium capitalize">
                {t(`crops.${entry.predicted_crop}`, { defaultValue: entry.predicted_crop })}
              </p>
                <p className="text-xs text-[var(--color-soil)]">
                  {new Date(entry.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-4 text-sm font-mono text-[var(--color-soil)]">
                <span>N {entry.inputs.nitrogen}</span>
                <span>P {entry.inputs.phosphorus}</span>
                <span>K {entry.inputs.potassium}</span>
                <span>pH {entry.inputs.ph}</span>
              </div>
              <span className="font-mono text-sm font-semibold text-[var(--color-terracotta)]">
                {entry.top5?.[0]?.confidence}%
              </span>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-md card disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-[var(--color-soil)]">
            {t("history.page", { current: page, total: totalPages })}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-2 rounded-md card disabled:opacity-40"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
