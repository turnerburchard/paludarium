import {
  Component,
  useEffect,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import {
  Leaf,
  Undo2,
  Redo2,
  Download,
  Upload,
  Plus,
  Check,
  Pause,
  Play,
  Maximize2,
  Eye,
  ArrowLeft,
  Move,
  RotateCw,
  Copy,
  Trash2,
  X,
  MousePointer2,
  SlidersHorizontal,
  Sprout,
  HelpCircle,
  HeartPulse,
} from "lucide-react";
import { useEcosystem } from "./simulation/useEcosystem";
import { LifePanel } from "./ui/LifePanel";
import { useEditor } from "./editor/useEditor";
import { downloadWorld, parseWorld } from "./editor/persistence";
import { assets, isFrog } from "./assets";
import { makePreset, type Preset } from "./model/presets";
import { placementProblem } from "./model/terrain";
import { WorldScene } from "./scene/WorldScene";
import { Library } from "./ui/Library";
import { EnvironmentPanel } from "./ui/EnvironmentPanel";
import { RangeControl } from "./ui/RangeControl";
import { Modal } from "./ui/Modal";
import { IconButton } from "./ui/Toolbar";

class SceneBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Terrarium renderer", error, info);
  }
  render() {
    return this.state.error ? (
      <div className="webgl-fallback">
        <strong>The scene could not start.</strong>
        <p>
          Try reloading in a browser with WebGL enabled. You can still export
          your saved world from the toolbar.
        </p>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  const editor = useEditor(),
    { world, selected, tool } = editor;
  const ecosystem = useEcosystem(world);
  const [panel, setPanel] = useState<"objects" | "habitat" | "life">("objects");
  const [view, setView] = useState(false),
    [resetCamera, setResetCamera] = useState(0),
    [menu, setMenu] = useState<"worlds" | "help" | null>(null);
  useEffect(() => {
    if (selected && isFrog(selected.kind)) setPanel("life");
  }, [selected?.id]);
  const importInput = useRef<HTMLInputElement>(null);
  const problems = world.objects.filter((o) =>
    placementProblem(o.kind, o.x, o.z, world.environment),
  );
  const activeKind =
    tool.type === "place"
      ? tool.kind
      : tool.type === "move" || tool.type === "copy"
        ? selected?.kind
        : null;
  const finish = () => editor.setTool({ type: "select" });
  function preset(which: Preset) {
    editor.replaceWorld(makePreset(which));
    setMenu(null);
    editor.notify(
      which === "empty"
        ? "A fresh start."
        : "Make it yours. Every object can be moved or changed.",
    );
    setResetCamera((n) => n + 1);
  }
  async function importFile(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 250_000)
        throw new Error("This file is too large for a terrarium.");
      editor.replaceWorld(parseWorld(await file.text()));
      editor.notify("Your world is ready.");
    } catch (error) {
      editor.notify(
        error instanceof Error ? error.message : "Could not import this file.",
      );
    }
    if (importInput.current) importInput.current.value = "";
  }
  return (
    <main className={`app ${view ? "view-mode" : ""}`}>
      <div
        className="scene-shell"
        aria-label="Interactive terrarium. Drag to orbit, scroll or pinch to zoom."
      >
        <SceneBoundary>
          <WorldScene
            editor={editor}
            resetCamera={resetCamera}
            view={view}
            ecosystem={ecosystem}
          />
        </SceneBoundary>
      </div>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <Leaf size={23} />
          </span>
          <div>
            <h1>
              Paludarium<span> / </span>
            </h1>
            <span className="brand-caption">TERRARIUM STUDIO</span>
          </div>
        </div>
        <div className="world-title">
          <input
            aria-label="World name"
            key={world.name}
            defaultValue={world.name}
            maxLength={60}
            onBlur={(e) => {
              const name = e.target.value.trim();
              if (name) editor.replaceWorld({ ...world, name });
              else e.target.value = world.name;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
          />
          <span
            className={editor.saved ? "save-status" : "save-status warning"}
          >
            {editor.saved ? <Check size={12} /> : null}
            {editor.saving
              ? "Saving…"
              : editor.saved
                ? "Saved on this device"
                : "Save unavailable · export a copy"}
          </span>
        </div>
        <div className="header-actions">
          <IconButton
            label="Undo (⌘/Ctrl Z)"
            onClick={editor.undo}
            disabled={!editor.canUndo}
          >
            <Undo2 size={18} />
          </IconButton>
          <IconButton
            label="Redo (⌘/Ctrl Shift Z)"
            onClick={editor.redo}
            disabled={!editor.canRedo}
          >
            <Redo2 size={18} />
          </IconButton>
          <span className="divider" />
          <IconButton label="Export world" onClick={() => downloadWorld(world)}>
            <Download size={18} />
          </IconButton>
          <IconButton
            label="Import world"
            onClick={() => importInput.current?.click()}
          >
            <Upload size={18} />
          </IconButton>
          <button className="new-world" onClick={() => setMenu("worlds")}>
            <Plus size={16} />
            <span>New world</span>
          </button>
        </div>
        <input
          ref={importInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => void importFile(e.target.files?.[0])}
        />
      </header>
      {!view && (
        <aside className="sidebar" aria-label="Terrarium tools">
          <div className="panel-tabs">
            <button
              className={panel === "objects" ? "active" : ""}
              onClick={() => setPanel("objects")}
            >
              <Sprout size={17} />
              Add to your world
            </button>
            <button
              className={panel === "habitat" ? "active" : ""}
              onClick={() => setPanel("habitat")}
              title="Habitat settings"
              aria-label="Habitat settings"
            >
              <SlidersHorizontal size={17} />
            </button>
            <button
              className={panel === "life" ? "active" : ""}
              onClick={() => setPanel("life")}
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
                ecosystem={ecosystem}
                selectedId={editor.selectedId}
                paused={editor.paused}
              />
            )}
          </div>
          <div className="sidebar-footer">
            <span>{world.objects.length} inhabitants & objects</span>
            <button
              onClick={() => setMenu("help")}
              aria-label="Controls and help"
            >
              <HelpCircle size={16} />
            </button>
          </div>
        </aside>
      )}
      {!view && world.objects.length === 0 && tool.type === "select" && (
        <div className="empty-invitation">
          <span className="eyebrow">A SMALL BEGINNING</span>
          <h2>
            Make room for
            <br />a little life.
          </h2>
          <p>
            Plant the first leaf, place a stone,
            <br />
            then find a home for a frog.
          </p>
          <div>
            <button onClick={() => preset("tropical")}>
              Try a cloud forest
            </button>
            <button className="text-button" onClick={() => preset("mountain")}>
              Or an alpine creek
            </button>
          </div>
        </div>
      )}
      {!view && selected && tool.type === "select" && (
        <aside className="inspector" aria-label="Selected object">
          <div className="inspector-heading">
            <div>
              <span className="eyebrow">IN YOUR WORLD</span>
              <h2>{assets[selected.kind].name}</h2>
            </div>
            <IconButton
              label="Deselect object"
              onClick={() => editor.select(null)}
            >
              <X size={17} />
            </IconButton>
          </div>
          {assets[selected.kind].scientificName && (
            <p className="species-name">
              {assets[selected.kind].scientificName}
            </p>
          )}
          <p>{assets[selected.kind].description}</p>
          <div className="object-actions">
            <button onClick={editor.move}>
              <Move size={18} />
              Move
            </button>
            <button onClick={() => editor.rotate()}>
              <RotateCw size={18} />
              Turn
            </button>
            <button onClick={editor.duplicate}>
              <Copy size={18} />
              Copy
            </button>
            <button onClick={editor.remove}>
              <Trash2 size={18} />
              Remove
            </button>
          </div>
          <RangeControl
            label="Size"
            value={selected.scale}
            min={0.4}
            max={2}
            step={0.05}
            format={(n) => `${Math.round(n * 100)}%`}
            onCommit={(scale) => editor.patchObject(selected.id, { scale })}
          />
        </aside>
      )}
      <div className="scene-tools">
        <IconButton
          label={editor.paused ? "Resume life (Space)" : "Pause life (Space)"}
          onClick={() => editor.setPaused((p) => !p)}
          active={editor.paused}
        >
          {editor.paused ? <Play size={19} /> : <Pause size={19} />}
        </IconButton>
        <IconButton
          label="Reset camera"
          onClick={() => setResetCamera((n) => n + 1)}
        >
          <Maximize2 size={19} />
        </IconButton>
        <IconButton
          label={view ? "Return to building" : "Watch your world"}
          onClick={() => {
            setView((v) => !v);
            finish();
            editor.select(null);
          }}
          active={view}
        >
          {view ? <ArrowLeft size={19} /> : <Eye size={19} />}
        </IconButton>
      </div>
      {view && (
        <button className="return-button" onClick={() => setView(false)}>
          <ArrowLeft size={17} />
          Back to building
        </button>
      )}
      {!view && (
        <div className="bottom-hud">
          {tool.type !== "select" ? (
            <div className="placement-bar">
              <span className="placement-icon">
                <Plus size={20} />
              </span>
              <div>
                <strong>
                  {tool.type === "move"
                    ? "Moving"
                    : tool.type === "copy"
                      ? "Copying"
                      : "Placing"}{" "}
                  {activeKind ? assets[activeKind].name.toLowerCase() : ""}
                </strong>
                <span>Tap a spot in the tank · drag to orbit</span>
              </div>
              <IconButton
                label="Rotate placement (R)"
                onClick={() => editor.rotate()}
              >
                <RotateCw size={18} />
              </IconButton>
              <button className="finish-button" onClick={finish}>
                <Check size={16} />
                {tool.type === "place" ? "Done" : "Cancel"}
              </button>
            </div>
          ) : (
            <div className="navigation-hint">
              <MousePointer2 size={14} />
              <span>WASD to move</span>
              <i />
              <span>Drag to orbit</span>
              <i />
              <span>Scroll / pinch to zoom</span>
              <i />
              <span>Click to select</span>
            </div>
          )}
          <div className="status-message" role="status" aria-live="polite">
            {editor.message}
          </div>
        </div>
      )}
      {!view && problems.length > 0 && (
        <button
          className="habitat-warning"
          onClick={() => {
            editor.select(problems[0].id);
            finish();
          }}
        >
          {problems.length}{" "}
          {problems.length === 1 ? "object needs" : "objects need"} a better
          spot
        </button>
      )}
      {menu && (
        <Modal
          label={menu === "worlds" ? "Start a world" : "How to build"}
          onClose={() => setMenu(null)}
        >
          <div className="modal-heading">
            <h2>
              {menu === "worlds"
                ? "A new little world"
                : "Make yourself at home"}
            </h2>
            <IconButton label="Close dialog" onClick={() => setMenu(null)}>
              <X size={20} />
            </IconButton>
          </div>
          {menu === "worlds" ? (
            <>
              <p>
                Start from scratch or settle into a ready-made habitat. Undo can
                bring your previous world back.
              </p>
              <div className="preset-options">
                <button onClick={() => preset("empty")}>
                  <span>01</span>
                  <strong>Empty tank</strong>
                  <small>A blank canvas, a bank, and a pond.</small>
                </button>
                <button onClick={() => preset("tropical")}>
                  <span>02</span>
                  <strong>Cloud forest</strong>
                  <small>Monstera, bromeliads, and curious frogs.</small>
                </button>
                <button onClick={() => preset("mountain")}>
                  <span>03</span>
                  <strong>Alpine creek</strong>
                  <small>Weathered stone and wild strawberries.</small>
                </button>
              </div>
            </>
          ) : (
            <>
              <p>
                Choose an object, then click or tap the tank to place it. Keep
                placing to make a cluster. Done or Escape returns to selection.
              </p>
              <dl>
                <dt>Move the camera</dt>
                <dd>
                  WASD moves across the tank. Hold Shift to move faster. Reset
                  Camera returns to the starting view.
                </dd>
                <dt>Look around</dt>
                <dd>
                  Drag with one finger or the mouse. Pinch or scroll to zoom.
                </dd>
                <dt>Rearrange</dt>
                <dd>Select an object, choose Move, then tap its new home.</dd>
                <dt>Turn</dt>
                <dd>R rotates; Shift R rotates the other way.</dd>
                <dt>Undo / redo</dt>
                <dd>⌘ or Ctrl Z / Shift Z. Each slider gesture is one step.</dd>
                <dt>Pause</dt>
                <dd>
                  Space pauses the inhabitants. The eye button hides the tools.
                </dd>
                <dt>Care for the frogs</dt>
                <dd>
                  Scatter insects for food, or mist a dry habitat. Frogs forage,
                  soak, explore and sleep on a sped-up day/night cycle. Select
                  one to see its needs. Life pauses while the tab is hidden;
                  activity restarts on reload.
                </dd>
                <dt>Keep your world</dt>
                <dd>
                  Autosaves stay in this browser. Export a file to back up or
                  move between devices.
                </dd>
              </dl>
              <p className="panel-note">
                This is a creative habitat sandbox, not a guide to keeping real
                animals together.
              </p>
            </>
          )}
        </Modal>
      )}
    </main>
  );
}
