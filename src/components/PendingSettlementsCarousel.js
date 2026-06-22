import React, { Component } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Animated, Image, Easing,
} from 'react-native';
import { getStatus } from '../utils/statusColors';

const { width: SW } = Dimensions.get('window');
const OUTER_PAD = 8;
const CARD_W = SW - OUTER_PAD * 2;
const SLIDE_MS = 4500;
const GREEN = '#16A34A';
const GREEN_DARK = '#15803D';
const GREEN_BG = '#F0FDF4';
const SECTION_ICON = 22;

const maskMobile = (p) => {
  if (!p) return '';
  const s = String(p).replace(/\s+/g, '');
  if (s.length < 6) return s;
  return `${s.slice(0, 2)}****${s.slice(-2)}`;
};

export default class PendingSettlementsCarousel extends Component {
  constructor(props) {
    super(props);
    this.scrollRef = React.createRef();
    this.scrollIdx = 0;
    this.timer = null;
    this.dragging = false;
    this.state = { activeDot: 0 };
    this.arrowX = new Animated.Value(0);
  }

  componentDidMount() {
    this.resetToMiddle(false);
    this.startAutoSlide();
    this.startArrow();
  }

  componentDidUpdate(prevProps) {
    if ((prevProps.items?.length || 0) !== (this.props.items?.length || 0)) {
      this.setState({ activeDot: 0 });
      this.resetToMiddle(false);
      this.restartAutoSlide();
    }
  }

  componentWillUnmount() {
    this.stopAutoSlide();
    this.arrowX.stopAnimation();
  }

  getItems = () => this.props.items || [];

  getLoopItems = () => {
    const items = this.getItems();
    if (items.length <= 1) return items;
    return [...items, ...items, ...items];
  };

  resetToMiddle = (animated = false) => {
    const items = this.getItems();
    if (items.length <= 1) {
      this.scrollIdx = 0;
      return;
    }
    this.scrollIdx = items.length;
    this.setState({ activeDot: 0 });
    requestAnimationFrame(() => {
      this.scrollRef.current?.scrollTo({ x: this.scrollIdx * CARD_W, animated });
    });
  };

  startArrow = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(this.arrowX, {
          toValue: 6,
          duration: 650,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(this.arrowX, {
          toValue: 0,
          duration: 650,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  };

  startAutoSlide = () => {
    this.stopAutoSlide();
    if (this.getItems().length <= 1) return;
    this.timer = setInterval(this.advance, SLIDE_MS);
  };

  restartAutoSlide = () => {
    this.stopAutoSlide();
    this.startAutoSlide();
  };

  stopAutoSlide = () => {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  };

  advance = () => {
    if (this.dragging) return;
    const items = this.getItems();
    if (items.length <= 1) return;
    this.scrollToIndex(this.scrollIdx + 1, true);
  };

  scrollToIndex = (index, animated = true) => {
    const items = this.getItems();
    if (!items.length) return;
    this.scrollIdx = index;
    this.scrollRef.current?.scrollTo({ x: index * CARD_W, animated });
    if (items.length === 1) {
      this.setState({ activeDot: 0 });
      return;
    }
    this.setState({ activeDot: index % items.length });
  };

  onScrollEnd = (e) => {
    const items = this.getItems();
    if (!items.length) return;

    const x = e.nativeEvent.contentOffset.x;
    let idx = Math.round(x / CARD_W);

    if (items.length > 1) {
      const n = items.length;
      if (idx < n) {
        idx += n;
        this.scrollRef.current?.scrollTo({ x: idx * CARD_W, animated: false });
      } else if (idx >= n * 2) {
        idx -= n;
        this.scrollRef.current?.scrollTo({ x: idx * CARD_W, animated: false });
      }
    }

    this.scrollIdx = idx;
    this.setState({ activeDot: items.length > 1 ? idx % items.length : 0 });
    this.restartAutoSlide();
  };

  money = (v) => {
    if (v === undefined || v === null || v === '') return '0';
    const s = String(v);
    return s.endsWith('.00') ? s.replace('.00', '') : s;
  };

  resolveItem = (item) => {
    const address = String(item?.shipping_address || '').trim();
    const dsName = String(item?.dark_store?.name || '').trim();
    const dsCity = String(item?.dark_store?.city || '').trim();
    const parts = address.split(',').map((s) => s.trim()).filter(Boolean);
    const shortLoc = [parts[parts.length - 2] || parts[parts.length - 1], dsName || dsCity]
      .filter(Boolean)
      .join(' · ');

    return {
      code: String(item?.order_code || item?.order_id || '—'),
      farmer: String(item?.farmer_name || item?.farmer?.name || 'Farmer').trim(),
      mobile: maskMobile(item?.farmer_mobile || item?.farmer?.mobile),
      shortLoc,
      amount: this.money(item?.amount ?? item?.collected_amount ?? item?.deposited_amount ?? item?.order_amount),
      payMode: String(item?.payment_mode || '').trim(),
      payStatus: String(item?.payment_status || '').trim(),
      status: String(item?.status || '').trim(),
    };
  };

  computedTotal = () => {
    const { totalAmount } = this.props;
    const n = Number(totalAmount);
    if (Number.isFinite(n) && n > 0) return this.money(n);
    const sum = this.getItems().reduce((acc, it) => acc + (Number(it?.amount) || 0), 0);
    return this.money(sum);
  };

  onSettle = () => {
    const { onNavigate } = this.props;
    if (onNavigate) onNavigate();
  };

  renderChip = (label, tone) => {
    if (!label) return null;
    const tones = {
      warn: { bg: '#FFF7ED', text: '#EA580C', border: '#FED7AA' },
      ok: { bg: '#ECFDF5', text: GREEN_DARK, border: '#A7F3D0' },
      muted: { bg: '#F1F5F9', text: '#64748B', border: '#E2E8F0' },
    };
    const t = tones[tone] || tones.muted;
    return (
      <View style={[$.chip, { backgroundColor: t.bg, borderColor: t.border }]}>
        <Text style={[$.chipT, { color: t.text }]}>{label}</Text>
      </View>
    );
  };

  renderCard = (item, index) => {
    const d = this.resolveItem(item);
    const orderSt = getStatus(d.status);
    const unpaid = d.payStatus.toLowerCase() !== 'paid';

    return (
      <View key={`${item?.order_id || item?.id || index}-${index}`} style={[$.slide, { width: CARD_W }]}>
        <View style={$.card}>
          <View style={$.cardBody}>
            <View style={$.topRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={$.code} numberOfLines={1}>{d.code}</Text>
                <Text style={$.farmerLine} numberOfLines={1}>
                  {d.farmer}{d.mobile ? ` · ${d.mobile}` : ''}
                </Text>
                {!!d.shortLoc && (
                  <Text style={$.locLine} numberOfLines={1}>{d.shortLoc}</Text>
                )}
              </View>
              <Text style={$.amtVal}>₹{d.amount}</Text>
            </View>

            <View style={$.chipRow}>
              {this.renderChip(d.payMode, 'muted')}
              {this.renderChip(unpaid ? 'Unpaid' : 'Paid', unpaid ? 'warn' : 'ok')}
              {this.renderChip(orderSt.label, 'ok')}
            </View>
          </View>

          <TouchableOpacity style={$.settleBtn} activeOpacity={0.88} onPress={this.onSettle}>
            <View style={$.settleBadge}>
              <Text style={$.settleBadgeT}>₹</Text>
            </View>
            <Text style={$.settleBtnT}>Abhi settle karien</Text>
            <Animated.Image
              source={require('../screens/assets/arrow.png')}
              style={[$.settleArrow, { transform: [{ translateX: this.arrowX }] }]}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  render() {
    const items = this.getItems();
    if (!items.length) return null;

    const loopItems = this.getLoopItems();
    const { totalCount } = this.props;
    const count = totalCount ?? items.length;
    const total = this.computedTotal();

    return (
      <View style={$.wrap}>
        <View style={$.head}>
          <View style={$.headLeft}>
            <View style={$.headIcoBox}>
              <Image source={require('../screens/assets/money.png')} style={$.headIco} resizeMode="contain" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={$.title}>Pending Settlement</Text>
              <Text style={$.sub}>{count} order{count === 1 ? '' : 's'} · Total ₹ {total}</Text>
            </View>
          </View>
          <View style={$.pill}>
            <View style={$.pillDot} />
            <Text style={$.pillT}>Pending</Text>
          </View>
        </View>

        <ScrollView
          ref={this.scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={CARD_W}
          snapToAlignment="start"
          contentContainerStyle={{ width: CARD_W * loopItems.length }}
          onScrollBeginDrag={() => { this.dragging = true; this.stopAutoSlide(); }}
          onScrollEndDrag={() => { this.dragging = false; }}
          onMomentumScrollEnd={this.onScrollEnd}
        >
          {loopItems.map((item, i) => this.renderCard(item, i))}
        </ScrollView>

        {items.length > 1 ? (
          <View style={$.dots}>
            {items.map((_, i) => (
              <View key={i} style={[$.dot, i === this.state.activeDot && $.dotOn]} />
            ))}
          </View>
        ) : null}
      </View>
    );
  }
}

const $ = StyleSheet.create({
  wrap: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: 10,
    paddingTop: 10,
    paddingBottom: 10,
    borderWidth: 1,
    borderColor: '#E8ECF1',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    overflow: 'hidden',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    marginBottom: 8,
    gap: 8,
  },
  headLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headIcoBox: { width: SECTION_ICON, height: SECTION_ICON, alignItems: 'center', justifyContent: 'center' },
  headIco: { width: SECTION_ICON, height: SECTION_ICON },
  title: { fontSize: 13, fontWeight: '700', color: '#1E293B' },
  sub: { fontSize: 11, fontWeight: '500', color: '#64748B', marginTop: 1 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: GREEN_BG,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  pillDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: GREEN },
  pillT: { fontSize: 10, fontWeight: '700', color: GREEN_DARK },

  slide: { paddingHorizontal: 10 },
  card: {
    backgroundColor: GREEN_BG,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    overflow: 'hidden',
  },
  cardBody: { paddingHorizontal: 10, paddingTop: 10, paddingBottom: 8 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  code: { fontSize: 11, fontWeight: '700', color: GREEN_DARK, letterSpacing: 0.2 },
  farmerLine: { fontSize: 13, fontWeight: '700', color: '#1E293B', marginTop: 3 },
  locLine: { fontSize: 10.5, fontWeight: '400', color: '#64748B', marginTop: 2 },
  amtVal: { fontSize: 18, fontWeight: '800', color: GREEN, letterSpacing: -0.3 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 },
  chip: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
  },
  chipT: { fontSize: 9.5, fontWeight: '600' },

  settleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GREEN,
    paddingVertical: 11,
    paddingHorizontal: 12,
    marginHorizontal: 8,
    marginBottom: 8,
    borderRadius: 10,
  },
  settleBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  settleBadgeT: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  settleBtnT: { flex: 1, color: '#FFF', fontSize: 13, fontWeight: '700' },
  settleArrow: { width: 12, height: 12, tintColor: '#FFF', resizeMode: 'contain', marginLeft: 4 },

  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 8, gap: 5 },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#D1FAE5' },
  dotOn: { width: 14, backgroundColor: GREEN },
});
