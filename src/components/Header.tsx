import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./LanguageSwitcher";
export function Header() {
  const { t } = useTranslation();
  return (
    <header className="mb-8 border-b border-slate-800 pb-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-indigo-500 text-lg font-bold text-white">
              F
            </span>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-50 md:text-3xl">LocalForm</h1>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-slate-400 md:text-base">{t("header.subtitle")}</p>
          <p className="mt-2 text-xs font-medium uppercase tracking-wider text-emerald-400">
            {t("header.runsInBrowser")} · {t("header.privacyFriendly")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LanguageSwitcher />
          <a href="https://simplepdf.com" target="_blank" rel="noopener noreferrer" className="tool-link">
            SimplePDF
          </a>
          <a
            href="https://github.com/BaDjinn/MyCommonForms-web"
            target="_blank"
            rel="noopener noreferrer"
            className="tool-link"
          >
            GitHub
          </a>
          <a href="/__auth/logout" className="tool-link tool-link-danger">
            Logout
          </a>
        </div>
      </div>
    </header>
  );
}
