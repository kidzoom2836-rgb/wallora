export type WebDownload = {
  id: string;
  slug: string;
  title: string;
  creator: string | null;
  filename: string;
  remoteUrl: string;
  previewUrl: string | null;
  variant?: string;
  downloadedAt: number;
};

const STORAGE_KEY = "wallora.downloads.v1";
const MAX_ITEMS = 100;

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `dl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Browser-local download index. The actual file lives at remoteUrl. */
export function readDownloads(): WebDownload[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WebDownload[]) : [];
  } catch {
    return [];
  }
}

function writeDownloads(items: WebDownload[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
}

export function recordDownload(
  entry: Omit<WebDownload, "id" | "downloadedAt">,
): WebDownload {
  const record: WebDownload = {
    ...entry,
    id: createId(),
    downloadedAt: Date.now(),
  };
  const items = readDownloads().filter(
    (item) => !(item.slug === entry.slug && item.filename === entry.filename),
  );
  writeDownloads([record, ...items]);
  return record;
}

export function removeDownload(id: string) {
  writeDownloads(readDownloads().filter((item) => item.id !== id));
}

export function clearDownloads() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
