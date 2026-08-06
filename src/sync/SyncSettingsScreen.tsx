import type { Session } from '@supabase/supabase-js';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { countPending, useDb } from '@/db';
import { AppText, Button, Card, InputField, ScreenShell, space } from '@/ui';
import {
  getSession,
  onAuthStateChange,
  signInWithPassword,
  signOut,
  signUpWithPassword,
} from './auth';
import { isSyncConfigured } from './config';
import { getLastSyncedAt, runSync } from './runSync';
import { getSupabaseClient } from './supabaseClient';
import { createSupabaseTransport } from './supabaseTransport';
import { DifferentUserError } from './transport';

type Status =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'error'; message: string }
  | { kind: 'done'; message: string };

/**
 * Sync settings (design doc §4). Everything here is optional: signed out, the
 * app is exactly the local-first app it was before sync existed, and this
 * screen says so rather than nagging.
 */
export function SyncSettingsScreen() {
  const db = useDb();
  const router = useRouter();
  const configured = isSyncConfigured();
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [pending, setPending] = useState(0);
  const [lastSynced, setLastSynced] = useState<number | null>(null);

  const refreshLocalState = useCallback(() => {
    setPending(countPending(db));
    setLastSynced(getLastSyncedAt(db));
  }, [db]);

  useEffect(() => {
    if (!configured) return;
    void getSession().then(setSession);
    return onAuthStateChange(setSession);
  }, [configured]);

  // useFocusEffect, not useEffect: this reads the local database, so it should
  // re-read when the user navigates back after doing work elsewhere — the same
  // pattern ProgressDashboardScreen uses.
  useFocusEffect(refreshLocalState);

  if (!configured) {
    return (
      <ScreenShell kicker="Settings" taskName="Sync">
        <View style={{ gap: space.sp3, paddingTop: space.sp5 }}>
          <AppText variant="heading">Sync isn’t set up in this build</AppText>
          <AppText variant="secondary" color="textSecondary">
            Everything you do is saved on this device, as always. Sync is optional — it only appears
            when the app is built with a Supabase project configured.
          </AppText>
          <Button kind="ghost" label="Back" onPress={() => router.back()} />
        </View>
      </ScreenShell>
    );
  }

  const doSync = async () => {
    const client = getSupabaseClient();
    const userId = session?.user.id;
    if (!client || !userId) return;
    setStatus({ kind: 'busy' });
    try {
      const outcome = await runSync({
        db,
        transport: createSupabaseTransport(client, userId),
        userId,
      });
      setStatus({
        kind: 'done',
        message: `Pulled ${outcome.pulled}, applied ${outcome.applied}, sent ${outcome.pushed}.`,
      });
    } catch (e) {
      setStatus({
        kind: 'error',
        message:
          e instanceof DifferentUserError ? e.message : e instanceof Error ? e.message : String(e),
      });
    } finally {
      refreshLocalState();
    }
  };

  const submitAuth = async (mode: 'in' | 'up') => {
    setStatus({ kind: 'busy' });
    const result =
      mode === 'in'
        ? await signInWithPassword(email.trim(), password)
        : await signUpWithPassword(email.trim(), password);
    setStatus(
      result.ok
        ? { kind: 'done', message: mode === 'up' ? 'Check your email to confirm.' : 'Signed in.' }
        : { kind: 'error', message: result.error ?? 'Something went wrong.' },
    );
    setPassword('');
  };

  return (
    <ScreenShell kicker="Settings" taskName="Sync">
      <View style={{ gap: space.sp4 }}>
        <AppText variant="title">Sync</AppText>

        <Card>
          <AppText variant="bodyStrong">Your data lives on this device</AppText>
          <AppText variant="secondary" color="textSecondary" style={{ paddingTop: space.sp2 }}>
            Sync is optional and additive. Signing out never deletes anything local, and the app
            works fully offline either way — changes queue up and reconcile the next time you sync.
          </AppText>
        </Card>

        {session === null ? (
          <Card>
            <AppText variant="bodyStrong">Sign in to sync</AppText>
            <View style={{ gap: space.sp3, paddingTop: space.sp3 }}>
              <InputField
                placeholder="Email"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <InputField
                placeholder="Password"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
              <Button
                label="Sign in"
                disabled={status.kind === 'busy' || email === '' || password === ''}
                onPress={() => void submitAuth('in')}
              />
              <Button
                kind="secondary"
                label="Create an account"
                disabled={status.kind === 'busy' || email === '' || password === ''}
                onPress={() => void submitAuth('up')}
              />
            </View>
          </Card>
        ) : (
          <Card>
            <AppText variant="bodyStrong">Signed in</AppText>
            <AppText variant="secondary" color="textSecondary" style={{ paddingTop: space.sp1 }}>
              {session.user.email ?? session.user.id}
            </AppText>
            <View style={{ gap: space.sp1, paddingTop: space.sp3 }}>
              <Row label="Waiting to sync" value={`${pending} change${pending === 1 ? '' : 's'}`} />
              <Row
                label="Last synced"
                value={lastSynced === null ? 'Never' : new Date(lastSynced).toLocaleString()}
              />
            </View>
            <View style={{ gap: space.sp2, paddingTop: space.sp3 }}>
              <Button
                label={status.kind === 'busy' ? 'Syncing…' : 'Sync now'}
                disabled={status.kind === 'busy'}
                onPress={() => void doSync()}
              />
              <Button
                kind="secondary"
                label="Sign out"
                disabled={status.kind === 'busy'}
                onPress={() => void signOut()}
              />
            </View>
          </Card>
        )}

        {status.kind === 'error' ? (
          <AppText variant="secondary" color="error">
            {status.message}
          </AppText>
        ) : null}
        {status.kind === 'done' ? (
          <AppText variant="secondary" color="textSecondary">
            {status.message}
          </AppText>
        ) : null}

        <Button kind="ghost" label="Back" onPress={() => router.back()} />
      </View>
    </ScreenShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <AppText variant="secondary" color="textSecondary">
        {label}
      </AppText>
      <AppText variant="secondary" tabular>
        {value}
      </AppText>
    </View>
  );
}
