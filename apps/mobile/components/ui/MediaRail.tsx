import { View, ScrollView, StyleSheet } from "react-native";
import { SectionTitle } from "./States";
import { MediaCard, MediaItem } from "./MediaCard";

/** Horizontal snap rail with a peek of the next card — the Netflix pattern. */
export function MediaRail({
  title,
  subtitle,
  items,
  onSeeAll,
  width,
  height,
}: {
  title: string;
  subtitle?: string;
  items: MediaItem[];
  onSeeAll?: () => void;
  width?: number;
  height?: number;
}) {
  if (!items.length) return null;
  return (
    <View style={styles.section}>
      <SectionTitle title={title} subtitle={subtitle} actionLabel={onSeeAll ? "See all" : undefined} onAction={onSeeAll} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToAlignment="start"
        decelerationRate="fast"
        contentContainerStyle={styles.rail}
      >
        {items.map((item, i) => (
          <MediaCard key={item.id} item={{ ...item, rank: item.rank ?? (i < 3 ? i + 1 : undefined) }} width={width} height={height} />
        ))}
        <View style={styles.spacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 26 },
  rail: { paddingLeft: 16, paddingRight: 48, gap: 12, alignItems: "center" },
  spacer: { width: 4 },
});
