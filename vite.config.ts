import { defineConfig } from "vite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { viteStaticCopy } from "vite-plugin-static-copy";

const rootDir = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(rootDir, "dist");

export default defineConfig(({ mode }) => {
  const isContent = mode === "content";

  if (isContent) {
    return {
      build: {
        outDir,
        emptyOutDir: false,
        sourcemap: true,
        lib: {
          entry: resolve(rootDir, "src/content/main.ts"),
          name: "DragToWhateverContent",
          formats: ["iife"],
          fileName: () => "content.js",
        },
        rollupOptions: {
          output: {
            inlineDynamicImports: true,
            assetFileNames: "assets/[name][extname]",
          },
        },
        target: "chrome120",
        minify: false,
      },
    };
  }

  return {
    build: {
      outDir,
      emptyOutDir: true,
      sourcemap: true,
      lib: {
        entry: resolve(rootDir, "src/background/service-worker.ts"),
        formats: ["es"],
        fileName: () => "background.js",
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
      target: "chrome120",
      minify: false,
    },
    plugins: [
      viteStaticCopy({
        targets: [
          { src: "manifest.json", dest: "." },
          { src: "icons/*", dest: "icons" },
        ],
      }),
    ],
  };
});
