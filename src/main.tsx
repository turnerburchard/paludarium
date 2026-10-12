import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AppBoundary } from "./ui/AppBoundary";
import {
  isWorldLink,
  readShortLink,
  readWorldLink,
  shortLinkId,
} from "./editor/worldLinks";
import "./styles.css";
const root = createRoot(document.getElementById("root")!);
let opening = 0;

/** Each open starts the app afresh, along with a boundary that hasn't caught
 * anything yet. */
function show(request: number, app: ReactNode) {
  root.render(<AppBoundary key={request}>{app}</AppBoundary>);
}

async function openWorld() {
  const request = ++opening;
  const hash = location.hash;
  const id = shortLinkId(location.search);
  if (!id && !isWorldLink(hash)) {
    show(request, <App />);
    return;
  }
  // Resolve the layout before mounting the scene, avoiding a flash of another world.
  root.render(
    <main className="world-loading" role="status">
      Opening shared world…
    </main>,
  );
  try {
    const world = await (id ? readShortLink(id) : readWorldLink(hash));
    if (request !== opening) return;
    // The world now lives in Worlds, so a reload opens it there rather than
    // a fresh copy of the link.
    history.replaceState(null, "", location.pathname);
    show(request, <App sharedWorld={world} />);
  } catch {
    if (request !== opening) return;
    history.replaceState(null, "", location.pathname);
    show(request, <App shareError />);
  }
}
window.addEventListener("hashchange", () => void openWorld());
void openWorld();
