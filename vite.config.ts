import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  // Mesh-heavy tests compete for CPU when every available worker starts at once,
  // and the longer simulations run for several seconds on a CI runner.
  test: { maxWorkers: 2, testTimeout: 20_000 },
  base: "./",
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/three/build/three.core.js"))
            return "three-core";
          if (id.includes("/node_modules/three/build/three.module.js"))
            return "three-renderer";
          if (
            id.includes("/node_modules/react/") ||
            id.includes("/node_modules/react-dom/") ||
            id.includes("/node_modules/scheduler/")
          )
            return "react";
          if (
            id.includes("/node_modules/@react-three/") ||
            id.includes("/node_modules/three-stdlib/")
          )
            return "scene-controls";
        },
      },
    },
  },
});
