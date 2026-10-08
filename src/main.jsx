import React from "react";
import ReactDOM from "react-dom/client";
import "./global.css";

const publicMatch = window.location.pathname.match(/^\/store\/([^/]+)\/?$/i);
const publicRoot = (window.location.hostname === "stallwale.in" || window.location.hostname === "www.stallwale.in") && window.location.pathname === "/";
const root = ReactDOM.createRoot(document.getElementById("root"));

async function boot() {
  try {
    const module = publicRoot ? await import("./PublicLandingPageFixed.jsx") : publicMatch ? await import("./PublicBusinessPage.jsx") : await import("./App.jsx");
    const Page = module.default;
    root.render(<React.StrictMode><Page listingId={publicMatch ? publicMatch[1] : undefined}/></React.StrictMode>);
  } catch (error) {
    console.error("STall boot failed", error);
    root.render(<div style={{padding:24,fontFamily:"system-ui"}}><h2>STall could not load</h2><p>{error?.message || "Unexpected startup error."}</p></div>);
  }
}
boot();

// Register STall as a Progressive Web App without changing the app's routing or data flow.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js?v=4", { scope: "/" }).catch((error) => {
      console.warn("STall PWA service worker registration failed", error);
    });
  });
}
