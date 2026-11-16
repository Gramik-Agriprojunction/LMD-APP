import { Platform, StyleSheet } from 'react-native';

/**
 * LMD tokens — GramikFarmer + dark_store patterns, purple brand kept.
 * Prefer flat bordered cards on scroll lists (Farmer home style).
 */
export const COLORS = {
  primary: '#5D3FD3',
  primaryDark: '#4C1D95',
  primaryLight: '#7C5CF0',
  primarySoft: '#EDE9FE',
  primarySoftBorder: '#C4B5FD',
  primaryChip: '#EDE9FE',
  primaryChipText: '#5D3FD3',

  bg: '#EBE7F5',
  bgSoft: '#E0DAF0',
  card: '#F7F5FC',
  surface: '#F7F5FC',

  header: '#5D3FD3',
  headerDark: '#4C1D95',
  headerBtn: 'rgba(255,255,255,0.18)',

  textPrimary: '#171A2A',
  textSecondary: '#5B6478',
  textMuted: '#8B93A7',

  border: '#D4CDE8',
  borderSoft: '#DDD6F0',
  divider: '#E6E0F2',

  success: '#16A34A',
  successSoft: '#E8F8EE',
  successBorder: '#C6EBD4',
  danger: '#E53935',
  dangerSoft: '#FCEAEA',
  warning: '#F58220',
  warningSoft: '#FFEEDB',
  warningText: '#8A5C24',

  tabInactive: '#8B93A7',

  // tinted quick-action tiles (Farmer-style)
  tintBlue: '#E1ECFB',
  tintGreen: '#DBF3E5',
  tintOrange: '#FFEBD8',
  tintPurple: '#EFE0FB',
};

export const FONT = {
  h1: 20,
  h2: 17,
  h3: 15.5,
  title: 13.5,
  body: 12.5,
  small: 11,
  tiny: 10,
};

export const RADIUS = {
  card: 16,
  cardLarge: 20,
  tile: 14,
  btn: 12,
  btnLarge: 22,
  pill: 999,
  headerSheet: 22,
  chip: 8,
  icon: 12,
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  screen: 8,
};

const SHADOW_BASE = '#1A1F3A';

export function appShadow(level = 'card') {
  const map = {
    none: { ios: {}, android: 0 },
    hairline: {
      ios: {
        shadowColor: SHADOW_BASE,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.045,
        shadowRadius: 4,
      },
      android: 0,
    },
    card: {
      ios: {
        shadowColor: SHADOW_BASE,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
      },
      android: 1,
    },
    raised: {
      ios: {
        shadowColor: SHADOW_BASE,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 14,
      },
      android: 3,
    },
  };
  const s = map[level] || map.card;
  return Platform.select({
    ios: s.ios,
    android: {
      elevation: s.android,
      ...(s.android > 0 && s.android <= 2
        ? {
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: 'rgba(26, 31, 58, 0.07)',
          }
        : {}),
    },
    default: s.ios,
  });
}

/** Flat card — Farmer home/list convention. */
export const FLAT = Platform.select({
  ios: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
  android: { elevation: 0 },
  default: {},
});

export const SHADOW = {
  card: appShadow('card'),
  raised: appShadow('raised'),
  hairline: appShadow('hairline'),
  none: FLAT,
};

/** White flat surface with soft purple-grey border (GramikFarmer ProductListCard language). */
export const flatCard = {
  backgroundColor: COLORS.card,
  borderRadius: RADIUS.card,
  borderWidth: 1,
  borderColor: COLORS.borderSoft,
  ...FLAT,
};

export const cardStyle = {
  ...flatCard,
};
