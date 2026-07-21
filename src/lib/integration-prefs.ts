/** Client-side integration toggles + local API keys (demo). */

export type IntegrationPrefs = {
  disabled: string[];
  apiKeys: { id: string; name: string; prefix: string; createdAt: string }[];
  lastChecked: Record<string, string>;
};

const KEY = "rbiap.integration-prefs.v1";

export function loadIntegrationPrefs(): IntegrationPrefs {
  if (typeof window === "undefined") {
    return { disabled: [], apiKeys: [], lastChecked: {} };
  }
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { disabled: [], apiKeys: [], lastChecked: {} };
    const parsed = JSON.parse(raw) as Partial<IntegrationPrefs>;
    return {
      disabled: Array.isArray(parsed.disabled) ? parsed.disabled.map(String) : [],
      apiKeys: Array.isArray(parsed.apiKeys)
        ? parsed.apiKeys.map((k) => ({
            id: String(k.id),
            name: String(k.name),
            prefix: String(k.prefix),
            createdAt: String(k.createdAt),
          }))
        : [],
      lastChecked:
        parsed.lastChecked && typeof parsed.lastChecked === "object"
          ? Object.fromEntries(
              Object.entries(parsed.lastChecked).map(([k, v]) => [k, String(v)]),
            )
          : {},
    };
  } catch {
    return { disabled: [], apiKeys: [], lastChecked: {} };
  }
}

export function saveIntegrationPrefs(prefs: IntegrationPrefs) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(prefs));
  window.dispatchEvent(new CustomEvent("rbiap:integration-prefs"));
}

export function setIntegrationEnabled(id: string, enabled: boolean) {
  const prefs = loadIntegrationPrefs();
  const disabled = new Set(prefs.disabled);
  if (enabled) disabled.delete(id);
  else disabled.add(id);
  saveIntegrationPrefs({ ...prefs, disabled: [...disabled] });
}

export function markIntegrationChecked(id: string) {
  const prefs = loadIntegrationPrefs();
  saveIntegrationPrefs({
    ...prefs,
    lastChecked: { ...prefs.lastChecked, [id]: new Date().toISOString() },
  });
}

export function createLocalApiKey(name: string) {
  const prefs = loadIntegrationPrefs();
  const rand = crypto.getRandomValues(new Uint8Array(16));
  const secret = Array.from(rand, (b) => b.toString(16).padStart(2, "0")).join("");
  const full = `rbiap_${secret}`;
  const entry = {
    id: crypto.randomUUID(),
    name: name.trim() || "API key",
    prefix: `${full.slice(0, 12)}…`,
    createdAt: new Date().toISOString(),
  };
  saveIntegrationPrefs({ ...prefs, apiKeys: [entry, ...prefs.apiKeys].slice(0, 10) });
  return { ...entry, secret: full };
}

export function revokeLocalApiKey(id: string) {
  const prefs = loadIntegrationPrefs();
  saveIntegrationPrefs({
    ...prefs,
    apiKeys: prefs.apiKeys.filter((k) => k.id !== id),
  });
}
