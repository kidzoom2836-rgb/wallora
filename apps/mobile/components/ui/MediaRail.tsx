import { useEffect, useRef } from "react";
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewInstance,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SectionTitle } from "./States";
import { MediaCard, MediaItem } from "./MediaCard";

const { width: SW } = Dimensions.get("window");
const GAP = 12;

/** Horizontal snap rail with a peek of the next card — the Netflix pattern. */
export function MediaRail({
  title,
  subtitle,
  items,
  onSeeAll,
  width,
  height,
  autoScroll = true,
}: {
  title: string;
  subtitle?: string;
  items: MediaItem[];
  onSeeAll?: () => void;
  width?: number;
  height?: number;
  autoScroll?: boolean;
}) {
  const scrollRef = useRef<ScrollViewInstance>(null);
  const offset = useRef(0);
  const paused = useRef(false);
  const cardWidth = width ?? SW * 0.56;

  useEffect(() => {
    if (!autoScroll || items.length < 3) return;
    const step = cardWidth + GAP;
    const max = step * items.length - SW + 48;
    const timer = setInterval(() => {
      if (paused.current || max <= 0) return;
      offset.current = offset.current + step > max ? 0 : offset.current + step;
      scrollRef.current?.scrollTo({ x: offset.current, animated: true });
    }, 3200);
    return () => clearInterval(timer);
  }, [autoScroll, cardWidth, items.length]);

  if (!items.length) return null;

  return (
    <View style={styles.section}>
      <SectionTitle
        title={title}
        subtitle={subtitle}
        actionLabel={onSeeAll ? "See all" : undefined}
        onAction={onSeeAll}
      />
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToAlignment="start"
        decelerationRate="fast"
        onTouchStart={() => {
          paused.current = true;
        }}
        onTouchEnd={() => {
          paused.current = false;
        }}
        onMomentumScrollEnd={(event) => {
          offset.current = event.nativeEvent.contentOffset.x;
        }}
        contentContainerStyle={styles.rail}
      >
        {items.map((item, i) => (
          <Animated.View
            key={item.id}
            entering={FadeInDown.delay(Math.min(i, 6) * 45).duration(420)}
          >
            <MediaCard
              item={{ ...item, rank: item.rank ?? (i < 3 ? i + 1 : undefined) }}
              width={width}
              height={height}
            />
          </Animated.View>
        ))}
        <View style={styles.spacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 26 },
  rail: { paddingLeft: 16, paddingRight: 48, gap: GAP, alignItems: "center" },
  spacer: { width: 4 },
});
