import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
//import * as ort from "onnxruntime-web";
import * as pdfjsLib from "pdfjs-dist";
import { detectFormFields, type DetectionResult } from "./lib/formFieldDetection";
import { applyAcroFields } from "./lib/applyAcroFields";
import { ensureValidPDF } from "./lib/ensureValidPDF";
import { drawDetections } from "./lib/drawDetections";
import { ModelSelection, type ModelType, type ModelOption } from "./components/ModelSelection";
import { DetectionResults, type ProcessingResult } from "./components/DetectionResults";
import { ProcessingSteps } from "./components/ProcessingSteps";
import { Header } from "./components/Header";
import { StatusMessage, type Status } from "./components/StatusMessage";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

//ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.0/dist/";

const MODEL_URLS: Record<ModelType, string> = {
  "FFDNet-S": "https://us-beautiful-space.nyc3.cdn.digitaloceanspaces.com/commonforms/FFDNet-S.onnx",
  "FFDNet-L": "https://huggingface.co/jbarrow/FFDNet-L-cpu/resolve/main/FFDNet-L.onnx",
};

const AVAILABLE_MODELS: ModelOption[] = [
  { value: "FFDNet-S", label: "FFDNet-S (faster)" },
  { value: "FFDNet-L", label: "FFDNet-L (more accurate)" },
];

interface ModelConfiguration {
  selectedModel: ModelType;
  confidenceThreshold: number;
  textBoxFontSize: number;
}

interface PdfFileState {
  file: File;
  hasAcrofields: boolean;
}

export function FormFieldsDetection() {
  const { t } = useTranslation();
  const [pdfFile, setPdfFile] = useState<PdfFileState | null>(null);
  const [modelConfiguration, setModelConfiguration] = useState<ModelConfiguration>({
    selectedModel: "FFDNet-S",
    confidenceThreshold: 0.25,
    textBoxFontSize: 9,
  });
  const [rawDetectionResult, setRawDetectionResult] = useState<DetectionResult | null>(null);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfObjectUrlRef = useRef<string | null>(null);
  const regenerationRequestIdRef = useRef(0);

  const revokeCurrentPdfObjectUrl = useCallback(() => {
    if (pdfObjectUrlRef.current) {
      URL.revokeObjectURL(pdfObjectUrlRef.current);
      pdfObjectUrlRef.current = null;
    }
  }, []);

  const clearGeneratedResult = useCallback(() => {
    regenerationRequestIdRef.current += 1;
    revokeCurrentPdfObjectUrl();
    setResult(null);
    setStatus({ type: "idle" });
  }, [revokeCurrentPdfObjectUrl]);

  useEffect(() => {
    return () => {
      revokeCurrentPdfObjectUrl();
    };
  }, [revokeCurrentPdfObjectUrl]);

  const regenerateResultFromDetection = useCallback(
    async (detectionResult: DetectionResult, selectedPdfFile: PdfFileState, textBoxFontSize: number) => {
      if (!detectionResult.success) {
        return;
      }

      const requestId = ++regenerationRequestIdRef.current;

      setStatus({
        type: "loading",
        message: t("statusMessages.applyingAcroFields"),
      });

      const acroFieldsResult = await applyAcroFields({
        pdfFile: selectedPdfFile.file,
        detectionResult,
        stripExistingAcroFields: selectedPdfFile.hasAcrofields,
        textBoxFontSize,
      });

      if (requestId !== regenerationRequestIdRef.current) {
        return;
      }

      if (!acroFieldsResult.success) {
        setStatus({
          type: "error",
          message: t("errors.acroFieldsFailed", {
            errorMessage: acroFieldsResult.error.message,
          }),
        });
        return;
      }

      const pdfBytes = acroFieldsResult.data.pdfBytes;
      const pdfArrayBuffer = new ArrayBuffer(pdfBytes.byteLength);
      new Uint8Array(pdfArrayBuffer).set(pdfBytes);

      const pdfBlob = new Blob([pdfArrayBuffer], {
        type: "application/pdf",
      });

      const pdfWithAcroFieldsBlobUrl = URL.createObjectURL(pdfBlob);

      const detectionDataWithDrawings = drawDetections(detectionResult.data, {
        textBoxFontSize,
      });

      if (requestId !== regenerationRequestIdRef.current) {
        URL.revokeObjectURL(pdfWithAcroFieldsBlobUrl);
        return;
      }

      revokeCurrentPdfObjectUrl();
      pdfObjectUrlRef.current = pdfWithAcroFieldsBlobUrl;

      setResult({
        pages: detectionDataWithDrawings.pages,
        processingTime: detectionResult.data.processingTime,
        modelInfo: detectionResult.data.modelInfo,
        pdfWithAcroFieldsBlobUrl,
        confidenceThreshold: modelConfiguration.confidenceThreshold,
        textBoxFontSize,
      });

      setStatus({ type: "idle" });
    },
    [modelConfiguration.confidenceThreshold, revokeCurrentPdfObjectUrl, t]
  );

  useEffect(() => {
    if (!pdfFile || !rawDetectionResult?.success) {
      return;
    }

    void regenerateResultFromDetection(rawDetectionResult, pdfFile, modelConfiguration.textBoxFontSize);
  }, [pdfFile, rawDetectionResult, modelConfiguration.textBoxFontSize, regenerateResultFromDetection]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file || file.type !== "application/pdf") {
      setStatus({ type: "error", message: t("errors.invalidPdfFile") });
      return;
    }

    clearGeneratedResult();
    setRawDetectionResult(null);

    const validationResult = await ensureValidPDF(file);

    if (!validationResult.success) {
      const errorCode = validationResult.error.code;

      if (errorCode === "pdf_encrypted_or_malformed") {
        setStatus({
          type: "error",
          message: (
            <>
              {t("errors.pdfEncryptedOrMalformed")}{" "}
              <a
                href="https://tools.pdf24.org/en/pdf-to-pdfa"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-red-900"
              >
                tools.pdf24.org
              </a>{" "}
              {t("errors.pdfEncryptedNotAffiliated")}
            </>
          ),
        });
      } else {
        setStatus({
          type: "error",
          message: t("errors.pdfProcessingFailed", {
            errorMessage: validationResult.error.errorMessage || "Unknown error",
          }),
        });
      }
      return;
    }

    setPdfFile({
      file,
      hasAcrofields: validationResult.data.warning?.code === "pdf_has_acrofields",
    });

    if (validationResult.data.warning) {
      setStatus({
        type: "warning",
        message: t("warnings.pdfHasAcrofields", {
          count: validationResult.data.warning.fieldsCount,
        }),
      });
    } else {
      setStatus({ type: "idle" });
    }
  };

  const handleDetectFormFields = async () => {
    if (!pdfFile) {
      return;
    }

    clearGeneratedResult();
    setRawDetectionResult(null);

    const detectionResult = await detectFormFields({
      pdfFile: pdfFile.file,
      modelPath: MODEL_URLS[modelConfiguration.selectedModel],
      confidenceThreshold: modelConfiguration.confidenceThreshold,
      onUpdateDetectionStatus: (status) => {
        const translatedMessage = ((): string => {
          switch (status.type) {
            case "loading_pdf":
              return t("statusMessages.loadingPdf");
            case "running_detection":
              return t("statusMessages.runningDetection", {
                modelName: status.modelName,
              });
            case "processing_page":
              return t("statusMessages.processingPage", {
                current: status.current,
                total: status.total,
              });
          }
        })();

        setStatus({ type: "loading", message: translatedMessage });
      },
    });

    if (!detectionResult.success) {
      setStatus({
        type: "error",
        message: t("errors.detectionFailed", {
          errorMessage: detectionResult.error.message,
        }),
      });
      return;
    }

    setRawDetectionResult(detectionResult);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-indigo-100 p-3 md:p-4">
      <div className="max-w-[96rem] mx-auto">
        <div className="bg-white rounded-lg shadow-xl p-4 md:p-6 lg:p-8">
          <Header />

          <ModelSelection
            selectedModel={modelConfiguration.selectedModel}
            onSelectModel={(model) => {
              clearGeneratedResult();
              setRawDetectionResult(null);
              setModelConfiguration((prev) => ({
                ...prev,
                selectedModel: model,
              }));
            }}
            availableModels={AVAILABLE_MODELS}
            confidenceThreshold={modelConfiguration.confidenceThreshold}
            onChangeConfidenceThreshold={(threshold) => {
              clearGeneratedResult();
              setRawDetectionResult(null);
              setModelConfiguration((prev) => ({
                ...prev,
                confidenceThreshold: threshold,
              }));
            }}
            textBoxFontSize={modelConfiguration.textBoxFontSize}
            onChangeTextBoxFontSize={(fontSize) =>
              setModelConfiguration((prev) => ({
                ...prev,
                textBoxFontSize: fontSize,
              }))
            }
          />

          <ProcessingSteps
            pdfFile={pdfFile?.file ?? null}
            isProcessing={status.type === "loading"}
            hasResult={result !== null}
            pdfWithAcroFieldsBlobUrl={result?.pdfWithAcroFieldsBlobUrl ?? null}
            fileInputRef={fileInputRef}
            onFileSelect={handleFileSelect}
            onDetect={handleDetectFormFields}
          />

          <StatusMessage status={status} />

          <DetectionResults result={result} />
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}