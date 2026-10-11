import { defineConfig } from "vite";

// `base: "./"` keeps asset URLs relative, so the same build serves from the
// repository root, a GitHub Pages project subpath (https://user.github.io/repo/),
// or any other static host without reconfiguring.
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    target: "es2020",
    sourcemap: true,
  },
});
