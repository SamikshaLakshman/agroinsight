/**
 * StrataBar - the signature visual element of AgroInsight.
 *
 * Renders a crop's confidence score as a horizontal soil-layer band: deeper,
 * more saturated terracotta for higher confidence, lighter and more
 * desaturated for lower confidence — visually echoing soil strata, which
 * ties the one deliberate design risk directly to the agronomy subject
 * matter rather than using a generic progress bar.
 */

import { useTranslation } from "react-i18next";

export default function StrataBar({ rank, crop, confidence, isBest }) {
  const { t } = useTranslation();
  const cropLabel = t(`crops.${crop}`, { defaultValue: crop });

  // Map confidence (0-100) to a terracotta intensity band.
  const intensity = Math.max(0.18, confidence / 100);

  return (
    <div
      className={`relative overflow-hidden rounded-lg card flex items-center gap-4 p-4 ${
        isBest ? "ring-2 ring-[var(--color-terracotta)]" : ""
      }`}
    >
      <div
        className="absolute inset-y-0 left-0"
        style={{
          width: `${confidence}%`,
          backgroundColor: `color-mix(in srgb, var(--color-terracotta) ${Math.round(intensity * 70 + 10)}%, transparent)`,
          transition: "width 0.6s ease-out",
        }}
        aria-hidden="true"
      />
      <div className="relative z-10 flex items-center gap-4 w-full">
        <span className="font-mono text-xs text-[var(--color-soil)] w-5 text-center">
          {rank}
        </span>
        <span className="font-display font-semibold capitalize flex-1">
          {cropLabel}
        </span>
        <span className="font-mono text-sm font-semibold tabular-nums">
          {confidence}%
        </span>
        {isBest && (
          <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full bg-[var(--color-terracotta)] text-white">
            Best
          </span>
        )}
      </div>
    </div>
  );
}
