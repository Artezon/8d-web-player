import { defineConfig } from "vite";
import { ViteMinifyPlugin } from "vite-plugin-minify";
import { viteSingleFile } from "vite-plugin-singlefile";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    ViteMinifyPlugin(),
    viteSingleFile(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: false,
      workbox: {
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: /.*/,
            handler: "NetworkFirst",
            options: {
              cacheName: "app-cache",
              networkTimeoutSeconds: 3,
            },
          },
        ],
      },
    }),
  ],
});
