// App entry point — mounts the React app into the page.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import ThemeRoot from "./ThemeRoot.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ThemeRoot />
  </StrictMode>,
);
