import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FlaskConical, Info, CheckCircle, XCircle } from "lucide-react";
import { runExplainabilityBenchmark } from "../api/models";

const SAMPLE_INPUT = {
  nitrogen: 90, phosphorus: 42, potassium: 43,
  ph: 6.5, temperature: 21, humidity: 82, rainfall: 200,
};

function ComparisonRow({ label, shap, lime, shapWins }) {
  return (
    <div className="grid grid-cols-3 gap-4 items-center py-3 border-b border-[var(--color-soil)]/10 last:border-0">
      <span className="text-sm font-medium">{label}</span>
      <span className={`font-mono text-sm text-center ${shapWins ? "font-semibold text-[var(--color-success)]" : ""}`}>
        {shap}
      </span>
      <span className={`font-mono text-sm text-center ${!shapWins ? "font-semibold text-[var(--color-success)]" : ""}`}>
        {lime}
      </span>
    </div>
  );
}

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
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-display font-semibold">{t("research.title")}</h1>
        <p className="text-[var(--color-soil)] mt-1">{t("research.subtitle")}</p>
      </div>

      {/* Explanation of both methods */}
      <div className="card p-6 flex flex-col gap-4">
        <h2 className="font-display font-semibold">What are SHAP and LIME?</h2>

        <div className="grid sm:grid-cols-2 gap-4 text-sm text-[var(--color-soil)] leading-relaxed">
          <div>
            <h3 className="font-semibold text-[var(--color-ink)] dark:text-[var(--color-paper)] mb-1">SHAP (SHapley Additive exPlanations)</h3>
            <p>
              Based on game theory (Shapley values). Each feature gets a fair contribution score by considering
              every possible combination of features. It is model-aware — it uses the internal structure of
              the trained model — so explanations are mathematically consistent and always sum to the prediction.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-[var(--color-ink)] dark:text-[var(--color-paper)] mb-1">LIME (Local Interpretable Model-agnostic Explanations)</h3>
            <p>
              Perturbs the input many times, observes how the prediction changes, and fits a simple linear model
              around the neighbourhood of the input. It is model-agnostic — it treats the model as a black box —
              but the random perturbations make results less stable across runs.
            </p>
          </div>
        </div>
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
        <>
          {/* Side-by-side comparison table */}
          <div className="card p-6">
            <h3 className="font-display font-semibold mb-4">SHAP vs LIME — Head-to-Head</h3>

            <div className="grid grid-cols-3 gap-4 pb-2 border-b-2 border-[var(--color-soil)]/20 mb-1">
              <span className="text-xs uppercase tracking-wide text-[var(--color-soil)]">Metric</span>
              <span className="text-xs uppercase tracking-wide text-center text-[var(--color-sage)]">SHAP</span>
              <span className="text-xs uppercase tracking-wide text-center text-[var(--color-terracotta)]">LIME</span>
            </div>

            <ComparisonRow
              label="Latency"
              shap={`${result.shap_latency_seconds}s`}
              lime={`${result.lime_latency_seconds}s`}
              shapWins={result.shap_latency_seconds <= result.lime_latency_seconds}
            />
            <ComparisonRow
              label="Mathematical Consistency"
              shap="Yes — values sum to prediction"
              lime="No — approximation only"
              shapWins={true}
            />
            <ComparisonRow
              label="Run-to-Run Stability"
              shap="Deterministic"
              lime="Varies (random perturbations)"
              shapWins={true}
            />
            <ComparisonRow
              label="Model Awareness"
              shap="Model-specific (uses internals)"
              lime="Model-agnostic (black box)"
              shapWins={true}
            />
            <ComparisonRow
              label="Top Features Identified"
              shap={result.shap_top_features.join(", ")}
              lime={result.lime_top_features.join(", ")}
              shapWins={false}
            />
            <ComparisonRow
              label="Feature Agreement"
              shap={`${result.feature_agreement_count} / 3`}
              lime={`${result.feature_agreement_count} / 3`}
              shapWins={false}
            />
          </div>

          {/* Why SHAP is the primary method */}
          <div className="card p-6 bg-[var(--color-sage)]/5">
            <h3 className="font-display font-semibold mb-3 flex items-center gap-2">
              <Info className="w-5 h-5 text-[var(--color-sage)]" />
              Why SHAP is Our Primary Explanation Method
            </h3>
            <div className="flex flex-col gap-3 text-sm text-[var(--color-soil)] leading-relaxed">
              <div className="flex gap-2">
                <CheckCircle className="w-4 h-4 text-[var(--color-success)] flex-shrink-0 mt-0.5" />
                <span><strong className="text-[var(--color-ink)] dark:text-[var(--color-paper)]">Mathematically grounded:</strong> SHAP values are derived from Shapley values in cooperative game theory. Each feature's contribution is computed fairly, and they always add up exactly to the model's prediction — no approximation gap.</span>
              </div>
              <div className="flex gap-2">
                <CheckCircle className="w-4 h-4 text-[var(--color-success)] flex-shrink-0 mt-0.5" />
                <span><strong className="text-[var(--color-ink)] dark:text-[var(--color-paper)]">Deterministic:</strong> Given the same input and model, SHAP always produces the same explanation. LIME's random perturbation approach means you can get different top features on different runs, which undermines trust.</span>
              </div>
              <div className="flex gap-2">
                <CheckCircle className="w-4 h-4 text-[var(--color-success)] flex-shrink-0 mt-0.5" />
                <span><strong className="text-[var(--color-ink)] dark:text-[var(--color-paper)]">Global + Local:</strong> SHAP explanations work both for individual predictions (why this specific crop?) and for understanding the model's overall behaviour across the entire dataset.</span>
              </div>
              <div className="flex gap-2">
                <XCircle className="w-4 h-4 text-[var(--color-terracotta)] flex-shrink-0 mt-0.5" />
                <span><strong className="text-[var(--color-ink)] dark:text-[var(--color-paper)]">LIME's trade-off:</strong> LIME is model-agnostic, which is useful when you can't access model internals. But for AgroInsight, we own the models — so LIME's flexibility isn't needed, and its instability is a drawback. We keep LIME available as a secondary cross-check.</span>
              </div>
            </div>
          </div>

          {/* Raw metrics grid */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="card p-5">
              <p className="text-xs uppercase tracking-wide text-[var(--color-soil)]">{t("research.shapLatency")}</p>
              <p className="font-mono text-2xl font-semibold mt-1">{result.shap_latency_seconds}s</p>
              <p className="text-xs text-[var(--color-soil)] mt-1">Time to compute one SHAP explanation</p>
            </div>
            <div className="card p-5">
              <p className="text-xs uppercase tracking-wide text-[var(--color-soil)]">{t("research.limeLatency")}</p>
              <p className="font-mono text-2xl font-semibold mt-1">{result.lime_latency_seconds}s</p>
              <p className="text-xs text-[var(--color-soil)] mt-1">Time to compute one LIME explanation</p>
            </div>
            <div className="card p-5">
              <p className="text-xs uppercase tracking-wide text-[var(--color-soil)]">{t("research.featureAgreement")}</p>
              <p className="font-mono text-2xl font-semibold mt-1">{result.feature_agreement_count} / 3</p>
              <p className="text-xs text-[var(--color-soil)] mt-1">How many of the top-3 features both methods agree on</p>
            </div>
            <div className="card p-5">
              <p className="text-xs uppercase tracking-wide text-[var(--color-soil)]">{t("research.consistencyScore")}</p>
              <p className="font-mono text-2xl font-semibold mt-1">{result.consistency_score}</p>
              <p className="text-xs text-[var(--color-soil)] mt-1">Agreement ratio (1.0 = perfect agreement)</p>
            </div>
          </div>

          {/* Top features side by side */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="card p-5">
              <h3 className="font-display font-semibold mb-2">SHAP Top Features</h3>
              <ul className="flex flex-wrap gap-2">
                {result.shap_top_features.map((f) => (
                  <li key={f} className="text-xs font-mono px-2 py-1 rounded-md bg-[var(--color-sage)]/15 text-[var(--color-sage)]">
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="card p-5">
              <h3 className="font-display font-semibold mb-2">LIME Top Features</h3>
              <ul className="flex flex-wrap gap-2">
                {result.lime_top_features.map((f) => (
                  <li key={f} className="text-xs font-mono px-2 py-1 rounded-md bg-[var(--color-terracotta)]/15 text-[var(--color-terracotta)]">
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
