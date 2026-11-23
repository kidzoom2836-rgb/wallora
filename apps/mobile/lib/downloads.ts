import { Directory, File, Paths } from "expo-file-system";
import { Album, Asset, requestPermissionsAsync } from "expo-media-library";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type DownloadedWallpaper = {
  id: string;
  title: string;
  remoteUrl: string;
  localUri: string;
  slug?: string;
  creator?: string;
  createdAt: number;
  bytes?: number;
  width?: number;
  height?: number;
};

const INDEX_KEY = "wallora.downloads.v1";
const ALBUM_NAME = "WALLORA";

function safeFileName(title: string, id: string) {
  const clean =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "wallpaper";
  return `${clean}-${id.slice(0, 8)}.jpg`;
}

export async function readDownloads(): Promise<DownloadedWallpaper[]> {
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeDownloads(items: DownloadedWallpaper[]) {
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(items));
}

/** Download a remote wallpaper into app storage and record it in the local index. */
export async function downloadWallpaper(input: {
  id: string;
  title: string;
  remoteUrl: string;
  slug?: string;
  creator?: string;
  width?: number;
  height?: number;
}): Promise<DownloadedWallpaper> {
  const existing = (await readDownloads()).find((d) => d.id === input.id);
  if (existing) return existing;

  const dir = new Directory(Paths.document, "wallora-downloads");
  dir.create({ intermediates: true, idempotent: true });

  const destination = new File(dir, safeFileName(input.title, input.id));
  const output = await File.downloadFileAsync(input.remoteUrl, destination, {
    idempotent: true,
  });

  const item: DownloadedWallpaper = {
    id: input.id,
    title: input.title,
    remoteUrl: input.remoteUrl,
    localUri: output.uri,
    slug: input.slug,
    creator: input.creator,
    createdAt: Date.now(),
    bytes: output.size || undefined,
    width: input.width,
    height: input.height,
  };

  const items = await readDownloads();
  await writeDownloads([item, ...items.filter((d) => d.id !== item.id)]);
  return item;
}

export async function removeDownload(id: string) {
  const items = await readDownloads();
  const item = items.find((d) => d.id === id);
  if (item) {
    const file = new File(item.localUri);
    if (file.exists) file.delete();
  }
  await writeDownloads(items.filter((d) => d.id !== id));
}

/**
 * Save the local copy into the device gallery album so the OS viewer can apply
 * it as a wallpaper. Expo does not expose a cross-platform "set wallpaper" API.
 */
export async function addAsWallpaper(item: DownloadedWallpaper) {
  // Ask only for photo access. The default requests audio (and video) on
  // Android 13+, which is unrelated to saving a wallpaper.
  const { status } = await requestPermissionsAsync(false, ["photo"]);
  if (status !== "granted")
    throw new Error("Gallery permission is required to add a wallpaper.");

  const file = new File(item.localUri);
  if (!file.exists)
    throw new Error("This download is missing from the device.");

  const asset = await Asset.create(file.uri);
  const album = await Album.get(ALBUM_NAME);
  if (album) {
    await album.add([asset]);
    return asset;
  }
  return Album.create(ALBUM_NAME, [asset]);
}
