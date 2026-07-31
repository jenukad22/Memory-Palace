import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { AppText, Button, Card, ComingSoonTag, ScreenShell, space } from '@/ui';

// Training hub — one card per cognitive domain (/src/modules). All three
// domains are live.
interface Domain {
  key: string;
  name: string;
  blurb: string;
  route?: string;
}

const DOMAINS: readonly Domain[] = [
  {
    key: 'memory',
    name: 'Memory',
    blurb: 'Memory palace and PAO trainers, daily review, and the six-week campaign.',
    route: '/modules/memory',
  },
  {
    key: 'attention',
    name: 'Attention',
    blurb:
      'Three timed tasks: a 3-minute reaction-time run, a go/no-go letter stream, and a change-flicker search.',
    route: '/modules/attention',
  },
  {
    key: 'reasoning',
    name: 'Reasoning',
    blurb:
      'Base-rate items in two formats, generate-multiple-hypotheses, disconfirmation, and calibration training.',
    route: '/modules/reasoning',
  },
];

export default function ModulesIndex() {
  const router = useRouter();
  return (
    <ScreenShell kicker="Training" taskName="Modules">
      <View style={{ gap: space.sp4, paddingTop: space.sp4 }}>
        <AppText variant="heading">Training modules</AppText>
        {DOMAINS.map((d) => (
          <Card key={d.key}>
            <AppText variant="bodyStrong" color={d.route ? 'textPrimary' : 'textSecondary'}>
              {d.name}
            </AppText>
            <AppText
              variant="secondary"
              color="textSecondary"
              style={{ paddingVertical: space.sp2 }}
            >
              {d.blurb}
            </AppText>
            {d.route ? (
              <Button label={`Open ${d.name}`} onPress={() => router.push(d.route!)} />
            ) : (
              <ComingSoonTag />
            )}
          </Card>
        ))}
      </View>
    </ScreenShell>
  );
}
