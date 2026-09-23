import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme';

/** Bottom sheet modal used for pickers and quick actions. */
export function Sheet({
  visible,
  onClose,
  title,
  children,
  actionLabel = 'Done',
  onAction,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <Pressable onPress={onAction ?? onClose} hitSlop={10}>
              <Text style={styles.action}>{actionLabel}</Text>
            </Pressable>
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 18, 30, 0.35)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg + 8,
    borderTopRightRadius: radius.lg + 8,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    maxHeight: '85%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.text },
  action: { fontSize: 16, fontWeight: '600', color: colors.primary },
});
