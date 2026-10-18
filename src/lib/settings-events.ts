export const SETTINGS_EVENT = "regalia:settings";

export function notifySettingsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SETTINGS_EVENT));
}
