import {
  HeartPulse,
  HelpCircle,
  SlidersHorizontal,
  Sprout,
} from "lucide-react";
import type { Editor } from "../editor/useEditor";
import type { EcosystemController } from "../simulation/useEcosystem";
import { EnvironmentPanel } from "./EnvironmentPanel";
import { Library } from "./Library";
import { LifePanel } from "./LifePanel";

export type Panel = "objects" | "habitat" | "life";

export function Sidebar({
  editor,
  ecosystem,
  panel,
  onPanel,
  onHelp,
}: {
  editor: Editor;
  ecosystem: EcosystemController;
  panel: Panel;
  onPanel: (panel: Panel) => void;
  onHelp: () => void;
}) {
  return (
    <aside className="sidebar" aria-label="Terrarium tools">
      <div className="panel-tabs">
        <button
          className={panel === "objects" ? "active" : ""}
          onClick={() => onPanel("objects")}
        >
          <Sprout size={17} />
          Add to your world
        </button>
        <button
          className={panel === "habitat" ? "active" : ""}
          onClick={() => onPanel("habitat")}
          title="Habitat settings"
          aria-label="Habitat settings"
        >
          <SlidersHorizontal size={17} />
        </button>
        <button
          className={panel === "life" ? "active" : ""}
          onClick={() => onPanel("life")}
          title="Habitat life"
          aria-label="Habitat life"
        >
          <HeartPulse size={17} />
        </button>
      </div>
      <div className="panel-content">
        {panel === "objects" ? (
          <Library editor={editor} />
        ) : panel === "habitat" ? (
          <EnvironmentPanel editor={editor} />
        ) : (
          <LifePanel
            world={editor.world}
            ecosystem={ecosystem}
            selectedId={editor.selectedId}
            paused={editor.paused}
          />
        )}
      </div>
      <div className="sidebar-footer">
        <span>{editor.world.objects.length} inhabitants & objects</span>
        <button onClick={onHelp} aria-label="Controls and help">
          <HelpCircle size={16} />
        </button>
      </div>
    </aside>
  );
}
