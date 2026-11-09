import { useTranslation } from "react-i18next";

const MIN = 0.05;
const MAX = 1;

interface ConfidenceControlProps {
  confidenceThreshold: number;
  recommendedConfidenceThreshold: number | null;
  onUseRecommendedConfidenceThreshold: (threshold: number) => void;
  onChangeConfidenceThreshold: (threshold: number) => void;
}

export function ConfidenceControl({
  confidenceThreshold,
  recommendedConfidenceThreshold,
  onUseRecommendedConfidenceThreshold,
  onChangeConfidenceThreshold,
}: ConfidenceControlProps) {
  const { t } = useTranslation();
  const recommendedPercent =
    recommendedConfidenceThreshold === null
      ? null
      : Math.min(100, Math.max(0, ((recommendedConfidenceThreshold - MIN) / (MAX - MIN)) * 100));

  return (
    <section className="mb-6 max-w-xl" aria-label={t("modelSelection.confidenceThreshold")}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <label htmlFor="confidence-threshold" className="text-sm font-medium text-gray-700">
          {t("modelSelection.confidenceThreshold")} {confidenceThreshold.toFixed(2)}
        </label>
        {recommendedConfidenceThreshold !== null && (
          <button
            type="button"
            onClick={() => onUseRecommendedConfidenceThreshold(recommendedConfidenceThreshold)}
            className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
          >
            {t("settings.useRecommended", { value: recommendedConfidenceThreshold.toFixed(2) })}
          </button>
        )}
      </div>
      <div className="relative flex h-10 items-center">
        <input
          id="confidence-threshold"
          type="range"
          min={MIN}
          max={MAX}
          step="0.01"
          value={confidenceThreshold}
          onChange={(event) => onChangeConfidenceThreshold(Number(event.target.value))}
          className="h-2 w-full cursor-pointer accent-indigo-500"
        />
        {recommendedPercent !== null && (
          <span
            className="pointer-events-none absolute top-1/2 h-5 w-0.5 -translate-y-1/2 bg-indigo-500"
            style={{ left: `${recommendedPercent}%` }}
            title={t("settings.recommended", { value: recommendedConfidenceThreshold?.toFixed(2) })}
          />
        )}
      </div>
    </section>
  );
}
