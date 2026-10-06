import {
  ChevronDown,
  Download,
  HeartPulse,
  HelpCircle,
  SlidersHorizontal,
  Sprout,
  Upload,
} from "lucide-react";
import type { Editor } from "../editor/useEditor";
import type { EcosystemController } from "../simulation/useEcosystem";
import { EnvironmentPanel } from "./EnvironmentPanel";
import { IconButton } from "./IconButton";
import { Library } from "./Library";
import { LifePanel } from "./LifePanel";

export type Panel = "objects" | "habitat" | "life";

export function Sidebar({
  hidden = false,
  editor,
  ecosystem,
  panel,
  onPanel,
  onHelp,
  onWatch,
  onClose,
  onExport,
  onImport,
}: {
  hidden?: boolean;
  editor: Editor;
  ecosystem: EcosystemController;
  panel: Panel;
  onPanel: (panel: Panel) => void;
  onHelp: () => void;
  onWatch: (id: string) => void;
  /** Phones show the sidebar as a sheet that can be closed. */
  onClose: () => void;
  onExport: () => void;
  onImport: () => void;
}) {
  return (
    <aside hidden={hidden} className="sidebar" aria-label="Terrarium tools">
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
        <span className="sheet-only sheet-close">
          <IconButton label="Close panel" onClick={onClose}>
            <ChevronDown size={18} />
          </IconButton>
        </span>
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
            onWatch={onWatch}
          />
        )}
      </div>
      <div className="sidebar-footer">
        <span>{editor.world.objects.length} inhabitants & objects</span>
        <span className="sheet-only">
          <button onClick={onExport} aria-label="Export world">
            <Download size={16} />
          </button>
          <button onClick={onImport} aria-label="Import world">
            <Upload size={16} />
          </button>
        </span>
        <button onClick={onHelp} aria-label="Controls and help">
          <HelpCircle size={16} />
        </button>
      </div>
    </aside>
  );
}
