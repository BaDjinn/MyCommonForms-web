import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "../i18n";
import { AVAILABLE_MODELS, TEXT_BOX_FONT_SIZE_OPTIONS, type ModelType } from "../lib/modelConfig";
import { THEMES, readTheme, saveTheme } from "../lib/theme";

interface SettingsMenuProps {
  selectedModel: ModelType;
  onSelectModel: (value: ModelType) => void;
  textBoxFontSize: number;
  onChangeTextBoxFontSize: (value: number) => void;
  isProcessing: boolean;
}

export function SettingsMenu({
  selectedModel,
  onSelectModel,
  textBoxFontSize,
  onChangeTextBoxFontSize,
  isProcessing,
}: SettingsMenuProps) {
  const { t, i18n } = useTranslation();
  const menuRef = useRef<HTMLDetailsElement>(null);
  const [selectedTheme, setSelectedTheme] = useState(readTheme);

  useEffect(() => {
    function onOutsidePointer(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        menuRef.current.open = false;
      }
    }
    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && menuRef.current?.open) {
        menuRef.current.open = false;
        menuRef.current.querySelector("summary")?.focus();
      }
    }
    document.addEventListener("pointerdown", onOutsidePointer);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", onOutsidePointer);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  return (
    <details ref={menuRef} className="lf-settings">
      <summary className="lf-settings-trigger" aria-label={t("settings.title")} title={t("settings.title")}>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.4 2h3.2l.55 2.25 1.53.64 2.02-1.2 2.26 2.26-1.2 2.02.64 1.53L21.65 10v3.2l-2.25.55-.64 1.53 1.2 2.02-2.26 2.26-2.02-1.2-1.53.64L13.6 21.25h-3.2l-.55-2.25-1.53-.64-2.02 1.2-2.26-2.26 2.02-1.2 1.53.64L10.4 2Z" />
          <circle cx="12" cy="11.6" r="3.1" />
        </svg>
      </summary>
      <div className="lf-settings-menu" role="group" aria-label={t("settings.title")}>
        <h2 className="lf-settings-heading">{t("settings.title")}</h2>
        <fieldset className="lf-settings-group">
          <legend>{t("settings.appearance")}</legend>
          <div className="lf-theme-options">
            {THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                className="lf-theme-option"
                aria-pressed={selectedTheme === theme.id}
                onClick={() => setSelectedTheme(saveTheme(theme.id))}
              >
                <span className="lf-theme-swatches" aria-hidden="true">
                  {theme.colors.map((color) => (
                    <i key={color} style={{ backgroundColor: color }} />
                  ))}
                </span>
                <span>{theme.name}</span>
                {selectedTheme === theme.id && <span className="lf-theme-check" aria-hidden="true">✓</span>}
              </button>
            ))}
          </div>
          <label htmlFor="lf-language">{t("settings.language")}</label>
          <select
            id="lf-language"
            value={i18n.language.split("-")[0]}
            onChange={(event) => void i18n.changeLanguage(event.target.value as SupportedLanguage)}
          >
            {Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </select>
        </fieldset>
        <fieldset className="lf-settings-group">
          <legend>{t("settings.processing")}</legend>
          <label htmlFor="lf-model">{t("settings.model")}</label>
          <select
            id="lf-model"
            value={selectedModel}
            disabled={isProcessing}
            onChange={(event) => onSelectModel(event.target.value as ModelType)}
          >
            {AVAILABLE_MODELS.map((model) => (
              <option key={model.value} value={model.value}>
                {model.label} · {t(model.value === "FFDNet-S" ? "settings.fast" : "settings.accurate")}
              </option>
            ))}
          </select>
          <p className="lf-settings-note">{t("settings.modelWarning")}</p>
        </fieldset>
        <fieldset className="lf-settings-group">
          <legend>{t("settings.pdf")}</legend>
          <label htmlFor="lf-fontsize">{t("settings.fontSize")}</label>
          <select
            id="lf-fontsize"
            value={textBoxFontSize}
            disabled={isProcessing}
            onChange={(event) => onChangeTextBoxFontSize(Number(event.target.value))}
          >
            {TEXT_BOX_FONT_SIZE_OPTIONS.map((value) => (
              <option key={value} value={value}>{value} pt</option>
            ))}
          </select>
        </fieldset>
        <div className="lf-settings-footer">
          <p className="lf-settings-note">{t("settings.about")}: LocalForm</p>
          <a href="/__auth/logout" className="lf-settings-logout">{t("settings.logout")}</a>
        </div>
      </div>
    </details>
  );
}
