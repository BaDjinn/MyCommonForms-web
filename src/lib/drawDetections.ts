import { type DetectedField, type FieldType } from "../workers/inference.worker";

export interface FieldColors {
  background: string;
  label: string;
}

type DrawableFieldKind = FieldType | "TextBoxMultiline";

export const FIELD_COLORS: Record<DrawableFieldKind, FieldColors> = {
  ChoiceButton: {
    background: "#a4dcf891",
    label: "#10B981",
  },
  Signature: {
    background: "#a4dcf891",
    label: "#F59E0B",
  },
  TextBox: {
    background: "#a4dcf891",
    label: "#3B82F6",
  },
  TextBoxMultiline: {
    background: "#86efac91",
    label: "#16A34A",
  },
};

const LABEL_BAR_HEIGHT = 12.5;
const LABEL_FONT = "10px Arial";
const LABEL_TEXT_COLOR = "white";
const LABEL_PADDING_X = 3;
const LABEL_PADDING_Y = 3;
const TEXTBOX_VERTICAL_PADDING_RATIO = 0.5;
const TEXTBOX_LINE_GAP_RATIO = 0.5;
const MULTILINE_MIN_LINES = 2;

interface PdfMetadata {
  originalWidth: number;
  originalHeight: number;
  canvasSize: number;
  offsetX: number;
  offsetY: number;
}

interface DrawDetectionsOptions {
  textBoxFontSize: number;
}

export const getEstimatedLineCapacity = (fieldHeight: number, fontSize: number): number => {
  const verticalPadding = fontSize * TEXTBOX_VERTICAL_PADDING_RATIO;
  const lineGap = fontSize * TEXTBOX_LINE_GAP_RATIO;
  const usableHeight = fieldHeight - 2 * verticalPadding;

  if (usableHeight < fontSize) {
    return 1;
  }

  return Math.max(1, Math.floor((usableHeight + lineGap) / (fontSize + lineGap)));
};

const getPdfFieldHeight = (field: DetectedField, pdfMetadata: PdfMetadata): number => {
  const [, , , normalizedHeight] = field.bbox;
  const { originalHeight, canvasSize, offsetY } = pdfMetadata;
  const canvasHeight = normalizedHeight * canvasSize;

  return (canvasHeight / (canvasSize - 2 * offsetY)) * originalHeight;
};

const addTextLayoutMetadata = (
  fields: DetectedField[],
  pdfMetadata: PdfMetadata,
  textBoxFontSize: number
): DetectedField[] => {
  return fields.map((field) => {
    if (field.type !== "TextBox") {
      return field;
    }

    const pdfFieldHeight = getPdfFieldHeight(field, pdfMetadata);
    const estimatedLines = getEstimatedLineCapacity(pdfFieldHeight, textBoxFontSize);

    return {
      ...field,
      estimatedLines,
      textLayout: estimatedLines >= MULTILINE_MIN_LINES ? "multiline" : "singleline",
    };
  });
};

const getFieldColors = (field: DetectedField): FieldColors => {
  if (field.type === "TextBox" && field.textLayout === "multiline") {
    return FIELD_COLORS.TextBoxMultiline;
  }

  return FIELD_COLORS[field.type];
};

const getFieldLabel = (field: DetectedField): string => {
  if (field.type === "TextBox" && field.textLayout === "multiline") {
    return `TextBox multiline (${field.estimatedLines ?? 2}L)`;
  }

  if (field.type === "TextBox") {
    return "TextBox singleline";
  }

  return field.type;
};

const drawWidgets = (canvas: HTMLCanvasElement, fields: DetectedField[]): void => {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  fields.forEach((field) => {
    const [normalizedX, normalizedY, normalizedWidth, normalizedHeight] = field.bbox;
    const absoluteX = normalizedX * canvas.width;
    const absoluteY = normalizedY * canvas.height;
    const absoluteWidth = normalizedWidth * canvas.width;
    const absoluteHeight = normalizedHeight * canvas.height;

    const fieldColors = getFieldColors(field);

    context.fillStyle = fieldColors.background;
    context.fillRect(absoluteX, absoluteY, absoluteWidth, absoluteHeight);

    context.fillStyle = fieldColors.label;
    context.fillRect(absoluteX, absoluteY - LABEL_BAR_HEIGHT, absoluteWidth, LABEL_BAR_HEIGHT);

    context.fillStyle = LABEL_TEXT_COLOR;
    context.font = LABEL_FONT;
    const confidencePercentage = (field.confidence * 100).toFixed(0);
    context.fillText(
      `${getFieldLabel(field)} (${confidencePercentage}%)`,
      absoluteX + LABEL_PADDING_X,
      absoluteY - LABEL_PADDING_Y
    );
  });
};

interface PageDetectionDataInput {
  fields: DetectedField[];
  imageData: ImageData;
  pdfMetadata: PdfMetadata;
}

interface PageDetectionDataOutput {
  fields: DetectedField[];
  imageData: string;
  pdfMetadata: PdfMetadata;
}

interface DetectionDataInput {
  pages: PageDetectionDataInput[];
  processingTime: number;
  modelInfo: string;
}

interface DetectionDataOutput {
  pages: PageDetectionDataOutput[];
  processingTime: number;
  modelInfo: string;
}

export const drawDetections = (
  detectionData: DetectionDataInput,
  options: DrawDetectionsOptions
): DetectionDataOutput => {
  const pagesWithDrawings = detectionData.pages.map((page) => {
    const fieldsWithLayout = addTextLayoutMetadata(page.fields, page.pdfMetadata, options.textBoxFontSize);

    const canvas = document.createElement("canvas");
    canvas.width = page.imageData.width;
    canvas.height = page.imageData.height;
    const ctx = canvas.getContext("2d")!;
    ctx.putImageData(page.imageData, 0, 0);

    drawWidgets(canvas, fieldsWithLayout);

    return {
      ...page,
      fields: fieldsWithLayout,
      imageData: canvas.toDataURL(),
    };
  });

  return {
    ...detectionData,
    pages: pagesWithDrawings,
  };
};
