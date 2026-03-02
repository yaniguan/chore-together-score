import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "icon.svg", "icon-*.png"],
      manifest: {
        name: "Chore Together Score",
        short_name: "ChoreScore",
        description: "Track household chores and points together",
        theme_color: "#0D9488",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          { src: "icon-72.png",  sizes: "72x72",   type: "image/png" },
          { src: "icon-96.png",  sizes: "96x96",   type: "image/png" },
          { src: "icon-128.png", sizes: "128x128", type: "image/png" },
          { src: "icon-144.png", sizes: "144x144", type: "image/png" },
          { src: "icon-152.png", sizes: "152x152", type: "image/png" },
          { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icon-384.png", sizes: "384x384", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      workbox: {
        // Cache the app shell and static assets
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // Network-first for API calls (Supabase), cache-first for assets
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api",
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
