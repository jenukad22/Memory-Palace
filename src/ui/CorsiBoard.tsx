import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import { color, motion, radius } from './tokens';

/** Fixed normalized top-left coordinates of the 9 blocks (DESIGN.md sec 2.7). */
export const CORSI_BLOCKS: readonly { x: number; y: number }[] = [
  { x: 0.06, y: 0.58 },
  { x: 0.26, y: 0.12 },
  { x: 0.28, y: 0.76 },
  { x: 0.42, y: 0.4 },
  { x: 0.55, y: 0.06 },
  { x: 0.6, y: 0.68 },
  { x: 0.72, y: 0.3 },
  { x: 0.82, y: 0.56 },
  { x: 0.06, y: 0.26 },
];

const BLOCK_SIZE = 0.18;

export interface CorsiBoardProps {
  /** display = watch the sequence (taps ignored, no visual change); recall = tap back. */
  phase: 'display' | 'recall';
  /** Index (0-8) of the block currently lit, or null. Screens own the timing. */
  highlightIndex: number | null;
  onTapBlock: (index: number) => void;
}

/**
 * Pick C3, tactile keys (DESIGN.md sec 2.7) — the system's only shadows.
 * Tap feedback is a transient depress held tapFlashMs; no persistent marking
 * of tapped blocks (it would act as a recall aid). The board renders
 * identically in both phases so the display phase leaks nothing.
 *
 * RN approximations of the spec: the highlight glow renders via iOS shadow
 * (Android elevation shadows stay black); the tap depress omits the inset
 * shadow (unsupported) — translate + darkened fill carries it.
 */
export function CorsiBoard({ phase, highlightIndex, onTapBlock }: CorsiBoardProps) {
  const [flashIndex, setFlashIndex] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const press = (i: number) => {
    if (phase !== 'recall') return;
    setFlashIndex(i);
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => setFlashIndex(null), motion.tapFlashMs);
    onTapBlock(i);
  };

  return (
    <View
      style={{ width: '100%', aspectRatio: 1 }}
      pointerEvents={phase === 'display' ? 'none' : 'auto'}
    >
      {CORSI_BLOCKS.map((pos, i) => {
        const lit = highlightIndex === i;
        const flashed = flashIndex === i;

        const frame: ViewStyle = {
          position: 'absolute',
          left: `${pos.x * 100}%`,
          top: `${pos.y * 100}%`,
          width: `${BLOCK_SIZE * 100}%`,
          height: `${BLOCK_SIZE * 100}%`,
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: lit ? color.accent : flashed ? color.accent : color.lineStrong,
          overflow: 'hidden',
          transform: flashed ? [{ translateY: 1 }] : [],
          ...(lit
            ? {
                shadowColor: color.accent,
                shadowOpacity: 0.45,
                shadowRadius: 18,
                shadowOffset: { width: 0, height: 0 },
                elevation: 8,
              }
            : {
                shadowColor: '#000',
                shadowOpacity: 0.35,
                shadowRadius: 3,
                shadowOffset: { width: 0, height: 2 },
                elevation: 3,
              }),
        };

        const faces: readonly [string, string] = lit
          ? [color.accent, color.accent]
          : flashed
            ? [color.corsiKeyBottom, color.corsiKeyBottom]
            : [color.corsiKeyTop, color.corsiKeyBottom];

        return (
          <Pressable
            key={i}
            accessibilityRole="button"
            accessibilityLabel={`block ${i + 1}`}
            onPress={() => press(i)}
            style={frame}
          >
            <LinearGradient colors={faces} style={{ flex: 1 }}>
              {/* top light — the key's lit edge */}
              {lit ? null : (
                <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.05)' }} />
              )}
            </LinearGradient>
          </Pressable>
        );
      })}
    </View>
  );
}
