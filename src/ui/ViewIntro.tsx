export function ViewIntro({
  onAbout,
  sharedName,
}: {
  onAbout: () => void;
  sharedName?: string;
}) {
  return (
    <div className="view-intro">
      <h1>{sharedName ?? "Paludarium"}</h1>
      <p>
        {sharedName
          ? "A world shared with you. Yours to explore."
          : "A tiny living world. Yours to shape."}
      </p>
      <div className="view-intro-actions">
        <button onClick={onAbout}>What can I do here?</button>
        {sharedName && (
          <a href={location.pathname + location.search}>Back to my world</a>
        )}
      </div>
    </div>
  );
}
