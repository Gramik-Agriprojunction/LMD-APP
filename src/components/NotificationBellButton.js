import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Platform } from 'react-native';
import { subscribe as cacheSubscribe, KEYS } from '../utils/dataCache';
import { getNotificationCount, notificationBadgeMeta } from '../utils/notificationCount';

const BELL = require('../screens/assets/bell.png');

function Badge({ count, floating = false, large = false }) {
  if (!count) return null;
  const badge = notificationBadgeMeta(count, { large });
  const sizeStyle = {
    height: badge.height,
    borderRadius: badge.height / 2,
    paddingHorizontal: badge.padH,
    ...(badge.width
      ? { width: badge.width }
      : { minWidth: badge.minWidth || badge.height }),
  };

  return (
    <View style={[st.badge, floating && st.badgeFloat, sizeStyle]}>
      <Text style={[st.badgeT, { fontSize: badge.fontSize }]} numberOfLines={1}>
        {badge.label}
      </Text>
    </View>
  );
}

export default function NotificationBellButton({
  navigation,
  size = 40,
  iconSize = 17,
  style,
}) {
  const [count, setCount] = useState(getNotificationCount);

  useEffect(() => {
    const unsub = cacheSubscribe(KEYS.DASHBOARD, (data) => {
      if (data) setCount(Number(data.notification_count || 0));
    });
    return unsub;
  }, []);

  return (
    <TouchableOpacity
      style={[st.chip, { width: size, height: size, borderRadius: size / 2 }, style]}
      onPress={() => navigation?.navigate?.('Notifications')}
      activeOpacity={0.7}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      <Image
        source={BELL}
        style={{ width: iconSize, height: iconSize, tintColor: '#FFF', resizeMode: 'contain' }}
      />
      <Badge count={count} floating />
    </TouchableOpacity>
  );
}

export function NotificationCountBadge({ large = false, compact = false }) {
  const [count, setCount] = useState(getNotificationCount);

  useEffect(() => {
    const unsub = cacheSubscribe(KEYS.DASHBOARD, (data) => {
      if (data) setCount(Number(data.notification_count || 0));
    });
    return unsub;
  }, []);

  if (!count) {
    return compact ? null : <View style={st.headerPlaceholder} />;
  }

  if (compact) {
    return <Badge count={count} large={large} />;
  }

  return <Badge count={count} large={large} />;
}

const st = StyleSheet.create({
  headerPlaceholder: { width: 40, height: 40 },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
    flexShrink: 0,
    overflow: 'visible',
  },
  badge: {
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    ...Platform.select({
      android: { elevation: 3 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1,
      },
    }),
  },
  badgeFloat: {
    position: 'absolute',
    top: -4,
    right: -4,
    zIndex: 2,
  },
  badgeT: {
    color: '#FFF',
    fontWeight: '700',
    textAlign: 'center',
    includeFontPadding: false,
    ...Platform.select({
      android: { textAlignVertical: 'center' },
      ios: { marginTop: -0.5 },
    }),
  },
});
