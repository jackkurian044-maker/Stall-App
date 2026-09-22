import React from "react";
import ReactDOM from "react-dom/client";
import "./global.css";

const publicMatch = window.location.pathname.match(/^\/store\/([^/]+)\/?$/i);
const root = ReactDOM.createRoot(document.getElementById("root"));

async function boot() {
  try {
    const module = publicMatch ? await import("./PublicBusinessPage.jsx") : await import("./App.jsx");
    const Page = module.default;
    root.render(<React.StrictMode><Page listingId={publicMatch ? publicMatch[1] : undefined}/></React.StrictMode>);
  } catch (error) {
    console.error("STall boot failed", error);
    root.render(<div style={{padding:24,fontFamily:"system-ui"}}><h2>STall could not load</h2><p>{error?.message || "Unexpected startup error."}</p></div>);
  }
}
boot();
\n\n// Register STall as a Progressive Web App without changing the app's routing or data flow.\nif ("serviceWorker" in navigator) {\n  window.addEventListener("load", () => {\n    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {\n      console.warn("STall PWA service worker registration failed", error);\n    });\n  });\n}\n