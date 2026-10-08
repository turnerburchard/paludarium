const HELP_DISMISSED_KEY = "paludarium:help-dismissed";

export function hasDismissedHelp(): boolean {
  try {
    return localStorage.getItem(HELP_DISMISSED_KEY) === "yes";
  } catch {
    return false;
  }
}

export function rememberHelpDismissal(): void {
  try {
    localStorage.setItem(HELP_DISMISSED_KEY, "yes");
  } catch {
    // Help still closes when browser storage is unavailable.
  }
}
