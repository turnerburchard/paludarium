import type { Preset } from "../model/presets";

export function EmptyInvitation({
  onPreset,
}: {
  onPreset: (preset: Preset) => void;
}) {
  return (
    <div className="empty-invitation">
      <div>
        <button onClick={() => onPreset("tropical")}>Cloud forest</button>
        <button className="text-button" onClick={() => onPreset("mountain")}>
          Alpine creek
        </button>
      </div>
    </div>
  );
}
