import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from "recharts";
import { Award } from "lucide-react";
import { getModelPerformance } from "../api/models";

const MODEL_LABELS = { knn: "KNN", random_forest: "Random Forest", xgboost: "XGBoost" };

export default function ModelDashboard() {
  const { t } = useTranslation();
  const [report, setReport] = useState(null);

  useEffect(() => {
    getModelPerformance().then(setReport);
  }, []);

  if (!report) return <p className="text-[var(--color-soil)] text-sm">{t("common.loading")}</p>;

  const barData = Object.entries(report.metrics).map(([name, m]) => ({
    name: MODEL_LABELS[name] || name,
    accuracy: Math.round(m.accuracy * 100),
    f1: Math.round(m.f1_score * 100),
    cv_f1: Math.round(m.cv_mean_f1 * 100),
  }));

  const radarData = ["accuracy", "precision", "recall", "f1_score", "cv_mean_f1"].map((metric) => {
    const point = { metric: metric.replace("_", " ") };
    Object.entries(report.metrics).forEach(([name, m]) => {
      point[MODEL_LABELS[name] || name] = Math.round(m[metric] * 100);
    });
    return point;
  });

  const best = report.metrics[report.best_model];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-display font-semibold">{t("models.title")}</h1>
        <p className="text-[var(--color-soil)] mt-1">{t("models.subtitle")}</p>
      </div>

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

      <div className="grid sm:grid-cols-3 gap-4">
        {Object.entries(report.metrics).map(([name, m]) => (
          <div key={name} className="card p-5">
            <h3 className="font-display font-semibold capitalize mb-3">{MODEL_LABELS[name] || name}</h3>
            <dl className="text-sm flex flex-col gap-1.5 font-mono">
              <div className="flex justify-between"><dt className="text-[var(--color-soil)] font-sans">{t("models.accuracy")}</dt><dd>{Math.round(m.accuracy * 1000) / 10}%</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--color-soil)] font-sans">{t("models.precision")}</dt><dd>{Math.round(m.precision * 1000) / 10}%</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--color-soil)] font-sans">{t("models.recall")}</dt><dd>{Math.round(m.recall * 1000) / 10}%</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--color-soil)] font-sans">{t("models.f1Score")}</dt><dd>{Math.round(m.f1_score * 1000) / 10}%</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--color-soil)] font-sans">{t("models.crossValidation")}</dt><dd>{Math.round(m.cv_mean_f1 * 1000) / 10}%</dd></div>
            </dl>
          </div>
        ))}
      </div>

      <div className="card p-6">
        <h3 className="font-display font-semibold mb-4">Accuracy & F1 by Model</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={barData}>
            <XAxis dataKey="name" stroke="var(--color-soil)" fontSize={12} />
            <YAxis stroke="var(--color-soil)" fontSize={12} />
            <Tooltip />
            <Bar dataKey="accuracy" fill="var(--color-sage)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="cv_f1" fill="var(--color-terracotta)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card p-6">
        <h3 className="font-display font-semibold mb-4">Multi-Metric Comparison</h3>
        <ResponsiveContainer width="100%" height={320}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="var(--color-soil-light)" />
            <PolarAngleAxis dataKey="metric" stroke="var(--color-soil)" fontSize={11} />
            <PolarRadiusAxis stroke="var(--color-soil-light)" />
            <Radar name="KNN" dataKey="KNN" stroke="var(--color-soil)" fill="var(--color-soil)" fillOpacity={0.15} />
            <Radar name="Random Forest" dataKey="Random Forest" stroke="var(--color-sage)" fill="var(--color-sage)" fillOpacity={0.2} />
            <Radar name="XGBoost" dataKey="XGBoost" stroke="var(--color-terracotta)" fill="var(--color-terracotta)" fillOpacity={0.2} />
            <Tooltip />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <p className="text-xs text-[var(--color-soil)] font-mono">
        {t("models.trainedAt")}: {report.trained_at} · {t("models.datasetSize")}: {report.dataset_rows}
      </p>
    </div>
  );
}
