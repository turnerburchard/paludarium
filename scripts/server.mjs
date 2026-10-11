/** Starts Vite for a browser check or script. Each run takes a free port, so
 * checks running side by side, or in another session, never share a server. */
import { createServer, preview as startPreview } from "vite";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const listen = { host: "127.0.0.1", port: 0 };

/** `preview` serves the production build in dist/; otherwise the dev server. */
export async function startServer({ preview = false } = {}) {
  const server = preview
    ? await startPreview({ root, logLevel: "warn", preview: listen })
    : await (
        await createServer({
          root,
          logLevel: "warn",
          // Without this, saving a source file mid-run, as another session
          // working in the checkout does, reloads the page under the check.
          server: { ...listen, hmr: false, watch: null },
        })
      ).listen();
  const { port } = server.httpServer.address();
  return {
    url: `http://127.0.0.1:${port}`,
    stop: () => server.close(),
  };
}
