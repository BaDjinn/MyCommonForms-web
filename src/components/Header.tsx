import { SettingsMenu } from "./SettingsMenu";
import { type ModelType } from "../lib/modelConfig";

interface HeaderProps {
  selectedModel: ModelType;
  onSelectModel: (model: ModelType) => void;
  textBoxFontSize: number;
  onChangeTextBoxFontSize: (size: number) => void;
  isProcessing: boolean;
}

export function Header(props: HeaderProps) {
  return (
    <header className="mb-8 flex items-center justify-between gap-3 border-b border-slate-800 pb-6">
      <div className="flex min-w-0 items-center gap-3">
        <img src="/icons/localform.svg" alt="" className="h-10 w-10 shrink-0 rounded-lg" />
        <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-50 md:text-3xl">LocalForm</h1>
      </div>
      <SettingsMenu {...props} />
    </header>
  );
}
