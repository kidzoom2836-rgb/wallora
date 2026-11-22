import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  Pressable,
  Linking,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { Chip, EmptyState } from "../../components/ui/States";
import { VerifiedBadge } from "../../components/ui/VerifiedBadge";
import { apiJson } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { API_BASE, assetUrl } from "../../lib/config";
import { C, R, S } from "../../lib/theme";
import { withVerification } from "../../lib/verification";

type ShowroomItem = {
  id: string;
  type?: string | null;
  title?: string | null;
  imageUrl?: string | null;
  href?: string | null;
  wallpaperSlug?: string | null;
  projectId?: string | null;
  caption?: string | null;
  createdAt?: string | null;
};

type Showroom = {
  username: string;
  headline?: string | null;
  description?: string | null;
  updatedAt?: string;
  itemCount?: number;
  owner?: {
    username?: string;
    displayName?: string;
    avatarUrl?: string | null;
    tier?: string | null;
    userId?: string | null;
  } | null;
  items: ShowroomItem[];
};

type PickerWallpaper = {
  id: string;
  slug: string;
  title: string;
  status?: string | null;
  isPublic?: boolean | null;
  gridAsset?: { objectKey?: string | null } | null;
  asset?: { objectKey?: string | null } | null;
  assets?: { variant?: string | null; objectKey?: string | null }[];
};

type PickerProject = {
  id: string;
  name?: string | null;
  description?: string | null;
  coverUrl?: string | null;
  isPublic?: boolean | null;
};

type ProjectList = PickerProject[] | { items?: PickerProject[] };

type ItemRef = { wallpaperSlug?: string; projectId?: string };

type PickerOption = {
  key: string;
  label: string;
  meta?: string;
  image?: string | null;
  ref: ItemRef;
};

function dateLabel(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function projectItems(data: ProjectList | undefined): PickerProject[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.items ?? [];
}

function wallpaperImage(wallpaper: PickerWallpaper): string | undefined {
  return assetUrl(
    wallpaper.gridAsset?.objectKey ??
      wallpaper.asset?.objectKey ??
      wallpaper.assets?.find((asset) => asset.variant === "grid")?.objectKey ??
      wallpaper.assets?.[0]?.objectKey,
  );
}

/** Resolved showroom items carry display-only image URLs; save real refs only. */
function toSavedItem(item: ShowroomItem): Record<string, string> {
  const saved: Record<string, string> = { id: item.id };
  const caption = item.caption?.trim();
  if (caption) saved.caption = caption;
  if (item.createdAt) saved.createdAt = item.createdAt;

  if (item.wallpaperSlug) saved.wallpaperSlug = item.wallpaperSlug;
  else if (item.projectId) saved.projectId = item.projectId;
  else if (
    item.type === "image" &&
    item.imageUrl &&
    /^(https?:\/\/|\/)/i.test(item.imageUrl)
  ) {
    saved.imageUrl = item.imageUrl;
  }
  return saved;
}

export default function ShowroomDetailScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ username?: string | string[] }>();
  const username = Array.isArray(params.username) ? params.username[0] : params.username ?? "";
  const [room, setRoom] = useState<Showroom | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [headline, setHeadline] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [picker, setPicker] = useState<"wallpaper" | "project" | null>(null);
  const [pickerWallpapers, setPickerWallpapers] = useState<PickerWallpaper[]>([]);
  const [pickerProjects, setPickerProjects] = useState<PickerProject[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!username) {
      setError("No showroom was specified.");
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const data = await apiJson<Showroom>(
        `/api/v1/showroom/${encodeURIComponent(username)}`,
      );
      setRoom(data);
    } catch (e: any) {
      setError(e?.message ?? "Could not load this showroom.");
      setRoom(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [username]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const showroomHandle = room?.username ?? username;
  const ownerUsername = room?.owner?.username ?? room?.username ?? "";
  const isOwner =
    !!user &&
    !!room &&
    (room.owner?.userId
      ? room.owner.userId === user.id
      : !!user.username && ownerUsername.toLowerCase() === user.username.toLowerCase());

  const loadPickers = useCallback(async () => {
    setPickerLoading(true);
    setPickerError(null);
    const [walls, projects] = await Promise.allSettled([
      apiJson<{ items?: PickerWallpaper[] }>(
        "/api/v1/users/me/wallpapers?status=approved&limit=24",
      ),
      withVerification(async () =>
        projectItems(await apiJson<ProjectList>("/api/v1/projects")),
      ),
    ]);

    if (walls.status === "fulfilled") {
      setPickerWallpapers(
        (walls.value.items ?? []).filter(
          (wallpaper) =>
            wallpaper.status === "approved" && wallpaper.isPublic !== false,
        ),
      );
    } else {
      setPickerWallpapers([]);
    }

    if (projects.status === "fulfilled") {
      setPickerProjects(
        (projects.value ?? []).filter((project) => project.isPublic !== false),
      );
    } else {
      setPickerProjects([]);
    }

    if (projects.status === "fulfilled" && !projects.value) {
      setPickerError("Claim your free WALLORA tick to add projects.");
    } else if (walls.status === "rejected" || projects.status === "rejected") {
      setPickerError("Could not load all picker options. Try again in a moment.");
    }
    setPickerLoading(false);
  }, []);

  const startEditing = async () => {
    if (!room) return;
    setNotice(null);
    const ok = await withVerification(async () => true);
    if (!ok) {
      setNotice("Claim your free WALLORA tick to edit your showroom.");
      return;
    }
    setHeadline(room.headline ?? "");
    setDescription(room.description ?? "");
    setPicker(null);
    setEditing(true);
    void loadPickers();
  };

  const closeEditing = () => {
    setEditing(false);
    setPicker(null);
    setNotice(null);
  };

  const addItem = async (ref: ItemRef, label: string, optionKey: string) => {
    setBusyItemId(optionKey);
    setNotice(null);
    try {
      const updated = await withVerification(async () =>
        apiJson<Showroom>(
          `/api/v1/showroom/${encodeURIComponent(showroomHandle)}/items`,
          {
            method: "POST",
            body: JSON.stringify({ item: ref }),
          },
        ),
      );
      if (!updated) {
        setNotice("Claim your free WALLORA tick to change your showroom.");
        return;
      }
      setRoom(updated);
      setPicker(null);
      setNotice(`${label} added to your showroom.`);
    } catch (e: any) {
      setNotice(e?.message ?? "Could not add that item.");
    } finally {
      setBusyItemId(null);
    }
  };

  const removeItem = async (item: ShowroomItem) => {
    setBusyItemId(item.id);
    setNotice(null);
    try {
      const updated = await withVerification(async () =>
        apiJson<Showroom>(
          `/api/v1/showroom/${encodeURIComponent(showroomHandle)}/items?id=${encodeURIComponent(item.id)}`,
          { method: "DELETE" },
        ),
      );
      if (!updated) {
        setNotice("Claim your free WALLORA tick to change your showroom.");
        return;
      }
      setRoom(updated);
      setNotice("Item removed from your showroom.");
    } catch (e: any) {
      setNotice(e?.message ?? "Could not remove that item.");
    } finally {
      setBusyItemId(null);
    }
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    setRoom((prev) => {
      if (!prev) return prev;
      const target = index + direction;
      if (target < 0 || target >= prev.items.length) return prev;
      const nextItems = [...prev.items];
      [nextItems[index], nextItems[target]] = [nextItems[target], nextItems[index]];
      return { ...prev, items: nextItems };
    });
  };

  const saveShowroom = async () => {
    if (!room) return;
    setSaving(true);
    setNotice(null);
    try {
      const updated = await withVerification(async () =>
        apiJson<Showroom>("/api/v1/showroom", {
          method: "POST",
          body: JSON.stringify({
            headline: headline.trim() || "My WALLORA showroom",
            description: description.trim(),
            items: room.items.map(toSavedItem),
          }),
        }),
      );
      if (!updated) {
        setNotice("Claim your free WALLORA tick to save your showroom.");
        return;
      }
      setRoom(updated);
      setEditing(false);
      setPicker(null);
      setNotice("Showroom saved.");
    } catch (e: any) {
      setNotice(e?.message ?? "Could not save your showroom.");
    } finally {
      setSaving(false);
    }
  };

  const openItem = (item: ShowroomItem) => {
    if (editing) return;
    if (item.wallpaperSlug) {
      router.push({ pathname: "/wallpaper/[slug]", params: { slug: item.wallpaperSlug } });
      return;
    }
    if (item.projectId) {
      router.push({ pathname: "/showcase/[id]", params: { id: item.projectId } });
      return;
    }
    if (item.href) {
      void Linking.openURL(`${API_BASE}${item.href.startsWith("/") ? "" : "/"}${item.href}`).catch(() => {});
    }
  };

  const items = Array.isArray(room?.items) ? room!.items : [];
  const ownerName = room?.owner?.displayName ?? room?.username ?? username ?? "WALLORA creator";
  const pickerOptions: PickerOption[] =
    picker === "wallpaper"
      ? pickerWallpapers
          .filter((wallpaper) => !!wallpaper.slug)
          .map((wallpaper) => ({
            key: `wallpaper-${wallpaper.id}`,
            label: wallpaper.title,
            meta: "Wallpaper",
            image: wallpaperImage(wallpaper),
            ref: { wallpaperSlug: wallpaper.slug },
          }))
      : pickerProjects.map((project) => ({
          key: `project-${project.id}`,
          label: project.name ?? "Creative project",
          meta: "Project",
          image: project.coverUrl,
          ref: { projectId: project.id },
        }));

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Showroom"
        subtitle={room ? `@${room.username}` : "Loading showroom"}
        right={
          isOwner ? (
            <Pressable
              onPress={() => (editing ? closeEditing() : void startEditing())}
              style={({ pressed }) => [styles.headerButton, pressed && styles.tilePressed]}
            >
              <Ionicons
                name={editing ? "close-outline" : "create-outline"}
                size={14}
                color={C.accent}
              />
              <Text style={styles.headerButtonText}>{editing ? "Close" : "Edit"}</Text>
            </Pressable>
          ) : undefined
        }
      />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          editing ? undefined : (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
              tintColor={C.accent}
            />
          )
        }
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            {loading ? (
              <View style={styles.inlineState}>
                <ActivityIndicator color={C.accent} size="small" />
                <Text style={styles.stateSub}>Loading this showroom…</Text>
              </View>
            ) : null}
            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={18} color={C.error} />
                <Text style={styles.errorText}>{error}</Text>
                <Pressable onPress={() => { setLoading(true); void load(); }}>
                  <Text style={styles.retryText}>Try again</Text>
                </Pressable>
              </View>
            ) : null}
            {notice ? (
              <View style={styles.noticeBox}>
                <Ionicons name="information-circle-outline" size={16} color={C.accent} />
                <Text style={styles.noticeText}>{notice}</Text>
              </View>
            ) : null}
            {room ? (
              <>
                <View style={styles.ownerRow}>
                  <View style={styles.avatar}>
                    {assetUrl(room.owner?.avatarUrl) ? (
                      <Image source={{ uri: assetUrl(room.owner?.avatarUrl) }} style={styles.avatarImage} />
                    ) : (
                      <Ionicons name="person-outline" size={20} color={C.accent} />
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.nameRow}>
                      <Text style={styles.ownerName} numberOfLines={1}>
                        {ownerName}
                      </Text>
                      <VerifiedBadge tier={room.owner?.tier} size="sm" />
                    </View>
                    <Text style={styles.handle}>@{room.username}</Text>
                  </View>
                </View>

                {editing ? (
                  <View style={styles.editor}>
                    <Text style={styles.sectionLabel}>EDIT DETAILS</Text>
                    <Text style={styles.fieldLabel}>Headline</Text>
                    <TextInput
                      value={headline}
                      onChangeText={setHeadline}
                      placeholder="My WALLORA showroom"
                      placeholderTextColor={C.mutedDark}
                      maxLength={120}
                      style={styles.input}
                    />
                    <Text style={styles.fieldLabel}>Description</Text>
                    <TextInput
                      value={description}
                      onChangeText={setDescription}
                      placeholder="Tell visitors what this collection is about"
                      placeholderTextColor={C.mutedDark}
                      multiline
                      textAlignVertical="top"
                      maxLength={1000}
                      style={[styles.input, styles.textArea]}
                    />
                    <Pressable
                      onPress={() => void saveShowroom()}
                      disabled={saving}
                      style={[styles.saveButton, saving && styles.buttonDisabled]}
                    >
                      {saving ? (
                        <ActivityIndicator color={C.bg} size="small" />
                      ) : (
                        <Ionicons name="save-outline" size={15} color={C.bg} />
                      )}
                      <Text style={styles.saveButtonText}>Save changes</Text>
                    </Pressable>
                    <Text style={styles.helper}>
                      Added and removed items save immediately. Use the arrows on a tile to reorder, then
                      save your changes.
                    </Text>

                    <View style={styles.pickerTabs}>
                      <Chip
                        label="Add wallpaper"
                        icon="image-outline"
                        active={picker === "wallpaper"}
                        onPress={() => setPicker(picker === "wallpaper" ? null : "wallpaper")}
                      />
                      <Chip
                        label="Add project"
                        icon="folder-outline"
                        active={picker === "project"}
                        onPress={() => setPicker(picker === "project" ? null : "project")}
                      />
                    </View>

                    {picker ? (
                      <View style={styles.pickerPanel}>
                        {pickerLoading ? (
                          <View style={styles.inlineState}>
                            <ActivityIndicator color={C.accent} size="small" />
                            <Text style={styles.stateSub}>Loading your work…</Text>
                          </View>
                        ) : null}
                        {!pickerLoading && pickerError ? (
                          <Text style={styles.pickerError}>{pickerError}</Text>
                        ) : null}
                        {!pickerLoading && !pickerError && pickerOptions.length === 0 ? (
                          <EmptyState
                            icon={picker === "wallpaper" ? "images-outline" : "folder-outline"}
                            title={picker === "wallpaper" ? "No approved wallpapers yet" : "No public projects yet"}
                            message={
                              picker === "wallpaper"
                                ? "Only approved, public wallpapers can be featured."
                                : "Publish a project on WALLORA before featuring it here."
                            }
                          />
                        ) : null}
                        {!pickerLoading && !pickerError
                          ? pickerOptions.map((option) => (
                              <Pressable
                                key={option.key}
                                onPress={() => void addItem(option.ref, option.meta ?? "Item", option.key)}
                                disabled={!!busyItemId}
                                style={({ pressed }) => [
                                  styles.pickerRow,
                                  pressed && styles.tilePressed,
                                  busyItemId === option.key && styles.buttonDisabled,
                                ]}
                              >
                                <View style={styles.pickerImageWrap}>
                                  {assetUrl(option.image) ? (
                                    <Image
                                      source={{ uri: assetUrl(option.image) }}
                                      style={styles.pickerImage}
                                      resizeMode="cover"
                                    />
                                  ) : (
                                    <Ionicons
                                      name={picker === "wallpaper" ? "image-outline" : "folder-outline"}
                                      size={18}
                                      color={C.accent}
                                    />
                                  )}
                                </View>
                                <View style={{ flex: 1, minWidth: 0 }}>
                                  <Text style={styles.pickerName} numberOfLines={1}>
                                    {option.label}
                                  </Text>
                                  <Text style={styles.pickerMeta}>{option.meta}</Text>
                                </View>
                                <Ionicons name="add-outline" size={18} color={C.accent} />
                              </Pressable>
                            ))
                          : null}
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <>
                    <Text style={styles.headline}>{room.headline ?? `@${room.username}`}</Text>
                    {room.description ? <Text style={styles.description}>{room.description}</Text> : null}

                    <View style={styles.stats}>
                      <View style={styles.stat}>
                        <Ionicons name="grid-outline" size={15} color={C.accent} />
                        <Text style={styles.statText}>{room.itemCount ?? items.length} items</Text>
                      </View>
                      <View style={styles.stat}>
                        <Ionicons name="time-outline" size={15} color={C.muted} />
                        <Text style={styles.statText}>Updated {dateLabel(room.updatedAt) || "recently"}</Text>
                      </View>
                    </View>
                  </>
                )}

                <Text style={styles.sectionLabel}>GALLERY</Text>
              </>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !loading && !error ? (
            <View style={styles.state}>
              <Ionicons name="images-outline" size={40} color={C.muted} />
              <Text style={styles.stateText}>This showroom is empty</Text>
              <Text style={styles.stateSub}>
                {editing
                  ? "Use Add wallpaper or Add project above to feature real work."
                  : "Its owner has not added any items yet."}
              </Text>
            </View>
          ) : undefined
        }
        renderItem={({ item, index }) => {
          const uri = assetUrl(item.imageUrl);
          const removing = busyItemId === item.id;
          return (
            <Pressable
              onPress={() => openItem(item)}
              disabled={editing}
              style={({ pressed }) => [
                styles.tile,
                pressed && styles.tilePressed,
                editing && styles.tileEditing,
              ]}
            >
              <View style={styles.tileImageWrap}>
                {uri ? (
                  <Image source={{ uri }} style={styles.tileImage} resizeMode="cover" />
                ) : (
                  <View style={styles.tileFallback}>
                    <Ionicons name="image-outline" size={24} color={C.mutedDark} />
                  </View>
                )}
              </View>
              <View style={styles.tileFooter}>
                <Text style={styles.tileTitle} numberOfLines={2}>
                  {item.title ?? item.caption ?? item.type ?? "Showroom item"}
                </Text>
                {editing ? (
                  <View style={styles.tileControls}>
                    <Pressable
                      onPress={() => moveItem(index, -1)}
                      disabled={index === 0 || saving || !!busyItemId}
                      hitSlop={6}
                      style={styles.controlButton}
                    >
                      <Ionicons
                        name="arrow-up-outline"
                        size={13}
                        color={index === 0 ? C.mutedDark : C.textSoft}
                      />
                    </Pressable>
                    <Pressable
                      onPress={() => moveItem(index, 1)}
                      disabled={index === items.length - 1 || saving || !!busyItemId}
                      hitSlop={6}
                      style={styles.controlButton}
                    >
                      <Ionicons
                        name="arrow-down-outline"
                        size={13}
                        color={index === items.length - 1 ? C.mutedDark : C.textSoft}
                      />
                    </Pressable>
                    <Pressable
                      onPress={() => void removeItem(item)}
                      disabled={!!busyItemId}
                      hitSlop={6}
                      style={styles.controlButton}
                    >
                      {removing ? (
                        <ActivityIndicator color={C.error} size="small" />
                      ) : (
                        <Ionicons name="trash-outline" size={13} color={C.error} />
                      )}
                    </Pressable>
                  </View>
                ) : (
                  <Ionicons name="open-outline" size={13} color={C.accent} />
                )}
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  list: { paddingHorizontal: S.lg, paddingBottom: S.xxxl },
  headerBlock: { paddingTop: S.lg },
  headerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: S.sm,
    paddingVertical: 7,
    borderRadius: R.pill,
    backgroundColor: C.accentDim,
    borderWidth: 1,
    borderColor: C.accent + "55",
  },
  headerButtonText: { color: C.accent, fontSize: 11, fontWeight: "800" },
  noticeBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: S.sm,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.accent + "55",
    borderRadius: R.md,
    padding: S.md,
    marginBottom: S.md,
  },
  noticeText: { flex: 1, color: C.textSoft, fontSize: 12, lineHeight: 18 },
  ownerRow: { flexDirection: "row", alignItems: "center", gap: S.sm },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: C.raised,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: { width: 46, height: 46 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  ownerName: { fontSize: 16, fontWeight: "800", color: C.text, flexShrink: 1 },
  handle: { fontSize: 12, color: C.muted, marginTop: 2 },
  headline: { fontSize: 22, fontWeight: "800", color: C.text, marginTop: S.lg },
  description: { fontSize: 13, color: C.textSoft, lineHeight: 20, marginTop: S.sm },
  stats: { flexDirection: "row", gap: S.lg, marginTop: S.md },
  stat: { flexDirection: "row", alignItems: "center", gap: 6 },
  statText: { fontSize: 12, color: C.muted },
  sectionLabel: {
    fontSize: 10,
    letterSpacing: 1.6,
    fontWeight: "800",
    color: C.accent,
    marginTop: S.xl,
    marginBottom: S.sm,
  },
  editor: {
    marginTop: S.lg,
    padding: S.md,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.lg,
  },
  fieldLabel: { color: C.muted, fontSize: 10, fontWeight: "800", marginBottom: 6, marginTop: S.sm },
  input: {
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    paddingHorizontal: S.md,
    paddingVertical: S.sm,
    color: C.text,
    fontSize: 13,
  },
  textArea: { minHeight: 84, lineHeight: 19 },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: S.md,
    paddingVertical: 11,
    borderRadius: R.md,
    backgroundColor: C.accent,
  },
  saveButtonText: { color: C.bg, fontSize: 12, fontWeight: "800" },
  buttonDisabled: { opacity: 0.6 },
  helper: { color: C.muted, fontSize: 11, lineHeight: 17, marginTop: S.sm },
  pickerTabs: { flexDirection: "row", flexWrap: "wrap", gap: S.sm, marginTop: S.md },
  pickerPanel: {
    marginTop: S.sm,
    borderTopWidth: 1,
    borderTopColor: C.borderSoft,
    paddingTop: S.sm,
  },
  pickerError: { color: C.error, fontSize: 12, lineHeight: 18, paddingVertical: S.sm },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: S.sm,
    paddingVertical: S.sm,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSoft,
  },
  pickerImageWrap: {
    width: 42,
    height: 42,
    borderRadius: R.sm,
    backgroundColor: C.raised,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  pickerImage: { width: 42, height: 42 },
  pickerName: { color: C.text, fontSize: 12, fontWeight: "700" },
  pickerMeta: { color: C.muted, fontSize: 10, marginTop: 3 },
  gridRow: { gap: S.sm, marginBottom: S.sm },
  tile: {
    flex: 1,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    overflow: "hidden",
  },
  tilePressed: { opacity: 0.8 },
  tileEditing: { borderColor: C.accent + "77" },
  tileImageWrap: { width: "100%", aspectRatio: 0.8, backgroundColor: C.raised },
  tileImage: { width: "100%", height: "100%" },
  tileFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  tileFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: S.xs,
    padding: S.sm,
  },
  tileTitle: { flex: 1, fontSize: 12, fontWeight: "700", color: C.text },
  tileControls: { flexDirection: "row", alignItems: "center", gap: 2 },
  controlButton: { padding: 5, borderRadius: R.sm, backgroundColor: C.raised },
  inlineState: { flexDirection: "row", alignItems: "center", gap: S.sm },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: S.sm,
    backgroundColor: C.errorDim,
    borderWidth: 1,
    borderColor: C.error + "55",
    borderRadius: R.md,
    padding: S.md,
  },
  errorText: { flex: 1, color: C.error, fontSize: 12 },
  retryText: { color: C.accent, fontSize: 12, fontWeight: "800" },
  state: { alignItems: "center", paddingVertical: 72, gap: S.sm },
  stateText: { fontSize: 15, fontWeight: "700", color: C.text, textAlign: "center", marginTop: 6 },
  stateSub: { fontSize: 12, color: C.muted, textAlign: "center", paddingHorizontal: S.xl, lineHeight: 18 },
});
