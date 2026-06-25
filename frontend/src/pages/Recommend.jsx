import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CloudRain, Thermometer, Droplets, Info, TrendingUp, TrendingDown } from "lucide-react";
import { useAuth } from "../context/useAuth";
import { getRecommendation, getLimeExplanation } from "../api/recommend";
import StrataBar from "../components/StrataBar";

const FIELDS = [
  { key: "nitrogen", labelKey: "recommend.nitrogen", min: 0, max: 140 },
  { key: "phosphorus", labelKey: "recommend.phosphorus", min: 5, max: 145 },
  { key: "potassium", labelKey: "recommend.potassium", min: 5, max: 205 },
  { key: "ph", labelKey: "recommend.ph", min: 3.5, max: 10, step: "0.1" },
];

function ShapBar({ contribution, maxAbsShap, t }) {
  const absVal = Math.abs(contribution.shap_value);
  const barWidth = maxAbsShap > 0 ? (absVal / maxAbsShap) * 100 : 0;
  const isPositive = contribution.shap_value > 0;

  const featureLabel = t(`features.${contribution.feature}`, { defaultValue: contribution.feature_label });
  const featureDescription = t(`featureDescriptions.${contribution.feature}`, { defaultValue: "" });
  const effectText = t(
    isPositive ? "recommend.shapPositiveEffect" : "recommend.shapNegativeEffect"
  );

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isPositive ? (
            <TrendingUp className="w-3.5 h-3.5 text-[var(--color-success)]" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5 text-[var(--color-danger)]" />
          )}
          <span className="text-sm font-semibold">{featureLabel}</span>
          <span className="text-xs font-mono text-[var(--color-soil)]">= {contribution.value}</span>
        </div>
        <span
          className={`text-xs font-mono font-semibold ${
            isPositive ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"
          }`}
        >
          {isPositive ? "+" : ""}{contribution.shap_value}
        </span>
      </div>

      {/* Horizontal bar */}
      <div className="w-full h-2.5 rounded-full bg-[var(--color-soil)]/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${barWidth}%`,
            backgroundColor: isPositive
              ? "var(--color-success)"
              : "var(--color-danger)",
          }}
        />
      </div>

      <p className="text-xs text-[var(--color-soil)] leading-relaxed">
        {featureDescription}
        {featureDescription ? " — " : ""}
        {effectText}
      </p>
    </div>
  );
}

export default function Recommend() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [form, setForm] = useState({ nitrogen: "", phosphorus: "", potassium: "", ph: "" });
  const [result, setResult] = useState(null);
  const [limeResult, setLimeResult] = useState(null);
  const [isLoadingLime, setIsLoadingLime] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setResult(null);
    setLimeResult(null);
    setIsSubmitting(true);
    try {
      const data = await getRecommendation({
        nitrogen: parseFloat(form.nitrogen),
        phosphorus: parseFloat(form.phosphorus),
        potassium: parseFloat(form.potassium),
        ph: parseFloat(form.ph),
      });
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.error || t("common.error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewLime = async () => {
    if (!result) return;
    setIsLoadingLime(true);
    try {
      const data = await getLimeExplanation(result.history_id);
      setLimeResult(data);
    } catch {
      setError(t("common.error"));
    } finally {
      setIsLoadingLime(false);
    }
  };

  if (!user?.city) {
    return (
      <div className="card p-8 text-center max-w-md mx-auto flex flex-col items-center gap-3">
        <Info className="w-8 h-8 text-[var(--color-warning)]" />
        <p>{t("recommend.noCityWarning")}</p>
        <Link to="/profile" className="btn-primary px-4 py-2 inline-block">
          {t("recommend.goToProfile")}
        </Link>
      </div>
    );
  }

  // Compute max absolute SHAP value for bar scaling
  const contributions = result?.shap_explanation?.contributions || [];
  const maxAbsShap = contributions.length > 0
    ? Math.max(...contributions.map((c) => Math.abs(c.shap_value)))
    : 1;

  return (
    <div className="flex flex-col gap-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-display font-semibold">{t("recommend.title")}</h1>
        <p className="text-[var(--color-soil)] mt-1">
          {t("recommend.subtitle", { city: user.city })}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 grid grid-cols-2 gap-4">
        {FIELDS.map((field) => (
          <div key={field.key}>
            <label className="text-sm font-medium block mb-1">{t(field.labelKey)}</label>
            <input
              type="number"
              required
              min={field.min}
              max={field.max}
              step={field.step || "1"}
              placeholder={`${field.min} - ${field.max}`}
              value={form[field.key]}
              onChange={update(field.key)}
              className="input-field w-full px-3 py-2 font-mono"
            />
          </div>
        ))}

        {error && (
          <div className="col-span-2 text-sm text-[var(--color-danger)] bg-[var(--color-danger)]/10 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <button type="submit" disabled={isSubmitting} className="btn-primary py-2.5 col-span-2 mt-1">
          {isSubmitting ? t("recommend.analyzing") : t("recommend.submitButton")}
        </button>
      </form>

      {result && (
        <div className="flex flex-col gap-6">

          {/* Weather card */}
          <div className="card p-4 flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-soil)]">
                {result.weather?.source === "fallback"
                  ? t("recommend.weatherFallback")
                  : t("recommend.weatherFetched", { city: user.city })}
              </span>

              <div className="flex items-center gap-4 font-mono">
                <span className="flex items-center gap-1">
                  <Thermometer className="w-4 h-4" />
                  {result.weather?.temperature ?? "--"}°C
                </span>

                <span className="flex items-center gap-1">
                  <Droplets className="w-4 h-4" />
                  {result.weather?.humidity ?? "--"}%
                </span>

                <span className="flex items-center gap-1">
                  <CloudRain className="w-4 h-4" />
                  {result.weather?.rainfall ?? "--"} mm
                </span>
              </div>
            </div>

            {result.weather?.source === "fallback" && result.weather?.fallback_reason && (
              <p className="text-xs text-[var(--color-warning)] font-mono">
                {t("recommend.weatherFallbackReason", { reason: result.weather.fallback_reason })}
              </p>
            )}
          </div>

          {/* Top 5 crops */}
          <div>
            <h2 className="font-display font-semibold text-lg mb-3">
              {t("recommend.resultsTitle")}
            </h2>

            <div className="flex flex-col gap-2">
              {result.top5.map((c) => (
                <StrataBar
                  key={c.rank}
                  rank={c.rank}
                  crop={c.crop}
                  confidence={c.confidence}
                  isBest={c.rank === 1}
                />
              ))}
            </div>

            <p className="text-xs text-[var(--color-soil)] mt-2 font-mono">
              {t("recommend.modelUsed")}: {result.model_used}
            </p>
          </div>

          {/* SHAP Explanation */}
          <div className="card p-6">
            <div className="mb-5">
              <h3 className="font-display font-semibold text-lg mb-1">
                {t("recommend.whyThisCrop")} — SHAP Explanation
              </h3>
            </div>

            <h4 className="text-xs uppercase tracking-wide text-[var(--color-soil)] mb-4">
              {t("recommend.factorsHeading")}
            </h4>

            <div className="flex flex-col gap-5">
              {contributions.map((c) => (
                <ShapBar
                  key={c.feature}
                  contribution={c}
                  maxAbsShap={maxAbsShap}
                  t={t}
                />
              ))}
            </div>

            {/* LIME section */}
            <div className="mt-6 pt-5 border-t border-[var(--color-soil)]/15">
              {!limeResult ? (
                <button
                  onClick={handleViewLime}
                  disabled={isLoadingLime}
                  className="text-sm text-[var(--color-sage)] font-medium flex items-center gap-1"
                >
                  {isLoadingLime
                    ? t("common.loading")
                    : t("recommend.viewLime")}
                </button>
              ) : (
                <div>
                  <ul className="text-sm flex flex-col gap-1 font-mono">
                    {limeResult.explanation.map((item, idx) => (
                      <li key={idx} className="flex justify-between">
                        <span>{item.rule}</span>
                        <span
                          className={
                            item.weight > 0
                              ? "text-[var(--color-success)]"
                              : "text-[var(--color-danger)]"
                          }
                        >
                          {item.weight > 0 ? "+" : ""}
                          {item.weight}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
