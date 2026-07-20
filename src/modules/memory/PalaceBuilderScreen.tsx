import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import {
  addLocus,
  createPalace,
  deleteLocus,
  listLoci,
  listPalaces,
  reorderLoci,
  useDb,
  type LocusRow,
  type PalaceRow,
} from '@/db';
import { AppText, Button, Card, InputField, ScreenShell, color, space } from '@/ui';

/**
 * Memory-palace builder (SPEC.md §1, §6). The user names a palace and authors an
 * ordered list of loci. Reorder and delete route through the query layer so the
 * resolved locus-edit semantics (scheduling preserved on reorder; placements
 * soft-deleted on delete) hold. No task-generalising copy.
 */
export function PalaceBuilderScreen() {
  const db = useDb();
  const router = useRouter();
  const [palaces, setPalaces] = useState<PalaceRow[]>(() => listPalaces(db));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loci, setLoci] = useState<LocusRow[]>([]);
  const [palaceName, setPalaceName] = useState('');
  const [locusLabel, setLocusLabel] = useState('');

  const selected = useMemo(
    () => palaces.find((p) => p.id === selectedId) ?? null,
    [palaces, selectedId],
  );

  const openPalace = useCallback(
    (id: string) => {
      setSelectedId(id);
      setLoci(listLoci(db, id));
    },
    [db],
  );

  const onCreatePalace = () => {
    const name = palaceName.trim();
    if (!name) return;
    const row = createPalace(db, { name });
    setPalaces(listPalaces(db));
    setPalaceName('');
    openPalace(row.id);
  };

  const onAddLocus = () => {
    if (!selected) return;
    const label = locusLabel.trim();
    if (!label) return;
    addLocus(db, { palaceId: selected.id, label });
    setLoci(listLoci(db, selected.id));
    setLocusLabel('');
  };

  const move = (index: number, dir: -1 | 1) => {
    if (!selected) return;
    const target = index + dir;
    if (target < 0 || target >= loci.length) return;
    const ids = loci.map((l) => l.id);
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    reorderLoci(db, selected.id, ids);
    setLoci(listLoci(db, selected.id));
  };

  const remove = (locusId: string) => {
    if (!selected) return;
    deleteLocus(db, selected.id, locusId);
    setLoci(listLoci(db, selected.id));
  };

  if (!selected) {
    return (
      <ScreenShell kicker="Memory · Palace" taskName="Builder">
        <ScrollView contentContainerStyle={{ gap: space.sp4, paddingVertical: space.sp4 }}>
          <AppText variant="heading">Your palaces</AppText>
          <AppText variant="secondary" color="textSecondary">
            A palace is a familiar route. Add stops (loci) in the order you walk them, then place
            items to remember at each stop.
          </AppText>
          {palaces.length === 0 ? (
            <AppText variant="secondary" color="textMuted">
              No palaces yet. Name your first route below.
            </AppText>
          ) : (
            palaces.map((p) => (
              <Card key={p.id}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <AppText variant="bodyStrong">{p.name}</AppText>
                  <Button
                    kind="secondary"
                    size="sm"
                    label="Open"
                    onPress={() => openPalace(p.id)}
                  />
                </View>
              </Card>
            ))
          )}
          <View style={{ gap: space.sp2 }}>
            <InputField
              placeholder="Palace name (e.g. Home Route)"
              value={palaceName}
              onChangeText={setPalaceName}
            />
            <Button label="Create palace" onPress={onCreatePalace} disabled={!palaceName.trim()} />
          </View>
        </ScrollView>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell kicker="Memory · Palace" taskName={selected.name}>
      <ScrollView contentContainerStyle={{ gap: space.sp3, paddingVertical: space.sp4 }}>
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <AppText variant="heading">{selected.name}</AppText>
          <Button kind="ghost" size="sm" label="All palaces" onPress={() => setSelectedId(null)} />
        </View>

        {loci.length === 0 ? (
          <AppText variant="secondary" color="textMuted">
            No stops yet. Add the first place on your route.
          </AppText>
        ) : (
          loci.map((l, i) => (
            <Card key={l.id}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sp3 }}>
                  <AppText variant="caption" color="textMuted">
                    {i + 1}
                  </AppText>
                  <AppText variant="body">{l.label}</AppText>
                </View>
                <View style={{ flexDirection: 'row', gap: space.sp2 }}>
                  <Button kind="ghost" size="sm" label="↑" onPress={() => move(i, -1)} />
                  <Button kind="ghost" size="sm" label="↓" onPress={() => move(i, 1)} />
                  <Button kind="ghost" size="sm" label="Remove" onPress={() => remove(l.id)} />
                </View>
              </View>
            </Card>
          ))
        )}

        <View style={{ gap: space.sp2, paddingTop: space.sp2 }}>
          <InputField
            placeholder="Add a stop (e.g. Front door)"
            value={locusLabel}
            onChangeText={setLocusLabel}
            onSubmitEditing={onAddLocus}
          />
          <Button
            kind="secondary"
            label="Add stop"
            onPress={onAddLocus}
            disabled={!locusLabel.trim()}
          />
        </View>

        <View style={{ paddingTop: space.sp3, borderTopWidth: 1, borderTopColor: color.line }}>
          <Button
            label="Train this route"
            onPress={() => router.push(`/modules/memory/palace-training?palaceId=${selected.id}`)}
            disabled={loci.length < 3}
          />
          {loci.length < 3 ? (
            <AppText variant="caption" color="textMuted" style={{ paddingTop: space.sp2 }}>
              Add at least 3 stops to train.
            </AppText>
          ) : null}
        </View>
      </ScrollView>
    </ScreenShell>
  );
}
