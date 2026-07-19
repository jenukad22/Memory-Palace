import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { vviqTotal } from '../../engine/assessment';
import { insertAssessment, useDb } from '../../db';
import { useBatterySession } from '../../state';
import { AppText, LikertScale, ScreenShell, motion, space } from '../../ui';
import { batteryFills, doneSet } from '../battery';
import { VVIQ_ANCHORS, VVIQ_ITEMS } from './items';

/**
 * VVIQ administration (SPEC.md sec 3): 16 items, single eyes-open pass,
 * self-paced, one item per screen. Presents and captures only — scoring is
 * engine's vviqTotal; the row goes through the Phase 2 query layer.
 */
export function VviqScreen() {
  const db = useDb();
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [responses, setResponses] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const item = VVIQ_ITEMS[index]!;

  const onSelect = (value: number) => {
    if (selected !== null) return; // advance already scheduled
    setSelected(value);
    timer.current = setTimeout(() => {
      const all = [...responses, value];
      if (all.length < VVIQ_ITEMS.length) {
        setResponses(all);
        setIndex(all.length);
        setSelected(null);
        return;
      }
      const total = vviqTotal(all);
      insertAssessment(db, {
        instrument: 'vviq',
        rawScore: total,
        payload: JSON.stringify({ responses: all }),
      });
      useBatterySession.getState().recordItem();
      router.replace('/onboarding/checkpoint');
    }, motion.advanceMs);
  };

  return (
    <ScreenShell kicker="Baseline · 1 of 3" taskName="Imagery" fills={batteryFills(doneSet([]))}>
      <View style={{ gap: space.sp3, paddingTop: space.sp3 }}>
        <AppText variant="caption" color="textSecondary">
          Item {index + 1} of {VVIQ_ITEMS.length}
        </AppText>
        <AppText variant="secondary" color="textSecondary">
          {item.scene}
        </AppText>
        <AppText variant="body" style={{ marginBottom: space.sp2 }}>
          {item.prompt}
        </AppText>
        <LikertScale options={[...VVIQ_ANCHORS]} value={selected} onSelect={onSelect} />
      </View>
    </ScreenShell>
  );
}
