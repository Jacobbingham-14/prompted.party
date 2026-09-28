import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// A tab opened before a deploy still references the previous build's code
// files, which no longer exist. Reload once to pick up the new build rather
// than showing a blank page.
window.addEventListener("vite:preloadError", (event) => {
  // At most one reload per minute, so a genuinely broken file can't loop.
  const key = "reloadedForNewBuildAt";
  const last = Number(sessionStorage.getItem(key) ?? 0);
  if (Date.now() - last < 60_000) return;
  sessionStorage.setItem(key, String(Date.now()));
  event.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(<App />);
