import React, { useEffect, useState } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createStyles, fonts, radius, spacing } from '../theme';

const HIDDEN_OFFSET = 600;

/**
 * Bottom sheet modal used for pickers and quick actions. Slides up with a spring over a fading
 * backdrop, and animates out before unmounting.
 */
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
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const progress = useState(() => new Animated.Value(0))[0];
  // Stay mounted while the close animation runs.
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (!mounted) return;
    if (visible) {
      Animated.spring(progress, { toValue: 1, useNativeDriver: true, damping: 22, stiffness: 240, mass: 0.9 }).start();
      return;
    }
    Animated.timing(progress, { toValue: 0, duration: 190, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start();
    // Unmount on a timer rather than the animation callback, which never fires if frames are paused
    // (app in background). Reopening before it fires cancels it via the effect cleanup.
    const id = setTimeout(() => setMounted(false), 210);
    return () => clearTimeout(id);
  }, [visible, mounted, progress]);

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: progress }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + spacing.lg },
            { transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [HIDDEN_OFFSET, 0] }) }] },
          ]}
        >
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
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = createStyles((colors) => ({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.backdrop },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    maxHeight: '85%',
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
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
  title: { flex: 1, fontSize: 21, fontFamily: fonts.display, color: colors.text },
  action: { fontSize: 16, fontWeight: '600', color: colors.primary },
}));
