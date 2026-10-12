import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import type { World } from "../model/schema";
import { downloadWorld, worldFile } from "../editor/persistence";
import { IconButton } from "./IconButton";
import { Modal } from "./Modal";
import { copyText, shareLink, shortWorldLink } from "./useWorldLink";

export function ShareDialog({
  world: current,
  link: fullLink,
  onClose,
}: {
  world: World;
  /** From useWorldLink: undefined while it's being built, null if it can't be. */
  link: string | null | undefined;
  onClose: () => void;
}) {
  // The world as it was when sharing began. Life keeps changing the live one.
  const [world] = useState(current);
  const [shortLink, setShortLink] = useState<string | null>();
  useEffect(() => {
    let canceled = false;
    void shortWorldLink(world).then((link) => {
      if (!canceled) setShortLink(link);
    });
    return () => {
      canceled = true;
    };
  }, [world]);
  // Without the share server, the whole world goes in the link instead.
  const link = shortLink === undefined ? undefined : (shortLink ?? fullLink);
  const [copied, setCopied] = useState(false);
  const [fileError, setFileError] = useState("");
  const [manual, setManual] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 3000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function share() {
    setManual(false);
    setCopied(false);
    if (!link) {
      setManual(true);
      return;
    }
    if (!(await shareLink(world.name, link))) await copy(link);
  }
  async function copy(url: string) {
    const done = await copyText(url);
    setCopied(done);
    setManual(!done);
  }
  async function shareFile() {
    const file = worldFile(world);
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
      <div className="world-library-actions">
        <button
          className="intro-build-button"
          onClick={share}
          disabled={link === undefined}
        >
          {copied ? <Check size={16} /> : null}
          {copied ? "World link copied" : "Share link"}
        </button>
        <button onClick={() => void shareFile()}>Share file</button>
      </div>
      {manual &&
        (link ? (
          <>
            <div className="world-link-copy">
              <input
                className="world-link-input"
                aria-label="World link"
                readOnly
                value={link}
                onFocus={(event) => event.currentTarget.select()}
              />
              <button onClick={() => void copy(link)}>Copy link</button>
            </div>
            <p>
              Your browser blocked copying. Press and hold the link to copy it.
            </p>
          </>
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
