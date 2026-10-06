import { useEffect, useState } from "react";
import { Check, Share2, X } from "lucide-react";
import type { World } from "../model/schema";
import { downloadWorld } from "../editor/persistence";
import { createWorldLink } from "../editor/worldLinks";
import { IconButton } from "./IconButton";
import { project } from "./project";

export function ShareButton({ world }: { world: World }) {
  const [prepared, setPrepared] = useState<{
    world: World;
    url: string | null;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState(false);
  useEffect(() => {
    let canceled = false;
    setCopied(false);
    setManual(false);
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
  return (
    <span className="share-control">
      <IconButton
        label="Share this world"
        onClick={share}
        disabled={prepared?.world !== world}
      >
        {copied ? <Check size={19} /> : <Share2 size={19} />}
      </IconButton>
      {copied && (
        <span className="share-feedback" role="status">
          World link copied
        </span>
      )}
      {manual && (
        <span className="share-fallback">
          <span>
            {prepared?.url ? "Copy this world link" : "Share a world file"}
            <IconButton
              label="Close share link"
              onClick={() => setManual(false)}
            >
              <X size={16} />
            </IconButton>
          </span>
          {prepared?.url ? (
            <input
              aria-label="World link"
              readOnly
              value={prepared.url}
              onFocus={(event) => event.currentTarget.select()}
            />
          ) : (
            <>
              <p>
                This world couldn’t be turned into a link. Export a file to
                share it instead.
              </p>
              <button
                className="intro-build-button"
                onClick={() => downloadWorld(world)}
              >
                Export this world
              </button>
            </>
          )}
        </span>
      )}
    </span>
  );
}
