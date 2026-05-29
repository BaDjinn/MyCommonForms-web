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
  onChangeConfidenceThreshold: (threshold: number) => void;
  textBoxFontSize: number | null;
  onChangeTextBoxFontSize: (fontSize: number | null) => void;
}

export function ModelSelection({
  selectedModel,
  onSelectModel,
  availableModels,
  confidenceThreshold,
  onChangeConfidenceThreshold,
  textBoxFontSize,
  onChangeTextBoxFontSize,
}: ModelSelectionProps) {
  const { t } = useTranslation();

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
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t("modelSelection.confidenceThreshold")} {confidenceThreshold.toFixed(2)}
          </label>
          <div className="flex items-center h-10">
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.01"
              value={confidenceThreshold}
              onChange={(e) => onChangeConfidenceThreshold(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t("modelSelection.textBoxFontSize")}{" "}
            {textBoxFontSize === null ? t("modelSelection.auto") : `${textBoxFontSize} pt`}
          </label>
          <input
            type="number"
            min="1"
            max="72"
            step="0.5"
            value={textBoxFontSize ?? ""}
            placeholder={t("modelSelection.auto")}
            onChange={(e) => {
              const value = e.target.value.trim();
              onChangeTextBoxFontSize(value === "" ? null : Number(value));
            }}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>
    </div>
  );
}

export type { ModelType, ModelOption };
