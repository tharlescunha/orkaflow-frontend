import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Identificador do build: vai para o bundle (__BUILD_ID__) e para dist/version.json.
// O painel compara os dois de tempos em tempos e recarrega sozinho quando sai versão nova,
// sem ninguém precisar apertar Ctrl+Shift+R (ver src/hooks/use-version-check.ts).
const buildId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);

function versionFile(): Plugin {
  return {
    name: "orkaflow-version-file",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ build: buildId }) });
    },
    // No dev server o arquivo não existe: responde o mesmo id para o check não disparar reload.
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith("/version.json")) {
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-store");
          res.end(JSON.stringify({ build: buildId }));
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), versionFile()],
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
