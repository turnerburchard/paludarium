import { useEffect, useState } from "react";
import { Check, Share2, X } from "lucide-react";
import { IconButton } from "./IconButton";
import { project } from "./project";

export function ShareButton() {
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 3000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function share() {
    setManual(false);
    if (navigator.share) {
      try {
        await navigator.share({
          title: project.title,
          text: project.description,
          url: project.url,
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setManual(true);
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(project.url);
      setCopied(true);
    } catch {
      setManual(true);
    }
  }
  return (
    <span className="share-control">
      <IconButton label="Share Paludarium" onClick={share}>
        {copied ? <Check size={19} /> : <Share2 size={19} />}
      </IconButton>
      {copied && (
        <span className="share-feedback" role="status">
          Link copied
        </span>
      )}
      {manual && (
        <span className="share-fallback">
          <span>
            Copy this link{" "}
            <IconButton
              label="Close share link"
              onClick={() => setManual(false)}
            >
              <X size={16} />
            </IconButton>
          </span>
          <input
            aria-label="Project link"
            readOnly
            value={project.url}
            onFocus={(event) => event.currentTarget.select()}
          />
        </span>
      )}
    </span>
  );
}
