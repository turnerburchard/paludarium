import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { IconButton } from "./ui/IconButton";
import { isAnimal } from "./assets";
import { useEditor } from "./editor/useEditor";
import type { Preset } from "./model/presets";
import { WorldScene } from "./scene/WorldScene";
import { useEcosystem } from "./simulation/useEcosystem";
import { BottomHud } from "./ui/BottomHud";
import { HelpDialog } from "./ui/HelpDialog";
import { hasDismissedHelp, rememberHelpDismissal } from "./ui/helpPreference";
import { Inspector } from "./ui/Inspector";
import { MobileDock } from "./ui/MobileDock";
import { ShareDialog } from "./ui/ShareDialog";
import { WorldsDialog } from "./ui/WorldsDialog";
import { SceneBoundary } from "./ui/SceneBoundary";
import { SceneTools } from "./ui/SceneTools";
import { Sidebar, type Panel } from "./ui/Sidebar";
import { TopBar } from "./ui/TopBar";
import { useWorldFiles } from "./ui/useWorldFiles";
import { WatchCard } from "./ui/WatchCard";
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
  const ecosystem = useEcosystem(
    editor.savedWorld,
    editor.updateLife,
    tool.type === "terrain",
  );
  const [panel, setPanel] = useState<Panel>("objects");
  // On phones the sidebar is a sheet, closed until a dock button opens it.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [hasBuilt, setHasBuilt] = useState(false);
  const [resetCamera, setResetCamera] = useState(0);
  const [dialog, setDialog] = useState<
    "share" | "worlds" | "help" | "about" | "shared-copy" | "share-error" | null
  >(() =>
    shareError
      ? "share-error"
      : !sharedWorld && !hasDismissedHelp()
        ? "help"
        : null,
  );
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

  function closeHelp() {
    rememberHelpDismissal();
    setDialog(null);
  }

  function watch(id: string) {
    if (!view) setMode(true);
    editor.select(id);
    setWatchRequest(id);
    setSheetOpen(false);
  }

  function inspectAnimal(id: string) {
    editor.finish();
    editor.select(id);
    setWatchRequest(null);
    setSheetOpen(false);
  }

  function openPanel(next: Panel) {
    setPanel(next);
    setSheetOpen(true);
  }

  function startPreset(preset: Preset) {
    if (!editor.startPreset(preset)) return;
    clearWorldLink();
    setWatchRequest(null);
    setDialog(null);
    setResetCamera((n) => n + 1);
  }

  function setMode(next: boolean) {
    if (next === view) return;
    editor.finish();
    setSheetOpen(false);
    setWatchRequest(null);
    if (next && selected && !isAnimal(selected.kind)) editor.select(null);
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

  function openWorlds() {
    editor.finish();
    setDialog("worlds");
  }

  function clearWorldLink() {
    history.replaceState(null, "", location.pathname + location.search);
  }

  const files = useWorldFiles(editor, () => {
    clearWorldLink();
    setDialog(null);
    setWatchRequest(null);
    setResetCamera((n) => n + 1);
  });

  function activateObject(id: string) {
    const object = world.objects.find((o) => o.id === id);
    if (view) {
      if (object && isAnimal(object.kind)) inspectAnimal(id);
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
      {!view && <TopBar editor={editor} onWorlds={openWorlds} />}
      {files.fileInput}
      {hasBuilt && (
        <Sidebar
          hidden={view}
          sheetOpen={sheetOpen}
          editor={editor}
          ecosystem={ecosystem}
          panel={panel}
          onPanel={setPanel}
          onAbout={() => setDialog("about")}
          onWatch={inspectAnimal}
          onClose={() => setSheetOpen(false)}
        />
      )}
      {!view && !sheetOpen && !selected && tool.type === "select" && (
        <MobileDock
          editor={editor}
          onOpen={openPanel}
          onWatchWorld={() => changeMode(true)}
        />
      )}
      {selected && tool.type === "select" && !watchingId && (
        <Inspector
          key={selected.id}
          editor={editor}
          object={selected}
          ecosystem={ecosystem}
          view={view}
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
        onShare={() => setDialog("share")}
        onWorlds={openWorlds}
        onChangeMode={changeMode}
        onResetCamera={() => {
          setWatchRequest(null);
          setResetCamera((n) => n + 1);
        }}
      />
      {view && !watchingId && (
        <>
          <div className="view-info">
            <IconButton
              label="About Paludarium"
              onClick={() => setDialog("about")}
            >
              <Info size={19} />
            </IconButton>
          </div>
          {editor.isShared && (
            <nav className="shared-world-badge" aria-label="Shared world">
              <span title={world.name}>{world.name}</span>
              <a href={location.pathname + location.search}>Back to my world</a>
            </nav>
          )}
        </>
      )}
      {!view && <BottomHud editor={editor} />}
      {dialog === "share" && (
        <ShareDialog
          world={editor.savedWorld}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "worlds" && (
        <WorldsDialog
          editor={editor}
          onClose={() => setDialog(null)}
          onPreset={startPreset}
          onImport={files.importWorld}
          importError={files.importError}
          onOpen={(id) => {
            if (!editor.openWorld(id)) return;
            clearWorldLink();
            setDialog(null);
            setWatchRequest(null);
            setResetCamera((n) => n + 1);
          }}
        />
      )}
      {dialog === "shared-copy" && (
        <SharedWorldDialog
          error={!editor.saved ? editor.saveError : ""}
          onClose={() => setDialog(null)}
          onCopy={() => {
            if (!editor.adoptSharedWorld()) return;
            clearWorldLink();
            setDialog(null);
            setMode(false);
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
      {dialog === "help" && <HelpDialog onClose={closeHelp} />}
      {dialog === "about" && (
        <AboutDialog
          onHelp={() => setDialog("help")}
          ecosystem={ecosystem}
          onWatch={(id) => {
            setDialog(null);
            watch(id);
          }}
          onClose={() => setDialog(null)}
        />
      )}
    </main>
  );
}
