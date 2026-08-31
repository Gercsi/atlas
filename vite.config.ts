import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
export default defineConfig({
  plugins: [vue()],
  root: "frontend",
  base: "./",
  build: {
    outDir: "../public",
    emptyOutDir: false,
    rollupOptions: {
      input: ["frontend/index.html", "frontend/proof.html"],
      output: {
        manualChunks: { graph: ["cytoscape"], pdf: ["jspdf"], vue: ["vue"] },
      },
    },
  },
});
