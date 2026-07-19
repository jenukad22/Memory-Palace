import { View } from 'react-native';
import { AppText } from './AppText';
import { Button } from './Button';
import { color, radius, space } from './tokens';

export interface CheckpointSheetProps {
  /** Copy is screen-owned and honesty-bound (CLAUDE.md): names the next task
   *  and its rough time, states progress is saved, never guilt-trips deferral. */
  title: string;
  body: string;
  continueLabel: string;
  onContinue: () => void;
  deferLabel?: string;
  onDefer: () => void;
}

/** DESIGN.md sec 2.9 — the between-instruments "finish later" checkpoint. */
export function CheckpointSheet({
  title,
  body,
  continueLabel,
  onContinue,
  deferLabel = 'Finish later',
  onDefer,
}: CheckpointSheetProps) {
  return (
    <View
      style={{
        backgroundColor: color.surface1,
        borderWidth: 1,
        borderColor: color.line,
        borderTopLeftRadius: radius.lg,
        borderTopRightRadius: radius.lg,
        borderBottomLeftRadius: radius.md,
        borderBottomRightRadius: radius.md,
        paddingTop: space.sp5 - 4,
        paddingHorizontal: space.sp4,
        paddingBottom: space.sp4,
      }}
    >
      <AppText variant="heading">{title}</AppText>
      <AppText variant="secondary" color="textSecondary" style={{ marginTop: space.sp1 }}>
        {body}
      </AppText>
      <View style={{ height: space.sp4 + 2 }} />
      <Button kind="primary" label={continueLabel} onPress={onContinue} />
      <View style={{ height: space.sp2 }} />
      <Button kind="ghost" label={deferLabel} onPress={onDefer} />
    </View>
  );
}
