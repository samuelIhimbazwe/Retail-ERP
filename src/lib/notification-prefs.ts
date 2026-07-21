/** Client-side prefs for derived alerts (read / dismissed). */

export type NotificationPrefs = {
  read: string[];
  dismissed: string[];
};

const KEY = "rbiap.notification-prefs.v1";

export function loadNotificationPrefs(): NotificationPrefs {
  if (typeof window === "undefined") return { read: [], dismissed: [] };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { read: [], dismissed: [] };
    const parsed = JSON.parse(raw) as Partial<NotificationPrefs>;
    return {
      read: Array.isArray(parsed.read) ? parsed.read.map(String) : [],
      dismissed: Array.isArray(parsed.dismissed) ? parsed.dismissed.map(String) : [],
    };
  } catch {
    return { read: [], dismissed: [] };
  }
}

export function saveNotificationPrefs(prefs: NotificationPrefs) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(prefs));
  window.dispatchEvent(new CustomEvent("rbiap:notification-prefs"));
}

export function markNotificationsRead(ids: string[]) {
  const prefs = loadNotificationPrefs();
  const next = new Set(prefs.read);
  for (const id of ids) next.add(id);
  saveNotificationPrefs({ ...prefs, read: [...next] });
}

export function dismissNotifications(ids: string[]) {
  const prefs = loadNotificationPrefs();
  const dismissed = new Set(prefs.dismissed);
  const read = new Set(prefs.read);
  for (const id of ids) {
    dismissed.add(id);
    read.add(id);
  }
  saveNotificationPrefs({ read: [...read], dismissed: [...dismissed] });
}

export function restoreNotifications(ids: string[]) {
  const prefs = loadNotificationPrefs();
  const skip = new Set(ids);
  saveNotificationPrefs({
    read: prefs.read.filter((id) => !skip.has(id)),
    dismissed: prefs.dismissed.filter((id) => !skip.has(id)),
  });
}

export function clearAllNotificationPrefs() {
  saveNotificationPrefs({ read: [], dismissed: [] });
}
