import { useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { type DetectedField, type FieldKind } from "../workers/inference.worker";
import { FIELD_KIND_OPTIONS, FIELD_COLORS, getFieldColors, getFieldKindLabel } from "../lib/drawDetections";

interface PageResult {
  fields: DetectedField[];
  imageData: string;
}

interface ProcessingResult {
  pages: PageResult[];
  processingTime: number;
  modelInfo: string;
  pdfWithAcroFieldsBlobUrl: string;
  confidenceThreshold: number;
  textBoxFontSize: number;
}

interface DetectionResultsProps {
  result: ProcessingResult | null;
  onSetFieldEnabled: (fieldId: string, enabled: boolean) => void;
  onSetFieldKind: (fieldId: string, fieldKind: FieldKind) => void;
  onSetFieldName: (fieldId: string, fieldName: string) => void;
}

const getSafeFieldKind = (field: DetectedField): FieldKind => {
  return field.fieldKind ?? "text_single";
};

const blurOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
  if (event.key === "Enter") {
    event.currentTarget.blur();
  }
};

export function DetectionResults({ result, onSetFieldEnabled, onSetFieldKind, onSetFieldName }: DetectionResultsProps) {
  const { t } = useTranslation();
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  if (!result) {
    return null;
  }

  const currentPage = result.pages[currentPageIndex] || result.pages[0];
  const totalFields = result.pages.reduce((sum, page) => sum + page.fields.length, 0);
  const activeFields = result.pages.reduce(
    (sum, page) => sum + page.fields.filter((field) => field.enabled !== false).length,
    0
  );
  const disabledFields = totalFields - activeFields;
  const totalMultilineTextBoxes = result.pages.reduce(
    (sum, page) =>
      sum + page.fields.filter((field) => field.enabled !== false && field.fieldKind === "text_multi").length,
    0
  );

  const handlePreviousPage = () => {
    setCurrentPageIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPageIndex((prev) => Math.min(result.pages.length - 1, prev + 1));
  };

  return (
    <div className="mt-6 md:mt-8 grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6">
      {/* Visualization */}
      <div className="col-span-1 md:col-span-3">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-4">{t("detectionResults.detectedFormFields")}</h2>
        <img
          src={currentPage.imageData}
          alt={`Detected Fields - Page ${currentPageIndex + 1}`}
          className="border border-gray-300 rounded-lg w-full"
          style={{
            imageRendering: "crisp-edges",
            height: "auto",
          }}
        />
        <div className="mt-4 md:mt-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex flex-wrap gap-3 md:gap-4 text-sm">
            {FIELD_KIND_OPTIONS.map((option) => (
              <div key={option.value} className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: FIELD_COLORS[option.value].label }}></div>
                <span>{option.label}</span>
              </div>
            ))}
          </div>
          {result.pages.length > 1 && (
            <div className="flex items-center gap-4">
              <button
                onClick={handlePreviousPage}
                disabled={currentPageIndex === 0}
                className={`px-3 py-1 rounded ${
                  currentPageIndex === 0
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-blue-500 text-white hover:bg-blue-600"
                }`}
              >
                ←
              </button>
              <span className="text-sm font-medium">
                {t("detectionResults.pageOfTotal", {
                  current: currentPageIndex + 1,
                  total: result.pages.length,
                })}
              </span>
              <button
                onClick={handleNextPage}
                disabled={currentPageIndex === result.pages.length - 1}
                className={`px-3 py-1 rounded ${
                  currentPageIndex === result.pages.length - 1
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-blue-500 text-white hover:bg-blue-600"
                }`}
              >
                →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Statistics and manual field review */}
      <div className="col-span-1 md:col-span-1 space-y-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-4">{t("detectionResults.statistics")}</h2>
          <div className="bg-gray-50 rounded-lg p-4 md:p-6 space-y-3 md:space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-600">{t("detectionResults.totalPages")}</span>
              <span className="font-semibold">{result.pages.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t("detectionResults.confidenceThresholdLabel")}</span>
              <span className="font-semibold">{(result.confidenceThreshold * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t("detectionResults.fieldsDetected")}</span>
              <span className="font-semibold">{totalFields}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Campi attivi</span>
              <span className="font-semibold">{activeFields}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Campi spenti</span>
              <span className="font-semibold">{disabledFields}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Text multi</span>
              <span className="font-semibold">{totalMultilineTextBoxes}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t("detectionResults.textBoxFontSize")}</span>
              <span className="font-semibold">{result.textBoxFontSize} pt</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t("detectionResults.currentPage")}</span>
              <span className="font-semibold">{currentPage.fields.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t("detectionResults.processingTime")}</span>
              <span className="font-semibold text-emerald-600">{result.processingTime.toFixed(0)}ms</span>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-3">Field review</h3>
          <div className="bg-gray-50 rounded-lg p-4 space-y-3 max-h-[36rem] overflow-y-auto">
            {currentPage.fields.length === 0 ? (
              <p className="text-sm text-gray-500">No fields detected on this page.</p>
            ) : (
              currentPage.fields.map((field) => {
                const fieldId = field.fieldId;
                const fieldKind = getSafeFieldKind(field);
                const fieldColors = getFieldColors(fieldKind);
                const isEnabled = field.enabled !== false;
                const isManualKind = field.fieldKindSource === "manual";

                if (!fieldId) {
                  return null;
                }

                return (
                  <div
                    key={fieldId}
                    className={`rounded-lg border p-3 space-y-2 ${
                      isEnabled ? "border-gray-200 bg-white" : "border-gray-200 bg-gray-100 opacity-75"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={(event) => onSetFieldEnabled(fieldId, event.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 cursor-pointer shrink-0"
                        style={{ accentColor: fieldColors.label }}
                        title={isEnabled ? "Campo incluso nel PDF" : "Campo escluso dal PDF"}
                      />

                      <input
                        key={`${fieldId}-${field.fieldName}`}
                        defaultValue={field.fieldName ?? fieldId}
                        onBlur={(event) => onSetFieldName(fieldId, event.currentTarget.value)}
                        onKeyDown={blurOnEnter}
                        className="min-w-0 flex-1 bg-transparent border border-transparent rounded px-1 py-0.5 text-sm font-semibold text-gray-900 focus:bg-white focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
                        title="Nome campo AcroForm"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <div
                        className="h-4 w-4 rounded shrink-0"
                        style={{ backgroundColor: isEnabled ? fieldColors.label : "#9CA3AF" }}
                      />
                      <select
                        value={fieldKind}
                        onChange={(event) => onSetFieldKind(fieldId, event.target.value as FieldKind)}
                        className="min-w-0 flex-1 px-2 py-1 border border-gray-300 rounded text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {FIELD_KIND_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="text-xs text-gray-500 flex flex-wrap gap-x-2 gap-y-1">
                      <span>{field.fieldLabel ?? fieldId}</span>
                      <span>{(field.confidence * 100).toFixed(0)}%</span>
                      <span>{getFieldKindLabel(fieldKind)}</span>
                      {typeof field.estimatedLines === "number" && <span>{field.estimatedLines} linee stimate</span>}
                      {isManualKind && <span>manuale</span>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export type { ProcessingResult };
