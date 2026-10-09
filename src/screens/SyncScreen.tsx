import { formatDistance } from 'date-fns';
import React, { useEffect, useState } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import { useSyncStatus } from '../components/SyncWatcher';
import { useToast } from '../components/Toast';
import { Button, Divider, Field, Row, Section, TextField } from '../components/ui';
import type { ScreenProps } from '../navigation/types';
import { connect, disconnect, getSyncConfig, syncNow, type SyncResult } from '../services/sync';
import { createStyles, spacing } from '../theme';
import { confirmAsync } from '../utils/confirm';

const SERVER_DOCS = 'https://github.com/BoazCohenJ/OpenCal/blob/main/server/README.md';
const WHAT_SYNCS =
  'Calendars, events, stamps, birthdays, saved colors and color rules sync. Theme, notifications, hidden calendars and the floating-time default stay on this device.';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const describe = ({ sent, received }: SyncResult) =>
  sent || received ? `Synced: ${plural(sent, 'change')} sent, ${plural(received, 'change')} received` : 'Synced, already up to date';

/** "Just now", "Synced 5 minutes ago". Re-renders every 30 s while shown. */
function useAgo(at?: number): string | undefined {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  if (!at) return undefined;
  return now - at < 60000 ? 'Synced just now' : `Synced ${formatDistance(at, now)} ago`;
}

export function SyncScreen(_props: ScreenProps<'Sync'>) {
  const styles = useStyles();
  const showToast = useToast();
  const status = useSyncStatus();
  // Re-read on every status change: connecting and disconnecting both update the status.
  const config = getSyncConfig();
  const ago = useAgo(status.lastSyncedAt);

  const [url, setUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedUrl = url.trim();
  const insecure = /^http:\/\//i.test(trimmedUrl);
  const validUrl = /^https?:\/\/[^\s/]+/i.test(trimmedUrl);

  const onConnect = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await connect({ url: trimmedUrl.replace(/\/+$/, ''), apiKey: apiKey.trim() });
      setApiKey('');
      showToast({ icon: 'check', message: `Connected. ${describe(result)}` });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onSyncNow = async () => {
    if (!config) return;
    try {
      showToast({ icon: 'check', message: describe(await syncNow(config)) });
    } catch {
      // The status line shows the error.
    }
  };

  const onDisconnect = async () => {
    const ok = await confirmAsync(
      'Stop syncing?',
      'Everything stays on this device, and the server keeps its copy. You can connect again any time.',
      'Stop syncing',
      true,
    );
    if (ok) disconnect();
  };

  if (!config) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>
          Keep your calendar on more than one device with an OpenCal server you run yourself, at home or on any computer
          that stays on. Your data never goes anywhere else.
        </Text>
        <Section title="Your server" footer="The server address and key are shown when you set up the server.">
          <Field label="Address">
            <TextField
              value={url}
              onChangeText={setUrl}
              placeholder="https://myserver.tailnet.ts.net:2290"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              textContentType="URL"
            />
          </Field>
          <Divider />
          <Field label="API key">
            <TextField
              value={apiKey}
              onChangeText={setApiKey}
              placeholder="Paste the key from the server's .env"
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
          </Field>
          <Divider />
          <View style={styles.action}>
            {insecure ? <Text style={styles.warning}>Android only connects over HTTPS: use an https:// address.</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button
              title={busy ? 'Connecting…' : 'Connect'}
              disabled={busy || !validUrl || !apiKey.trim()}
              onPress={() => void onConnect()}
            />
          </View>
        </Section>
        <Section footer={WHAT_SYNCS}>
          <Row label="How to set up a server" subtitle="Docker, one command, works great with Tailscale" onPress={() => void Linking.openURL(SERVER_DOCS)} />
        </Section>
      </ScrollView>
    );
  }

  const statusLine = status.syncing ? 'Syncing…' : status.error ? `Last sync failed: ${status.error}` : (ago ?? 'Not synced yet');
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Section title="Server" footer="Syncs when the app opens, when you come back to it, and a few seconds after each change.">
        <Row label={config.url.replace(/^https?:\/\//i, '')} subtitle={statusLine} />
        <Divider />
        <View style={styles.action}>
          <Button variant="secondary" title={status.syncing ? 'Syncing…' : 'Sync now'} disabled={status.syncing} onPress={() => void onSyncNow()} />
        </View>
      </Section>
      <Section footer={WHAT_SYNCS}>
        <Row label="Stop syncing" destructive onPress={() => void onDisconnect()} />
      </Section>
    </ScrollView>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 48 },
  intro: { fontSize: 15, lineHeight: 22, color: colors.textMuted, marginBottom: spacing.lg },
  action: { padding: spacing.md, gap: 10 },
  warning: { fontSize: 13, lineHeight: 19, color: colors.textMuted },
  error: { fontSize: 14, lineHeight: 20, color: colors.danger },
}));
