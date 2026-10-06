import { useEffect, useState } from "react";
import { isLandAnimal } from "./assets";
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
import { ViewControls } from "./ui/ViewControls";
import { ViewIntro } from "./ui/ViewIntro";
import { AboutDialog } from "./ui/AboutDialog";
import type { World } from "./model/schema";
import { SharedWorldDialog, WorldLinkError } from "./ui/SharedWorldDialog";

export default function App({
  sharedWorld,
  shareError = false,
}: {
  sharedWorld?: World;
  shareError?: boolean;
}) {
  const [view, setView] = useState(true);
  const editor = useEditor(view, sharedWorld);
  const { world, selected, tool } = editor;
  // Life follows committed edits, not intermediate brush or slider previews.
  const ecosystem = useEcosystem(editor.savedWorld);
  const files = useWorldFiles(editor);
  const [panel, setPanel] = useState<Panel>("objects");
  // On phones the sidebar is a sheet, closed until a dock button opens it.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [hasBuilt, setHasBuilt] = useState(false);
  const [resetCamera, setResetCamera] = useState(0);
  const [dialog, setDialog] = useState<
    "new-world" | "help" | "about" | "shared-copy" | "share-error" | null
  >(shareError ? "share-error" : null);
  const [watchRequest, setWatchRequest] = useState<string | null>(null);
  // Deselecting (Escape, clicking away) also stops watching.
  const watchingId =
    watchRequest && watchRequest === selected?.id ? watchRequest : null;
  // Watching ends for good once its frog is deselected; reselecting it later
  // shouldn't zoom back in.
  useEffect(() => {
    if (watchRequest && watchRequest !== editor.selectedId)
      setWatchRequest(null);
  }, [editor.selectedId]);

  // Placing or moving needs the tank, so the sheet gets out of the way.
  useEffect(() => {
    if (tool.type !== "select") setSheetOpen(false);
  }, [tool.type]);

  function watch(id: string) {
    editor.select(id);
    setWatchRequest(id);
    setSheetOpen(false);
  }

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

  function setMode(next: boolean) {
    if (next === view) return;
    editor.finish();
    setSheetOpen(false);
    if (!next) setHasBuilt(true);
    setView(next);
  }

  function changeMode(next: boolean) {
    if (!next && editor.isShared) {
      setDialog("shared-copy");
      return;
    }
    setMode(next);
  }

  function clearWorldLink() {
    history.replaceState(null, "", location.pathname + location.search);
  }

  function activateObject(id: string) {
    const object = world.objects.find((o) => o.id === id);
    if (view) {
      if (object && isLandAnimal(object.kind)) watch(id);
    } else editor.select(id);
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
            onActivateObject={activateObject}
          />
        </SceneBoundary>
      </div>
      {!view && (
        <TopBar
          editor={editor}
          onNewWorld={() => setDialog("new-world")}
          onExport={files.exportWorld}
          onImport={files.importWorld}
        />
      )}
      {files.fileInput}
      {hasBuilt && (
        <Sidebar
          hidden={view}
          editor={editor}
          ecosystem={ecosystem}
          panel={panel}
          onPanel={setPanel}
          onHelp={() => setDialog("help")}
          onWatch={watch}
          onClose={() => setSheetOpen(false)}
          onExport={files.exportWorld}
          onImport={files.importWorld}
        />
      )}
      {!view && !sheetOpen && !selected && tool.type === "select" && (
        <MobileDock
          editor={editor}
          onOpen={openPanel}
          onWatchWorld={() => changeMode(true)}
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
                // Each click moves on to the next object that needs a spot.
                const current = misplaced.findIndex(
                  (o) => o.id === editor.selectedId,
                );
                editor.select(misplaced[(current + 1) % misplaced.length].id);
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
          key={selected.id}
          editor={editor}
          object={selected}
          onWatch={() => watch(selected.id)}
        />
      )}
      {selected && watchingId && (
        <WatchCard
          object={selected}
          ecosystem={ecosystem}
          onStop={() => setWatchRequest(null)}
        />
      )}
      <SceneTools
        editor={editor}
        view={view}
        onChangeMode={changeMode}
        onResetCamera={() => {
          setWatchRequest(null);
          setResetCamera((n) => n + 1);
        }}
      />
      {view && !watchingId && (
        <>
          <ViewIntro
            sharedName={editor.isShared ? world.name : undefined}
            onAbout={() => setDialog("about")}
          />
          <ViewControls world={world} ecosystem={ecosystem} onWatch={watch} />
        </>
      )}
      {!view && <BottomHud editor={editor} />}
      {dialog === "new-world" && (
        <NewWorldDialog
          onPreset={startPreset}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "shared-copy" && (
        <SharedWorldDialog
          onClose={() => setDialog(null)}
          onCopy={() => {
            const saved = editor.adoptSharedWorld();
            if (saved) clearWorldLink();
            setDialog(null);
            setMode(false);
            if (!saved)
              editor.notify(
                "Saving is unavailable. Export a backup of your copy.",
              );
          }}
        />
      )}
      {dialog === "share-error" && (
        <WorldLinkError
          onClose={() => {
            clearWorldLink();
            setDialog(null);
          }}
        />
      )}
      {dialog === "help" && <HelpDialog onClose={() => setDialog(null)} />}
      {dialog === "about" && (
        <AboutDialog
          onClose={() => setDialog(null)}
          onBuild={() => {
            setDialog(null);
            changeMode(false);
          }}
        />
      )}
    </main>
  );
}
