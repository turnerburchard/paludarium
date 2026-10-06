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
import { FirstSteps, isFirstVisit } from "./ui/FirstSteps";
import { HelpDialog } from "./ui/HelpDialog";
import { Inspector } from "./ui/Inspector";
import { NewWorldDialog } from "./ui/NewWorldDialog";
import { SceneBoundary } from "./ui/SceneBoundary";
import { SceneTools } from "./ui/SceneTools";
import { Sidebar, type Panel } from "./ui/Sidebar";
import { TopBar } from "./ui/TopBar";
import { WatchCard } from "./ui/WatchCard";

export default function App() {
  const editor = useEditor();
  const { world, selected, tool } = editor;
  const ecosystem = useEcosystem(world);
  const [panel, setPanel] = useState<Panel>("objects");
  const [view, setView] = useState(false);
  const [resetCamera, setResetCamera] = useState(0);
  const [dialog, setDialog] = useState<"new-world" | "help" | null>(null);
  const [watchRequest, setWatchRequest] = useState<string | null>(null);
  // Deselecting (Escape, clicking away) also stops watching.
  const watchingId =
    watchRequest && watchRequest === selected?.id ? watchRequest : null;
  const [guiding, setGuiding] = useState(isFirstVisit);
  const [watchedOnce, setWatchedOnce] = useState(false);

  useEffect(() => {
    if (watchingId) setWatchedOnce(true);
  }, [watchingId]);

  useEffect(() => {
    if (selected && isFrog(selected.kind)) setPanel("life");
  }, [selected?.id]);

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
            watchingId={watchingId}
          />
        </SceneBoundary>
      </div>
      <TopBar editor={editor} onNewWorld={() => setDialog("new-world")} />
      {!view && (
        <Sidebar
          editor={editor}
          ecosystem={ecosystem}
          panel={panel}
          onPanel={setPanel}
          onHelp={() => setDialog("help")}
        />
      )}
      {!view && world.objects.length === 0 && tool.type === "select" && (
        <EmptyInvitation onPreset={startPreset} />
      )}
      {!view && guiding && world.objects.length > 0 && !selected && (
        <FirstSteps
          world={world}
          watched={watchedOnce}
          onFinish={(completed) => {
            setGuiding(false);
            if (completed)
              editor.notify(
                "Your habitat is alive. The life panel shows how everyone is doing.",
              );
          }}
        />
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
      {!view && misplaced.length > 0 && (
        <button
          className="habitat-warning"
          onClick={() => {
            editor.select(misplaced[0].id);
            editor.setTool({ type: "select" });
          }}
        >
          {misplaced.length}{" "}
          {misplaced.length === 1 ? "object needs" : "objects need"} a better
          spot
        </button>
      )}
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
