/**
 * ScreenHeader — app-wide header matching Delivery Jaankari style.
 * Notification bell shows by default on every screen (hide with showNotification={false}).
 *
 *   <ScreenHeader bg="#5D3FD3" title="Orders" onBack={() => nav.goBack()} />
 *   <ScreenHeader bg="#9333EA" kicker="Action Zaroori" title="Reject Delivery" onBack={…} />
 *   <ScreenHeader bg="#5D3FD3" onBack={…} below={<SearchBox … />} />
 *   <ScreenHeader bg="#5D3FD3" title="Cash" onBack={…} right={<CallBtn />} />
 */
import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import NotificationBellButton from './NotificationBellButton';

const SIDE = 38;
const BACK_ICON = require('../screens/assets/back.png');

const isLightHex = (hex) => {
  if (typeof hex !== 'string') return false;
  const h = hex.replace('#', '');
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 186;
};

export default function ScreenHeader({
  bg = '#5D3FD3',
  title,
  kicker,
  onBack,
  right,
  children,
  below,
  iconChipBg,
  iconTint,
  titleColor,
  kickerColor,
  showNotification = true,
}) {
  const navigation = useNavigation();
  const light = isLightHex(bg);
  const chipBg = iconChipBg || (light ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.20)');
  const tint = iconTint || (light ? '#0F172A' : '#FFF');
  const tColor = titleColor || (light ? '#0F172A' : '#FFF');
  const kColor = kickerColor || (light ? 'rgba(15,23,42,0.6)' : 'rgba(255,255,255,0.70)');

  const bell = showNotification ? (
    <NotificationBellButton
      navigation={navigation}
      size={SIDE}
      iconSize={17}
      tint={tint}
      style={{ backgroundColor: chipBg, marginLeft: 0 }}
    />
  ) : null;

  const hasExtraRight = !!right;
  const rightNode = (hasExtraRight || bell) ? (
    <View style={[styles.rightRow, hasExtraRight && bell ? styles.rightRowWide : null]}>
      {right || null}
      {bell}
    </View>
  ) : (
    <View style={[styles.chip, { backgroundColor: 'transparent' }]} />
  );

  return (
    <View style={[styles.sheet, { backgroundColor: bg }, below ? styles.sheetWithBelow : null]}>
      {!light ? (
        <>
          <View style={styles.blobA} />
          <View style={styles.blobB} />
        </>
      ) : null}

      <SafeAreaView edges={['top']}>
        <View style={styles.row}>
          {onBack ? (
            <TouchableOpacity
              onPress={onBack}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={[styles.chip, { backgroundColor: chipBg }]}
            >
              <Image source={BACK_ICON} style={[styles.backIco, { tintColor: tint }]} />
            </TouchableOpacity>
          ) : (
            <View style={[styles.chip, { backgroundColor: 'transparent' }]} />
          )}

          <View style={[styles.center, children && styles.centerFill]}>
            {children ? (
              children
            ) : (
              <>
                {!!kicker && (
                  <Text style={[styles.kicker, { color: kColor }]} numberOfLines={1}>
                    {kicker}
                  </Text>
                )}
                {!!title && (
                  <Text
                    style={[styles.title, { color: tColor, marginTop: kicker ? 1 : 0 }]}
                    numberOfLines={1}
                  >
                    {title}
                  </Text>
                )}
              </>
            )}
          </View>

          <View style={[styles.sideSlot, (hasExtraRight && bell) && styles.sideSlotWide]}>
            {rightNode}
          </View>
        </View>

        {below ? <View style={styles.below}>{below}</View> : null}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
    paddingBottom: 10,
    elevation: 4,
  },
  sheetWithBelow: { paddingBottom: 16 },
  blobA: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(255,255,255,0.10)',
    right: -50,
    top: -60,
  },
  blobB: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(0,0,0,0.08)',
    left: -40,
    bottom: -50,
  },
  row: {
    height: 52,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chip: {
    width: SIDE,
    height: SIDE,
    borderRadius: SIDE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIco: { width: 18, height: 18, resizeMode: 'contain' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  centerFill: { alignItems: 'stretch' },
  kicker: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  title: { fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  sideSlot: {
    minWidth: SIDE,
    height: SIDE,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  sideSlotWide: {
    minWidth: SIDE * 2 + 6,
  },
  rightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rightRowWide: {},
  below: {
    paddingHorizontal: 14,
    paddingTop: 4,
  },
});
