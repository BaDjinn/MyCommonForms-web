import { type DetectedField, type FieldKind, type TextLayout } from "../workers/inference.worker";

export interface FieldColors {
  background: string;
  label: string;
}

export interface FieldOverride {
  enabled?: boolean;
  fieldName?: string;
  fieldKind?: FieldKind;
}

export type FieldOverrides = Record<string, FieldOverride>;

export const FIELD_COLORS: Record<FieldKind, FieldColors> = {
  text_single: {
    background: "#bfdbfe91",
    label: "#3B82F6",
  },
  text_multi: {
    background: "#86efac91",
    label: "#16A34A",
  },
  signature: {
    background: "#fde68a91",
    label: "#F59E0B",
  },
  checkbox: {
    background: "#ddd6fe91",
    label: "#8B5CF6",
  },
};

const FIELD_KIND_LABELS: Record<FieldKind, string> = {
  text_single: "Text single",
  text_multi: "Text multi",
  signature: "Signature",
  checkbox: "Checkbox",
};

const FIELD_NAME_PREFIXES: Record<FieldKind, string> = {
  text_single: "text",
  text_multi: "text_multi",
  signature: "signature",
  checkbox: "checkbox",
};

const LABEL_BAR_HEIGHT = 12.5;
const LABEL_FONT = "10px Arial";
const LABEL_TEXT_COLOR = "white";
const LABEL_PADDING_X = 3;
const LABEL_PADDING_Y = 3;
const TEXTBOX_VERTICAL_PADDING_RATIO = 0.5;
const TEXTBOX_LINE_GAP_RATIO = 0.5;
export const MULTILINE_MIN_LINES = 2;

export interface PdfMetadata {
  originalWidth: number;
  originalHeight: number;
  canvasSize: number;
  offsetX: number;
  offsetY: number;
}

interface DrawDetectionsOptions {
  textBoxFontSize: number;
  fieldOverrides: FieldOverrides;
}

export const FIELD_KIND_OPTIONS: Array<{ value: FieldKind; label: string }> = [
  { value: "text_single", label: FIELD_KIND_LABELS.text_single },
  { value: "text_multi", label: FIELD_KIND_LABELS.text_multi },
  { value: "signature", label: FIELD_KIND_LABELS.signature },
  { value: "checkbox", label: FIELD_KIND_LABELS.checkbox },
];

export const getFieldKindLabel = (fieldKind: FieldKind): string => {
  return FIELD_KIND_LABELS[fieldKind];
};

export const getFieldId = (pageIndex: number, fieldIndex: number): string => {
  return `page-${pageIndex + 1}-field-${fieldIndex + 1}`;
};

export const sanitizeFieldName = (rawName: string): string => {
  return rawName
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
};

export const makeUniqueFieldName = (baseName: string, usedFieldNames: Set<string>): string => {
  const sanitizedBaseName = sanitizeFieldName(baseName) || "field";
  let candidate = sanitizedBaseName;
  let suffix = 2;

  while (usedFieldNames.has(candidate)) {
    candidate = `${sanitizedBaseName}_${suffix}`;
    suffix += 1;
  }

  usedFieldNames.add(candidate);
  return candidate;
};

export const getEstimatedLineCapacity = (fieldHeight: number, fontSize: number): number => {
  const verticalPadding = fontSize * TEXTBOX_VERTICAL_PADDING_RATIO;
  const lineGap = fontSize * TEXTBOX_LINE_GAP_RATIO;
  const usableHeight = fieldHeight - 2 * verticalPadding;

  if (usableHeight < fontSize) {
    return 1;
  }

  return Math.max(1, Math.floor((usableHeight + lineGap) / (fontSize + lineGap)));
};

export const getPdfFieldHeight = (field: DetectedField, pdfMetadata: PdfMetadata): number => {
  const [, , , normalizedHeight] = field.bbox;
  const { originalHeight, canvasSize, offsetY } = pdfMetadata;
  const canvasHeight = normalizedHeight * canvasSize;

  return (canvasHeight / (canvasSize - 2 * offsetY)) * originalHeight;
};

export const getAutoFieldKind = (
  field: DetectedField,
  pdfMetadata: PdfMetadata,
  textBoxFontSize: number
): { fieldKind: FieldKind; estimatedLines?: number; textLayout?: TextLayout } => {
  if (field.type === "ChoiceButton") {
    return { fieldKind: "checkbox" };
  }

  if (field.type === "Signature") {
    return { fieldKind: "signature" };
  }

  const pdfFieldHeight = getPdfFieldHeight(field, pdfMetadata);
  const estimatedLines = getEstimatedLineCapacity(pdfFieldHeight, textBoxFontSize);
  const textLayout: TextLayout = estimatedLines >= MULTILINE_MIN_LINES ? "multiline" : "singleline";

  return {
    fieldKind: textLayout === "multiline" ? "text_multi" : "text_single",
    estimatedLines,
    textLayout,
  };
};

export const getDefaultFieldName = (fieldKind: FieldKind, pageIndex: number, fieldIndex: number): string => {
  return `${FIELD_NAME_PREFIXES[fieldKind]}_${pageIndex + 1}_${fieldIndex + 1}`;
};

export const getEffectiveFieldName = (
  fieldId: string,
  fieldKind: FieldKind,
  pageIndex: number,
  fieldIndex: number,
  fieldOverrides: FieldOverrides
): string => {
  const overrideName = fieldOverrides[fieldId]?.fieldName;
  const sanitizedOverrideName = overrideName ? sanitizeFieldName(overrideName) : "";

  return sanitizedOverrideName || getDefaultFieldName(fieldKind, pageIndex, fieldIndex);
};

export const getFieldColors = (fieldKind: FieldKind): FieldColors => {
  return FIELD_COLORS[fieldKind];
};

export const addFieldMetadata = (
  fields: DetectedField[],
  pageIndex: number,
  pdfMetadata: PdfMetadata,
  textBoxFontSize: number,
  fieldOverrides: FieldOverrides
): DetectedField[] => {
  return fields.map((field, fieldIndex) => {
    const fieldId = getFieldId(pageIndex, fieldIndex);
    const autoFieldInfo = getAutoFieldKind(field, pdfMetadata, textBoxFontSize);
    const fieldOverride = fieldOverrides[fieldId];
    const fieldKind = fieldOverride?.fieldKind ?? autoFieldInfo.fieldKind;
    const enabled = fieldOverride?.enabled ?? true;
    const fieldName = getEffectiveFieldName(fieldId, fieldKind, pageIndex, fieldIndex, fieldOverrides);
    const textLayout: TextLayout | undefined =
      fieldKind === "text_multi" ? "multiline" : fieldKind === "text_single" ? "singleline" : autoFieldInfo.textLayout;

    return {
      ...field,
      fieldId,
      fieldLabel: `F${fieldIndex + 1}`,
      fieldName,
      fieldKind,
      fieldKindSource: fieldOverride?.fieldKind ? "manual" : "auto",
      enabled,
      estimatedLines: autoFieldInfo.estimatedLines,
      textLayout,
    };
  });
};

const getFieldLabel = (field: DetectedField): string => {
  const fieldKind = field.fieldKind ?? "text_single";
  const manualSuffix = field.fieldKindSource === "manual" ? " manual" : "";
  const fieldName = field.fieldName ? ` · ${field.fieldName}` : "";

  return `${field.fieldLabel ?? "Field"} ${getFieldKindLabel(fieldKind)}${manualSuffix}${fieldName}`;
};

const drawWidgets = (canvas: HTMLCanvasElement, fields: DetectedField[]): void => {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  fields.forEach((field) => {
    if (field.enabled === false || !field.fieldKind) {
      return;
    }

    const [normalizedX, normalizedY, normalizedWidth, normalizedHeight] = field.bbox;
    const absoluteX = normalizedX * canvas.width;
    const absoluteY = normalizedY * canvas.height;
    const absoluteWidth = normalizedWidth * canvas.width;
    const absoluteHeight = normalizedHeight * canvas.height;

    const fieldColors = getFieldColors(field.fieldKind);

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
  const pagesWithDrawings = detectionData.pages.map((page, pageIndex) => {
    const fieldsWithMetadata = addFieldMetadata(
      page.fields,
      pageIndex,
      page.pdfMetadata,
      options.textBoxFontSize,
      options.fieldOverrides
    );

    const canvas = document.createElement("canvas");
    canvas.width = page.imageData.width;
    canvas.height = page.imageData.height;
    const ctx = canvas.getContext("2d")!;
    ctx.putImageData(page.imageData, 0, 0);

    drawWidgets(canvas, fieldsWithMetadata);

    return {
      ...page,
      fields: fieldsWithMetadata,
      imageData: canvas.toDataURL(),
    };
  });

  return {
    ...detectionData,
    pages: pagesWithDrawings,
  };
};
