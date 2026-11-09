export type ModelType = "FFDNet-S" | "FFDNet-L";

export const AVAILABLE_MODELS: ReadonlyArray<{ value: ModelType; label: string }> = [
  { value: "FFDNet-S", label: "FFDNet-S" },
  { value: "FFDNet-L", label: "FFDNet-L" },
];

export const MODEL_URLS: Record<ModelType, string> = {
  "FFDNet-S": "https://us-beautiful-space.nyc3.cdn.digitaloceanspaces.com/commonforms/FFDNet-S.onnx",
  "FFDNet-L": "https://huggingface.co/jbarrow/FFDNet-L-cpu/resolve/main/FFDNet-L.onnx",
};

export const TEXT_BOX_FONT_SIZE_OPTIONS = [6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 24] as const;
const MODEL_KEY = "localform.model.v1";
const FONT_SIZE_KEY = "localform.fontsize.v1";

export function readModelPreference(): ModelType {
  try {
    return window.localStorage.getItem(MODEL_KEY) === "FFDNet-L" ? "FFDNet-L" : "FFDNet-S";
  } catch {
    return "FFDNet-S";
  }
}

export function saveModelPreference(model: ModelType): void {
  try {
    window.localStorage.setItem(MODEL_KEY, model);
  } catch {
    // Storage may be unavailable.
  }
}

export function readFontSizePreference(): number {
  try {
    const value = Number(window.localStorage.getItem(FONT_SIZE_KEY));
    return (TEXT_BOX_FONT_SIZE_OPTIONS as readonly number[]).includes(value) ? value : 9;
  } catch {
    return 9;
  }
}

export function saveFontSizePreference(value: number): void {
  if (!(TEXT_BOX_FONT_SIZE_OPTIONS as readonly number[]).includes(value)) return;
  try {
    window.localStorage.setItem(FONT_SIZE_KEY, String(value));
  } catch {
    // Storage may be unavailable.
  }
}
