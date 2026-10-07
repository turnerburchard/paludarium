import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import type { World } from "../model/schema";
import { downloadWorld } from "../editor/persistence";
import { createWorldLink } from "../editor/worldLinks";
import { IconButton } from "./IconButton";
import { Modal } from "./Modal";
import { project } from "./project";

export function ShareDialog({
  world,
  onClose,
}: {
  world: World;
  onClose: () => void;
}) {
  const [prepared, setPrepared] = useState<{
    world: World;
    url: string | null;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [fileError, setFileError] = useState("");
  const [manual, setManual] = useState(false);
  useEffect(() => {
    let canceled = false;
    createWorldLink(world, project.url).then(
      (url) => {
        if (!canceled) setPrepared({ world, url });
      },
      () => {
        if (!canceled) setPrepared({ world, url: null });
      },
    );
    return () => {
      canceled = true;
    };
  }, [world]);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 3000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function share() {
    setManual(false);
    setCopied(false);
    const url = prepared?.world === world ? prepared.url : null;
    if (!url) {
      setManual(true);
      return;
    }
    // Prepare the link before the click: native sharing needs user activation.
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${world.name} · Paludarium`,
          text: "Explore this tiny living world, then build your own copy.",
          url,
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setManual(true);
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setManual(true);
    }
  }
  async function shareFile() {
    const file = new File(
      [JSON.stringify(world, null, 2)],
      `${world.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "terrarium"}.json`,
      { type: "application/json" },
    );
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ title: world.name, files: [file] });
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError"))
          setFileError("File sharing is unavailable. Export a backup instead.");
      }
    } else downloadWorld(world);
  }
  return (
    <Modal label="Share world" onClose={onClose}>
      <div className="modal-heading">
        <h2>Share world</h2>
        <IconButton label="Close dialog" onClick={onClose}>
          <X size={20} />
        </IconButton>
      </div>
      <p>Share a snapshot. Later edits won’t change the copy you send.</p>
      <div className="world-library-actions">
        <button
          className="intro-build-button"
          onClick={share}
          disabled={prepared?.world !== world}
        >
          {copied ? <Check size={16} /> : null}
          {copied ? "World link copied" : "Share link"}
        </button>
        <button onClick={() => void shareFile()}>Share file</button>
      </div>
      {manual &&
        (prepared?.url ? (
          <input
            className="world-link-input"
            aria-label="World link"
            readOnly
            value={prepared.url}
            onFocus={(event) => event.currentTarget.select()}
          />
        ) : (
          <p>
            This world couldn’t be turned into a link. Use Share file instead.
          </p>
        ))}
      {fileError && (
        <>
          <p role="status">{fileError}</p>
          <button onClick={() => downloadWorld(world)}>Export file</button>
        </>
      )}
    </Modal>
  );
}
