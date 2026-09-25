import { LayoutAnimation, Platform } from 'react-native';

/**
 * Animates the next layout change (rows appearing/disappearing, sections expanding). Call right
 * before the state update. No-op on web, where LayoutAnimation isn't supported.
 */
export function animateNextLayout(duration = 220): void {
  if (Platform.OS === 'web') return;
  LayoutAnimation.configureNext(LayoutAnimation.create(duration, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
}
