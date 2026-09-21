import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Firebase Hosting serves the app from the domain root.
  // Absolute asset paths are required for /business/:listingId routes.
  base: "/",
});
