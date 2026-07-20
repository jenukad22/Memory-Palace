import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { listPaoEntries, paoStatus, upsertPaoEntry, useDb } from '@/db';
import { PAO_MAX, PAO_MIN, pad2, type PaoEntry } from '@/engine';
import { AppText, Button, Card, InputField, ScreenShell, color, space } from '@/ui';

/**
 * PAO alphabet builder (SPEC.md §1). The user authors their own Person/Action/
 * Object for each number 00–99; each entry is stored as a reviewable card. A
 * completeness meter reports how many of the 100 numbers are authored — a plain
 * count of this task, nothing generalised.
 */
export function PaoBuilderScreen() {
  const db = useDb();
  const [byNumber, setByNumber] = useState<Map<number, PaoEntry>>(
    () => new Map(listPaoEntries(db).map((e) => [e.n, e])),
  );
  const [status, setStatus] = useState(() => paoStatus(db));
  const [n, setN] = useState(0);

  const current = byNumber.get(n);
  const [person, setPerson] = useState(current?.person ?? '');
  const [action, setAction] = useState(current?.action ?? '');
  const [object, setObject] = useState(current?.object ?? '');

  // Re-seed the three fields whenever the selected number changes.
  const goTo = (next: number) => {
    const clamped = Math.min(PAO_MAX, Math.max(PAO_MIN, next));
    const e = byNumber.get(clamped);
    setN(clamped);
    setPerson(e?.person ?? '');
    setAction(e?.action ?? '');
    setObject(e?.object ?? '');
  };

  const canSave = person.trim() !== '' && action.trim() !== '' && object.trim() !== '';

  const save = () => {
    if (!canSave) return;
    upsertPaoEntry(db, {
      n,
      person: person.trim(),
      action: action.trim(),
      object: object.trim(),
    });
    setByNumber(new Map(listPaoEntries(db).map((e) => [e.n, e])));
    setStatus(paoStatus(db));
  };

  const progressLabel = useMemo(() => `${status.count} of 100 authored`, [status.count]);

  return (
    <ScreenShell kicker="Memory · PAO" taskName="Builder">
      <ScrollView contentContainerStyle={{ gap: space.sp4, paddingVertical: space.sp4 }}>
        <View style={{ gap: space.sp2 }}>
          <AppText variant="heading">Your 00–99 list</AppText>
          <AppText variant="secondary" color="textSecondary">
            Give each number a Person, an Action, and an Object. Later, a 6-digit number becomes one
            scene: the Person of the first pair doing the Action of the second to the Object of the
            third.
          </AppText>
        </View>

        <Card>
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <Button kind="ghost" size="sm" label="‹ Prev" onPress={() => goTo(n - 1)} />
            <AppText variant="stimulus" color="accent" tabular>
              {pad2(n)}
            </AppText>
            <Button kind="ghost" size="sm" label="Next ›" onPress={() => goTo(n + 1)} />
          </View>
        </Card>

        <View style={{ gap: space.sp3 }}>
          <View style={{ gap: space.sp1 }}>
            <AppText variant="caption" color="textSecondary">
              Person
            </AppText>
            <InputField placeholder="e.g. a chef" value={person} onChangeText={setPerson} />
          </View>
          <View style={{ gap: space.sp1 }}>
            <AppText variant="caption" color="textSecondary">
              Action
            </AppText>
            <InputField placeholder="e.g. juggling" value={action} onChangeText={setAction} />
          </View>
          <View style={{ gap: space.sp1 }}>
            <AppText variant="caption" color="textSecondary">
              Object
            </AppText>
            <InputField placeholder="e.g. a teapot" value={object} onChangeText={setObject} />
          </View>
          <Button
            label={current ? 'Update entry' : 'Save entry'}
            onPress={save}
            disabled={!canSave}
          />
        </View>

        <View style={{ paddingTop: space.sp3, borderTopWidth: 1, borderTopColor: color.line }}>
          <AppText variant="caption" color="textSecondary">
            {progressLabel}
            {status.duplicates.length > 0 ? ` · ${status.duplicates.length} duplicated` : ''}
          </AppText>
          <AppText
            variant="caption"
            color={status.complete ? 'success' : 'textMuted'}
            style={{ paddingTop: space.sp1 }}
          >
            {status.complete
              ? 'All 100 numbers authored — ready to drill.'
              : `${status.missing.length} still to author.`}
          </AppText>
        </View>
      </ScrollView>
    </ScreenShell>
  );
}
