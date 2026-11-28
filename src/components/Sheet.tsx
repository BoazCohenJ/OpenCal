import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createStyles, fonts, radius, spacing } from '../theme';
import { useDesktop } from '../utils/desktop';

const HIDDEN_OFFSET = 600;
const DISMISS_DISTANCE = 72;

/**
 * Bottom sheet modal used for pickers and quick actions. Slides up with a spring over a fading
 * backdrop, supports swiping down from its handle/header to dismiss on phones and Escape on web,
 * and animates out before unmounting.
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
  const desktop = useDesktop();
  const progress = useState(() => new Animated.Value(0))[0];
  const dragY = useState(() => new Animated.Value(0))[0];
  // Stay mounted while the close animation runs.
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);

  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  });

  // eslint-disable-next-line react-hooks/refs -- handlers only read refs when gestures fire
  const [dragResponder] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && g.dy > Math.abs(g.dx) * 1.4,
      onPanResponderMove: (_, g) => dragY.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > DISMISS_DISTANCE || g.vy > 0.65) {
          onCloseRef.current();
        } else {
          Animated.spring(dragY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 260 }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(dragY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 260 }).start();
      },
    }),
  );

  const sheetTranslateY = useMemo(
    () => Animated.add(progress.interpolate({ inputRange: [0, 1], outputRange: [HIDDEN_OFFSET, 0] }), dragY),
    [progress, dragY],
  );
  const desktopTranslateY = useMemo(
    () => progress.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }),
    [progress],
  );

  useEffect(() => {
    if (!mounted) return;
    if (visible) {
      dragY.setValue(0);
      Animated.spring(progress, { toValue: 1, useNativeDriver: true, damping: 22, stiffness: 240, mass: 0.9 }).start();
      return;
    }
    Animated.timing(progress, { toValue: 0, duration: 190, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start();
    // Unmount on a timer rather than the animation callback, which never fires if frames are paused
    // (app in background). Reopening before it fires cancels it via the effect cleanup.
    const id = setTimeout(() => setMounted(false), 210);
    return () => clearTimeout(id);
  }, [visible, mounted, progress, dragY]);

  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible]);

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.root, desktop && styles.rootDesktop]}>
        <Animated.View style={[styles.backdrop, { opacity: progress }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheet,
            desktop && styles.sheetDesktop,
            { paddingBottom: (desktop ? 0 : insets.bottom) + spacing.lg },
            desktop
              ? { opacity: progress, transform: [{ translateY: desktopTranslateY }] }
              : { transform: [{ translateY: sheetTranslateY }] },
          ]}
        >
          <View {...(!desktop ? dragResponder.panHandlers : undefined)}>
            {desktop ? null : <View style={styles.handle} />}
            <View style={styles.header}>
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
              <Pressable onPress={onAction ?? onClose} hitSlop={10} style={({ pressed }) => pressed && styles.pressed}>
                <Text style={styles.action}>{actionLabel}</Text>
              </Pressable>
            </View>
          </View>
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = createStyles((colors) => ({
  root: { flex: 1, justifyContent: 'flex-end' },
  rootDesktop: { justifyContent: 'center' },
  sheetDesktop: { borderRadius: radius.xl, maxWidth: 460, paddingTop: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
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
  pressed: { opacity: 0.65 },
}));
