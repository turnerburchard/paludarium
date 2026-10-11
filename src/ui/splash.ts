/** Fades out the loading screen from index.html. */
export function hideSplash() {
  document.getElementById("splash")?.classList.add("hidden");
}

/** Brings the loading screen back at once, without fading in. */
export function showSplash() {
  document.getElementById("splash")?.classList.remove("hidden");
}
