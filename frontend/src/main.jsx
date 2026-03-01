import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

// This is the React entry file.
// createRoot(...) tells React where to render the app in the HTML page.
// The HTML file has a <div id="root"></div> placeholder for this.
// StrictMode is a development helper that warns about risky patterns.
// It does not change behavior in production builds.
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
