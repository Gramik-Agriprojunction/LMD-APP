import React, { Component } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Animated, Image, Easing,
} from 'react-native';
import { getStatus } from '../utils/statusColors';
import { isReadOnly } from '../utils/lmdViewMode';

const { width: SW } = Dimensions.get('window');
const OUTER_PAD = 12;
const CARD_W = SW - OUTER_PAD * 2;
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

  renderCard = (item, index) => {
    const d = this.resolveItem(item);
    const orderSt = getStatus(d.status);
    const unpaid = d.payStatus.toLowerCase() !== 'paid';
    const meta = [d.payMode, unpaid ? 'Unpaid' : 'Paid', orderSt.label].filter(Boolean).join('  ·  ');

    return (
      <View key={`${item?.order_id || item?.id || index}-${index}`} style={[$.slide, { width: CARD_W }]}>
        <View style={$.rowTop}>
          <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
            <Text style={$.code} numberOfLines={1}>{d.code}</Text>
            <Text style={$.farmer} numberOfLines={1}>
              {d.farmer}{d.mobile ? ` · ${d.mobile}` : ''}
            </Text>
            {!!d.shortLoc && (
              <Text style={$.loc} numberOfLines={1}>{d.shortLoc}</Text>
            )}
            {!!meta && <Text style={$.meta} numberOfLines={1}>{meta}</Text>}
          </View>
          <Text style={$.amt}>₹{d.amount}</Text>
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
          <Image source={require('../screens/assets/money.png')} style={$.headIco} resizeMode="contain" />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={$.title}>Pending Settlement</Text>
            <Text style={$.sub}>{count} order{count === 1 ? '' : 's'} · Total ₹{total}</Text>
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
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  headIco: { width: 28, height: 28 },
  title: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  sub: { fontSize: 11, fontWeight: '500', color: '#64748B', marginTop: 1 },

  slide: { paddingRight: 4 },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  code: {
    fontSize: 11,
    fontWeight: '600',
    color: GREEN_DARK,
    marginBottom: 3,
  },
  farmer: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  loc: { fontSize: 11, fontWeight: '500', color: '#64748B', marginTop: 2 },
  meta: { fontSize: 11, fontWeight: '600', color: '#475569', marginTop: 5 },
  amt: {
    fontSize: 20,
    fontWeight: '800',
    color: GREEN,
    letterSpacing: -0.3,
    marginTop: 2,
  },

  settleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GREEN,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 12,
    gap: 6,
  },
  settleBtnT: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  settleArrow: { width: 12, height: 12, tintColor: '#FFF', resizeMode: 'contain' },

  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 8, gap: 5 },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#A7F3D0' },
  dotOn: { width: 14, backgroundColor: GREEN },
});
