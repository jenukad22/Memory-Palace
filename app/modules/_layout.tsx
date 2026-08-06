import { Stack } from 'expo-router';
import { stackScreenOptionsWithTitles } from '@/ui';

// Header titles, keyed by expo-router's route name (the path under app/modules).
// Without these the navigator falls back to the filename, which is how the
// modules hub shipped a header reading "index". Anything missing here is
// humanized rather than shown raw, so a new route can't regress to a filename —
// but a task's real name ("PVT-B", not "Pvt") has to be written down.
const TITLES = {
  index: 'Training',
  '[module]': 'Module',
  'memory/index': 'Memory',
  'memory/palace-builder': 'Palace builder',
  'memory/palace-training': 'Palace training',
  'memory/pao-builder': 'PAO builder',
  'memory/pao-drill': 'PAO drill',
  'memory/retake-vviq': 'Imagery retake',
  'memory/retake-digitspan': 'Digit span retake',
  'memory/retake-corsi': 'Corsi retake',
  'attention/index': 'Attention',
  'attention/pvt': 'PVT-B',
  'attention/cpt': 'Go / no-go',
  'attention/flicker': 'Change flicker',
  'reasoning/index': 'Reasoning',
  'reasoning/base-rate': 'Base rates',
  'reasoning/hypotheses': 'Hypotheses',
  'reasoning/disconfirmation': 'Disconfirmation',
  'reasoning/calibration': 'Calibration',
} as const;

export default function ModulesLayout() {
  return <Stack screenOptions={stackScreenOptionsWithTitles(TITLES)} />;
}
