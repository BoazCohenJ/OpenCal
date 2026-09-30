import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { ColorPicker } from '../components/ColorPicker';
import { Button, Divider, Field, IconButton, Row, Section, TextField } from '../components/ui';
import { useCalendarContext } from '../context/CalendarContext';
import type { ColorRule } from '../models/ColorRule';
import type { ScreenProps } from '../navigation/types';
import { matchColorRule } from '../services/occurrences';
import { createStyles, PALETTE, spacing } from '../theme';
import { newId } from '../utils/id';
import { animateNextLayout } from '../utils/motion';

export function ColorRulesScreen(_: ScreenProps<'ColorRules'>) {
  const styles = useStyles();
  const { colorRules, saveColorRule, deleteColorRule, moveColorRule, events } = useCalendarContext();
  const [draft, setDraft] = useState<ColorRule | null>(null);

  // How many events each rule ends up coloring (an earlier rule takes an event first).
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of events) {
      if (e.color) continue;
      const rule = matchColorRule(e.title, colorRules);
      if (rule) map.set(rule.id, (map.get(rule.id) ?? 0) + 1);
    }
    return map;
  }, [events, colorRules]);

  const start = (rule?: ColorRule) => {
    animateNextLayout();
    setDraft(rule ?? { id: newId(), keyword: '', color: PALETTE[colorRules.length % PALETTE.length]! });
  };
  const commit = () => {
    if (!draft || !draft.keyword.trim()) return;
    animateNextLayout();
    saveColorRule({ ...draft, keyword: draft.keyword.trim() });
    setDraft(null);
  };
  const editing = draft ? colorRules.some((r) => r.id === draft.id) : false;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Section footer="An event containing the word gets the color, whatever its calendar. The first rule that matches wins, so put more specific words higher. A color set on an event itself always wins.">
        {colorRules.length === 0 ? <Text style={styles.empty}>No rules yet. Try “Break” or “Gym”.</Text> : null}
        {colorRules.map((r, i) => (
          <View key={r.id}>
            {i > 0 ? <Divider /> : null}
            <Row
              label={r.keyword}
              subtitle={`${counts.get(r.id) ?? 0} event${counts.get(r.id) === 1 ? '' : 's'}`}
              left={<View style={[styles.swatch, { backgroundColor: r.color }]} />}
              right={
                <View style={styles.moves}>
                  {i > 0 ? <IconButton icon="chevron-up" size={34} accessibilityLabel="Move up" onPress={() => moveColorRule(r.id, -1)} /> : null}
                  {i < colorRules.length - 1 ? (
                    <IconButton icon="chevron-down" size={34} accessibilityLabel="Move down" onPress={() => moveColorRule(r.id, 1)} />
                  ) : null}
                </View>
              }
              onPress={() => start(r)}
            />
          </View>
        ))}
      </Section>

      {draft ? (
        <Section title={editing ? 'Edit rule' : 'New rule'}>
          <Field label="Title contains">
            <TextField
              value={draft.keyword}
              onChangeText={(keyword) => setDraft({ ...draft, keyword })}
              placeholder="e.g. Break"
              autoFocus
              autoCapitalize="none"
            />
          </Field>
          <Field label="Color">
            <ColorPicker value={draft.color} onChange={(color) => color && setDraft({ ...draft, color })} />
          </Field>
          <View style={styles.actions}>
            <Button title="Save rule" onPress={commit} disabled={!draft.keyword.trim()} />
            {editing ? (
              <Button
                variant="danger"
                title="Delete rule"
                onPress={() => {
                  animateNextLayout();
                  deleteColorRule(draft.id);
                  setDraft(null);
                }}
              />
            ) : null}
            <Button variant="secondary" title="Cancel" onPress={() => setDraft(null)} />
          </View>
        </Section>
      ) : (
        <Button title="Add a rule" onPress={() => start()} />
      )}
    </ScrollView>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 48 },
  swatch: { width: 26, height: 26, borderRadius: 8 },
  moves: { flexDirection: 'row', gap: 2 },
  empty: { padding: spacing.lg, fontSize: 14, color: colors.textMuted },
  actions: { gap: spacing.sm, padding: spacing.md },
}));
