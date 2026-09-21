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
