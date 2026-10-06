import { Component, type ErrorInfo, type ReactNode } from "react";

/** Keeps the toolbar (and export) usable if WebGL or the scene crashes. */
export class SceneBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Terrarium renderer", error, info);
  }
  render() {
    return this.state.error ? (
      <div className="webgl-fallback">
        <strong>The scene could not start.</strong>
        <p>
          Try reloading in a browser with WebGL enabled. You can still export
          your saved world from the toolbar.
        </p>
      </div>
    ) : (
      this.props.children
    );
  }
}
