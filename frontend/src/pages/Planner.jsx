import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { useAuth } from "../context/useAuth";
import { getHistoryEntry } from "../api/history";
import { createPlan } from "../api/plans";

const STRATA_COLORS = [
  "#C97D3F", "#A4632E", "#E0A06A", "#8B6F47", "#5B7553",
];

export default function Planner() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const historyId = searchParams.get("historyId");

  const [crops, setCrops] = useState([]);
  const [totalLand, setTotalLand] = useState(user?.land_area_acres || "");
  const [allocationType, setAllocationType] = useState("equal");
  const [allocations, setAllocations] = useState([]);
  const [planName, setPlanName] = useState("My Land Plan");
  const [saveStatus, setSaveStatus] = useState("");
  const [error, setError] = useState("");

  const computeEqualAllocations = (cropNames) => {
    const equalPct = Math.round((100 / cropNames.length) * 100) / 100;
    const remainder = 100 - equalPct * cropNames.length;
    return cropNames.map((crop, idx) => ({
      crop,
      percentage: idx === 0 ? equalPct + remainder : equalPct,
    }));
  };

  useEffect(() => {
    if (!historyId) return;
    getHistoryEntry(historyId).then((entry) => {
      const cropNames = entry.top5.map((c) => c.crop);
      setCrops(cropNames);
      setAllocations(computeEqualAllocations(cropNames));
    });
  }, [historyId]);

  const handleSelectEqual = () => {
    setAllocationType("equal");
    if (crops.length > 0) setAllocations(computeEqualAllocations(crops));
  };

  const totalPercentage = useMemo(
    () => allocations.reduce((sum, a) => sum + Number(a.percentage || 0), 0),
    [allocations]
  );
  const isValidTotal = Math.abs(totalPercentage - 100) < 0.01;

  const handlePercentageChange = (idx, value) => {
    setAllocationType("custom");
    setAllocations((prev) =>
      prev.map((a, i) => (i === idx ? { ...a, percentage: value } : a))
    );
  };

  const computedAreas = allocations.map((a) => ({
    ...a,
    area: totalLand ? Math.round(((Number(a.percentage) || 0) / 100) * totalLand * 1000) / 1000 : 0,
  }));

  const handleSave = async () => {
    setError("");
    if (!isValidTotal) {
      setError(t("planner.mustEqual100"));
      return;
    }
    if (!totalLand || totalLand <= 0) {
      setError(t("planner.totalLand"));
      return;
    }
    try {
      await createPlan({
        plan_name: planName,
        total_land_acres: parseFloat(totalLand),
        allocation_type: allocationType,
        history_id: historyId ? parseInt(historyId, 10) : null,
        allocations: allocations.map((a) => ({
          crop: a.crop,
          percentage: parseFloat(a.percentage) || 0,
        })),
      });
      setSaveStatus(t("planner.planSaved"));
    } catch (err) {
      setError(err.response?.data?.error || t("common.error"));
    }
  };

  if (crops.length === 0) {
    return (
      <div className="card p-8 text-center max-w-md mx-auto">
        <p className="text-[var(--color-soil)]">
          Get a crop recommendation first to plan your land allocation.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-display font-semibold">{t("planner.title")}</h1>
        <p className="text-[var(--color-soil)] mt-1">{t("planner.subtitle")}</p>
      </div>

      <div className="card p-6 grid sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium block mb-1">{t("planner.planName")}</label>
          <input value={planName} onChange={(e) => setPlanName(e.target.value)} className="input-field w-full px-3 py-2" />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">{t("planner.totalLand")}</label>
          <input
            type="number"
            min="0.1"
            step="0.1"
            value={totalLand}
            onChange={(e) => setTotalLand(e.target.value)}
            className="input-field w-full px-3 py-2 font-mono"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSelectEqual}
          className={`px-4 py-2 rounded-md text-sm font-medium ${
            allocationType === "equal" ? "btn-primary" : "card"
          }`}
        >
          {t("planner.equalAllocation")}
        </button>
        <button
          onClick={() => setAllocationType("custom")}
          className={`px-4 py-2 rounded-md text-sm font-medium ${
            allocationType === "custom" ? "btn-primary" : "card"
          }`}
        >
          {t("planner.customAllocation")}
        </button>
      </div>

      <div className="card p-6 flex flex-col sm:flex-row gap-6">
        <div className="flex-1 flex flex-col gap-3">
          {computedAreas.map((a, idx) => (
            <div key={a.crop} className="flex items-center gap-3">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: STRATA_COLORS[idx % STRATA_COLORS.length] }}
              />
              <span className="capitalize font-medium flex-1">
                {t(`crops.${a.crop}`, { defaultValue: a.crop })}
              </span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={a.percentage}
                onChange={(e) => handlePercentageChange(idx, e.target.value)}
                className="input-field w-20 px-2 py-1 text-right font-mono text-sm"
              />
              <span className="text-sm text-[var(--color-soil)] w-2">%</span>
              <span className="font-mono text-sm w-20 text-right text-[var(--color-soil)]">
                {a.area} ac
              </span>
            </div>
          ))}

          <div className={`flex justify-between text-sm font-semibold pt-2 border-t border-[var(--color-soil)]/15 ${
            isValidTotal ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"
          }`}>
            <span>{t("planner.totalAllocated")}</span>
            <span className="font-mono">{Math.round(totalPercentage * 100) / 100}%</span>
          </div>
        </div>

        <div className="w-full sm:w-48 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={computedAreas}
                dataKey="percentage"
                nameKey="crop"
                cx="50%"
                cy="50%"
                outerRadius={70}
                innerRadius={35}
              >
                {computedAreas.map((_, idx) => (
                  <Cell key={idx} fill={STRATA_COLORS[idx % STRATA_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${value}%`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {error && (
        <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger)]/10 rounded-md px-3 py-2">
          {error}
        </div>
      )}
      {saveStatus && (
        <div className="text-sm text-[var(--color-success)] bg-[var(--color-success)]/10 rounded-md px-3 py-2">
          {saveStatus}
        </div>
      )}

      <button onClick={handleSave} disabled={!isValidTotal} className="btn-primary py-2.5">
        {t("planner.savePlan")}
      </button>
    </div>
  );
}
