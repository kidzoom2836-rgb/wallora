import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  Linking,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  TextInput,
  ScrollView,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { ScreenHeader } from "../components/ui/ScreenHeader";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import { apiFetch, apiJson } from "../lib/api";
import { API_BASE } from "../lib/config";
import { C, R, S } from "../lib/theme";
import { useAuth } from "../lib/auth";

type Site = {
  id: string;
  slug: string;
  title: string;
  prompt: string;
  html?: string;
  published?: boolean;
  externalPublished?: boolean;
  forSale?: boolean;
  priceCents?: number;
  model?: string;
  createdAt?: string;
  updatedAt?: string;
};

type PublicSite = {
  id: string;
  slug: string;
  title?: string | null;
  prompt?: string | null;
  forSale?: boolean;
  priceCents?: number;
  createdAt?: string;
};

type BuildResult = { site: Site; stages?: string[]; model?: string };
type SiteResult = { site: Site };
type PublishResult = { site: Site; internalUrl: string; externalUrl: string | null };

const STARTERS = [
  "A dark portfolio site for a motion designer with a project grid and contact form",
  "A SaaS landing page for an AI note-taking app with pricing tiers and FAQ",
  "A café menu and ordering app with a cart that persists in local storage",
  "A personal dashboard with task list, stats cards and a weekly chart",
];

const CODE_FONT = Platform.OS === "ios" ? "Menlo" : "monospace";

function dateLabel(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function messageOf(e: any, fallback: string) {
  return e?.message ?? fallback;
}

function priceLabel(cents?: number) {
  const value = typeof cents === "number" ? cents : 0;
  return value === 0 ? "Free" : `$${(value / 100).toFixed(2)}`;
}

export default function BuilderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ site?: string | string[] }>();
  const siteParam = Array.isArray(params.site) ? params.site[0] : params.site ?? "";
  const { user, loading: authLoading } = useAuth();

  const [ownedSites, setOwnedSites] = useState<Site[]>([]);
  const [publicSites, setPublicSites] = useState<PublicSite[]>([]);
  const [loadingOwned, setLoadingOwned] = useState(true);
  const [loadingPublic, setLoadingPublic] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorOwned, setErrorOwned] = useState<string | null>(null);
  const [errorPublic, setErrorPublic] = useState<string | null>(null);

  const [selected, setSelected] = useState<Site | null>(null);
  const [loadingSelected, setLoadingSelected] = useState(false);
  const [errorSelected, setErrorSelected] = useState<string | null>(null);

  const [promptText, setPromptText] = useState("");
  const [buildError, setBuildError] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftPrompt, setDraftPrompt] = useState("");
  const [draftHtml, setDraftHtml] = useState("");
  const [price, setPrice] = useState("49");

  const [building, setBuilding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [rawLoading, setRawLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3200);
    return () => clearTimeout(timer);
  }, [notice]);

  const loadOwned = useCallback(async () => {
    if (!user) {
      setOwnedSites([]);
      setErrorOwned(null);
      setLoadingOwned(false);
      return;
    }
    setErrorOwned(null);
    setLoadingOwned(true);
    try {
      const data = await apiJson<{ sites: Site[] }>("/api/v1/sites");
      setOwnedSites(Array.isArray(data?.sites) ? data.sites : []);
    } catch (e: any) {
      setErrorOwned(messageOf(e, "Could not load your sites."));
      setOwnedSites([]);
    } finally {
      setLoadingOwned(false);
    }
  }, [user]);

  const loadPublic = useCallback(async () => {
    setErrorPublic(null);
    try {
      const data = await apiJson<{ sites: PublicSite[] }>("/api/v1/sites/public");
      setPublicSites(Array.isArray(data?.sites) ? data.sites : []);
    } catch (e: any) {
      setErrorPublic(messageOf(e, "Could not load public sites."));
      setPublicSites([]);
    } finally {
      setLoadingPublic(false);
    }
  }, []);

  const loadSelected = useCallback(async (id: string) => {
    if (!id) {
      setSelected(null);
      setErrorSelected(null);
      setLoadingSelected(false);
      setDraftTitle("");
      setDraftPrompt("");
      setDraftHtml("");
      return;
    }
    setLoadingSelected(true);
    setErrorSelected(null);
    try {
      const data = await apiJson<SiteResult>(`/api/v1/sites/${encodeURIComponent(id)}`);
      const site = data?.site ?? null;
      setSelected(site);
      setDraftTitle(site?.title ?? "");
      setDraftPrompt(site?.prompt ?? "");
      setDraftHtml(site?.html ?? "");
      setPrice(typeof site?.priceCents === "number" ? (site.priceCents / 100).toFixed(2) : "49");
    } catch (e: any) {
      setErrorSelected(messageOf(e, "Could not load this site."));
      setSelected(null);
    } finally {
      setLoadingSelected(false);
    }
  }, []);

  useEffect(() => {
    void loadPublic();
  }, [loadPublic]);

  useEffect(() => {
    void loadOwned();
  }, [loadOwned]);

  useEffect(() => {
    void loadSelected(siteParam);
  }, [loadSelected, siteParam]);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      loadPublic(),
      loadOwned(),
      siteParam ? loadSelected(siteParam) : Promise.resolve(),
    ]);
    setRefreshing(false);
  }, [loadPublic, loadOwned, loadSelected, siteParam]);

  const openUrl = async (url: string, failure: string) => {
    setOpenError(null);
    try {
      await Linking.openURL(url);
    } catch {
      setOpenError(failure);
    }
  };

  const selectSite = (id: string) => {
    setNotice(null);
    setActionError(null);
    router.setParams({ site: id });
  };

  const clearSelection = () => router.setParams({ site: "" });

  const buildSite = async () => {
    const value = promptText.trim();
    if (!value || building) return;
    setBuilding(true);
    setBuildError(null);
    setActionError(null);
    try {
      const data = await apiJson<BuildResult>("/api/v1/sites", {
        method: "POST",
        body: JSON.stringify({ prompt: value }),
      });
      setPromptText("");
      setNotice("Site built. Preview, edit and publish it below.");
      await loadOwned();
      if (data?.site?.id) router.setParams({ site: data.site.id });
    } catch (e: any) {
      setBuildError(messageOf(e, "Could not build the site."));
    } finally {
      setBuilding(false);
    }
  };

  const saveChanges = async () => {
    if (!selected || saving) return;
    const id = selected.id;
    const title = draftTitle.trim();
    const nextPrompt = draftPrompt.trim();
    if (!title) {
      setActionError("Give the site a title before saving.");
      return;
    }
    setSaving(true);
    setActionError(null);
    setNotice(null);
    try {
      const promptChanged = nextPrompt !== (selected.prompt ?? "").trim();
      let current: Site = selected;
      if (promptChanged) {
        // PATCH does not regenerate code. Posting with siteId is the supported
        // way to apply a new prompt and rewrite the generated site.
        const built = await apiJson<BuildResult>("/api/v1/sites", {
          method: "POST",
          body: JSON.stringify({ prompt: nextPrompt, siteId: id }),
        });
        if (built?.site) current = built.site;
      }
      const patch: Record<string, unknown> = { title, prompt: nextPrompt };
      if (!promptChanged) patch.html = draftHtml;
      const saved = await apiJson<SiteResult>(`/api/v1/sites/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      const finalSite = saved?.site ?? current;
      setSelected(finalSite);
      setDraftTitle(finalSite.title ?? title);
      setDraftPrompt(finalSite.prompt ?? nextPrompt);
      if (typeof finalSite.html === "string") setDraftHtml(finalSite.html);
      await loadOwned();
      setNotice(promptChanged ? "Prompt applied and site saved." : "Site changes saved.");
    } catch (e: any) {
      // Keep the user's edits on screen so they can retry the save.
      setActionError(messageOf(e, "Could not save this site."));
    } finally {
      setSaving(false);
    }
  };

  const publish = async (body: Record<string, unknown>, successMessage: string) => {
    const id = selected?.id;
    if (!id || publishing) return;
    setPublishing(true);
    setActionError(null);
    setNotice(null);
    try {
      const data = await apiJson<PublishResult>(
        `/api/v1/sites/${encodeURIComponent(id)}/publish`,
        { method: "POST", body: JSON.stringify(body) },
      );
      if (data?.site) setSelected(data.site);
      await loadOwned();
      setNotice(data?.externalUrl ? "Direct link is live." : successMessage);
    } catch (e: any) {
      setActionError(messageOf(e, "Could not update publishing settings."));
    } finally {
      setPublishing(false);
    }
  };

  const loadRaw = async () => {
    const id = selected?.id;
    if (!id || rawLoading) return;
    setRawLoading(true);
    setActionError(null);
    try {
      const res = await apiFetch(`/api/v1/sites/${encodeURIComponent(id)}/raw`);
      if (!res.ok) {
        throw new Error(
          res.status === 403
            ? "This site is private to its owner."
            : `Could not load raw HTML (${res.status}).`,
        );
      }
      const html = await res.text();
      setDraftHtml(html);
      setNotice("Raw HTML loaded into the editor.");
    } catch (e: any) {
      setActionError(messageOf(e, "Could not load raw HTML."));
    } finally {
      setRawLoading(false);
    }
  };

  const performDelete = async (id: string) => {
    setDeleting(true);
    setActionError(null);
    try {
      await apiJson(`/api/v1/sites/${encodeURIComponent(id)}`, { method: "DELETE" });
      setSelected(null);
      clearSelection();
      await loadOwned();
      setNotice("Site deleted.");
    } catch (e: any) {
      setActionError(messageOf(e, "Could not delete this site."));
    } finally {
      setDeleting(false);
    }
  };

  const confirmDelete = () => {
    if (!selected || deleting) return;
    Alert.alert("Delete site", `Delete "${selected.title}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void performDelete(selected.id) },
    ]);
  };

  const priceNumber = Number(price || 0);
  const priceCents = Number.isFinite(priceNumber)
    ? Math.max(0, Math.min(1000000, Math.round(priceNumber * 100)))
    : 0;

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Builder"
        subtitle={selected ? selected.title : "Create, publish and sell sites"}
        right={
          <Pressable onPress={() => void refreshAll()} hitSlop={10} style={styles.headerButton}>
            <Ionicons name="refresh-outline" size={19} color={C.accent} />
          </Pressable>
        }
      />

      <FlatList
        data={publicSites}
        keyExtractor={(item) => item.id ?? item.slug}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refreshAll()}
            tintColor={C.accent}
          />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.intro}>
              <View style={styles.introTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.eyebrow}>WALLORA BUILDER</Text>
                  <Text style={styles.title}>Build once, publish anywhere</Text>
                </View>
                <View style={styles.mark}>
                  <Ionicons name="code-slash-outline" size={22} color={C.accent} />
                </View>
              </View>
              <Text style={styles.subtitle}>
                Describe a site and WALLORA writes the full interface. Save it to your account,
                publish it and sell it from your library.
              </Text>
            </View>

            {!authLoading && !user ? (
              <Pressable style={styles.signInCard} onPress={() => router.push("/auth/login")}>
                <Ionicons name="lock-closed-outline" size={19} color={C.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.panelTitle}>Sign in to build</Text>
                  <Text style={styles.panelText}>
                    Sites are saved to your WALLORA account so you can edit, publish and sell them.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.accent} />
              </Pressable>
            ) : null}

            {user ? (
              <View style={styles.builderPanel}>
                <View style={styles.panelHeader}>
                  <View style={styles.panelIcon}>
                    <Ionicons name="color-wand-outline" size={21} color={C.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.panelTitle}>Generate a site</Text>
                    <Text style={styles.panelText}>
                      Building creates a private site in your library. Regeneration rewrites the
                      selected site from its prompt.
                    </Text>
                  </View>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.starterRow}
                >
                  {STARTERS.map((starter) => (
                    <Pressable
                      key={starter}
                      onPress={() => setPromptText(starter)}
                      style={styles.starterChip}
                    >
                      <Text style={styles.starterText} numberOfLines={2}>
                        {starter}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>

                <TextInput
                  value={promptText}
                  onChangeText={(text) => {
                    setPromptText(text);
                    setBuildError(null);
                  }}
                  style={[styles.input, styles.promptInput]}
                  placeholder="A portfolio site for a photographer with a dark gallery…"
                  placeholderTextColor={C.muted}
                  multiline
                  textAlignVertical="top"
                  maxLength={2000}
                  editable={!building}
                />
                <Pressable
                  onPress={() => void buildSite()}
                  disabled={!promptText.trim() || building}
                  style={[styles.primaryButton, (!promptText.trim() || building) && styles.buttonDisabled]}
                >
                  {building ? (
                    <ActivityIndicator color={C.bg} size="small" />
                  ) : (
                    <Ionicons name="sparkles-outline" size={16} color={C.bg} />
                  )}
                  <Text style={styles.primaryButtonText}>
                    {building ? "Building your site…" : "Build site"}
                  </Text>
                </Pressable>
                {buildError ? (
                  <View style={styles.inlineError}>
                    <Ionicons name="alert-circle-outline" size={15} color={C.error} />
                    <Text style={styles.inlineErrorText}>{buildError}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {user ? (
              <View style={styles.block}>
                <Text style={styles.sectionLabel}>MY SITES</Text>
                {loadingOwned ? (
                  <LoadingState label="Loading your sites…" />
                ) : errorOwned ? (
                  <ErrorState
                    message={errorOwned}
                    onRetry={() => {
                      setLoadingOwned(true);
                      void loadOwned();
                    }}
                  />
                ) : ownedSites.length === 0 ? (
                  <EmptyState
                    icon="folder-open-outline"
                    title="No sites yet"
                    message="Describe a site above to create your first one."
                  />
                ) : (
                  ownedSites.map((site) => (
                    <Pressable
                      key={site.id}
                      onPress={() => selectSite(site.id)}
                      style={[
                        styles.ownedRow,
                        siteParam === site.id && styles.ownedRowActive,
                      ]}
                    >
                      <View style={styles.ownedIcon}>
                        <Ionicons name="globe-outline" size={17} color={C.accent} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.ownedTitle} numberOfLines={1}>
                          {site.title || site.slug}
                        </Text>
                        <Text style={styles.siteSlug} numberOfLines={1}>
                          /sites/{site.slug}
                        </Text>
                      </View>
                      {!!site.published ? (
                        <View style={[styles.statusDot, { backgroundColor: C.success }]} />
                      ) : null}
                      {site.forSale ? (
                        <Ionicons name="pricetag-outline" size={15} color={C.gold} />
                      ) : null}
                      <Ionicons name="chevron-forward" size={16} color={C.muted} />
                    </Pressable>
                  ))
                )}
              </View>
            ) : null}

            {siteParam ? (
              <View style={styles.block}>
                <Text style={styles.sectionLabel}>SELECTED SITE</Text>
                {loadingSelected ? (
                  <LoadingState label="Loading site…" />
                ) : errorSelected || !selected ? (
                  <ErrorState
                    message={errorSelected ?? "Site not found."}
                    onRetry={() => void loadSelected(siteParam)}
                  />
                ) : (
                  <View style={styles.siteDetail}>
                    <View style={styles.siteTop}>
                      <View style={styles.siteIcon}>
                        <Ionicons name="globe-outline" size={18} color={C.accent} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.siteTitle} numberOfLines={2}>
                          {selected.title}
                        </Text>
                        <Text style={styles.siteSlug} numberOfLines={1}>
                          /sites/{selected.slug}
                        </Text>
                      </View>
                      <Pressable onPress={clearSelection} hitSlop={10}>
                        <Ionicons name="close-outline" size={20} color={C.muted} />
                      </Pressable>
                    </View>

                    <View style={styles.badgeRow}>
                      <View
                        style={[
                          styles.badge,
                          { backgroundColor: selected.published ? C.successDim : C.raised },
                        ]}
                      >
                        <Ionicons
                          name={selected.published ? "checkmark-circle-outline" : "lock-closed-outline"}
                          size={12}
                          color={selected.published ? C.success : C.muted}
                        />
                        <Text
                          style={[
                            styles.badgeText,
                            { color: selected.published ? C.success : C.muted },
                          ]}
                        >
                          {selected.published ? "Published" : "Private"}
                        </Text>
                      </View>
                      {selected.externalPublished ? (
                        <View style={[styles.badge, { backgroundColor: C.blueDim }]}>
                          <Ionicons name="link-outline" size={12} color={C.blue} />
                          <Text style={[styles.badgeText, { color: C.blue }]}>Direct link</Text>
                        </View>
                      ) : null}
                      {selected.forSale ? (
                        <View style={[styles.badge, { backgroundColor: C.goldDim }]}>
                          <Ionicons name="pricetag-outline" size={12} color={C.gold} />
                          <Text style={[styles.badgeText, { color: C.gold }]}>
                            {priceLabel(selected.priceCents)}
                          </Text>
                        </View>
                      ) : null}
                      {selected.model ? (
                        <Text style={styles.modelText} numberOfLines={1}>
                          {selected.model}
                        </Text>
                      ) : null}
                    </View>

                    <View style={styles.actionRow}>
                      <Pressable
                        onPress={() =>
                          void openUrl(
                            `${API_BASE}/sites/${selected.slug}`,
                            "Could not open the site preview.",
                          )
                        }
                        style={[styles.actionButton, styles.actionPrimary]}
                      >
                        <Ionicons name="eye-outline" size={15} color={C.bg} />
                        <Text style={styles.actionPrimaryText}>Preview</Text>
                      </Pressable>
                      <Pressable
                        onPress={() =>
                          void publish(
                            { published: !selected.published },
                            selected.published ? "Site unpublished." : "Site published inside WALLORA.",
                          )
                        }
                        disabled={publishing}
                        style={[styles.actionButton, styles.actionSecondary]}
                      >
                        <Ionicons
                          name={selected.published ? "cloud-offline-outline" : "cloud-upload-outline"}
                          size={15}
                          color={C.text}
                        />
                        <Text style={styles.actionText}>
                          {selected.published ? "Unpublish" : "Publish"}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={confirmDelete}
                        disabled={deleting}
                        style={[styles.actionButton, styles.actionDanger]}
                      >
                        {deleting ? (
                          <ActivityIndicator color={C.error} size="small" />
                        ) : (
                          <Ionicons name="trash-outline" size={15} color={C.error} />
                        )}
                      </Pressable>
                    </View>

                    <Pressable
                      onPress={() => void publish({ external: !selected.externalPublished }, "Direct link updated.")}
                      disabled={publishing || !selected.published}
                      style={[styles.toggleRow, (!selected.published || publishing) && styles.rowDisabled]}
                    >
                      <Ionicons
                        name="link-outline"
                        size={17}
                        color={selected.externalPublished ? C.blue : C.muted}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.toggleText}>Direct external link</Text>
                        <Text style={styles.toggleHint}>
                          {selected.published
                            ? "A Pro feature — exposes a standalone link."
                            : "Publish the site first."}
                        </Text>
                      </View>
                      <View style={[styles.switch, selected.externalPublished && styles.switchOn]}>
                        <View
                          style={[
                            styles.switchKnob,
                            selected.externalPublished && styles.switchKnobOn,
                          ]}
                        />
                      </View>
                    </Pressable>

                    <View style={styles.saleRow}>
                      <View style={styles.priceWrap}>
                        <Text style={styles.fieldLabel}>PRICE (USD)</Text>
                        <TextInput
                          value={price}
                          onChangeText={setPrice}
                          keyboardType="decimal-pad"
                          style={styles.input}
                          placeholder="49"
                          placeholderTextColor={C.muted}
                        />
                      </View>
                      <Pressable
                        onPress={() =>
                          void publish(
                            { forSale: !selected.forSale, priceCents },
                            selected.forSale ? "Site unlisted." : "Site listed for sale.",
                          )
                        }
                        disabled={publishing}
                        style={[styles.saleButton, publishing && styles.buttonDisabled]}
                      >
                        <Ionicons name="cart-outline" size={15} color={C.bg} />
                        <Text style={styles.primaryButtonText}>
                          {selected.forSale ? "Unlist" : "List for sale"}
                        </Text>
                      </Pressable>
                    </View>

                    <View style={styles.editor}>
                      <View style={styles.editorHeading}>
                        <Ionicons name="create-outline" size={16} color={C.accent} />
                        <Text style={styles.editorTitle}>Edit site</Text>
                      </View>
                      <Text style={styles.fieldLabel}>TITLE</Text>
                      <TextInput
                        value={draftTitle}
                        onChangeText={setDraftTitle}
                        style={styles.input}
                        placeholder="Site title"
                        placeholderTextColor={C.muted}
                        maxLength={120}
                      />
                      <Text style={styles.fieldLabel}>PROMPT</Text>
                      <TextInput
                        value={draftPrompt}
                        onChangeText={setDraftPrompt}
                        style={[styles.input, styles.promptInput]}
                        placeholder="Describe the site"
                        placeholderTextColor={C.muted}
                        multiline
                        textAlignVertical="top"
                        maxLength={2000}
                      />
                      <Text style={styles.editorHint}>
                        Saving a new prompt regenerates the site and replaces manual code edits.
                      </Text>
                      <View style={styles.codeHeading}>
                        <Text style={styles.fieldLabel}>HTML CODE</Text>
                        <Pressable
                          onPress={() => void loadRaw()}
                          disabled={rawLoading}
                          style={styles.rawButton}
                        >
                          {rawLoading ? (
                            <ActivityIndicator color={C.accent} size="small" />
                          ) : (
                            <Ionicons name="download-outline" size={14} color={C.accent} />
                          )}
                          <Text style={styles.rawButtonText}>Load raw</Text>
                        </Pressable>
                      </View>
                      <TextInput
                        value={draftHtml}
                        onChangeText={setDraftHtml}
                        style={[styles.input, styles.codeInput, { fontFamily: CODE_FONT }]}
                        placeholder="<html>…</html>"
                        placeholderTextColor={C.muted}
                        multiline
                        textAlignVertical="top"
                        autoCapitalize="none"
                        autoCorrect={false}
                        spellCheck={false}
                      />
                      <Pressable
                        onPress={() => void saveChanges()}
                        disabled={saving}
                        style={[styles.primaryButton, saving && styles.buttonDisabled]}
                      >
                        {saving ? (
                          <ActivityIndicator color={C.bg} size="small" />
                        ) : (
                          <Ionicons name="save-outline" size={16} color={C.bg} />
                        )}
                        <Text style={styles.primaryButtonText}>
                          {saving ? "Saving…" : "Save changes"}
                        </Text>
                      </Pressable>
                      {!!selected.updatedAt ? (
                        <Text style={styles.updatedText}>
                          Last edited {dateLabel(selected.updatedAt)}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                )}
              </View>
            ) : null}

            {notice ? (
              <View style={styles.noticeBox}>
                <Ionicons name="checkmark-circle-outline" size={16} color={C.success} />
                <Text style={styles.noticeText}>{notice}</Text>
              </View>
            ) : null}
            {actionError || openError ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color={C.error} />
                <Text style={styles.errorText}>{actionError ?? openError}</Text>
              </View>
            ) : null}
            {errorPublic && publicSites.length > 0 ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color={C.error} />
                <Text style={styles.errorText}>{errorPublic}</Text>
                <Pressable onPress={() => void loadPublic()}>
                  <Text style={styles.retryText}>Retry</Text>
                </Pressable>
              </View>
            ) : null}

            <Text style={styles.sectionLabel}>PUBLIC PROJECTS</Text>
          </View>
        }
        ListEmptyComponent={
          loadingPublic ? (
            <LoadingState label="Loading public sites…" />
          ) : errorPublic ? (
            <ErrorState
              message={errorPublic}
              onRetry={() => {
                setLoadingPublic(true);
                void loadPublic();
              }}
            />
          ) : (
            <EmptyState
              icon="globe-outline"
              title="No public sites published yet"
              message="Sites published from the builder will appear here with their live links."
            />
          )
        }
        renderItem={({ item }) => (
          <View style={styles.siteCard}>
            <View style={styles.siteTop}>
              <View style={styles.siteIcon}>
                <Ionicons name="globe-outline" size={18} color={C.accent} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.siteTitle} numberOfLines={2}>
                  {item.title ?? item.slug}
                </Text>
                <Text style={styles.siteSlug} numberOfLines={1}>
                  /sites/{item.slug}
                </Text>
              </View>
            </View>

            {item.prompt ? (
              <Text style={styles.sitePrompt} numberOfLines={3}>
                {item.prompt}
              </Text>
            ) : null}

            <View style={styles.siteMeta}>
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={12} color={C.muted} />
                <Text style={styles.metaText}>{dateLabel(item.createdAt) || "Published"}</Text>
              </View>
              {item.forSale ? (
                <View style={styles.metaItem}>
                  <Ionicons name="pricetag-outline" size={12} color={C.gold} />
                  <Text style={[styles.metaText, { color: C.gold }]}>
                    {item.priceCents ? `$${(item.priceCents / 100).toFixed(2)}` : "Free"}
                  </Text>
                </View>
              ) : (
                <View style={styles.metaItem}>
                  <Ionicons name="checkmark-circle-outline" size={12} color={C.success} />
                  <Text style={[styles.metaText, { color: C.success }]}>Public</Text>
                </View>
              )}
            </View>

            <Pressable
              onPress={() =>
                void openUrl(
                  `${API_BASE}/sites/${item.slug}`,
                  "Could not open this site in your browser.",
                )
              }
              style={styles.openButton}
            >
              <Ionicons name="open-outline" size={15} color={C.bg} />
              <Text style={styles.openButtonText}>Open public site</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: R.md,
    backgroundColor: C.raised,
    alignItems: "center",
    justifyContent: "center",
  },
  list: { paddingHorizontal: S.lg, paddingBottom: S.xxxl },
  intro: { paddingTop: S.lg },
  introTop: { flexDirection: "row", alignItems: "center", gap: S.md },
  eyebrow: { fontSize: 10, letterSpacing: 1.6, color: C.accent, fontWeight: "800", marginBottom: 4 },
  title: { fontSize: 25, fontWeight: "800", color: C.text },
  subtitle: { fontSize: 12, color: C.muted, marginTop: S.sm, lineHeight: 18 },
  mark: {
    width: 44,
    height: 44,
    borderRadius: R.lg,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  signInCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: S.sm,
    backgroundColor: C.accentDim,
    borderWidth: 1,
    borderColor: C.accent + "44",
    borderRadius: R.lg,
    padding: S.md,
    marginTop: S.lg,
  },
  builderPanel: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.lg,
    padding: S.md,
    marginTop: S.lg,
  },
  panelHeader: { flexDirection: "row", alignItems: "center", gap: S.sm },
  panelIcon: {
    width: 38,
    height: 38,
    borderRadius: R.md,
    backgroundColor: C.accentDim,
    alignItems: "center",
    justifyContent: "center",
  },
  panelTitle: { fontSize: 14, fontWeight: "800", color: C.text },
  panelText: { fontSize: 11, color: C.textSoft, lineHeight: 17, marginTop: 3 },
  starterRow: { gap: S.sm, paddingVertical: S.md },
  starterChip: {
    width: 200,
    minHeight: 58,
    borderRadius: R.md,
    backgroundColor: C.raised,
    borderWidth: 1,
    borderColor: C.border,
    padding: S.sm,
    justifyContent: "center",
  },
  starterText: { fontSize: 11, color: C.textSoft, lineHeight: 16 },
  input: {
    backgroundColor: C.raised,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    paddingHorizontal: S.md,
    paddingVertical: 10,
    color: C.text,
    fontSize: 13,
    marginBottom: S.sm,
  },
  promptInput: { minHeight: 84, textAlignVertical: "top", lineHeight: 19 },
  codeInput: { minHeight: 200, textAlignVertical: "top", fontSize: 11, lineHeight: 16 },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: C.accent,
    borderRadius: R.md,
    paddingVertical: 11,
    marginTop: S.xs,
  },
  primaryButtonText: { fontSize: 12, fontWeight: "800", color: C.bg },
  buttonDisabled: { opacity: 0.6 },
  inlineError: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: S.sm,
    marginTop: S.sm,
  },
  inlineErrorText: { flex: 1, color: C.error, fontSize: 12, lineHeight: 17 },
  block: { marginTop: S.xl },
  sectionLabel: {
    fontSize: 10,
    letterSpacing: 1.6,
    fontWeight: "800",
    color: C.accent,
    marginTop: S.xl,
    marginBottom: S.sm,
  },
  ownedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: S.sm,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    padding: S.sm,
    marginBottom: S.sm,
  },
  ownedRowActive: { borderColor: C.accent, backgroundColor: C.accentDim },
  ownedIcon: {
    width: 34,
    height: 34,
    borderRadius: R.sm,
    backgroundColor: C.raised,
    alignItems: "center",
    justifyContent: "center",
  },
  ownedTitle: { fontSize: 13, fontWeight: "800", color: C.text },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  siteDetail: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.lg,
    padding: S.md,
  },
  siteTop: { flexDirection: "row", alignItems: "center", gap: S.sm },
  siteIcon: {
    width: 38,
    height: 38,
    borderRadius: R.md,
    backgroundColor: C.raised,
    alignItems: "center",
    justifyContent: "center",
  },
  siteTitle: { fontSize: 15, fontWeight: "800", color: C.text },
  siteSlug: { fontSize: 11, color: C.accent, marginTop: 2 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: S.sm, marginTop: S.md },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: R.pill,
    paddingHorizontal: S.sm,
    paddingVertical: 5,
  },
  badgeText: { fontSize: 10, fontWeight: "800" },
  modelText: { fontSize: 10, color: C.mutedDark, marginLeft: "auto" },
  actionRow: { flexDirection: "row", gap: S.sm, marginTop: S.md },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: R.md,
    paddingVertical: 10,
    paddingHorizontal: S.md,
  },
  actionPrimary: { flex: 1, backgroundColor: C.accent },
  actionPrimaryText: { fontSize: 12, fontWeight: "800", color: C.bg },
  actionSecondary: { flex: 1, backgroundColor: C.raised, borderWidth: 1, borderColor: C.border },
  actionText: { fontSize: 12, fontWeight: "800", color: C.text },
  actionDanger: { width: 44, backgroundColor: C.errorDim, borderWidth: 1, borderColor: C.error + "44" },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: S.sm,
    backgroundColor: C.raised,
    borderRadius: R.md,
    padding: S.sm,
    marginTop: S.md,
  },
  rowDisabled: { opacity: 0.55 },
  toggleText: { fontSize: 12, fontWeight: "700", color: C.text },
  toggleHint: { fontSize: 10, color: C.muted, marginTop: 2, lineHeight: 14 },
  switch: { width: 38, height: 22, borderRadius: 11, backgroundColor: C.border, padding: 2 },
  switchOn: { backgroundColor: C.blue },
  switchKnob: { width: 18, height: 18, borderRadius: 9, backgroundColor: C.muted },
  switchKnobOn: { backgroundColor: C.white, marginLeft: 16 },
  saleRow: { flexDirection: "row", alignItems: "flex-end", gap: S.sm, marginTop: S.md },
  priceWrap: { flex: 1 },
  fieldLabel: { fontSize: 10, letterSpacing: 1.2, fontWeight: "800", color: C.muted, marginBottom: 5 },
  saleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: C.accent,
    borderRadius: R.md,
    paddingHorizontal: S.md,
    height: 42,
    marginBottom: S.sm,
  },
  editor: { borderTopWidth: 1, borderTopColor: C.border, marginTop: S.md, paddingTop: S.md },
  editorHeading: { flexDirection: "row", alignItems: "center", gap: S.sm, marginBottom: S.md },
  editorTitle: { fontSize: 14, fontWeight: "800", color: C.text },
  editorHint: { fontSize: 10, color: C.muted, lineHeight: 15, marginBottom: S.sm },
  codeHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rawButton: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 4 },
  rawButtonText: { fontSize: 11, fontWeight: "800", color: C.accent },
  updatedText: { fontSize: 10, color: C.muted, textAlign: "center", marginTop: S.sm },
  noticeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: S.sm,
    backgroundColor: C.successDim,
    borderWidth: 1,
    borderColor: C.success + "55",
    borderRadius: R.md,
    padding: S.md,
    marginTop: S.md,
  },
  noticeText: { flex: 1, color: C.success, fontSize: 12 },
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
    marginTop: S.md,
  },
  errorText: { flex: 1, color: C.error, fontSize: 12 },
  retryText: { color: C.accent, fontSize: 12, fontWeight: "800" },
  siteCard: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.lg,
    padding: S.md,
    marginBottom: S.md,
  },
  sitePrompt: { fontSize: 12, color: C.textSoft, lineHeight: 18, marginTop: S.md },
  siteMeta: { flexDirection: "row", gap: S.lg, marginTop: S.md },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { fontSize: 11, color: C.muted },
  openButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: C.accent,
    borderRadius: R.md,
    paddingVertical: 11,
    marginTop: S.md,
  },
  openButtonText: { fontSize: 12, fontWeight: "800", color: C.bg },
});
