import React, { useEffect } from "react";
import PublicLandingPage from "./PublicLandingPageClay";

export default function PublicLandingPageFixed() {
  useEffect(() => {
    const root = document.getElementById("stall-public-landing");
    if (!root) return;
    const routes = {
      "Help Center": "https://stall.stallwale.in/help.html",
      "FAQs": "https://stall.stallwale.in/faq.html",
      "Privacy Policy": "https://stall.stallwale.in/privacy.html",
      "Terms & Conditions": "https://stall.stallwale.in/terms.html",
      "Contact Us": "https://stall.stallwale.in/contact.html"
    };
    root.querySelectorAll("a").forEach((link) => {
      const label = link.textContent.trim();
      if (routes[label]) link.href = routes[label];
    });
  }, []);
  return <PublicLandingPage />;
}
