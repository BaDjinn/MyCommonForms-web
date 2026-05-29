import { PDFDocument, rgb } from "pdf-lib";
import type { DetectionResult } from "./formFieldDetection";
import { addFieldMetadata, makeUniqueFieldName, type FieldOverrides, type PdfMetadata } from "./drawDetections";

interface ApplyAcroFieldsParameters {
  pdfFile: File;
  detectionResult: DetectionResult;
  stripExistingAcroFields: boolean;
  textBoxFontSize: number;
  fieldOverrides: FieldOverrides;
  confidenceThreshold: number;
}

type ApplyAcroFieldsErrorCode =
  | "invalid_detection_result"
  | "pdf_load_failed"
  | "field_creation_failed"
  | "pdf_save_failed"
  | "unknown_error";

export type ApplyAcroFieldsResult =
  | { success: true; data: { pdfBytes: Uint8Array } }
  | {
      success: false;
      error: { code: ApplyAcroFieldsErrorCode; message: string };
    };

const removeWidgetAppearance = (widgets: any[]): void => {
  widgets.forEach((widget) => {
    const widgetDict = widget.dict;
    const mkDict = widgetDict.context.obj({});
    widgetDict.set(widgetDict.context.obj("MK"), mkDict);
  });
};

const getPdfCoordinates = (
  bbox: [number, number, number, number],
  pdfMetadata: PdfMetadata,
  pageHeight: number
): { x: number; y: number; width: number; height: number } => {
  const [x, y, w, h] = bbox;
  const { originalWidth, originalHeight, canvasSize, offsetX, offsetY } = pdfMetadata;

  const canvasX = x * canvasSize;
  const canvasY = y * canvasSize;
  const canvasW = w * canvasSize;
  const canvasH = h * canvasSize;

  const pdfX = ((canvasX - offsetX) / (canvasSize - 2 * offsetX)) * originalWidth;
  const pdfY = ((canvasY - offsetY) / (canvasSize - 2 * offsetY)) * originalHeight;
  const pdfW = (canvasW / (canvasSize - 2 * offsetX)) * originalWidth;
  const pdfH = (canvasH / (canvasSize - 2 * offsetY)) * originalHeight;

  return {
    x: pdfX,
    y: pageHeight - (pdfY + pdfH),
    width: pdfW,
    height: pdfH,
  };
};

export const applyAcroFields = async (parameters: ApplyAcroFieldsParameters): Promise<ApplyAcroFieldsResult> => {
  const { pdfFile, detectionResult, stripExistingAcroFields, textBoxFontSize, fieldOverrides, confidenceThreshold } =
    parameters;

  if (!detectionResult.success) {
    return {
      success: false,
      error: {
        code: "invalid_detection_result",
        message: `Detection result was not successful: ${detectionResult.error.message}`,
      },
    };
  }

  try {
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);

    if (stripExistingAcroFields) {
      try {
        const form = pdfDoc.getForm();
        const existingFields = form.getFields();

        if (existingFields.length > 0) {
          form.flatten();
        }
      } catch (e) {
        const error = e as Error;
        console.error(`Failed to flatten existing form fields: ${error.name}: ${error.message}`);
        // Fail silently - better to add detected fields alongside existing ones than to fail entirely
      }
    }

    const form = pdfDoc.getForm();
    const pages = pdfDoc.getPages();
    const usedFieldNames = new Set<string>();

    for (let pageIndex = 0; pageIndex < detectionResult.data.pages.length; pageIndex++) {
      const pageData = detectionResult.data.pages[pageIndex];
      const pdfPage = pages[pageIndex];
      const { height: pageHeight } = pdfPage.getSize();

      const fieldsWithMetadata = addFieldMetadata(
        pageData.fields,
        pageIndex,
        pageData.pdfMetadata,
        textBoxFontSize,
        fieldOverrides,
        confidenceThreshold
      );

      for (const field of fieldsWithMetadata) {
        if (field.enabled === false || !field.fieldKind || !field.fieldName) {
          continue;
        }

        const fieldName = makeUniqueFieldName(field.fieldName, usedFieldNames);
        const { x, y, width, height } = getPdfCoordinates(field.bbox, pageData.pdfMetadata, pageHeight);

        try {
          switch (field.fieldKind) {
            case "text_single": {
              const textField = form.createTextField(fieldName);
              textField.addToPage(pdfPage, {
                x,
                y,
                width,
                height,
                borderWidth: 0,
                textColor: rgb(0, 0, 0),
              });
              textField.setFontSize(textBoxFontSize);
              removeWidgetAppearance(textField.acroField.getWidgets());
              break;
            }

            case "text_multi": {
              const textField = form.createTextField(fieldName);
              textField.addToPage(pdfPage, {
                x,
                y,
                width,
                height,
                borderWidth: 0,
                textColor: rgb(0, 0, 0),
              });
              textField.setFontSize(textBoxFontSize);
              textField.enableMultiline();
              removeWidgetAppearance(textField.acroField.getWidgets());
              break;
            }

            case "checkbox": {
              const checkBox = form.createCheckBox(fieldName);
              checkBox.addToPage(pdfPage, {
                x,
                y,
                width,
                height,
                borderWidth: 0,
              });
              removeWidgetAppearance(checkBox.acroField.getWidgets());
              break;
            }

            case "signature": {
              const signatureField = form.createTextField(fieldName);
              signatureField.addToPage(pdfPage, {
                x,
                y,
                width,
                height,
                borderWidth: 0,
                textColor: rgb(0, 0, 0),
              });
              signatureField.setFontSize(textBoxFontSize);
              removeWidgetAppearance(signatureField.acroField.getWidgets());
              break;
            }

            default:
              console.error(`Unsupported field kind: ${field.fieldKind satisfies never}`);
              break;
          }
        } catch (e) {
          const error = e as Error;
          return {
            success: false,
            error: {
              code: "field_creation_failed",
              message: `Failed to create field ${fieldName}: ${error.name}: ${error.message}`,
            },
          };
        }
      }
    }

    const pdfBytes = await pdfDoc.save();

    return {
      success: true,
      data: {
        pdfBytes,
      },
    };
  } catch (e) {
    const error = e as Error;
    if (error.message.includes("load")) {
      return {
        success: false,
        error: {
          code: "pdf_load_failed",
          message: `Failed to load PDF: ${error.name}: ${error.message}`,
        },
      };
    }
    if (error.message.includes("save")) {
      return {
        success: false,
        error: {
          code: "pdf_save_failed",
          message: `Failed to save PDF: ${error.name}: ${error.message}`,
        },
      };
    }
    return {
      success: false,
      error: {
        code: "unknown_error",
        message: `Failed to apply AcroFields: ${error.name}: ${error.message}`,
      },
    };
  }
};
