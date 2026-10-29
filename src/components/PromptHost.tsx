import React, { useSyncExternalStore } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { createStyles, fonts, radius, spacing, useTheme } from '../theme';
import { answerPrompt, getPrompt, subscribePrompts } from '../utils/confirm';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { Button } from './ui';

/** App-styled confirmations and notices, shared by native and web. */
export function PromptHost() {
  const prompt = useSyncExternalStore(subscribePrompts, getPrompt, () => null);
  const styles = useStyles();
  const { colors } = useTheme();
  const close = () => { if (prompt) answerPrompt(prompt.id, false); };
  return (
    <Sheet visible={!!prompt} title={prompt?.cancelable ? 'Please confirm' : 'OpenCal'} onClose={close} actionLabel={prompt?.cancelable ? 'Cancel' : 'Close'}>
      {prompt ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
          <View style={[styles.icon, prompt.destructive && styles.dangerIcon]}>
            <Icon name={prompt.destructive ? 'x' : 'calendar'} size={24} color={prompt.destructive ? colors.danger : colors.primary} />
          </View>
          <Text accessibilityRole="header" style={styles.title}>{prompt.title}</Text>
          {prompt.message ? <Text style={styles.message}>{prompt.message}</Text> : null}
          <View style={styles.actions}>
            <Button title={prompt.confirmLabel} variant={prompt.destructive ? 'danger' : 'primary'} onPress={() => answerPrompt(prompt.id, true)} />
            {prompt.cancelable ? <Button title="Cancel" variant="ghost" onPress={close} /> : null}
          </View>
        </ScrollView>
      ) : null}
    </Sheet>
  );
}

const useStyles = createStyles((colors) => ({
  body: { gap: spacing.md, paddingBottom: spacing.sm },
  icon: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  dangerIcon: { backgroundColor: colors.dangerSoft },
  title: { fontFamily: fonts.display, fontSize: 25, color: colors.text },
  message: { fontSize: 16, lineHeight: 24, color: colors.textMuted },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
}));
