import { Component, type ErrorInfo, type ReactNode } from "react";
import { hideSplash } from "./splash";

/** Keeps the world controls usable if WebGL or the scene crashes. */
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
    hideSplash();
  }
  render() {
    return this.state.error ? (
      <div className="webgl-fallback">
        <strong>The scene could not start.</strong>
        <p>
          Try reloading in a browser with WebGL enabled. You can still export
          your saved world from Worlds.
        </p>
      </div>
    ) : (
      this.props.children
    );
  }
}
