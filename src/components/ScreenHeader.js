/**
 * ScreenHeader — single, app-wide header used on every screen with a back
 * button. Guarantees the back chip and title sit at the exact same coordinates
 * on every screen so navigation feels stable.
 *
 *   <ScreenHeader bg="#5D3FD3" title="Notifications" onBack={() => nav.goBack()} />
 *   <ScreenHeader bg="#9333EA" kicker="Action Required" title="Reject Delivery" onBack={…} />
 *   <ScreenHeader bg="#5D3FD3" onBack={…}>
 *     <SearchBox … />            // custom center slot
 *   </ScreenHeader>
 *   <ScreenHeader bg="#5D3FD3" title="Cash Settlement" onBack={…} right={<BellButton/>} />
 *
 * Layout invariants:
 *   - `SafeAreaView edges={['top']}` consumes the status-bar height
 *   - Header row: height 56, paddingHorizontal 12
 *   - Back chip: 40 × 40 round, marginLeft 4, tinted from the bg
 *   - Title slot: flex 1 centered horizontally
 *   - Right slot: 40 × 40 spacer by default; pass a node to override
 */
import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BACK_ICON = require('../screens/assets/back.png');

const isLightHex = (hex) => {
  if (typeof hex !== 'string') return false;
  const h = hex.replace('#', '');
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // perceived luminance
  return (0.299 * r + 0.587 * g + 0.114 * b) > 186;
};

export default function ScreenHeader({
  bg = '#5D3FD3',
  title,
  kicker,
  onBack,
  right,
  children,
  iconChipBg,
  iconTint,
  titleColor,
  kickerColor,
}) {
  const light = isLightHex(bg);
  const chipBg = iconChipBg || (light ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.16)');
  const tint = iconTint || (light ? '#0F172A' : '#FFF');
  const tColor = titleColor || (light ? '#0F172A' : '#FFF');
  const kColor = kickerColor || (light ? 'rgba(15,23,42,0.6)' : 'rgba(255,255,255,0.65)');

  return (
    <View style={{ backgroundColor: bg }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: bg }}>
        <View style={styles.row}>
          <TouchableOpacity
            onPress={onBack}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={[styles.chip, { backgroundColor: chipBg }]}
          >
            <Image source={BACK_ICON} style={[styles.ico, { tintColor: tint }]} />
          </TouchableOpacity>

          <View style={styles.center}>
            {children ? (
              children
            ) : (
              <>
                {!!kicker && <Text style={[styles.kicker, { color: kColor }]} numberOfLines={1}>{kicker}</Text>}
                {!!title && <Text style={[styles.title, { color: tColor, marginTop: kicker ? 1 : 0 }]} numberOfLines={1}>{title}</Text>}
              </>
            )}
          </View>

          {right || <View style={styles.spacer} />}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: 56, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  chip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  ico: { width: 17, height: 17, resizeMode: 'contain' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  kicker: { fontSize: 10, fontWeight: '600', letterSpacing: 1 },
  title: { fontSize: 14.5, fontWeight: '700', letterSpacing: 0.2 },
  spacer: { width: 40, height: 40 },
});
