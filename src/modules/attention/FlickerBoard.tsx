import { useState } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import type { FlickerCell } from '@/engine';
import { color, radius } from '@/ui';
import { flickerCellSide } from './boardLayout';

/**
 * Palette for the flicker elements. The engine emits colour *indexes* so it
 * stays framework-free (SPEC.md §4.3); this is where they become colours, from
 * the design tokens like everything else.
 */
const PALETTE = [
  color.accent,
  color.success,
  color.error,
  color.textSecondary,
  color.lineStrong,
] as const;

export interface FlickerBoardProps {
  cols: number;
  rows: number;
  /** The scene to draw, or null to draw the blank between scenes. */
  cells: readonly FlickerCell[] | null;
  onTapCell: (index: number) => void;
}

/**
 * The flicker scene. The blank between scenes keeps the grid's geometry and
 * hides only the elements: a collapsing layout would give the change away by
 * moving everything around it.
 */
export function FlickerBoard({ cols, rows, cells, onTapCell }: FlickerBoardProps) {
  const [box, setBox] = useState({ width: 0, height: 0 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox({ width, height });
  };

  // Geometry lives in boardLayout.ts, where it is unit-tested against real
  // viewport sizes for overflow and minimum tap target (a mistap here is a
  // wrong trial, not a cosmetic issue).
  const cellSide = flickerCellSide(box.width, box.height, cols, rows);
  const ready = cellSide > 0;

  return (
    <View
      onLayout={onLayout}
      style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' }}
    >
      {ready ? (
        <View
          style={{
            width: cellSide * cols,
            height: cellSide * rows,
            flexDirection: 'row',
            flexWrap: 'wrap',
          }}
        >
          {Array.from({ length: cols * rows }, (_, index) => {
            const cell = cells?.[index];
            const side = cell !== undefined && cell.present ? cellSide * cell.sizeScale : 0;
            return (
              <Pressable
                key={index}
                accessibilityRole="button"
                accessibilityLabel={`cell ${index + 1}`}
                onPress={() => onTapCell(index)}
                style={{
                  width: cellSide,
                  height: cellSide,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {side > 0 && cell !== undefined ? (
                  <View
                    style={{
                      width: side,
                      height: side,
                      backgroundColor: PALETTE[cell.colorIndex] ?? color.textSecondary,
                      borderRadius:
                        cell.shape === 'circle'
                          ? side / 2
                          : cell.shape === 'square'
                            ? radius.sm
                            : 2,
                      transform: cell.shape === 'diamond' ? [{ rotate: '45deg' }] : [],
                    }}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
