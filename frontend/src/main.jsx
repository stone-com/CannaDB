import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import ThemeRoot from "./ThemeRoot.jsx";

// React app entry point and top-level providers.
// We mount the entire React tree into the single #root element in index.html.
createRoot(document.getElementById("root")).render(
  <StrictMode>
    {/* StrictMode helps catch side effects and unsafe lifecycle patterns in development. */}
    <ThemeRoot />
  </StrictMode>,
);
