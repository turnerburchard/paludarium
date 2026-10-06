import { createRoot } from "react-dom/client";
import App from "./App";
import { isWorldLink, readWorldLink } from "./editor/worldLinks";
import "./styles.css";
const root = createRoot(document.getElementById("root")!);
let opening = 0;

async function openWorld() {
  const request = ++opening;
  const hash = location.hash;
  if (!isWorldLink(hash)) {
    root.render(<App key="local" />);
    return;
  }
  // Resolve the layout before mounting the scene, avoiding a flash of another world.
  root.render(
    <main className="world-loading" role="status">
      Opening shared world…
    </main>,
  );
  try {
    const world = await readWorldLink(hash);
    if (request === opening)
      root.render(<App key={hash} sharedWorld={world} />);
  } catch {
    if (request === opening) root.render(<App key={hash} shareError />);
  }
}
window.addEventListener("hashchange", () => void openWorld());
void openWorld();
