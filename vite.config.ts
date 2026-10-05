import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  // The Cloudflare plugin emits a worker/client split build for wrangler; on
  // Vercel (process.env.VERCEL) skip it so vite build outputs plain dist/.
  plugins: [react(), ...(process.env.VERCEL ? [] : [cloudflare()])],
});
