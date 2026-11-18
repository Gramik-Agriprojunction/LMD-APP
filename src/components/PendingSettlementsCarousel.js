import React, { Component } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Animated, Image, Easing,
} from 'react-native';
import { getStatus } from '../utils/statusColors';
import { isReadOnly } from '../utils/lmdViewMode';

const { width: SW } = Dimensions.get('window');
const OUTER_PAD = 12;
const GAP = 10;
const FULL_W = SW - OUTER_PAD * 2;
/** Multi: ~1 card + next peek */
const PEEK_W = Math.round(SW * 0.78);
const SLIDE_MS = 4500;
const GREEN = '#16A34A';
const GREEN_DARK = '#15803D';
const GREEN_SOFT = '#ECFDF5';

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
    this.startAutoSlide();
    this.startArrow();
  }

  componentDidUpdate(prevProps) {
    if ((prevProps.items?.length || 0) !== (this.props.items?.length || 0)) {
      this.setState({ activeDot: 0 });
      this.scrollIdx = 0;
      this.scrollRef.current?.scrollTo({ x: 0, animated: false });
      this.restartAutoSlide();
    }
  }

  componentWillUnmount() {
    this.stopAutoSlide();
    this.arrowX.stopAnimation();
  }

  getItems = () => this.props.items || [];

  isMulti = () => this.getItems().length > 1;

  cardW = () => (this.isMulti() ? PEEK_W : FULL_W);

  step = () => this.cardW() + GAP;

  startArrow = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(this.arrowX, {
          toValue: 5,
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
    if (!this.isMulti()) return;
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
    if (this.dragging || !this.isMulti()) return;
    const items = this.getItems();
    const next = (this.scrollIdx + 1) % items.length;
    this.scrollToIndex(next, true);
  };

  scrollToIndex = (index, animated = true) => {
    const items = this.getItems();
    if (!items.length) return;
    const idx = Math.max(0, Math.min(index, items.length - 1));
    this.scrollIdx = idx;
    this.scrollRef.current?.scrollTo({ x: idx * this.step(), animated });
    this.setState({ activeDot: idx });
  };

  onScrollEnd = (e) => {
    const items = this.getItems();
    if (!items.length) return;
    const step = this.step();
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.max(0, Math.min(Math.round(x / step), items.length - 1));
    this.scrollIdx = idx;
    this.setState({ activeDot: idx });
    this.restartAutoSlide();
  };

  money = (v) => {
    if (v === undefined || v === null || v === '') return '0';
    const n = Number(v);
    if (!Number.isFinite(n)) {
      const s = String(v);
      return s.endsWith('.00') ? s.replace('.00', '') : s;
    }
    return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
  };

  resolveItem = (item) => {
    const address = String(item?.shipping_address || '').trim();
    const dsName = String(item?.dark_store?.name || '').trim();
    const dsCity = String(item?.dark_store?.city || '').trim();
    const parts = address.split(',').map((s) => s.trim()).filter(Boolean);
    const shortLoc = [parts[parts.length - 2] || parts[parts.length - 1], dsName || dsCity]
      .filter(Boolean)
      .join(' · ');

    const rawAmt =
      item?.amount ??
      item?.collected_amount ??
      item?.order_grand_total ??
      item?.deposited_amount ??
      item?.order_amount;

    return {
      code: String(item?.order_code || item?.order_id || '—'),
      farmer: String(item?.farmer_name || item?.farmer?.name || 'Farmer').trim(),
      mobile: maskMobile(item?.farmer_mobile || item?.farmer?.mobile),
      shortLoc,
      amount: this.money(rawAmt),
      payMode: String(item?.payment_mode || '').trim(),
      payStatus: String(item?.payment_status || '').trim(),
      status: String(item?.status || '').trim(),
    };
  };

  computedTotal = () => {
    const { totalAmount } = this.props;
    const n = Number(totalAmount);
    if (Number.isFinite(n) && n > 0) return this.money(n);
    const sum = this.getItems().reduce((acc, it) => {
      const raw = it?.amount ?? it?.collected_amount ?? it?.order_grand_total ?? 0;
      return acc + (Number(raw) || 0);
    }, 0);
    return this.money(sum);
  };

  onSettle = () => {
    const { onNavigate } = this.props;
    if (onNavigate) onNavigate();
  };

  renderCard = (item, index, cardW, isLast) => {
    const d = this.resolveItem(item);
    const orderSt = getStatus(d.status);
    const unpaid = d.payStatus.toLowerCase() !== 'paid';
    const metaBits = [
      d.payMode,
      unpaid ? 'Unpaid' : 'Paid',
      orderSt.label || d.status,
    ].filter(Boolean);

    return (
      <View
        key={`${item?.order_id || item?.id || index}-${index}`}
        style={[$.slide, { width: cardW, marginRight: isLast ? 0 : GAP }]}
      >
        <View style={$.orderRow}>
          <View style={$.orderLeft}>
            <Text style={$.code} numberOfLines={1}>{d.code}</Text>
            <Text style={$.farmer} numberOfLines={1}>
              {d.farmer}{d.mobile ? ` · ${d.mobile}` : ''}
            </Text>
            {!!d.shortLoc && (
              <Text style={$.loc} numberOfLines={1}>{d.shortLoc}</Text>
            )}
            {!!metaBits.length && (
              <Text style={$.meta} numberOfLines={1}>{metaBits.join('  ·  ')}</Text>
            )}
          </View>
          <View style={$.amtCol}>
            <Text style={$.amt} numberOfLines={1}>₹{d.amount}</Text>
          </View>
        </View>
      </View>
    );
  };

  render() {
    const items = this.getItems();
    if (!items.length) return null;

    const multi = this.isMulti();
    const cardW = this.cardW();
    const { totalCount } = this.props;
    const count = totalCount ?? items.length;
    const total = this.computedTotal();

    return (
      <View style={$.wrap}>
        <View style={$.head}>
          <Image source={require('../screens/assets/money.png')} style={$.headIco} resizeMode="contain" />
          <View style={$.headText}>
            <Text style={$.title}>Pending Settlement</Text>
            <Text style={$.sub}>
              {count} order{count === 1 ? '' : 's'} · Total ₹{total}
            </Text>
          </View>
        </View>

        {multi ? (
          <ScrollView
            ref={this.scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={this.step()}
            snapToAlignment="start"
            disableIntervalMomentum
            contentContainerStyle={$.scrollInner}
            onScrollBeginDrag={() => { this.dragging = true; this.stopAutoSlide(); }}
            onScrollEndDrag={() => { this.dragging = false; }}
            onMomentumScrollEnd={this.onScrollEnd}
          >
            {items.map((item, i) => this.renderCard(item, i, cardW, i === items.length - 1))}
          </ScrollView>
        ) : (
          <View style={$.singlePad}>
            {this.renderCard(items[0], 0, cardW, true)}
          </View>
        )}

        {multi ? (
          <View style={$.dots}>
            {items.slice(0, 8).map((_, i) => (
              <View key={i} style={[$.dot, i === this.state.activeDot && $.dotOn]} />
            ))}
          </View>
        ) : null}

        {!isReadOnly() ? (
          <TouchableOpacity style={$.settleBtn} activeOpacity={0.88} onPress={this.onSettle}>
            <Text style={$.settleBtnT}>Abhi settle karien</Text>
            <Animated.Image
              source={require('../screens/assets/arrow.png')}
              style={[$.settleArrow, { transform: [{ translateX: this.arrowX }] }]}
            />
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }
}

const $ = StyleSheet.create({
  wrap: {
    backgroundColor: GREEN_SOFT,
    borderRadius: 18,
    marginBottom: 4,
    paddingTop: 12,
    paddingBottom: 12,
    overflow: 'hidden',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
    paddingHorizontal: OUTER_PAD,
  },
  headIco: { width: 28, height: 28 },
  headText: { flex: 1, minWidth: 0 },
  title: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  sub: { fontSize: 12, fontWeight: '600', color: GREEN_DARK, marginTop: 2 },

  scrollInner: {
    paddingHorizontal: OUTER_PAD,
  },
  singlePad: {
    paddingHorizontal: OUTER_PAD,
  },
  slide: {},
  orderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  orderLeft: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  code: {
    fontSize: 11,
    fontWeight: '700',
    color: GREEN_DARK,
    marginBottom: 3,
  },
  farmer: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  loc: { fontSize: 11.5, fontWeight: '500', color: '#64748B', marginTop: 3 },
  meta: { fontSize: 11, fontWeight: '600', color: '#475569', marginTop: 6 },
  amtCol: {
    flexShrink: 0,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    paddingTop: 2,
  },
  amt: {
    fontSize: 20,
    fontWeight: '800',
    color: GREEN,
    letterSpacing: -0.3,
  },

  settleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GREEN,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 12,
    marginHorizontal: OUTER_PAD,
    gap: 6,
  },
  settleBtnT: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  settleArrow: { width: 12, height: 12, tintColor: '#FFF', resizeMode: 'contain' },

  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    gap: 5,
  },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#A7F3D0' },
  dotOn: { width: 14, backgroundColor: GREEN },
});
