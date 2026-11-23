import React from 'react';
import { Text, View } from 'react-native';
import { createStyles } from '../theme';
import { useInboxCount } from './SyncWatcher';
import { IconButton } from './ui';

/** Header button to the assistant inbox, shown only while changes are waiting there. */
export function InboxButton({ onPress }: { onPress: () => void }) {
  const styles = useStyles();
  const count = useInboxCount();
  if (!count) return null;
  return (
    <View>
      <IconButton icon="sparkles" onPress={onPress} accessibilityLabel={`${count} assistant change${count === 1 ? '' : 's'} to review`} />
      <View style={styles.badge} pointerEvents="none">
        <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
      </View>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: colors.onPrimary },
}));
