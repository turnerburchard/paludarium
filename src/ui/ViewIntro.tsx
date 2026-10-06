export function ViewIntro({ onAbout }: { onAbout: () => void }) {
  return (
    <div className="view-intro">
      <h1>Paludarium</h1>
      <p>A tiny living world. Yours to shape.</p>
      <button onClick={onAbout}>What can I do here?</button>
    </div>
  );
}
