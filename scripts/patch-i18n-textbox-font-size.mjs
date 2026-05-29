import fs from "node:fs";
import path from "node:path";

const LOCALES_DIR = path.resolve("src/i18n/locales");

const TRANSLATIONS = {
  en: "TextBox font size:",
  it: "Dimensione carattere TextBox:",
  de: "TextBox-Schriftgröße:",
  es: "Tamaño de fuente TextBox:",
  et: "TextBox fondi suurus:",
  fr: "Taille de police TextBox :",
  nl: "TextBox-lettergrootte:",
  pl: "Rozmiar czcionki TextBox:",
  pt: "Tamanho da fonte TextBox:",
};

const localeFiles = fs.readdirSync(LOCALES_DIR).filter((filename) => filename.endsWith(".json"));

for (const filename of localeFiles) {
  const filePath = path.join(LOCALES_DIR, filename);
  const locale = path.basename(filename, ".json");
  const textBoxFontSize = TRANSLATIONS[locale] ?? TRANSLATIONS.en;

  const json = JSON.parse(fs.readFileSync(filePath, "utf8"));

  json.modelSelection ??= {};
  json.detectionResults ??= {};

  json.modelSelection.textBoxFontSize = textBoxFontSize;
  json.detectionResults.textBoxFontSize = textBoxFontSize;

  fs.writeFileSync(filePath, `${JSON.stringify(json, null, 2)}\n`, "utf8");
  console.log(`Patched ${path.relative(process.cwd(), filePath)}`);
}
