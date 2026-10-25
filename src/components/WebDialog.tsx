import { getHeaderTitle } from '@react-navigation/elements';
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { createStyles, fonts, radius, shadow, spacing, useTheme } from '../theme';
import { useDesktop } from '../utils/desktop';

/** Width of the editor dialogs on a desktop browser. */
export const DIALOG_WIDTH = 640;

/**
 * On a desktop browser the editors (event, quick add, stamp...) open as a dialog over the dimmed
 * calendar instead of a full page. This is the card's top: the title with the screen's own
 * header buttons, which the screens set through `navigation.setOptions` like on the phone.
 */
export function DialogHeader({ navigation, options, route, back }: NativeStackHeaderProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const title = getHeaderTitle(options, route.name);
  const tintColor = colors.primary;
  const left = options.headerLeft?.({ tintColor, canGoBack: !!back });
  const right = options.headerRight?.({ tintColor, canGoBack: !!back });
  return (
    <View style={styles.headerBackdrop}>
      <Pressable style={styles.dismiss} onPress={() => navigation.goBack()} accessibilityLabel="Close" />
      <View style={[styles.headerCard, shadow]}>
        <View style={styles.side}>
          {left ?? (
            <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
              <Text style={styles.close}>Close</Text>
            </Pressable>
          )}
        </View>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={[styles.side, styles.sideRight]}>{right}</View>
      </View>
    </View>
  );
}

/** Wraps an editor screen as the body of the dialog card; Esc closes it. Phone-sized windows keep the page. */
export function dialog<P extends { navigation: { goBack: () => void } }>(Screen: React.ComponentType<P>): React.ComponentType<P> {
  function Dialog(props: P) {
    const styles = useStyles();
    const desktop = useDesktop();
    const { goBack } = props.navigation;
    useEffect(() => {
      if (!desktop) return;
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') goBack();
      };
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    }, [desktop, goBack]);
    if (!desktop) return <Screen {...props} />;
    return (
      <View style={styles.backdrop}>
        <Pressable style={styles.dismiss} onPress={goBack} accessibilityLabel="Close" />
        <View style={styles.body}>
          <Screen {...props} />
        </View>
      </View>
    );
  }
  return Dialog;
}

const useStyles = createStyles((colors) => ({
  headerBackdrop: { alignItems: 'center', backgroundColor: colors.backdrop, paddingTop: 40 },
  backdrop: { flex: 1, alignItems: 'center', backgroundColor: colors.backdrop, paddingBottom: 40 },
  dismiss: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  headerCard: {
    width: '100%',
    maxWidth: DIALOG_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    height: 54,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.border,
  },
  side: { width: 90, flexDirection: 'row', alignItems: 'center' },
  sideRight: { justifyContent: 'flex-end' },
  title: { flex: 1, textAlign: 'center', fontFamily: fonts.display, fontSize: 19, color: colors.text },
  close: { fontSize: 16, color: colors.primary },
  body: {
    flex: 1,
    width: '100%',
    maxWidth: DIALOG_WIDTH,
    backgroundColor: colors.bg,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.border,
    overflow: 'hidden',
  },
}));
