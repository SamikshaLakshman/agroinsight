import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Award, Info } from "lucide-react";
import { getModelPerformance } from "../api/models";

const MODEL_LABELS = { knn: "KNN", random_forest: "Random Forest", xgboost: "XGBoost" };
const MODEL_COLORS = {
  knn: "var(--color-soil)",
  random_forest: "var(--color-sage)",
  xgboost: "var(--color-terracotta)",
};

const METRIC_INFO = [
  {
    key: "accuracy",
    label: "Accuracy",
    formula: "Correct Predictions / Total Predictions",
    description: "The proportion of all predictions that the model got right. A high accuracy means the model rarely misclassifies crops, but it can be misleading if some crops appear far more often than others in the dataset.",
  },
  {
    key: "precision",
    label: "Precision",
    formula: "True Positives / (True Positives + False Positives)",
    description: "Of all the times the model predicted a specific crop, how often was it actually that crop? High precision means fewer false alarms — the model doesn't recommend a crop unless it's confident.",
  },
  {
    key: "recall",
    label: "Recall",
    formula: "True Positives / (True Positives + False Negatives)",
    description: "Of all the times a crop was actually the correct answer, how often did the model catch it? High recall means the model rarely misses a crop that should have been recommended.",
  },
  {
    key: "f1_score",
    label: "F1 Score",
    formula: "2 × (Precision × Recall) / (Precision + Recall)",
    description: "The harmonic mean of precision and recall. It balances both metrics — a high F1 means the model is both precise and thorough. This is the single best metric when you care equally about false positives and false negatives.",
  },
  {
    key: "cv_mean_f1",
    label: "Cross-Validation F1",
    formula: "Average F1 across k independent train/test splits",
    description: "The model is trained and tested k times on different slices of the data, and the F1 scores are averaged. This guards against overfitting — a high CV F1 means the model generalises well to unseen soil samples, not just the data it was trained on.",
  },
];

export default function ModelDashboard() {
  const { t } = useTranslation();
  const [report, setReport] = useState(null);

  useEffect(() => {
    getModelPerformance().then(setReport);
  }, []);

  if (!report) return <p className="text-[var(--color-soil)] text-sm">{t("common.loading")}</p>;

  // One row per metric; each model contributes its own keyed value
  const comparisonData = METRIC_INFO.map(({ key, label }) => {
    const row = { metric: label };
    Object.entries(report.metrics).forEach(([name, m]) => {
      row[name] = Math.round(m[key] * 1000) / 10;
    });
    return row;
  });

  const best = report.metrics[report.best_model];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-display font-semibold">{t("models.title")}</h1>
        <p className="text-[var(--color-soil)] mt-1">{t("models.subtitle")}</p>
      </div>

      {/* Best model highlight */}
      <div className="card p-6 flex items-center gap-4 bg-[var(--color-terracotta)]/10">
        <div className="p-3 rounded-full bg-[var(--color-terracotta)]/20">
          <Award className="w-6 h-6 text-[var(--color-terracotta)]" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--color-soil)]">{t("models.bestModel")}</p>
          <p className="font-display font-semibold text-xl capitalize">
            {MODEL_LABELS[report.best_model] || report.best_model}
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-[var(--color-soil)]">{t("models.accuracy")}</p>
          <p className="font-mono text-2xl font-semibold text-[var(--color-terracotta)]">
            {Math.round(best.accuracy * 1000) / 10}%
          </p>
        </div>
      </div>

      {/* Per-model metric cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        {Object.entries(report.metrics).map(([name, m]) => (
          <div
            key={name}
            className="card p-5"
            style={{ borderLeft: `4px solid ${MODEL_COLORS[name] || "var(--color-soil)"}` }}
          >
            <h3 className="font-display font-semibold capitalize mb-3">{MODEL_LABELS[name] || name}</h3>
            <dl className="text-sm flex flex-col gap-1.5 font-mono">
              {METRIC_INFO.map(({ key, label }) => (
                <div key={key} className="flex justify-between">
                  <dt className="text-[var(--color-soil)] font-sans">{label}</dt>
                  <dd>{Math.round(m[key] * 1000) / 10}%</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      {/* All metrics bar chart — all 5 metrics, all 3 models, each model a different color */}
      <div className="card p-6">
        <h3 className="font-display font-semibold mb-1">All Metrics — Model Comparison</h3>
        <p className="text-xs text-[var(--color-soil)] mb-4">
          All five metrics for each model, side by side.
        </p>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={comparisonData}>
            <XAxis dataKey="metric" stroke="var(--color-soil)" fontSize={12} />
            <YAxis stroke="var(--color-soil)" fontSize={12} domain={[0, 100]} unit="%" />
            <Tooltip formatter={(value) => `${value}%`} />
            <Legend
              formatter={(value) => MODEL_LABELS[value] || value}
              wrapperStyle={{ fontSize: 12 }}
            />
            {Object.keys(report.metrics).map((name) => (
              <Bar
                key={name}
                dataKey={name}
                name={name}
                fill={MODEL_COLORS[name] || "var(--color-soil)"}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Metric explanations */}
      <div className="card p-6">
        <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
          <Info className="w-5 h-5 text-[var(--color-sage)]" />
          What Each Metric Means
        </h3>
        <div className="flex flex-col gap-5">
          {METRIC_INFO.map(({ key, label, formula, description }) => (
            <div key={key}>
              <h4 className="font-display font-semibold text-sm">{label}</h4>
              <p className="text-xs font-mono text-[var(--color-sage)] mt-0.5 mb-1">{formula}</p>
              <p className="text-sm text-[var(--color-soil)] leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-[var(--color-soil)] font-mono">
        {t("models.trainedAt")}: {report.trained_at} · {t("models.datasetSize")}: {report.dataset_rows}
      </p>
    </div>
  );
}
