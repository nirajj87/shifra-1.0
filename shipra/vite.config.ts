import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { missingQuestionsPlugin } from "./vite.missing-plugin";
import { systemCommandsPlugin } from "./vite.system-plugin";
import { webSearchPlugin } from "./vite.web-plugin";

export default defineConfig({
  plugins: [
    react(),
    missingQuestionsPlugin(),
    systemCommandsPlugin(),
    webSearchPlugin(),
  ],
  base: "/shifra/",
});
