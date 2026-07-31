import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { AppText, Button, Card, ScreenShell, color, radius, space } from '@/ui';

// Training hub — one card per cognitive domain (/src/modules). Memory is live;
// Attention and Reasoning are later phases, shown as not-yet-available rather
// than as dead links to placeholder screens.
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
    blurb: 'Sustained-attention and working-memory tasks (N-back, PVT).',
  },
  {
    key: 'reasoning',
    name: 'Reasoning',
    blurb: 'Pattern and relational reasoning tasks.',
  },
];

function ComingSoonTag() {
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: color.surface2,
        borderRadius: radius.sm,
        paddingHorizontal: space.sp2,
        paddingVertical: space.sp1,
      }}
    >
      <AppText variant="overline" color="textMuted">
        Not yet available
      </AppText>
    </View>
  );
}

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
