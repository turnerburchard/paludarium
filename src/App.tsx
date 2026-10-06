import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { isFrog } from "./assets";
import { useEditor } from "./editor/useEditor";
import { makePreset, type Preset } from "./model/presets";
import { placementProblem } from "./model/terrain";
import { WorldScene } from "./scene/WorldScene";
import { useEcosystem } from "./simulation/useEcosystem";
import { BottomHud } from "./ui/BottomHud";
import { EmptyInvitation } from "./ui/EmptyInvitation";
import { HelpDialog } from "./ui/HelpDialog";
import { Inspector } from "./ui/Inspector";
import { MobileDock } from "./ui/MobileDock";
import { NewWorldDialog } from "./ui/NewWorldDialog";
import { SceneBoundary } from "./ui/SceneBoundary";
import { SceneTools } from "./ui/SceneTools";
import { Sidebar, type Panel } from "./ui/Sidebar";
import { TopBar } from "./ui/TopBar";
import { useWorldFiles } from "./ui/useWorldFiles";
import { WatchCard } from "./ui/WatchCard";

export default function App() {
  const editor = useEditor();
  const { world, selected, tool } = editor;
  const ecosystem = useEcosystem(world);
  const files = useWorldFiles(editor);
  const [panel, setPanel] = useState<Panel>("objects");
  // On phones the sidebar is a sheet, closed until a dock button opens it.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [view, setView] = useState(false);
  const [resetCamera, setResetCamera] = useState(0);
  const [dialog, setDialog] = useState<"new-world" | "help" | null>(null);
  const [watchRequest, setWatchRequest] = useState<string | null>(null);
  // Deselecting (Escape, clicking away) also stops watching.
  const watchingId =
    watchRequest && watchRequest === selected?.id ? watchRequest : null;

  useEffect(() => {
    if (selected && isFrog(selected.kind)) setPanel("life");
  }, [selected?.id]);

  // Placing or moving needs the tank, so the sheet gets out of the way.
  useEffect(() => {
    if (tool.type !== "select") setSheetOpen(false);
  }, [tool.type]);

  function openPanel(next: Panel) {
    setPanel(next);
    setSheetOpen(true);
  }

  const misplaced = world.objects.filter((o) =>
    placementProblem(o.kind, o.x, o.z, world.environment),
  );

  function startPreset(preset: Preset) {
    editor.replaceWorld(makePreset(preset));
    setDialog(null);
    editor.notify(
      preset === "empty"
        ? "A fresh start."
        : "Make it yours. Every object can be moved or changed.",
    );
    setResetCamera((n) => n + 1);
  }

  function toggleView() {
    setView((v) => !v);
    editor.setTool({ type: "select" });
    editor.select(null);
  }

  return (
    <main
      className={`app ${view ? "view-mode" : ""} ${sheetOpen ? "sheet-open" : ""}`}
    >
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
            watchingId={watchingId}
          />
        </SceneBoundary>
      </div>
      <TopBar
        editor={editor}
        onNewWorld={() => setDialog("new-world")}
        onExport={files.exportWorld}
        onImport={files.importWorld}
      />
      {files.fileInput}
      {!view && (
        <Sidebar
          editor={editor}
          ecosystem={ecosystem}
          panel={panel}
          onPanel={setPanel}
          onHelp={() => setDialog("help")}
          onClose={() => setSheetOpen(false)}
          onExport={files.exportWorld}
          onImport={files.importWorld}
        />
      )}
      {!view && !sheetOpen && !selected && tool.type === "select" && (
        <MobileDock
          editor={editor}
          onOpen={openPanel}
          onWatchWorld={toggleView}
        />
      )}
      {!view && world.objects.length === 0 && tool.type === "select" && (
        <EmptyInvitation onPreset={startPreset} />
      )}
      {!view && (
        <div className="scene-notices">
          {misplaced.length > 0 && (
            <button
              className="habitat-warning"
              onClick={() => {
                editor.select(misplaced[0].id);
                editor.setTool({ type: "select" });
              }}
            >
              {misplaced.length}{" "}
              {misplaced.length === 1 ? "object needs" : "objects need"} a
              better spot
            </button>
          )}
        </div>
      )}
      {!view && selected && tool.type === "select" && !watchingId && (
        <Inspector
          editor={editor}
          object={selected}
          onWatch={() => setWatchRequest(selected.id)}
        />
      )}
      {!view && selected && watchingId && (
        <WatchCard
          object={selected}
          ecosystem={ecosystem}
          onStop={() => setWatchRequest(null)}
        />
      )}
      <SceneTools
        editor={editor}
        view={view}
        onToggleView={toggleView}
        onResetCamera={() => setResetCamera((n) => n + 1)}
      />
      {view && (
        <button className="return-button" onClick={() => setView(false)}>
          <ArrowLeft size={17} />
          Back to building
        </button>
      )}
      {!view && <BottomHud editor={editor} />}
      {dialog === "new-world" && (
        <NewWorldDialog
          onPreset={startPreset}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "help" && <HelpDialog onClose={() => setDialog(null)} />}
    </main>
  );
}
