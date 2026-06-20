import React, { Component } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Animated, Image,
} from 'react-native';

const { width: SW } = Dimensions.get('window');
const PAD = 8;
const CARD_W = SW - PAD * 2;
const SLIDE_MS = 3800;
const GREEN = '#16A34A';
const SECTION_ICON = 24;
const GREEN_DARK = '#15803D';

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
    const loop = () => {
      Animated.sequence([
        Animated.timing(this.arrowX, { toValue: 5, duration: 700, useNativeDriver: true }),
        Animated.timing(this.arrowX, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]).start(() => loop());
    };
    loop();
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

  onPressItem = () => {
    const { onNavigate } = this.props;
    if (onNavigate) onNavigate();
  };

  renderCard = (item, index) => {
    const farmer = item?.farmer || {};
    const amount = this.money(item?.collected_amount || item?.deposite_amount || item?.order_amount);
    const slot = String(item?.slot || '').trim();

    return (
      <View key={`${item?.order_id || item?.id || index}-${index}`} style={[$.slide, { width: CARD_W }]}>
        <TouchableOpacity style={$.card} activeOpacity={0.92} onPress={this.onPressItem}>
          <View style={$.cardTop}>
            <View style={{ flex: 1 }}>
              <Text style={$.code}>#{item?.order_code || item?.order_id || '—'}</Text>
              <Text style={$.farmer} numberOfLines={1}>{farmer?.name || 'Farmer'}</Text>
              {slot ? <Text style={$.slot} numberOfLines={1}>{slot}</Text> : null}
            </View>
            <View style={$.amtBox}>
              <Text style={$.amtLbl}>Jama</Text>
              <Text style={$.amtVal}>₹ {amount}</Text>
            </View>
          </View>

          <TouchableOpacity style={$.btn} activeOpacity={0.88} onPress={this.onPressItem}>
            <Text style={$.btnT}>Settle Karien</Text>
            <Animated.Image
              source={require('../screens/assets/arrow.png')}
              style={[$.btnArrow, { transform: [{ translateX: this.arrowX }] }]}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
    );
  };

  render() {
    const items = this.getItems();
    if (!items.length) return null;

    const loopItems = this.getLoopItems();
    const { totalAmount, totalCount } = this.props;
    const count = totalCount ?? items.length;
    const total = this.money(totalAmount);

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
    paddingTop: 12,
    paddingBottom: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    overflow: 'hidden',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    marginBottom: 10,
    gap: 8,
  },
  headLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headIcoBox: { width: SECTION_ICON, height: SECTION_ICON, alignItems: 'center', justifyContent: 'center' },
  headIco: { width: SECTION_ICON, height: SECTION_ICON },
  title: { fontSize: 13, fontWeight: '700', color: '#1E293B' },
  sub: { fontSize: 11, fontWeight: '500', color: '#64748B', marginTop: 2 },
  pill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  pillT: { fontSize: 10, fontWeight: '700', color: GREEN_DARK },

  slide: { paddingHorizontal: 0 },
  card: {
    marginHorizontal: 12,
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    padding: 12,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  code: { fontSize: 12, fontWeight: '700', color: GREEN_DARK },
  farmer: { fontSize: 14, fontWeight: '600', color: '#1E293B', marginTop: 2 },
  slot: { fontSize: 10, fontWeight: '500', color: '#64748B', marginTop: 2 },
  amtBox: { alignItems: 'flex-end', marginLeft: 8 },
  amtLbl: { fontSize: 10, fontWeight: '500', color: '#64748B' },
  amtVal: { fontSize: 18, fontWeight: '800', color: GREEN, marginTop: 1 },

  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  btnT: { fontSize: 13, fontWeight: '700', color: '#FFF', letterSpacing: 0.2 },
  btnArrow: { width: 12, height: 12, tintColor: '#FFF', marginLeft: 8, resizeMode: 'contain' },

  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 10, gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#D1FAE5' },
  dotOn: { width: 16, backgroundColor: GREEN },
});
