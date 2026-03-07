// Screens/InventoryScreen.js
import React, { Component } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Platform,
  StatusBar,
  LayoutAnimation,
  UIManager,
  Modal,
  Pressable,
  SafeAreaView,
  Dimensions,
  ActivityIndicator,
  Animated,
  Easing,
  PanResponder,
  Switch,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import constants from './constants';
import { Image } from 'react-native-animatable';

Ionicons.loadFont?.();

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { height: SCREEN_H } = Dimensions.get('window');

const C = {
  green: '#0F7451',
  greenDark: '#0B6B47',
  bg: '#F5F7F6',
  text: '#111827',
  sub: '#6B7280',
  line: '#E6E9EC',
  border: '#D7DEE6',
  badgeRed: '#EF4444',

  statGreen: '#1B7D5D',
  statNavy: '#2563EB',
  statOrange: '#F68A20',

  chipOrangeBg: '#FDEDDC',
  chipOrangeBorder: '#F5C79B',
  chipOrangeText: '#9A3412',

  lowRowBg: '#FFF1F2',
  lowRowText: '#B91C1C',

  statusGreenBg: '#ECFDF5',
  statusGreenBorder: '#A7F3D0',
  statusGreenText: '#065F46',

  statusOrangeBg: '#FFF7ED',
  statusOrangeBorder: '#FDBA74',
  statusOrangeText: '#9A3412',

  statusRedBg: '#FEF2F2',
  statusRedBorder: '#FECACA',
  statusRedText: '#B91C1C',
};

const formatINR = (n) => Number(n || 0).toLocaleString('en-IN');
const money = (n) => `₹${formatINR(n)}`;
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const variantValue = (v) => Number(v?.stock_qty || v?.stock || v?.qty || 0) * Number(v?.price || 0);

const variantQtyLabel = (v) => {
  const qty = formatINR(v?.stock_qty ?? v?.stock ?? v?.qty ?? 0);
  const unit = String(v?.unit || '').trim();
  return unit ? `${qty} ${unit}` : `${qty}`;
};

const productStatus = (p) => {
  const variants = Array.isArray(p?.variants) ? p.variants : [];
  const hasAnyQty = variants.some((x) => Number(x?.stock_qty ?? x?.stock ?? x?.qty ?? 0) > 0);
  const allZero = variants.length ? variants.every((x) => Number(x?.stock_qty ?? x?.stock ?? x?.qty ?? 0) <= 0) : true;

  const anyLow = variants.some((x) => !!x?.is_low);
  const productLow = !!p?.low_stock;

  if (allZero) return 'Out of Stock';
  if (anyLow || productLow) return 'Low Stock';
  if (hasAnyQty) return 'In Stock';
  return 'Out of Stock';
};

const recomputeStats = (products) => {
  let totalProducts = products.length;
  let totalStockValue = 0;
  let lowStockItems = 0;

  products.forEach((p) => {
    (p?.variants || []).forEach((v) => {
      totalStockValue += variantValue(v);
      if (v?.is_low) lowStockItems += 1;
    });
  });

  return { totalProducts, totalStockValue, lowStockItems };
};

const buildCategories = (products) => {
  const set = new Set();
  products.forEach((p) => {
    const c = String(p?.category || '').trim();
    if (c) set.add(c);
  });
  return Array.from(set);
};

class BottomSheet extends Component {
  constructor(props) {
    super(props);
    this.anim = new Animated.Value(0);
    this.dragY = new Animated.Value(0);
    this.sheetH = 0;
    this.state = { measuredH: 0 };

    this.panResponder = PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) this.dragY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        const h = this.sheetH || this.state.measuredH || 360;
        const shouldClose = g.dy > h * 0.18 || g.vy > 1.1;

        Animated.timing(this.dragY, {
          toValue: 0,
          duration: 160,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();

        if (shouldClose) this.props?.onClose?.();
      },
    });
  }

  componentDidUpdate(prev) {
    if (!!prev.visible === !!this.props.visible) return;

    if (this.props.visible) {
      this.anim.setValue(0);
      Animated.timing(this.anim, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(this.anim, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }

  onMeasure = (e) => {
    const h = Math.min(Number(e?.nativeEvent?.layout?.height || 0), SCREEN_H * 0.82);
    if (!h) return;
    if (this.sheetH !== h) this.sheetH = h;
    if (this.state.measuredH !== h) this.setState({ measuredH: h });
  };

  render() {
    const { visible, onClose, children, title } = this.props;
    if (!visible) return null;

    const h = this.state.measuredH || 360;

    const overlayOpacity = this.anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
    const translateY = this.anim.interpolate({ inputRange: [0, 1], outputRange: [h + 40, 0] });
    const sheetTransform = { transform: [{ translateY }, { translateY: this.dragY }] };

    return (
      <Modal
        visible={visible}
        transparent
        animationType="none"
        presentationStyle="overFullScreen"
        onRequestClose={onClose}
      >
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <Animated.View style={[styles.sheetOverlay, { opacity: overlayOpacity }]} />
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
          <Animated.View style={[styles.sheet, sheetTransform]} pointerEvents="box-none">
            <View onLayout={this.onMeasure} pointerEvents="auto">
              <View {...this.panResponder.panHandlers}>
                <View style={styles.sheetHandle} />
                <View style={styles.sheetTitleRowOnlyX}>
                  <Text style={styles.sheetTitle}>{title}</Text>
                  <TouchableOpacity activeOpacity={0.9} onPress={onClose} style={styles.sheetCloseBtn}>
                    <Ionicons name="close" size={18} color={C.text} />
                  </TouchableOpacity>
                </View>
              </View>
              {children}
            </View>
          </Animated.View>
        </View>
      </Modal>
    );
  }
}

export default class InventoryScreen extends Component {
  constructor(props) {
    super(props);

    this._searchDebounce = null;

    this.state = {
      search: '',
      expanded: {},

      filterOpen: false,
      activeFilters: { stock: 'All', category: 'All' },

      updateOpen: false,
      updateDraft: null,
      updatePosting: false,

      addOpen: false,
      addPosting: false,
      addDraft: {
        photo: null,
        name: '',
        category: '',
        brand: '',
        variantSize: '',
        variantUnit: 'kg',
        variantType: '',
        unitsInStock: '',
        sellingPrice: '',
        lowStockAlert: false,
        alertLevel: '',
      },

      pickerOpen: false,
      pickerTitle: '',
      pickerItems: [],
      pickerOnPick: null,

      products: [],
      categories: [],
      stats: { totalProducts: 0, totalStockValue: 0, lowStockItems: 0 },

      apiLoading: false,
      apiError: '',
      apiResponse: null,
    };
  }

  componentDidMount() {
    this.fetchRetailerInventory();
  }

  fetchRetailerInventory = () => {
    let baseUrl = String(constants?.retailerInventory || '').trim();
    if (!baseUrl) {
      this.setState({ apiError: 'constants.retailerInventory missing' });
      return;
    }

    const { search, activeFilters } = this.state;

    let params = [];

    if (String(search || '').trim()) {
      params.push(`search=${encodeURIComponent(search.trim())}`);
    }

    const stockMap = {
      All: 'all',
      'In Stock': 'in',
      'Low Stock': 'low',
      'Out of Stock': 'out',
    };

    params.push(`stock_status=${encodeURIComponent(stockMap[activeFilters?.stock] || 'all')}`);
    params.push(`category=${encodeURIComponent(activeFilters?.category || 'All')}`);

    if (params.length) {
      const joiner = baseUrl.includes('?') ? '&' : '?';
      baseUrl = `${baseUrl}${joiner}${params.join('&')}`;
    }

    this.setState({ apiLoading: true, apiError: '' });

    fetch(baseUrl, {
      method: 'GET',
      headers: {
        'X-localization': 'en',
        Authorization: 'Bearer ' + (global.token || ''),
      },
    })
      .then((r) => r.json())
      .then((res) => {
        const raw = Array.isArray(res?.data) ? res.data : [];
        const products = raw.map((p) => ({
          id: String(p?.id ?? ''),
          name: String(p?.name || '').trim(),
          category: String(p?.category || '').trim(),
          low_stock: !!p?.low_stock,
          variants: Array.isArray(p?.variants) ? p.variants : [],
        }));

        const statsFromApi =
          res?.summary &&
          res?.summary?.total_products != null &&
          res?.summary?.total_stock_value != null &&
          res?.summary?.low_stock_items != null
            ? {
                totalProducts: Number(res?.summary?.total_products || 0),
                totalStockValue: Number(res?.summary?.total_stock_value || 0),
                lowStockItems: Number(res?.summary?.low_stock_items || 0),
              }
            : recomputeStats(products);

        const expanded = products.reduce((acc, p) => {
          acc[p.id] = false;
          return acc;
        }, {});

        this.setState({
          apiLoading: false,
          apiResponse: res,
          products,
          categories: buildCategories(products),
          stats: statsFromApi,
          expanded,
        });
      })
      .catch(() => {
        this.setState({ apiLoading: false, apiError: 'API failed' });
      });
  };

  postUpdateStock = async (productId, variantId, type, nextQty) => {
    const url = String(constants?.updateStock || '').trim();
    if (!url) return { ok: false };

    const headersJson = {
      'Content-Type': 'application/json',
      'X-localization': 'en',
      Authorization: 'Bearer ' + (global.token || ''),
    };

    const payload = {
      product_id: String(productId || ''),
      variant_id: String(variantId || ''),
      type: String(type || ''),
      stock_qty: nextQty != null ? String(nextQty) : undefined,
      qty: nextQty != null ? String(nextQty) : undefined,
      stock: nextQty != null ? String(nextQty) : undefined,
    };

    try {
      const r = await fetch(url, { method: 'POST', headers: headersJson, body: JSON.stringify(payload) });
      const txt = await r.text();
      let res = null;
      try {
        res = JSON.parse(txt);
      } catch (e) {
        res = { raw: txt };
      }
      if (res?.status === false) throw new Error('json_failed');
      return { ok: true, res };
    } catch (e) {
      try {
        const form = new FormData();
        form.append('product_id', String(productId || ''));
        form.append('variant_id', String(variantId || ''));
        form.append('type', String(type || ''));
        if (nextQty != null) form.append('stock_qty', String(nextQty));
        const r2 = await fetch(url, {
          method: 'POST',
          headers: {
            'X-localization': 'en',
            Authorization: 'Bearer ' + (global.token || ''),
          },
          body: form,
        });
        const txt2 = await r2.text();
        let res2 = null;
        try {
          res2 = JSON.parse(txt2);
        } catch (e2) {
          res2 = { raw: txt2 };
        }
        return { ok: res2?.status !== false, res: res2 };
      } catch (e2) {
        return { ok: false };
      }
    }
  };

  onBack = () => {
    if (this.props?.navigation?.goBack) this.props.navigation.goBack();
  };

  onBell = () => {};

  toggleExpand = (id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    this.setState((p) => ({ expanded: { ...p.expanded, [id]: !p.expanded[id] } }));
  };

  openFilter = () => this.setState({ filterOpen: true });
  closeFilter = () => this.setState({ filterOpen: false });

  setFilterStock = (stock) => this.setState((p) => ({ activeFilters: { ...p.activeFilters, stock } }));
  setFilterCategory = (category) => this.setState((p) => ({ activeFilters: { ...p.activeFilters, category } }));

  clearFilter = () => this.setState({ activeFilters: { stock: 'All', category: 'All' } });

  openUpdate = (product) => {
    const draft = {
      productId: product.id,
      name: product.name,
      category: product.category,
      variants: (product.variants || []).map((v) => ({
        ...v,
        id: v?.id ?? v?.variant_id ?? v?.variantId ?? v?.product_variant_id ?? v?.pv_id ?? v?.pvId,
        stock_qty: v?.stock_qty ?? v?.stock ?? v?.qty ?? 0,
      })),
    };
    this.setState({ updateOpen: true, updateDraft: draft });
  };

  closeUpdate = () => this.setState({ updateOpen: false, updateDraft: null, updatePosting: false });

  changeDraftQty = (variantIndex, nextQty) => {
    this.setState((prev) => {
      if (!prev.updateDraft) return null;
      const draft = { ...prev.updateDraft };
      const variants = [...draft.variants];
      const v = { ...variants[variantIndex] };
      v.stock_qty = clamp(Number(nextQty || 0), 0, 999999);
      variants[variantIndex] = v;
      draft.variants = variants;
      return { updateDraft: draft };
    });
  };

  applyVariantUpdate = async (variantIndex, type) => {
    const draft = this.state.updateDraft;
    if (!draft) return;
    if (this.state.updatePosting) return;

    const v = draft?.variants?.[variantIndex];
    const variantId = v?.id ?? v?.variant_id ?? v?.variantId ?? v?.product_variant_id;
    if (!variantId) return;

    const cur = Number(v?.stock_qty ?? v?.stock ?? v?.qty ?? 0);
    const next = clamp(cur + (type === 'plus' ? 1 : -1), 0, 999999);

    this.changeDraftQty(variantIndex, next);
    this.setState({ updatePosting: true });

    const out = await this.postUpdateStock(draft.productId, variantId, type, next);
    this.setState({ updatePosting: false });

    if (!out.ok) {
      this.changeDraftQty(variantIndex, cur);
      Alert.alert('Failed', 'Stock update failed');
      return;
    }

    this.fetchRetailerInventory();
  };

  saveUpdate = () => {
    this.closeUpdate();
    this.fetchRetailerInventory();
  };

  applyFilter = () => {
    this.closeFilter();
    this.fetchRetailerInventory();
  };

  getVisibleProducts = () => {
    const q = (this.state.search || '').trim().toLowerCase();
    const { stock, category } = this.state.activeFilters;

    let list = this.state.products;

    if (category !== 'All') list = list.filter((p) => p.category === category);

    if (stock !== 'All') {
      list = list.filter((p) => productStatus(p) === stock);
    }

    if (!q) return list;

    return list
      .map((p) => {
        const inTitle = (p.name || '').toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q);
        const vv = (p.variants || []).filter((x) => String(x?.variant || '').toLowerCase().includes(q));
        if (inTitle) return p;
        if (vv.length) return { ...p, variants: vv };
        return null;
      })
      .filter(Boolean);
  };

  getRetailerIdText = () => {
    const apiRetailerId =
      this.state.apiResponse?.retailer?.id ||
      this.state.apiResponse?.retailer_id ||
      this.state.apiResponse?.data?.retailer_id;
    const id = String(apiRetailerId || '').trim();
    return id ? `Retailer ID: ${id}` : 'Retailer ID: --';
  };

  getNotificationCount = () => {
    const apiCount = this.state.apiResponse?.notification_count;
    const n = Number(apiCount ?? 0);
    return Number.isFinite(n) ? n : 0;
  };

  renderHeader() {
    const notifCount = this.getNotificationCount();

    return (
      <View style={styles.headerWrap}>
        <StatusBar barStyle="light-content" backgroundColor={C.green} />
        <SafeAreaView style={styles.headerSafe} />
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={this.onBack} activeOpacity={0.85} style={styles.headerBtn}>
            <Ionicons name="cube-outline" size={28} color="#fff" />
          </TouchableOpacity>

          <View style={{ flex: 1, paddingHorizontal: 8 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Retailer Inventory
            </Text>
            <View style={styles.headerSubRow}>
              <Text style={styles.headerSubText} numberOfLines={1}>
                {this.getRetailerIdText()}
              </Text>
            </View>
          </View>

          <TouchableOpacity onPress={this.onBell} activeOpacity={0.85} style={styles.headerBtn}>
            <Ionicons name="notifications-outline" size={20} color="#fff" />
            {notifCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{notifCount > 99 ? '99+' : String(notifCount)}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  renderStatBoxes() {
    const { totalProducts, totalStockValue, lowStockItems } = this.state.stats;

    return (
      <View style={styles.statsRow}>
        <View style={[styles.statBox, { backgroundColor: C.statGreen }]}>
          <View style={styles.statIconCircle}>
            <Ionicons name="cube-outline" size={22} color="#fff" />
          </View>
          <Text style={styles.statLabel} numberOfLines={2}>
            Total Products
          </Text>
          <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {formatINR(totalProducts)}
          </Text>
        </View>

        <View style={[styles.statBox, { backgroundColor: C.statNavy }]}>
          <View style={styles.statIconCircle}>
            <Ionicons name="cash-outline" size={22} color="#fff" />
          </View>
          <Text style={styles.statLabel} numberOfLines={2}>
            Total Stock
          </Text>
          <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}>
            {money(totalStockValue)}
          </Text>
        </View>

        <View style={[styles.statBox, { backgroundColor: C.statOrange }]}>
          <View style={styles.statIconCircle}>
            <Ionicons name="warning-outline" size={22} color="#fff" />
          </View>
          <Text style={styles.statLabel} numberOfLines={2}>
            Low Stock
          </Text>
          <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {formatINR(lowStockItems)}
          </Text>
        </View>
      </View>
    );
  }

  onChangeSearch = (t) => {
    this.setState({ search: t });
    if (this._searchDebounce) clearTimeout(this._searchDebounce);
    this._searchDebounce = setTimeout(() => {
      this.fetchRetailerInventory();
    }, 350);
  };

  renderSearchFilter() {
    return (
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={15} color="#9CA3AF" />
          <TextInput
            value={this.state.search}
            onChangeText={this.onChangeSearch}
            placeholder="Search Product / Variant"
            placeholderTextColor="#9CA3AF"
            style={styles.searchInput}
            returnKeyType="search"
          />
        </View>

        <TouchableOpacity onPress={this.openFilter} activeOpacity={0.9} style={styles.filterBtn}>
          <Ionicons name="options-outline" size={16} color={C.green} />
          <Text style={styles.filterText}>Filter</Text>
        </TouchableOpacity>
      </View>
    );
  }

  renderListHeader() {
    return (
      <View style={styles.listHeader}>
        <Text style={[styles.listHeaderText, { flex: 1.25 }]} numberOfLines={1}>
          Product & Variants
        </Text>
        <Text style={[styles.listHeaderText, { flex: 0.65, textAlign: 'center' }]} numberOfLines={1}>
          Stock
        </Text>
        <Text style={[styles.listHeaderText, { flex: 0.55, textAlign: 'right' }]} numberOfLines={1}>
          Value (₹)
        </Text>
      </View>
    );
  }

  renderProductCard(p) {
    const expanded = !!this.state.expanded[p.id];
    const status = productStatus(p);

    const isIn = status === 'In Stock';
    const isLow = status === 'Low Stock';
    const isOut = status === 'Out of Stock';

    return (
      <View key={p.id} style={styles.cardOuter}>
        <View style={styles.card}>
          <TouchableOpacity activeOpacity={0.92} onPress={() => this.toggleExpand(p.id)}>
            <View style={styles.cardTop}>
              <View style={styles.thumb}>
                <Ionicons name="cube-outline" size={20} color={C.green} />
              </View>

              <View style={{ flex: 1, paddingRight: 8, minWidth: 0 }}>
                <Text style={styles.productTitle} numberOfLines={2}>
                  {p.name}
                </Text>

                <View style={styles.productMetaRow}>
                  <Text style={styles.categoryText} numberOfLines={1} ellipsizeMode="tail">
                    {p.category}
                  </Text>

                  <View
                    style={[
                      styles.statusPillInline,
                      isIn ? styles.statusPillIn : null,
                      isLow ? styles.statusPillLow : null,
                      isOut ? styles.statusPillOut : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        isIn ? styles.statusPillTextIn : null,
                        isLow ? styles.statusPillTextLow : null,
                        isOut ? styles.statusPillTextOut : null,
                      ]}
                      numberOfLines={1}
                    >
                      {status}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.expandBtn}>
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={C.green} />
              </View>
            </View>
          </TouchableOpacity>

          {expanded ? (
            <View style={styles.tableWrap}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, { flex: 1.12 }]} numberOfLines={1}>
                  Variant
                </Text>
                <Text style={[styles.tableHeaderText, { flex: 0.72, textAlign: 'center' }]} numberOfLines={1}>
                  Stock
                </Text>
                <Text style={[styles.tableHeaderText, { flex: 0.52, textAlign: 'center' }]} numberOfLines={1}>
                  Rate (₹)
                </Text>
                <Text style={[styles.tableHeaderText, { flex: 0.64, textAlign: 'right' }]} numberOfLines={1}>
                  Value (₹)
                </Text>
              </View>

              {(p.variants || []).map((v, idx) => {
                const rowLow = !!v?.is_low;
                const isLast = idx === p.variants.length - 1;

                return (
                  <View
                    key={`${p.id}_${v?.id || idx}`}
                    style={[
                      styles.tableRow,
                      rowLow ? styles.tableRowLow : null,
                      isLast ? { borderBottomWidth: 0 } : null,
                    ]}
                  >
                    <Text style={[styles.tableText, { flex: 1.12 }]} numberOfLines={1}>
                      {String(v?.variant || '').trim()}
                    </Text>

                    <Text style={[styles.tableText, { flex: 0.72, textAlign: 'center' }]} numberOfLines={1}>
                      {variantQtyLabel(v)}
                    </Text>

                    <Text style={[styles.tableText, { flex: 0.52, textAlign: 'center' }]} numberOfLines={1}>
                      {formatINR(v?.price || 0)}
                    </Text>

                    <Text style={[styles.tableText, { flex: 0.64, textAlign: 'right' }]} numberOfLines={1}>
                      {formatINR(variantValue(v))}
                    </Text>
                  </View>
                );
              })}

              {/* <View style={styles.footerRow}>
                <View style={styles.footerLeft} />
                <TouchableOpacity onPress={() => this.openUpdate(p)} activeOpacity={0.9} style={styles.updateBtn}>
                  <Text style={styles.updateBtnText}>Update Stock</Text>
                </TouchableOpacity>
              </View> */}
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  renderFilterSheet() {
    const { filterOpen, activeFilters, categories } = this.state;

    const stockOptions = ['All', 'In Stock', 'Low Stock', 'Out of Stock'];
    const categoryOptions = ['All', ...(Array.isArray(categories) ? categories : [])];

    return (
      <BottomSheet visible={filterOpen} onClose={this.closeFilter} title="Filter">
        <View style={{ paddingBottom: 30 }}>
          <Text style={styles.sheetSectionTitle}>Stock Status</Text>
          <View style={styles.chipWrap}>
            {stockOptions.map((x) => {
              const active = activeFilters.stock === x;
              return (
                <TouchableOpacity
                  key={x}
                  activeOpacity={0.9}
                  onPress={() => this.setFilterStock(x)}
                  style={[styles.chip, active ? styles.chipActive : null]}
                >
                  <Text style={[styles.chipText, active ? styles.chipTextActive : null]} numberOfLines={1}>
                    {x}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.sheetSectionTitle, { marginTop: 20 }]}>Category</Text>
          <View style={styles.chipWrap}>
            {categoryOptions.map((x) => {
              const active = activeFilters.category === x;
              return (
                <TouchableOpacity
                  key={x}
                  activeOpacity={0.9}
                  onPress={() => this.setFilterCategory(x)}
                  style={[styles.chip, active ? styles.chipActive : null]}
                >
                  <Text style={[styles.chipText, active ? styles.chipTextActive : null]} numberOfLines={1}>
                    {x}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.sheetActions}>
            <TouchableOpacity activeOpacity={0.9} onPress={this.clearFilter} style={styles.sheetBtnGhost}>
              <Text style={styles.sheetBtnGhostText}>Clear Filter</Text>
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.9} onPress={this.applyFilter} style={styles.sheetBtn}>
              <Text style={styles.sheetBtnText}>Apply Filter</Text>
            </TouchableOpacity>
          </View>
        </View>
      </BottomSheet>
    );
  }

  renderUpdateSheet() {
    const { updateOpen, updateDraft, updatePosting } = this.state;
    if (!updateDraft) return null;

    return (
      <BottomSheet visible={updateOpen} onClose={this.closeUpdate} title="Update Stock">
        <Text style={styles.updateSub} numberOfLines={1}>
          {updateDraft.name} • {updateDraft.category}
        </Text>

        <View style={styles.updateTableHead}>
          <Text style={[styles.updateHeadText, { flex: 1.2 }]} numberOfLines={1}>
            Variant
          </Text>
          <Text style={[styles.updateHeadText, { flex: 0.8, textAlign: 'right' }]} numberOfLines={1}>
            Current
          </Text>
        </View>

        <ScrollView
          style={{ maxHeight: SCREEN_H * 0.52 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 10 }}
        >
          {(updateDraft.variants || []).map((v, idx) => {
            return (
              <View key={`${updateDraft.productId}_u_${v?.id || idx}`} style={styles.updateRow}>
                <View style={{ flex: 1.2, minWidth: 0 }}>
                  <Text style={styles.updateRowTitle} numberOfLines={1} ellipsizeMode="tail">
                    {String(v?.variant || '').trim()}
                  </Text>
                  <Text style={styles.updateRowSub} numberOfLines={1} ellipsizeMode="tail">
                    Rate: ₹{formatINR(v?.price || 0)} • Value: ₹{formatINR(variantValue(v))}
                  </Text>
                </View>

                <View style={{ flex: 0.8, alignItems: 'flex-end' }}>
                  <Text style={styles.updateQty} numberOfLines={1}>
                    {variantQtyLabel(v)}
                  </Text>

                  <View style={styles.qtyControls}>
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() => this.applyVariantUpdate(idx, 'minus')}
                      style={styles.qtyBtn}
                      disabled={updatePosting}
                    >
                      <Ionicons name="remove" size={13} color={C.text} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() => this.applyVariantUpdate(idx, 'plus')}
                      style={styles.qtyBtn}
                      disabled={updatePosting}
                    >
                      <Ionicons name="add" size={13} color={C.text} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.saveOnlyWrap}>
          <TouchableOpacity activeOpacity={0.9} onPress={this.saveUpdate} style={styles.saveOnlyBtn}>
            <Text style={styles.saveOnlyText}>Save</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>
    );
  }

  openAddProduct = () => {
    this.setState({
      addOpen: true,
      addPosting: false,
      addDraft: {
        photo: null,
        name: '',
        category: '',
        brand: '',
        variantSize: '',
        variantUnit: 'kg',
        variantType: '',
        unitsInStock: '',
        sellingPrice: '',
        lowStockAlert: false,
        alertLevel: '',
      },
    });
  };

  closeAddProduct = () => this.setState({ addOpen: false, addPosting: false });

  openPicker = (title, items, onPick) => {
    this.setState({
      pickerOpen: true,
      pickerTitle: String(title || ''),
      pickerItems: Array.isArray(items) ? items : [],
      pickerOnPick: onPick,
    });
  };

  closePicker = () => this.setState({ pickerOpen: false, pickerTitle: '', pickerItems: [], pickerOnPick: null });

  getBrandOptions = () => {
    const res = this.state.apiResponse || {};
    const list =
      res?.brands ||
      res?.data?.brands ||
      res?.brand_list ||
      res?.data?.brand_list ||
      res?.data?.brand ||
      [];
    if (!Array.isArray(list)) return [];
    return list
      .map((x) => {
        if (typeof x === 'string') return x;
        return String(x?.name || x?.title || x?.brand || '').trim();
      })
      .filter(Boolean);
  };

  pickCategory = () => {
    const options = buildCategories(this.state.products || []);
    const items = options.length ? options : (this.state.categories || []);
    this.openPicker('Select Category', items, (val) => {
      this.setState((p) => ({ addDraft: { ...p.addDraft, category: String(val || '') } }));
    });
  };

  pickBrand = () => {
    const options = this.getBrandOptions();
    this.openPicker('Select Brand', options, (val) => {
      this.setState((p) => ({ addDraft: { ...p.addDraft, brand: String(val || '') } }));
    });
  };

  pickUnit = () => {
    const units = ['kg', 'gm', 'ltr', 'ml', 'pack', 'bag', 'bottle', 'pcs'];
    this.openPicker('Select Unit', units, (val) => {
      this.setState((p) => ({ addDraft: { ...p.addDraft, variantUnit: String(val || '') } }));
    });
  };

  uploadPhoto = () => {
    Alert.alert('Upload', 'Upload Product Photo not connected');
  };

  submitAddProduct = async () => {
    if (this.state.addPosting) return;

    const endpoint =
      String(
        constants?.addProduct ||
          constants?.newProduct ||
          constants?.addNewProduct ||
          constants?.createProduct ||
          constants?.createRetailerProduct ||
          ''
      ).trim();

    if (!endpoint) {
      Alert.alert('Missing API', 'constants.addProduct missing');
      return;
    }

    const d = this.state.addDraft || {};
    const payload = {
      name: String(d?.name || '').trim(),
      category: String(d?.category || '').trim(),
      brand: String(d?.brand || '').trim(),
      variant_size: String(d?.variantSize || '').trim(),
      variant_unit: String(d?.variantUnit || '').trim(),
      variant_type: String(d?.variantType || '').trim(),
      stock_qty: String(d?.unitsInStock || '').trim(),
      price: String(d?.sellingPrice || '').trim(),
      low_stock_alert: d?.lowStockAlert ? '1' : '0',
      alert_level: String(d?.alertLevel || '').trim(),
    };

    this.setState({ addPosting: true });

    try {
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-localization': 'en',
          Authorization: 'Bearer ' + (global.token || ''),
        },
        body: JSON.stringify(payload),
      });

      const txt = await r.text();
      let res = null;
      try {
        res = JSON.parse(txt);
      } catch (e) {
        res = { raw: txt };
      }

      if (res?.status === false) throw new Error('failed');

      this.setState({ addPosting: false, addOpen: false }, () => this.fetchRetailerInventory());
    } catch (e) {
      try {
        const form = new FormData();
        Object.keys(payload).forEach((k) => {
          if (payload[k] !== undefined && payload[k] !== null) form.append(k, String(payload[k]));
        });

        const r2 = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'X-localization': 'en',
            Authorization: 'Bearer ' + (global.token || ''),
          },
          body: form,
        });

        const txt2 = await r2.text();
        let res2 = null;
        try {
          res2 = JSON.parse(txt2);
        } catch (e2) {
          res2 = { raw: txt2 };
        }

        if (res2?.status === false) throw new Error('failed2');

        this.setState({ addPosting: false, addOpen: false }, () => this.fetchRetailerInventory());
      } catch (e2) {
        this.setState({ addPosting: false });
        Alert.alert('Failed', 'Add product failed');
      }
    }
  };

  renderAddProductSheet() {
    const { addOpen, addDraft, addPosting } = this.state;
    if (!addOpen) return null;

    const d = addDraft || {};
    const unitLabel = String(d?.variantUnit || 'kg').trim() || 'kg';

    return (
      <BottomSheet visible={addOpen} onClose={this.closeAddProduct} title="New Product">
        <ScrollView
          style={{ maxHeight: SCREEN_H * 0.72 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 16 }}
        >
          <View style={styles.addInfoCard}>
            <View style={styles.addInfoIcon}>
              <Ionicons name="information" size={16} color="#2563EB" />
            </View>
            <Text style={styles.addInfoText}>Add your product for sale to farmer customers in your area.</Text>
          </View>

          <View style={styles.photoRow}>
            <View style={styles.photoLeft}>
              <View style={styles.photoThumb}>
                <Ionicons name="image-outline" size={22} color="#9CA3AF" />
              </View>
            </View>

            <TouchableOpacity activeOpacity={0.9} onPress={this.uploadPhoto} style={styles.photoUploadBox}>
              <View style={styles.photoPlusCircle}>
                <Ionicons name="add" size={20} color="#fff" />
              </View>
              <Text style={styles.photoUploadText}>Upload Product Photo</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.addLabel}>Product Name *</Text>
          <View style={styles.addInputWrap}>
            <TextInput
              value={d?.name}
              onChangeText={(t) => this.setState((p) => ({ addDraft: { ...p.addDraft, name: t } }))}
              placeholder="Enter product name *"
              placeholderTextColor="#9CA3AF"
              style={styles.addInput}
            />
          </View>

          <Text style={styles.addLabel}>Product Category</Text>
          <TouchableOpacity activeOpacity={0.9} onPress={this.pickCategory} style={styles.addSelectWrap}>
            <View style={styles.addSelectLeft}>
              <View style={styles.addSelectIcon}>
                <Ionicons name="leaf" size={16} color={C.green} />
              </View>
              <Text style={[styles.addSelectText, !String(d?.category || '').trim() ? { color: '#9CA3AF' } : null]}>
                {String(d?.category || '').trim() ? String(d?.category || '').trim() : 'Select Category'}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={18} color="#6B7280" />
          </TouchableOpacity>

          <Text style={styles.addLabel}>Brand *</Text>
          <TouchableOpacity activeOpacity={0.9} onPress={this.pickBrand} style={styles.addSelectWrap}>
            <View style={styles.addSelectLeft}>
              <Text style={[styles.addSelectText, !String(d?.brand || '').trim() ? { color: '#9CA3AF' } : null]}>
                {String(d?.brand || '').trim() ? String(d?.brand || '').trim() : 'Select Brand *'}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={18} color="#6B7280" />
          </TouchableOpacity>

          <Text style={styles.addLabel}>Variant</Text>
          <View style={styles.variantRow}>
            <View style={[styles.addInputWrap, { flex: 1.05 }]}>
              <TextInput
                value={d?.variantSize}
                onChangeText={(t) => this.setState((p) => ({ addDraft: { ...p.addDraft, variantSize: t } }))}
                placeholder="Weight / Size"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
                style={styles.addInput}
              />
            </View>

            <TouchableOpacity activeOpacity={0.9} onPress={this.pickUnit} style={styles.unitSelect}>
              <Text style={styles.unitText}>{unitLabel}</Text>
              <Ionicons name="chevron-down" size={16} color="#6B7280" />
            </TouchableOpacity>

            <View style={[styles.addInputWrap, { flex: 1.25 }]}>
              <TextInput
                value={d?.variantType}
                onChangeText={(t) => this.setState((p) => ({ addDraft: { ...p.addDraft, variantType: t } }))}
                placeholder="e.g. Pack, Bag, Bottle"
                placeholderTextColor="#9CA3AF"
                style={styles.addInput}
              />
            </View>
          </View>

          <Text style={styles.addLabel}>Units in Stock *</Text>
          <View style={styles.addInputWrap}>
            <TextInput
              value={d?.unitsInStock}
              onChangeText={(t) => this.setState((p) => ({ addDraft: { ...p.addDraft, unitsInStock: t } }))}
              placeholder="Enter quantity available *"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              style={styles.addInput}
            />
          </View>

          <View style={styles.priceLabelRow}>
            <Text style={styles.addLabel}>Selling Price (₹)</Text>
            <Text style={styles.priceHint}>e.g. ₹600 per 50kg bag</Text>
          </View>
          <View style={styles.addInputWrap}>
            <TextInput
              value={d?.sellingPrice}
              onChangeText={(t) => this.setState((p) => ({ addDraft: { ...p.addDraft, sellingPrice: t } }))}
              placeholder="Enter price"
              placeholderTextColor="#9CA3AF"
              keyboardType="decimal-pad"
              style={styles.addInput}
            />
          </View>

          <View style={styles.lowStockCard}>
            <View style={styles.lowStockHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.lowStockTitle}>Low Stock Alert</Text>
                <Text style={styles.lowStockSub}>Notify me when available units fall below alert level</Text>
              </View>
              <Switch
                value={!!d?.lowStockAlert}
                onValueChange={(v) => this.setState((p) => ({ addDraft: { ...p.addDraft, lowStockAlert: !!v } }))}
              />
            </View>

            <View style={styles.alertRow}>
              <Text style={styles.alertLeft}>Set Alert Level</Text>
              <Text style={styles.alertRight}>Enter minimum quantity to alert</Text>
            </View>

            <View style={[styles.addInputWrap, { marginTop: 8 }]}>
              <TextInput
                value={d?.alertLevel}
                onChangeText={(t) => this.setState((p) => ({ addDraft: { ...p.addDraft, alertLevel: t } }))}
                placeholder="Enter minimum quantity to alert"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                style={styles.addInput}
              />
            </View>
          </View>

          <TouchableOpacity activeOpacity={0.9} onPress={this.submitAddProduct} style={styles.submitBtn} disabled={addPosting}>
            <Text style={styles.submitBtnText}>{addPosting ? 'Submitting...' : 'Submit Product'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </BottomSheet>
    );
  }

  renderPicker() {
    const { pickerOpen, pickerTitle, pickerItems } = this.state;
    if (!pickerOpen) return null;

    return (
      <BottomSheet visible={pickerOpen} onClose={this.closePicker} title={pickerTitle}>
        <ScrollView
          style={{ maxHeight: SCREEN_H * 0.6 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 16 }}
        >
          {(pickerItems || []).map((x, idx) => {
            const v = String(x || '').trim();
            if (!v) return null;
            return (
              <TouchableOpacity
                key={`${v}_${idx}`}
                activeOpacity={0.9}
                onPress={() => {
                  const cb = this.state.pickerOnPick;
                  this.closePicker();
                  if (cb) cb(v);
                }}
                style={styles.pickerItem}
              >
                <Text style={styles.pickerItemText}>{v}</Text>
                <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
              </TouchableOpacity>
            );
          })}
          {!pickerItems?.length ? (
            <View style={styles.pickerEmpty}>
              <Text style={styles.pickerEmptyText}>No options</Text>
            </View>
          ) : null}
        </ScrollView>
      </BottomSheet>
    );
  }

  renderLoadingOrError() {
    if (!this.state.apiLoading && !this.state.apiError) return null;

    return (
      <View style={styles.loadingWrap}>
        {this.state.apiLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>Loading inventory...</Text>
          </View>
        ) : (
          <View style={styles.loadingCard}>
            <Text style={styles.loadingText}>{this.state.apiError || 'Failed'}</Text>
          </View>
        )}
      </View>
    );
  }

  renderBottomAdd() {
    return (
      <View style={styles.bottomAddWrap} pointerEvents="box-none">
        <View style={styles.bottomAddBar}>
          <TouchableOpacity activeOpacity={0.9} onPress={this.openAddProduct} style={styles.bottomAddBtn}>
            <Text style={styles.bottomAddText}>+ Add New Product</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  render() {
    const products = this.getVisibleProducts();

    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        {this.renderHeader()}

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 170 }} showsVerticalScrollIndicator={false}>
          <View style={styles.pagePad}>
            {this.renderStatBoxes()}
            {this.renderSearchFilter()}
            {this.renderListHeader()}
          </View>

          {this.renderLoadingOrError()}
          {!this.state.apiLoading && products.length ? products.map((p) => this.renderProductCard(p)) : null}

          {!this.state.apiLoading && !products.length ? (
            <View style={{ paddingHorizontal: 14, marginTop: 14 }}>
              <View
                style={{
                  backgroundColor: '#fff',
                  borderRadius: 20,
                  borderWidth: 1.1,
                  borderColor: '#E5E7EB',
                  paddingHorizontal: 14,
                  paddingVertical: 18,
                  alignItems: 'center',
                }}
              >
                <Image style={{ height: 90, width: 90, resizeMode: 'contain' }} source={require('./assets/found.png')} />
                <Text style={{ marginTop: 8, color: C.text, fontSize: 14, fontWeight: '700' }}>No products found</Text>
                <Text style={{ marginTop: 8, color: C.sub, fontSize: 13, fontWeight: '400', textAlign: 'center' }}>
                  Try changing search or filters
                </Text>
              </View>
            </View>
          ) : null}
        </ScrollView>

        {this.renderFilterSheet()}
        {this.renderUpdateSheet()}
        {this.renderAddProductSheet()}
        {this.renderPicker()}
        {/* {this.renderBottomAdd()} */}
        <SafeAreaView style={{ backgroundColor: 'transparent' }} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  headerWrap: { backgroundColor: C.green },
  headerSafe: { backgroundColor: C.green, paddingTop: Platform.OS === 'ios' ? 44 : 0 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'android' ? 10 : 8,
    paddingBottom: 10,
  },
  headerBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 15.5, fontWeight: '600' },
  headerSubRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  headerSubText: { color: '#D1FAE5', fontSize: 11.5, fontWeight: '500' },

  badge: {
    position: 'absolute',
    top: 5,
    right: -3,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: C.badgeRed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '500' },

  pagePad: { paddingHorizontal: 14, paddingTop: 12 },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  statBox: { width: '31.8%', borderRadius: 16, padding: 10, minHeight: 78 },
  statIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: { marginTop: 9, color: '#fff', fontSize: 9.2, fontWeight: '600', lineHeight: 13 },
  statValue: { marginTop: 6, color: '#fff', fontSize: 13.2, fontWeight: '700' },

  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  searchBox: {
    flex: 1,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1.2,
    borderColor: C.border,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 13, color: C.text, paddingVertical: 0, fontWeight: '500' },

  filterBtn: {
    height: 44,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1.2,
    borderColor: C.border,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  filterText: { color: C.green, fontSize: 13, fontWeight: '600' },

  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    marginTop: 10,
  },
  listHeaderText: { color: '#374151', fontSize: 11.5, fontWeight: '400' },

  loadingWrap: { paddingHorizontal: 14, marginTop: 12 },
  loadingCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1.1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: { color: C.text, fontSize: 12.6, fontWeight: '600' },

  cardOuter: { paddingHorizontal: 14, marginTop: 12 },
  card: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 1.1, borderColor: '#E5E7EB', overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },

  thumb: {
    width: 40,
    height: 40,
    borderRadius: 15,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  productTitle: { color: C.text, fontSize: 12, flex: 1, lineHeight: 18, paddingRight: 10 },
  productMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5, gap: 8 },
  categoryText: { color: '#F68A20', fontSize: 11, fontWeight: '500' },

  statusPillInline: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusPillIn: { backgroundColor: C.statusGreenBg, borderColor: C.statusGreenBorder },
  statusPillLow: { backgroundColor: C.statusOrangeBg, borderColor: C.statusOrangeBorder },
  statusPillOut: { backgroundColor: C.statusRedBg, borderColor: C.statusRedBorder },

  statusPillText: { fontSize: 8, fontWeight: '400' },
  statusPillTextIn: { color: C.statusGreenText },
  statusPillTextLow: { color: C.statusOrangeText },
  statusPillTextOut: { color: C.statusRedText },

  expandBtn: {
    width: 34,
    height: 34,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  tableWrap: { borderTopWidth: 1, borderTopColor: C.line },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#EAF7F1',
  },
  tableHeaderText: { color: '#000', fontSize: 10, fontWeight: '500' },

  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    backgroundColor: '#fff',
  },
  tableRowLow: { backgroundColor: C.lowRowBg },
  tableText: { color: C.text, fontSize: 11, fontWeight: '300' },

  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  updateBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, backgroundColor: C.greenDark },
  updateBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.28)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    elevation: 20,
    zIndex: 20,
    maxHeight: SCREEN_H * 0.82,
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 8,
  },

  sheetTitleRowOnlyX: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { color: C.text, fontSize: 15, fontWeight: '700' },
  sheetCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },

  sheetSectionTitle: { marginTop: 10, color: C.sub, fontSize: 12, fontWeight: '400', marginBottom: 10 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    maxWidth: '100%',
  },
  chipActive: { backgroundColor: C.green, borderColor: C.green },
  chipText: { color: C.text, fontSize: 12.2, fontWeight: '400' },
  chipTextActive: { color: '#fff', fontWeight: '600' },

  sheetActions: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 35, paddingHorizontal: 10 },
  sheetBtnGhost: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: '#ef7354',
    justifyContent: 'center',
  },
  sheetBtnGhostText: { color: '#FFF', fontSize: 12.5, fontWeight: '400', alignSelf: 'center' },
  sheetBtn: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: C.green,
    justifyContent: 'center',
  },
  sheetBtnText: { color: '#fff', fontSize: 12.5, fontWeight: '400', alignSelf: 'center' },

  updateSub: { marginTop: 6, color: C.sub, fontSize: 12, fontWeight: '600' },
  updateTableHead: {
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  updateHeadText: { color: '#374151', fontSize: 12, fontWeight: '400' },

  updateRow: {
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  updateRowTitle: { color: C.text, fontSize: 13, fontWeight: '600' },
  updateRowSub: { marginTop: 3, color: C.sub, fontSize: 11.6, fontWeight: '500' },
  updateQty: { fontSize: 12.2, fontWeight: '600', color: C.text },

  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  qtyBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  saveOnlyWrap: { marginTop: 14, alignItems: 'center' },
  saveOnlyBtn: {
    width: '82%',
    height: 46,
    borderRadius: 16,
    backgroundColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveOnlyText: { color: '#fff', fontSize: 13.5, fontWeight: '800' },

  bottomAddWrap: { position: 'absolute', left: 0, right: 0, bottom: 50 },
  bottomAddBar: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 18,
    backgroundColor: 'transparent',
  },
  bottomAddBtn: {
    height: 46,
    borderRadius: 16,
    backgroundColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomAddText: { color: '#fff', fontSize: 13.5, fontWeight: '800' },

  addInfoCard: {
    marginTop: 10,
    backgroundColor: '#EEF2FF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  addInfoIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addInfoText: { flex: 1, color: '#374151', fontSize: 12.5, fontWeight: '500', lineHeight: 18 },

  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  photoLeft: { width: 86 },
  photoThumb: {
    height: 80,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1.1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoUploadBox: {
    flex: 1,
    height: 80,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlusCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.greenDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  photoUploadText: { color: C.text, fontSize: 13, fontWeight: '600' },

  addLabel: { marginTop: 12, color: C.text, fontSize: 13, fontWeight: '600' },
  addInputWrap: {
    marginTop: 8,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1.1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  addInput: { fontSize: 13, color: C.text, fontWeight: '500', paddingVertical: 0 },

  addSelectWrap: {
    marginTop: 8,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1.1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addSelectLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  addSelectIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSelectText: { color: C.text, fontSize: 13, fontWeight: '500', flex: 1 },

  variantRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  unitSelect: {
    height: 44,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1.1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  unitText: { color: C.text, fontSize: 13, fontWeight: '600' },

  priceLabelRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priceHint: { color: '#6B7280', fontSize: 12, fontWeight: '500' },

  lowStockCard: {
    marginTop: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1.1,
    borderColor: '#E5E7EB',
    padding: 12,
  },
  lowStockHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  lowStockTitle: { color: C.text, fontSize: 15, fontWeight: '800' },
  lowStockSub: { marginTop: 4, color: C.sub, fontSize: 12.5, fontWeight: '500', lineHeight: 18 },

  alertRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  alertLeft: { color: C.text, fontSize: 13, fontWeight: '600' },
  alertRight: { color: C.sub, fontSize: 12, fontWeight: '500' },

  submitBtn: {
    marginTop: 14,
    height: 46,
    borderRadius: 16,
    backgroundColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  pickerItem: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1.1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  pickerItemText: { color: C.text, fontSize: 13, fontWeight: '600' },
  pickerEmpty: {
    marginTop: 12,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerEmptyText: { color: C.sub, fontSize: 12.5, fontWeight: '600' },
});