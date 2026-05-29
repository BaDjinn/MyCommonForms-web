import { useTranslation } from "react-i18next";

type ModelType = "FFDNet-S" | "FFDNet-L";

interface ModelOption {
  value: ModelType;
  label: string;
}

interface ModelSelectionProps {
  selectedModel: ModelType;
  onSelectModel: (model: ModelType) => void;
  availableModels: ModelOption[];
  confidenceThreshold: number;
  recommendedConfidenceThreshold: number | null;
  onUseRecommendedConfidenceThreshold: (threshold: number) => void;
  onChangeConfidenceThreshold: (threshold: number) => void;
  textBoxFontSize: number;
  onChangeTextBoxFontSize: (fontSize: number) => void;
}

const TEXT_BOX_FONT_SIZE_OPTIONS = [6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 24];
const CONFIDENCE_THRESHOLD_MIN = 0.05;
const CONFIDENCE_THRESHOLD_MAX = 1;

const getSliderPercent = (value: number): number => {
  return ((value - CONFIDENCE_THRESHOLD_MIN) / (CONFIDENCE_THRESHOLD_MAX - CONFIDENCE_THRESHOLD_MIN)) * 100;
};

export function ModelSelection({
  selectedModel,
  onSelectModel,
  availableModels,
  confidenceThreshold,
  recommendedConfidenceThreshold,
  onUseRecommendedConfidenceThreshold,
  onChangeConfidenceThreshold,
  textBoxFontSize,
  onChangeTextBoxFontSize,
}: ModelSelectionProps) {
  const { t } = useTranslation();
  const recommendedPercent =
    recommendedConfidenceThreshold === null
      ? null
      : Math.min(100, Math.max(0, getSliderPercent(recommendedConfidenceThreshold)));

  return (
    <div className="mb-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 max-w-4xl">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{t("modelSelection.selectModel")}</label>
          <select
            value={selectedModel}
            onChange={(e) => onSelectModel(e.target.value as ModelType)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {availableModels.map((model) => (
              <option key={model.value} value={model.value}>
                {model.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <label className="block text-sm font-medium text-gray-700">
              {t("modelSelection.confidenceThreshold")} {confidenceThreshold.toFixed(2)}
            </label>

            {recommendedConfidenceThreshold !== null && (
              <button
                type="button"
                onClick={() => onUseRecommendedConfidenceThreshold(recommendedConfidenceThreshold)}
                className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                title="Use recommended threshold"
              >
                Use {recommendedConfidenceThreshold.toFixed(2)}
              </button>
            )}
          </div>

          <div className="relative flex items-center h-10">
            <input
              type="range"
              min={CONFIDENCE_THRESHOLD_MIN}
              max={CONFIDENCE_THRESHOLD_MAX}
              step="0.01"
              value={confidenceThreshold}
              onChange={(e) => onChangeConfidenceThreshold(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />

            {recommendedPercent !== null && (
              <div
                className="pointer-events-none absolute top-1/2 h-5 w-0.5 -translate-y-1/2 rounded bg-indigo-600"
                style={{ left: `${recommendedPercent}%` }}
                title={`Recommended: ${recommendedConfidenceThreshold?.toFixed(2)}`}
              />
            )}
          </div>

          {recommendedConfidenceThreshold !== null && (
            <div className="mt-1 text-xs text-gray-500">
              Recommended after analysis:{" "}
              <span className="font-semibold text-indigo-700">{recommendedConfidenceThreshold.toFixed(2)}</span>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t("modelSelection.textBoxFontSize")} {textBoxFontSize} pt
          </label>
          <select
            value={textBoxFontSize}
            onChange={(e) => onChangeTextBoxFontSize(Number(e.target.value))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {TEXT_BOX_FONT_SIZE_OPTIONS.map((fontSize) => (
              <option key={fontSize} value={fontSize}>
                {fontSize} pt
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

export type { ModelType, ModelOption };
