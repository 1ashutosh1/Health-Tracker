import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { radius } from '../../theme/spacing';
import { fontFamily } from '../../theme/typography';
import { useTheme } from '../../theme/useTheme';
import { Text } from './Text';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
}

const TRACK_HEIGHT = 32;
const TRACK_PADDING = 2;

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedControlProps<T>) {
  const { colors } = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const [translateX] = useState(() => new Animated.Value(0));
  const hasPositioned = useRef(false);

  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const segmentWidth = trackWidth > 0 ? (trackWidth - TRACK_PADDING * 2) / options.length : 0;

  useEffect(() => {
    if (segmentWidth === 0) return;
    const target = selectedIndex * segmentWidth;
    if (!hasPositioned.current) {
      // First layout: jump to the right segment instead of sliding in from the left.
      translateX.setValue(target);
      hasPositioned.current = true;
      return;
    }
    Animated.timing(translateX, { toValue: target, duration: 200, useNativeDriver: true }).start();
  }, [selectedIndex, segmentWidth, translateX]);

  const handleLayout = (event: LayoutChangeEvent) => setTrackWidth(event.nativeEvent.layout.width);

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      onLayout={handleLayout}
      style={[styles.track, { backgroundColor: colors.fill }]}
    >
      {segmentWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.thumb,
            { width: segmentWidth, backgroundColor: colors.segmentThumb, transform: [{ translateX }] },
          ]}
        />
      ) : null}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            // The visual track is 32pt tall; hitSlop brings the touch target up to 44pt.
            hitSlop={{ top: 6, bottom: 6 }}
            style={styles.segment}
          >
            <Text variant="footnote" style={styles.segmentLabel} color={selected ? 'label' : 'secondaryLabel'}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    height: TRACK_HEIGHT,
    padding: TRACK_PADDING,
    borderRadius: radius.pill,
  },
  thumb: {
    position: 'absolute',
    top: TRACK_PADDING,
    left: TRACK_PADDING,
    height: TRACK_HEIGHT - TRACK_PADDING * 2,
    borderRadius: radius.pill,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentLabel: { fontFamily: fontFamily.semibold },
});
