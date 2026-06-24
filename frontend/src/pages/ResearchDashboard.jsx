import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FlaskConical } from "lucide-react";
import { runExplainabilityBenchmark } from "../api/models";

const SAMPLE_INPUT = { nitrogen: 90, phosphorus: 42, potassium: 43, ph: 6.5, temperature: 21, humidity: 82, rainfall: 200 };

export default function ResearchDashboard() {
  const { t } = useTranslation();
  const [result, setResult] = useState(null);
  const [isRunning, setIsRunning] = useState(false);

  const handleRun = async () => {
    setIsRunning(true);
    try {
      const data = await runExplainabilityBenchmark(SAMPLE_INPUT);
      setResult(data);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-display font-semibold">{t("research.title")}</h1>
        <p className="text-[var(--color-soil)] mt-1">{t("research.subtitle")}</p>
      </div>

      <button
        onClick={handleRun}
        disabled={isRunning}
        className="btn-primary py-2.5 px-5 self-start flex items-center gap-2"
      >
        <FlaskConical className="w-4 h-4" />
        {isRunning ? t("common.loading") : t("research.runBenchmark")}
      </button>

      {result && (
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="card p-5">
            <p className="text-xs uppercase tracking-wide text-[var(--color-soil)]">{t("research.shapLatency")}</p>
            <p className="font-mono text-2xl font-semibold mt-1">{result.shap_latency_seconds}s</p>
          </div>
          <div className="card p-5">
            <p className="text-xs uppercase tracking-wide text-[var(--color-soil)]">{t("research.limeLatency")}</p>
            <p className="font-mono text-2xl font-semibold mt-1">{result.lime_latency_seconds}s</p>
          </div>
          <div className="card p-5">
            <p className="text-xs uppercase tracking-wide text-[var(--color-soil)]">{t("research.featureAgreement")}</p>
            <p className="font-mono text-2xl font-semibold mt-1">{result.feature_agreement_count} / 3</p>
          </div>
          <div className="card p-5">
            <p className="text-xs uppercase tracking-wide text-[var(--color-soil)]">{t("research.consistencyScore")}</p>
            <p className="font-mono text-2xl font-semibold mt-1">{result.consistency_score}</p>
          </div>
        </div>
      )}
    </div>
  );
}
