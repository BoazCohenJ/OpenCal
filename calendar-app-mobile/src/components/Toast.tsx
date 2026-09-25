import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createStyles, radius, shadow, spacing } from '../theme';
import { Icon, type IconName } from './Icon';

interface ToastOptions {
  message: string;
  icon?: IconName;
  actionLabel?: string;
  onAction?: () => void;
  /** Milliseconds before auto-dismiss. */
  duration?: number;
}

const ToastContext = createContext<(options: ToastOptions) => void>(() => undefined);

/** `const showToast = useToast(); showToast({ message: 'Added', actionLabel: 'Undo', onAction })` */
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<(ToastOptions & { id: number }) | null>(null);
  const progress = useState(() => new Animated.Value(0))[0];
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const removeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    Animated.timing(progress, { toValue: 0, duration: 180, useNativeDriver: true }).start();
    // Timer instead of the animation callback, which doesn't fire while frames are paused.
    removeTimer.current = setTimeout(() => setToast(null), 200);
  }, [progress]);

  const show = useCallback(
    (options: ToastOptions) => {
      if (timer.current) clearTimeout(timer.current);
      if (removeTimer.current) clearTimeout(removeTimer.current);
      setToast({ ...options, id: Date.now() });
      progress.setValue(0);
      Animated.spring(progress, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 220, mass: 0.8 }).start();
      timer.current = setTimeout(hide, options.duration ?? 4500);
    },
    [hide, progress],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (removeTimer.current) clearTimeout(removeTimer.current);
    },
    [],
  );

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <View pointerEvents="box-none" style={[styles.host, { bottom: insets.bottom + 96 }]}>
          <Animated.View
            accessibilityLiveRegion="polite"
            style={[
              styles.toast,
              shadow,
              {
                opacity: progress,
                transform: [
                  { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
                  { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
                ],
              },
            ]}
          >
            {toast.icon ? <Icon name={toast.icon} size={18} color={styles.message.color as string} /> : null}
            <Text style={styles.message} numberOfLines={2}>
              {toast.message}
            </Text>
            {toast.actionLabel ? (
              <Pressable
                hitSlop={10}
                onPress={() => {
                  toast.onAction?.();
                  hide();
                }}
                style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.actionText}>{toast.actionLabel}</Text>
              </Pressable>
            ) : null}
          </Animated.View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

const useStyles = createStyles((colors) => ({
  host: { position: 'absolute', left: spacing.lg, right: spacing.lg, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: 520,
    alignSelf: 'stretch',
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.ink,
  },
  message: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.onInk },
  action: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.primary },
  actionText: { fontSize: 14, fontWeight: '800', color: colors.onPrimary },
}));
