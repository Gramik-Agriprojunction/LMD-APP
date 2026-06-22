import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

const SECTION_IMAGES = {
  payment: require('../screens/assets/money.png'),
  settlement: require('../screens/assets/purse.png'),
};

const STAT = {
  calendar: { tint: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  truck: { tint: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
  package: { tint: '#0891B2', bg: '#ECFEFF', border: '#A5F3FC' },
  card: { tint: '#5D3FD3', bg: '#EDE9FE', border: '#C4B5FD' },
  check: { tint: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
  pending: { tint: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  rupee: { tint: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
  cash: { tint: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  clock: { tint: '#EA580C', bg: '#FFF7ED', border: '#FED7AA' },
  refresh: { tint: '#64748B', bg: '#F8FAFC', border: '#E2E8F0' },
  payment: { tint: '#5D3FD3', bg: '#EDE9FE', border: '#C4B5FD' },
  settlement: { tint: '#0D9488', bg: '#F0FDFA', border: '#99F6E4' },
};

function MiniCalendar({ size = 16, color = '#2563EB' }) {
  const w = size;
  const h = size * 1.05;
  return (
    <View style={{ width: w, height: h, borderWidth: 1.6, borderColor: color, borderRadius: 3, overflow: 'hidden' }}>
      <View style={{ height: 4.5, backgroundColor: color }} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        <View style={{ width: w * 0.5, height: 1.5, backgroundColor: color, opacity: 0.9 }} />
        <View style={{ width: w * 0.32, height: 1.5, backgroundColor: color, opacity: 0.55 }} />
      </View>
    </View>
  );
}

function MiniTruck({ size = 16, color = '#7C3AED' }) {
  return (
    <View style={{ width: size + 2, height: size, justifyContent: 'flex-end' }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        <View style={{ width: size * 0.52, height: size * 0.42, borderWidth: 1.6, borderColor: color, borderRadius: 2 }} />
        <View style={{ width: size * 0.44, height: size * 0.56, borderWidth: 1.6, borderColor: color, borderLeftWidth: 0, borderRadius: 2 }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 1, marginTop: 2 }}>
        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color }} />
        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color }} />
      </View>
    </View>
  );
}

function MiniPackage({ size = 16, color = '#0891B2' }) {
  const s = size;
  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: s * 0.84, height: s * 0.84, borderWidth: 1.6, borderColor: color, borderRadius: 2 }}>
        <View style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1.5, marginLeft: -0.75, backgroundColor: color }} />
        <View style={{ position: 'absolute', top: '36%', left: 0, right: 0, height: 1.5, backgroundColor: color }} />
      </View>
    </View>
  );
}

function MiniCard({ size = 16, color = '#5D3FD3' }) {
  const w = size + 2;
  const h = size * 0.7;
  return (
    <View style={{ width: w, height: h + 4, justifyContent: 'center' }}>
      <View style={{ width: w, height: h, borderWidth: 1.6, borderColor: color, borderRadius: 3, overflow: 'hidden' }}>
        <View style={{ height: h * 0.36, backgroundColor: color, opacity: 0.22 }} />
        <View style={{ marginTop: 4, marginLeft: 4, width: w * 0.42, height: 1.5, backgroundColor: color, opacity: 0.75 }} />
      </View>
    </View>
  );
}

function MiniCheck({ size = 16, color = '#059669' }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1.6, borderColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.5, fontWeight: '900', color, includeFontPadding: false, lineHeight: size * 0.56 }}>✓</Text>
    </View>
  );
}

function MiniPending({ size = 16, color = '#D97706' }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1.6, borderColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.56, fontWeight: '900', color, includeFontPadding: false, lineHeight: size * 0.6 }}>!</Text>
    </View>
  );
}

function MiniRupee({ size = 16, color = '#059669' }) {
  return (
    <Text style={{ fontSize: size * 1.05, fontWeight: '800', color, includeFontPadding: false, lineHeight: size }}>₹</Text>
  );
}

function MiniCash({ size = 16, color = '#16A34A' }) {
  const w = size + 3;
  const h = size * 0.58;
  return (
    <View style={{ width: w, height: h + 2, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: w, height: h, borderWidth: 1.6, borderColor: color, borderRadius: 3, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 5, height: 5, borderRadius: 2.5, borderWidth: 1.4, borderColor: color }} />
      </View>
    </View>
  );
}

function MiniClock({ size = 16, color = '#EA580C' }) {
  const r = size / 2;
  return (
    <View style={{ width: size, height: size, borderRadius: r, borderWidth: 1.6, borderColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: 1.5, height: r * 0.52, backgroundColor: color, top: r * 0.24 }} />
      <View style={{ position: 'absolute', width: r * 0.38, height: 1.5, backgroundColor: color, top: r * 0.54, left: r * 0.5 }} />
    </View>
  );
}

function MiniRefresh({ size = 16, color = '#64748B' }) {
  return (
    <Text style={{ fontSize: size * 0.95, fontWeight: '800', color, includeFontPadding: false, lineHeight: size }}>↻</Text>
  );
}

const RENDERERS = {
  calendar: MiniCalendar,
  truck: MiniTruck,
  package: MiniPackage,
  card: MiniCard,
  check: MiniCheck,
  pending: MiniPending,
  rupee: MiniRupee,
  cash: MiniCash,
  clock: MiniClock,
  refresh: MiniRefresh,
};

function IconBadge({ name, compact, section }) {
  const meta = STAT[name] || STAT.clock;
  const sectionSrc = section ? SECTION_IMAGES[name] : null;

  if (sectionSrc) {
    const dim = 28;
    return (
      <View
        style={[
          st.wrap,
          st.sectionWrap,
          {
            width: dim,
            height: dim,
            backgroundColor: meta.bg,
            borderColor: meta.border,
            marginRight: 8,
          },
        ]}
      >
        <Image source={sectionSrc} style={{ width: 18, height: 18 }} resizeMode="contain" />
      </View>
    );
  }

  const Render = RENDERERS[name] || RENDERERS.clock;
  const dim = compact ? 26 : 30;
  const iconSize = compact ? 13 : 14;
  const radius = compact ? 7 : 8;

  return (
    <View
      style={[
        st.wrap,
        {
          width: dim,
          height: dim,
          borderRadius: radius,
          backgroundColor: meta.bg,
          borderColor: meta.border,
          marginRight: compact ? 7 : 8,
        },
      ]}
    >
      <Render size={iconSize} color={meta.tint} />
    </View>
  );
}

export function SummaryStatIcon({ name, wrapSize }) {
  const compact = wrapSize != null && wrapSize < 34;
  return <IconBadge name={name} compact={compact} />;
}

export function SummarySectionIcon({ name }) {
  return <IconBadge name={name} compact section />;
}

const st = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    borderWidth: 1,
  },
  sectionWrap: {
    borderRadius: 8,
  },
});
