import fs from "node:fs";
import path from "node:path";

const LOCALES_DIR = path.resolve("src/i18n/locales");

const TRANSLATIONS = {
  en: {
    textBoxFontSize: "TextBox font size:",
    auto: "Auto",
  },
  it: {
    textBoxFontSize: "Dimensione carattere TextBox:",
    auto: "Auto",
  },
  de: {
    textBoxFontSize: "TextBox-Schriftgröße:",
    auto: "Auto",
  },
  es: {
    textBoxFontSize: "Tamaño de fuente TextBox:",
    auto: "Auto",
  },
  et: {
    textBoxFontSize: "TextBox fondi suurus:",
    auto: "Auto",
  },
  fr: {
    textBoxFontSize: "Taille de police TextBox :",
    auto: "Auto",
  },
  nl: {
    textBoxFontSize: "TextBox-lettergrootte:",
    auto: "Auto",
  },
  pl: {
    textBoxFontSize: "Rozmiar czcionki TextBox:",
    auto: "Auto",
  },
  pt: {
    textBoxFontSize: "Tamanho da fonte TextBox:",
    auto: "Auto",
  },
};

const getLocaleFromFilename = (filename) => path.basename(filename, ".json");

const patchLocale = (filePath) => {
  const locale = getLocaleFromFilename(filePath);
  const translation = TRANSLATIONS[locale] ?? TRANSLATIONS.en;

  const raw = fs.readFileSync(filePath, "utf8");
  const json = JSON.parse(raw);

  json.modelSelection ??= {};
  json.detectionResults ??= {};

  json.modelSelection.textBoxFontSize = translation.textBoxFontSize;
  json.modelSelection.auto = translation.auto;

  json.detectionResults.textBoxFontSize = translation.textBoxFontSize;
  json.detectionResults.auto = translation.auto;

  fs.writeFileSync(filePath, `${JSON.stringify(json, null, 2)}\n`, "utf8");

  console.log(`Patched ${path.relative(process.cwd(), filePath)}`);
};

const files = fs
  .readdirSync(LOCALES_DIR)
  .filter((filename) => filename.endsWith(".json"))
  .map((filename) => path.join(LOCALES_DIR, filename));

for (const file of files) {
  patchLocale(file);
}
