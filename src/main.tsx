import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./themes.css";
import { initializeTheme } from "./lib/theme";
import "./i18n";

import { FormFieldsDetection } from "./FormFieldsDetection";

initializeTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FormFieldsDetection />
  </StrictMode>
);
