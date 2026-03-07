// Screens/CounterSaleScreen.js
import React, { Component } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Platform,
  UIManager,
  LayoutAnimation,
  Image,
  Keyboard,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import constants from './constants'

import {
  BottomSheetModal,
  BottomSheetModalProvider,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';

Ionicons.loadFont?.();

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const C = {
  green: '#0F7451',
  greenDark: '#0B6B47',
  bg: '#F5F7F6',
  text: '#111827',
  sub: '#6B7280',
  line: '#E5E7EB',
  border: '#D7DEE6',
  badgeRed: '#EF4444',

  infoIconBg: '#DBEAFE',
  infoIcon: '#2563EB',

  chipBg: '#ECFDF5',
  chipText: '#065F46',

  qtyBg: '#F3F4F6',
};

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

// ✅ Gramik Products only (as you asked)
const PRODUCTS = [
  {
    id: 'p1',
    title: 'Solio Gold',
    subtitle: '50 kg Bag',
    unitLabel: 'per Bag',
    price: 600,
    maxQty: 10,
    maxLabel: 'Max: 10 Bags',
    image: require('./assets/solio.jpg'),
  },
  {
    id: 'p2',
    title: 'Gramo Rhizza',
    subtitle: '5 kg Pack',
    unitLabel: 'Pack',
    price: 300,
    maxQty: 10,
    maxLabel: 'Max: 10 Packs',
    image: require('./assets/gramo.jpg'),
  },
  {
    id: 'p3',
    title: 'Doodh Sagar',
    subtitle: '1 kg Pack',
    unitLabel: 'Pack',
    price: 250,
    maxQty: 10,
    maxLabel: 'Max: 10 Packs',
    // (if you don’t have doodh image, using shakti as placeholder)
    image: require('./assets/shakti.jpg'),
  },
  {
    id: 'p4',
    title: 'Zinox',
    subtitle: '1 L Bottle',
    unitLabel: 'Bottle',
    price: 200,
    maxQty: 10,
    maxLabel: 'Max: 10 Bottles',
    image: require('./assets/zinox.jpg'),
  },
  {
    id: 'p5',
    title: 'Gibro Max',
    subtitle: '500 ml Bottle',
    unitLabel: 'Bottle',
    price: 180,
    maxQty: 10,
    maxLabel: 'Max: 10 Bottles',
    image: require('./assets/gibro.jpg'),
  },
  {
    id: 'p6',
    title: 'Shakti Sagar',
    subtitle: '50 kg Bag',
    unitLabel: 'per Bag',
    price: 520,
    maxQty: 10,
    maxLabel: 'Max: 10 Bags',
    image: require('./assets/shakti.jpg'),
  },
];

const FARMERS = [
  { id: 'f1', name: 'Ramesh Kumar', village: 'Gomti Nagar' },
  { id: 'f2', name: 'Sita Verma', village: 'Aliganj' },
  { id: 'f3', name: 'Amit Singh', village: 'Barabanki' },
  { id: 'f4', name: 'Neha Gupta', village: 'Ayodhya' },
  { id: 'f5', name: 'Walk-in Farmer', village: 'Counter' },
];

export default class CounterSaleScreen extends Component {
  constructor(props) {
    super(props);

    this.farmerRef = null;
    this.searchRef = null;

    this.sheetRef = React.createRef();

    this.state = {
      retailerId: 'RTRL12345',
      notifications: 3,

      farmerName: '',
      search: '',

      farmerFocused: false,
      searchFocused: false,

      qtyMap: {
        // example prefill like your screenshot
        p1: 2,
        p2: 0,
        p3: 0,
        p4: 0,
        p5: 0,
        p6: 0,
      },

      successOpen: false,
      farmerMobile: '',
      farmerAddress: '',
    };
  }

  // ===== header actions =====
  onBack = () => this.props?.navigation?.goBack?.();
  onBell = () => {};

  // ===== helpers =====
  setQty = (id, qty) => {
    const product = PRODUCTS.find((x) => x.id === id);
    const max = product?.maxQty ?? 9999;
    const next = Math.max(0, Math.min(max, qty));

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    this.setState((p) => ({ qtyMap: { ...p.qtyMap, [id]: next } }));
  };

  inc = (id) => this.setQty(id, (this.state.qtyMap[id] || 0) + 1);
  dec = (id) => this.setQty(id, (this.state.qtyMap[id] || 0) - 1);

  totalQty = () =>
    Object.values(this.state.qtyMap).reduce((a, b) => a + (Number(b) || 0), 0);

  totalAmount = () =>
    PRODUCTS.reduce(
      (sum, p) => sum + (Number(this.state.qtyMap[p.id] || 0) * Number(p.price || 0)),
      0
    );

  commission = () => Math.round(this.totalAmount() * 0.15);

  cartLines = () => {
    return PRODUCTS.map((p) => {
      const qty = Number(this.state.qtyMap[p.id] || 0);
      if (qty <= 0) return null;
      const lineTotal = qty * Number(p.price || 0);
      return { ...p, qty, lineTotal };
    }).filter(Boolean);
  };

  getVisibleProducts = () => {
    const q = (this.state.search || '').trim().toLowerCase();
    if (!q) return PRODUCTS;
    return PRODUCTS.filter((p) => {
      const hay = `${p.title} ${p.subtitle}`.toLowerCase();
      return hay.includes(q);
    });
  };

  componentDidMount()
  {
    this.suggestionsApi()
  }

    suggestionsApi() {
    fetch(constants.suggestions, {
      headers: {
        'X-localization': 'en',
        Authorization: 'Bearer ' + global.token,
      },
      method: 'GET',
    })
      .then((r) => r.json())
      .then((res) => {
        console.log('suggestions response== ', JSON.stringify(res));

        const list = Array.isArray(res?.data?.order) ? res.data.order : [];
        const count = res?.count || res?.data?.count || {};

        this.setState({
          isLoading: false,
          orders: list,
          stats: {
            totalOrders: Number(count?.total_order || list.length || 0),
            pending: Number(count?.pending || 0),
            totalValue: Number(count?.total_value || 0),
          },
          notifications: Number(count?.notification_count || 0),
          retailerId: String(count?.retailer_id || ''),
        });

        if (!res?.status) {
          console.log('orders api status false, message== ', res?.message);
        }

        if (!Array.isArray(res?.data?.order)) console.log('missing key: data.order (array)');
        if (!count?.retailer_id) console.log('missing key: count.retailer_id');
      })
      .catch((e) => {
        console.log('orders error== ', e);
        this.setState({ isLoading: false });
      });
    }
  

  getFarmerSuggestions = () => {
    const q = (this.state.farmerName || '').trim().toLowerCase();
    if (!q) return FARMERS.slice(0, 5);
    return FARMERS.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 6);
  };

  getProductSuggestions = () => {
    const q = (this.state.search || '').trim().toLowerCase();
    if (!q) return PRODUCTS.slice(0, 6);
    return PRODUCTS.filter((p) => p.title.toLowerCase().includes(q)).slice(0, 6);
  };

  pickFarmer = (name) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    this.setState({ farmerName: name, farmerFocused: false }, () => Keyboard.dismiss());
  };

  pickProduct = (title) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    this.setState({ search: title, searchFocused: false }, () => Keyboard.dismiss());
  };

  // ===== checkout =====
  openConfirm = () => {
    if (this.totalQty() <= 0) return;
    this.setState({ farmerFocused: false, searchFocused: false }, () => {
      Keyboard.dismiss();
      this.sheetRef?.current?.present?.();
    });
  };

  confirmCheckout = () => {
    this.sheetRef?.current?.dismiss?.();
    this.setState({ successOpen: true });
  };

  closeSuccess = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    this.setState({
      successOpen: false,
      farmerName: '',
      search: '',
      farmerFocused: false,
      searchFocused: false,
      qtyMap: { p1: 0, p2: 0, p3: 0, p4: 0, p5: 0, p6: 0 },
    });
  };

  // ===== UI =====
  renderHeader() {
    return (
      <View style={styles.headerWrap}>
        <SafeAreaView style={styles.headerSafe} />
        <StatusBar backgroundColor={C.green} barStyle="light-content" />

        <View style={styles.headerRow}>
          <TouchableOpacity activeOpacity={0.85} style={styles.headerBtn}>
            <Ionicons name="bag-handle" size={30} color="#fff" />
          </TouchableOpacity>

          <View style={{ flex: 1, paddingHorizontal: 8 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Gramik Counter Sale
            </Text>
            <View style={styles.headerSubRow}>
              <Text style={styles.headerSubText} numberOfLines={1}>
                Retailer ID : {this.state.retailerId}
              </Text>
              {/* <Ionicons name="chevron-down" size={15} color="#D1FAE5" style={{ marginLeft: 6 }} /> */}
            </View>
          </View>

       <TouchableOpacity onPress={this.onBell} activeOpacity={0.85} style={styles.headerBtn}>
                  <Ionicons name="notifications-outline" size={22} color="#fff" />
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>3</Text>
                  </View>
                </TouchableOpacity>
        </View>
      </View>
    );
  }

  renderInfo() {
    return (
      <View style={styles.infoCard}>
        <View style={styles.infoIconWrap}>
          <Ionicons name="information" size={18} color={C.infoIcon} />
        </View>
        <Text style={styles.infoText}>
          Log Counter Sales for walk-in farmers of Gramik Products. All sales will earn you{' '}
          <Text style={styles.infoBold}>15% commission!</Text>
        </Text>
      </View>
    );
  }

  renderFarmerSuggestions() {
    const show = this.state.farmerFocused && this.getFarmerSuggestions().length > 0;
    if (!show) return null;
    const list = this.getFarmerSuggestions();

    return (
      <View style={styles.suggestWrap}>
        {list.map((x) => (
          <TouchableOpacity
            key={x.id}
            activeOpacity={0.85}
            onPress={() => this.pickFarmer(x.name)}
            style={styles.suggestRow}
          >
            <Text style={styles.suggestTitle} numberOfLines={1}>
              {x.name}
            </Text>
            <Text style={styles.suggestSub} numberOfLines={1}>
              {x.village}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  renderProductSuggestions() {
    const show = this.state.searchFocused && this.getProductSuggestions().length > 0;
    if (!show) return null;

    const list = this.getProductSuggestions();

    return (
      <View style={styles.suggestWrap}>
        {list.map((x) => (
          <TouchableOpacity
            key={x.id}
            activeOpacity={0.85}
            onPress={() => this.pickProduct(x.title)}
            style={styles.suggestRow}
          >
            <Text style={styles.suggestTitle} numberOfLines={1}>
              {x.title}
            </Text>
            <Text style={styles.suggestSub} numberOfLines={1}>
              {x.subtitle} • {money(x.price)} {x.unitLabel}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  renderInputs() {
    return (
      <View style={{ paddingHorizontal: 14 }}>
        <View style={[styles.inputBox, { marginTop: 10 }]}>
          <Ionicons name="person-outline" size={16} color="#9CA3AF" />
          <TextInput
            ref={(r) => (this.farmerRef = r)}
            value={this.state.farmerName}
            onChangeText={(t) => this.setState({ farmerName: t, farmerFocused: true })}
            placeholder="Enter Farmer’s Name"
            placeholderTextColor="#9CA3AF"
            style={styles.input}
            onFocus={() => this.setState({ farmerFocused: true, searchFocused: false })}
            onBlur={() => this.setState({ farmerFocused: false })}
            returnKeyType="done"
          />
        </View>

        {this.renderFarmerSuggestions()}


            <View style={[styles.inputBox, { marginTop: 10 }]}>
            <Ionicons name="call-outline" size={16} color="#9CA3AF" />
            <TextInput
                value={this.state.farmerMobile}
                onChangeText={(t) => this.setState({ farmerMobile: t })}
                placeholder="Farmer Mobile"
                placeholderTextColor="#9CA3AF"
                style={styles.input}
                keyboardType="phone-pad"
                returnKeyType="done"
            />
            </View>

            <View style={[styles.inputBox, { marginTop: 10 }]}>
            <Ionicons name="location-outline" size={16} color="#9CA3AF" />
            <TextInput
                value={this.state.farmerAddress}
                onChangeText={(t) => this.setState({ farmerAddress: t })}
                placeholder="Farmer Address"
                placeholderTextColor="#9CA3AF"
                style={styles.input}
                multiline={true}
                returnKeyType="done"
            />
            </View>

        <View style={[styles.inputBox, { marginTop: 10 }]}>
          <Ionicons name="search" size={16} color="#9CA3AF" />
          <TextInput
            ref={(r) => (this.searchRef = r)}
            value={this.state.search}
            onChangeText={(t) => this.setState({ search: t, searchFocused: true })}
            placeholder="Search product by name"
            placeholderTextColor="#9CA3AF"
            style={styles.input}
            onFocus={() => this.setState({ searchFocused: true, farmerFocused: false })}
            onBlur={() => this.setState({ searchFocused: false })}
            returnKeyType="search"
          />
        </View>

        {this.renderProductSuggestions()}
      </View>
    );
  }

  renderProductCard(p) {
    const qty = Number(this.state.qtyMap[p.id] || 0);
    const added = qty > 0;

    return (
      <View key={p.id} style={styles.productOuter}>
        <View style={styles.productCard}>
          <View style={styles.productTop}>
            <View style={styles.thumb}>
              <Image source={p.image} style={styles.thumbImg} />
            </View>

            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.pTitle} numberOfLines={1}>
                {p.title}
              </Text>
              <Text style={styles.pSub} numberOfLines={1}>
                {p.subtitle}
              </Text>

              <View style={styles.maxChip}>
                <Text style={styles.maxChipText}>{p.maxLabel}</Text>
              </View>
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.priceText}>
                {money(p.price)} <Text style={styles.priceUnit}>{p.unitLabel}</Text>
              </Text>

              {added ? (
                <View style={styles.qtyPill}>
                  <TouchableOpacity activeOpacity={0.9} onPress={() => this.dec(p.id)} style={styles.qtyBtn}>
                    <Ionicons name="remove" size={16} color={C.text} />
                  </TouchableOpacity>

                  <Text style={styles.qtyValue}>{qty}</Text>

                  <TouchableOpacity activeOpacity={0.9} onPress={() => this.inc(p.id)} style={styles.qtyBtn}>
                    <Ionicons name="add" size={16} color={C.text} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity activeOpacity={0.9} onPress={() => this.setQty(p.id, 1)} style={styles.plusOnly}>
                  <Ionicons name="add" size={18} color={C.green} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </View>
    );
  }

  renderSummary() {
    const qty = this.totalQty();
    const total = this.totalAmount();
    const comm = this.commission();
    const disabled = qty <= 0;

    return (
      <View style={styles.summaryWrap}>
        <View style={styles.summaryRow}>
          <Text style={styles.sumLeft}>Total Qty: {qty}</Text>
          <Text style={styles.sumRight}>
            Total: <Text style={styles.sumRightBold}>{money(total)}</Text>
          </Text>
        </View>

        <View style={styles.commChip}>
          <Text style={styles.commText}>
            + 15% Commission: <Text style={styles.commBold}>{money(comm)}</Text>
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={this.openConfirm}
          style={[styles.checkoutBtn, disabled ? { opacity: 0.45 } : null]}
          disabled={disabled}
        >
          <Text style={styles.checkoutText}>Proceed to Checkout</Text>
        </TouchableOpacity>

        <View style={{ height: 10 }} />
      </View>
    );
  }

  renderSheetBackdrop = (props) => (
    <BottomSheetBackdrop
      {...props}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      opacity={0.35}
      pressBehavior="close"
    />
  );

  renderConfirmSheet() {
    const lines = this.cartLines();
    const total = this.totalAmount();
    const comm = this.commission();
    const farmer = (this.state.farmerName || '').trim() || 'Walk-in Farmer';

    return (
      <BottomSheetModal
        ref={this.sheetRef}
        snapPoints={['62%']}
        backdropComponent={this.renderSheetBackdrop}
        handleIndicatorStyle={{ backgroundColor: '#D1D5DB', width: 44 }}
        backgroundStyle={{ backgroundColor: '#fff' }}
        onDismiss={() => {}}
      >
        <View style={styles.sheetInner}>
          <View style={styles.sheetTitleRow}>
            <Text style={styles.sheetTitle}>Confirm Checkout</Text>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => this.sheetRef?.current?.dismiss?.()}
              style={styles.sheetCloseBtn}
            >
              <Ionicons name="close" size={18} color={C.text} />
            </TouchableOpacity>
          </View>

          <Text style={styles.sheetSub} numberOfLines={2}>
            Farmer: <Text style={styles.sheetSubBold}>{farmer}</Text>
          </Text>

          <View style={styles.sheetLine} />

          <View style={styles.itemsHead}>
            <Text style={[styles.itemsHeadText, { flex: 1.3 }]}>Product</Text>
            <Text style={[styles.itemsHeadText, { flex: 0.35, textAlign: 'center' }]}>Qty</Text>
            <Text style={[styles.itemsHeadText, { flex: 0.6, textAlign: 'right' }]}>Amount</Text>
          </View>

          <ScrollView
            style={{ maxHeight: 190 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 6 }}
          >
            {lines.map((x) => (
              <View key={x.id} style={styles.itemRow}>
                <View style={{ flex: 1.3, paddingRight: 10 }}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {x.title}
                  </Text>
                  <Text style={styles.itemMeta} numberOfLines={1}>
                    {x.subtitle} • {money(x.price)} {x.unitLabel}
                  </Text>
                </View>

                <Text style={[styles.itemQty, { flex: 0.35 }]}>{x.qty}</Text>

                <Text style={[styles.itemAmt, { flex: 0.6 }]}>{money(x.lineTotal)}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.sheetLine} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLeft}>Total</Text>
            <Text style={styles.totalRight}>{money(total)}</Text>
          </View>

          <View style={styles.totalRow}>
            <Text style={styles.totalLeft}>Commission (15%)</Text>
            <Text style={styles.totalRight}>{money(comm)}</Text>
          </View>

          <TouchableOpacity activeOpacity={0.9} onPress={this.confirmCheckout} style={styles.sheetBtn}>
            <Text style={styles.sheetBtnText}>Confirm</Text>
          </TouchableOpacity>

          <SafeAreaView />
        </View>
      </BottomSheetModal>
    );
  }

  renderSuccessModal() {
    if (!this.state.successOpen) return null;

    return (
      <View style={styles.successOverlay}>
        <View style={styles.successCard}>
          <View style={styles.tickCircle}>
            <Ionicons name="checkmark" size={26} color="#fff" />
          </View>

          <Text style={styles.successTitle}>Success</Text>
          <Text style={styles.successSub}>Counter sale logged successfully.</Text>

          <TouchableOpacity activeOpacity={0.9} onPress={this.closeSuccess} style={styles.successBtn}>
            <Text style={styles.successBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  render() {
    const list = this.getVisibleProducts();

    return (
      <BottomSheetModalProvider>
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          {this.renderHeader()}

          <ScrollView
            contentContainerStyle={{ paddingBottom: 34 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            <View style={{ paddingHorizontal: 14, paddingTop: 12 }}>
              {this.renderInfo()}
            </View>

            {this.renderInputs()}

            <View style={{ marginTop: 10 }}>
              {list.map((p) => this.renderProductCard(p))}
            </View>

            <View style={{ paddingHorizontal: 14, marginTop: 12 }}>
              {this.renderSummary()}
            </View>

            <View style={{ height: 18 }} />
          </ScrollView>

          {this.renderConfirmSheet()}
          {this.renderSuccessModal()}
        </View>
      </BottomSheetModalProvider>
    );
  }
}

const styles = StyleSheet.create({
  // ===== Header =====
  headerWrap: { backgroundColor: C.green },
  headerSafe: { backgroundColor: C.green },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 10,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  headerSubRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  headerSubText: { color: '#D1FAE5', fontSize: 11, fontWeight: '500' },
  badge: {
    position: 'absolute',
    top: 5,
    right: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: C.badgeRed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '400' },

  // ===== Info =====
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.line,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: C.infoIconBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    marginRight: 10,
  },
  infoText: { flex: 1, color: C.sub, fontSize: 12.2, fontWeight: '500', lineHeight: 18 },
  infoBold: { fontWeight: '800', color: C.text },

  inputBox: {
    height: 46,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1.2,
    borderColor: C.border,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: { flex: 1, marginLeft: 8, fontSize: 13, color: C.text, paddingVertical: 0, fontWeight: '500' },

  suggestWrap: {
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.line,
    overflow: 'hidden',
  },
  suggestRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  suggestTitle: { color: C.text, fontSize: 13, fontWeight: '500' },
  suggestSub: { marginTop: 2, color: C.sub, fontSize: 11.5, fontWeight: '600' },

  // ===== Product card =====
  productOuter: { paddingHorizontal: 14, marginTop: 10 },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1.1,
    borderColor: C.line,
    overflow: 'hidden',
  },
  productTop: { flexDirection: 'row', padding: 12, alignItems: 'center' },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%', resizeMode: 'cover' },

  pTitle: { color: C.text, fontSize: 13, fontWeight: '500' },
  pSub: { marginTop: 5, color: C.greenDark, fontSize: 12, fontWeight: '400' },

  maxChip: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: C.chipBg,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  maxChipText: { color: C.chipText, fontSize: 11.2, fontWeight: '500' },

  priceText: { color: C.greenDark, fontSize: 15, fontWeight: '800' },
  priceUnit: { color: C.sub, fontSize: 12, fontWeight: '600' },

  plusOnly: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },

  qtyPill: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  qtyBtn: {
    width: 36,
    height: 34,
    borderRadius: 12,
    backgroundColor: C.qtyBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.line,
  },
  qtyValue: { width: 40, textAlign: 'center', color: C.text, fontSize: 13.5, fontWeight: '800' },

  // ===== Summary =====
  summaryWrap: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1.1,
    borderColor: C.line,
    padding: 14,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sumLeft: { color: C.text, fontSize: 12.8, fontWeight: '700' },
  sumRight: { color: C.text, fontSize: 12.8, fontWeight: '700' },
  sumRightBold: { fontWeight: '900', color: C.greenDark },

  commChip: {
    marginTop: 10,
    alignSelf: 'flex-end',
    backgroundColor: '#ECFDF5',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  commText: { color: C.greenDark, fontSize: 12.2, fontWeight: '700' },
  commBold: { fontWeight: '900' },

  checkoutBtn: {
    marginTop: 12,
    height: 48,
    borderRadius: 16,
    backgroundColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkoutText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  // ===== Gorhom Sheet =====
  sheetInner: { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 12 },
  sheetTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { color: '#F37A20', fontSize: 15.5, fontWeight: '800' },
  sheetCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  sheetSub: { marginTop: 6, color: C.sub, fontSize: 12.2, fontWeight: '600' },
  sheetSubBold: { fontWeight: '500', color: C.text },
  sheetLine: { height: 1, backgroundColor: C.line, marginTop: 10, marginBottom: 10 },

  itemsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  itemsHeadText: { color: '#374151', fontSize: 12, fontWeight: '700' },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  itemName: { color: C.text, fontSize: 12.6, fontWeight: '700' },
  itemMeta: { marginTop: 2, color: C.sub, fontSize: 11.5, fontWeight: '600' },
  itemQty: { textAlign: 'center', color: C.text, fontSize: 12.6, fontWeight: '800' },
  itemAmt: { textAlign: 'right', color: C.text, fontSize: 12.6, fontWeight: '800' },

  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  totalLeft: { color: C.sub, fontSize: 12.2, fontWeight: '700' },
  totalRight: { color: C.text, fontSize: 12.6, fontWeight: '900' },

  sheetBtn: {
    marginTop: 12,
    height: 46,
    borderRadius: 16,
    backgroundColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBtnText: { color: '#fff', fontSize: 13.5, fontWeight: '800' },

  // ===== Success overlay =====
  successOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  successCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: 'center',
  },
  tickCircle: {
    width: 54,
    height: 54,
    borderRadius: 20,
    backgroundColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: { marginTop: 10, color: C.text, fontSize: 15.5, fontWeight: '800' },
  successSub: { marginTop: 6, color: C.sub, fontSize: 12.2, fontWeight: '600', textAlign: 'center' },
  successBtn: {
    marginTop: 12,
    width: '100%',
    height: 46,
    borderRadius: 16,
    backgroundColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successBtnText: { color: '#fff', fontSize: 13.5, fontWeight: '800' },
});