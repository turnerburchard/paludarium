import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { assets, isAnimal } from "./assets";
import { useEditor } from "./editor/useEditor";
import type { Preset } from "./model/presets";
import { WorldScene } from "./scene/WorldScene";
import { useEcosystem } from "./simulation/useEcosystem";
import { BottomHud } from "./ui/BottomHud";
import { CameraHint } from "./ui/CameraHint";
import { HelpDialog } from "./ui/HelpDialog";
import { hasDismissedHelp, rememberHelpDismissal } from "./ui/helpPreference";
import { Inspector } from "./ui/Inspector";
import { MobileDock } from "./ui/MobileDock";
import { ShareDialog } from "./ui/ShareDialog";
import { WorldsDialog } from "./ui/WorldsDialog";
import { RenameDialog } from "./ui/RenameDialog";
import { SceneBoundary } from "./ui/SceneBoundary";
import { Sidebar, type Panel } from "./ui/Sidebar";
import { TopBar } from "./ui/TopBar";
import { shareLink, useWorldLink } from "./ui/useWorldLink";
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
  // View can drop the interface to leave just the tank.
  const [uiHidden, setUiHidden] = useState(false);
  const [resetCamera, setResetCamera] = useState(0);
  const [dialog, setDialog] = useState<
    | "share"
    | "worlds"
    | "help"
    | "about"
    | "shared-copy"
    | "share-error"
    | "rename-animal"
    | null
  >(() => (shareError ? "share-error" : null));
  const [cameraHint, setCameraHint] = useState<"shown" | "fading" | null>(() =>
    hasDismissedHelp() ? null : "shown",
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

  useEffect(() => {
    if (!view) return;
    const keydown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "h" || e.metaKey || e.ctrlKey || e.altKey)
        return;
      const target = e.target instanceof Element ? e.target : null;
      if (
        target?.closest("input,textarea,select,[contenteditable=true]") ||
        document.querySelector('[role="dialog"]')
      )
        return;
      setUiHidden((hidden) => !hidden);
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [view]);

  // Placing or moving needs the tank, so the sheet gets out of the way.
  useEffect(() => {
    if (tool.type !== "select") setSheetOpen(false);
  }, [tool.type]);

  function learnCamera() {
    if (cameraHint !== "shown") return;
    rememberHelpDismissal();
    // The scene's handlers can hold an older copy of this function.
    setCameraHint((hint) => (hint === "shown" ? "fading" : hint));
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
    setUiHidden(false);
    setView(next);
  }

  function changeMode(next: boolean) {
    if (!next && editor.isShared) {
      setDialog("shared-copy");
      return;
    }
    setMode(next);
  }

  const worldLink = useWorldLink(editor.savedWorld);
  async function share() {
    // Phones go straight to the share sheet; the dialog adds copying and files.
    if (
      worldLink &&
      matchMedia("(pointer: coarse)").matches &&
      (await shareLink(editor.savedWorld.name, worldLink))
    )
      return;
    setDialog("share");
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
    if (!view) editor.select(id);
    else if (!object || !isAnimal(object.kind)) return;
    // With no card to offer Watch, a tap goes straight to following the
    // animal, and a second tap lets it go.
    else if (!uiHidden) inspectAnimal(id);
    else if (watchingId === id) editor.select(null);
    else watch(id);
  }

  return (
    <main
      className={`app ${view ? "view-mode" : ""} ${sheetOpen ? "sheet-open" : ""} ${uiHidden ? "ui-hidden" : ""}`}
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
            onCameraStart={learnCamera}
          />
        </SceneBoundary>
      </div>
      <TopBar
        editor={editor}
        view={view}
        onChangeMode={changeMode}
        onWorlds={openWorlds}
        onShare={() => void share()}
        onAbout={() => setDialog("about")}
      />
      {files.fileInput}
      {hasBuilt && (
        <Sidebar
          hidden={view}
          editor={editor}
          ecosystem={ecosystem}
          panel={panel}
          onPanel={setPanel}
          onWatch={inspectAnimal}
          onClose={() => setSheetOpen(false)}
        />
      )}
      {!sheetOpen && !selected && tool.type === "select" && (
        <MobileDock view={view} onChangeMode={changeMode} onOpen={openPanel} />
      )}
      {selected && tool.type === "select" && !watchingId && (
        <Inspector
          key={selected.id}
          editor={editor}
          object={selected}
          ecosystem={ecosystem}
          view={view}
          onWatch={() => watch(selected.id)}
          onRename={() => setDialog("rename-animal")}
        />
      )}
      {selected && watchingId && (
        <WatchCard
          object={selected}
          ecosystem={ecosystem}
          onStop={() => setWatchRequest(null)}
        />
      )}
      {view && !watchingId && editor.isShared && (
        <nav className="shared-world-badge" aria-label="Shared world">
          <span title={world.name}>{world.name}</span>
          <a href={location.pathname + location.search}>Back to my world</a>
        </nav>
      )}
      {/* An open card covers this corner and already shows the interface. */}
      {view && (uiHidden || !selected) && (
        <button
          className="interface-toggle"
          aria-label={uiHidden ? "Show interface" : "Hide interface"}
          title={uiHidden ? "Show interface (H)" : "Hide interface (H)"}
          onClick={() => setUiHidden((hidden) => !hidden)}
        >
          {uiHidden ? <Eye size={18} /> : <EyeOff size={18} />}
        </button>
      )}
      {view && cameraHint && (
        <CameraHint
          fading={cameraHint === "fading"}
          onFaded={() => setCameraHint(null)}
        />
      )}
      {!view && <BottomHud editor={editor} />}
      {dialog === "share" && (
        <ShareDialog
          world={editor.savedWorld}
          link={worldLink}
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
      {dialog === "rename-animal" && selected && (
        <RenameDialog
          title={`Name this ${assets[selected.kind].name.toLowerCase()}`}
          name={selected.name ?? ""}
          placeholder={assets[selected.kind].name}
          maxLength={40}
          onSave={(name) => {
            editor.patchObject(selected.id, { name: name || undefined });
            setDialog(null);
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "help" && <HelpDialog onClose={() => setDialog(null)} />}
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
