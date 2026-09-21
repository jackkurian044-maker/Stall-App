import React from "react";
import ReactDOM from "react-dom/client";
import "./global.css";
import PublicBusinessPage from "./PublicBusinessPage.jsx";

const match = window.location.pathname.match(/^\/store\/([^/]+)\/?$/i);
const listingId = match ? match[1] : "";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <PublicBusinessPage listingId={listingId} />
  </React.StrictMode>
);
