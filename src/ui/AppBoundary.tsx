import { Component, type ErrorInfo, type ReactNode } from "react";
import { hideSplash } from "./splash";

/** Offers a way out if the app itself crashes, rather than leaving the
 * loading screen up or a blank page. */
export class AppBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Paludarium", error, info);
    hideSplash();
  }
  render() {
    return this.state.error ? (
      <main className="app-error" role="alert">
        <strong>Something went wrong.</strong>
        <p>Reloading the page usually fixes it.</p>
        <button className="intro-build-button" onClick={reloadFresh}>
          Reload
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}

/** Like a hard refresh: the page is fetched past the browser's cache first,
 * so a copy from before the latest deploy can't come back. */
function reloadFresh() {
  void fetch(location.href, { cache: "reload" }).finally(() =>
    location.reload(),
  );
}
