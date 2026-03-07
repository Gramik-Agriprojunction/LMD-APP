// Screens/RetailerDashboard.js
import React, { Component } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Modal,
  Pressable,
  FlatList,
  Platform,
  Image,
  TextInput,
} from 'react-native';

import Ionicons from 'react-native-vector-icons/Ionicons';

import InventoryScreen from './InventoryScreen';
import CounterSaleScreen from './CounterSaleScreen';
import PaymentsScreen from './PaymentsScreen';
import LedgerScreen from './LedgerScreen';
import Orders from './Orders';
import FastImage from 'react-native-fast-image';
import constants from './constants';

class DropdownModal extends Component {
  render() {
    const { visible, title, options, selected, onClose, onSelect } = this.props;

    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <Pressable style={styles.modalBackdrop} onPress={onClose}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{title}</Text>
              <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn} activeOpacity={0.8}>
                <Ionicons name="close-circle" size={24} color="#FFFF" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={options}
              keyExtractor={(item, idx) => String(item?.value ?? idx)}
              ItemSeparatorComponent={() => <View style={styles.modalSep} />}
              renderItem={({ item }) => {
                const isActive = selected === item.value;
                return (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => onSelect(item.value)}
                    style={[styles.modalRow, isActive ? styles.rowActive : styles.modalRow]}
                  >
                    <Text
                      style={[
                        styles.modalRowText,
                        isActive
                          ? [styles.modalRowTextActive, { color: '#000', fontSize: 16, fontWeight: '400' }]
                          : null,
                      ]}
                    >
                      {item.label}
                    </Text>
                    {isActive ? <Ionicons name="checkmark" size={18} color="#000" /> : <View style={{ width: 18 }} />}
                  </TouchableOpacity>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    );
  }
}

class DashboardHome extends Component {
  constructor(props) {
    super(props);

    this.searchTimer = null;

    this.state = {
      filterOpen: null,
      filters: {
        category: 'All',
        brand: 'All',
        variant: 'All',
        status: 'All',
      },
      expanded: {},
      dashboard_data: null,
      notifCount: 0,
      isLoading: false,

      searchText: '',
    };
  }

  componentDidMount() {
    try {
      Ionicons.loadFont();
    } catch (e) {}

    this.dashboardApi();
  }

  componentWillUnmount() {
    if (this.searchTimer) clearTimeout(this.searchTimer);
  }

  getSelectedCategoryId() {
    const selectedName = this.state.filters?.category;
    if (!selectedName || selectedName === 'All') return '';

    const cats = Array.isArray(this.state.dashboard_data?.category) ? this.state.dashboard_data.category : [];
    const found = cats.find((c) => String(c?.name || '').trim() === String(selectedName).trim());
    return found?.id ? String(found.id) : '';
  }

  buildDashboardUrl() {
    const base = String(constants.homescreen || '');

    const params = [];
    const categoryId = this.getSelectedCategoryId();
    const search = String(this.state.searchText || '').trim();

    if (categoryId) params.push(`category_id=${encodeURIComponent(categoryId)}`);
    if (search) params.push(`search=${encodeURIComponent(search)}`);

    if (!params.length) return base;

    const joiner = base.includes('?') ? '&' : '?';
    return `${base}${joiner}${params.join('&')}`;
  }

  dashboardApi() {
    this.setState({ isLoading: true });

    const url = this.buildDashboardUrl();

    console.log('url== ', url);

    fetch(url, {
      headers: {
        'X-localization': 'en',
        Authorization: 'Bearer ' + global.token,
      },
      method: 'GET',
    })
      .then((response) => response.json())
      .then((responseJson) => {
        console.log('dashboard response== ', JSON.stringify(responseJson));
        this.setState({ isLoading: false });

        if (responseJson.status) {
          const data = responseJson.data || {};
          const summary = data.summary || {};

          this.setState(
            {
              dashboard_data: data,
              notifCount: Number(summary.notification_count || 0),
            },
            () => {
              const ids = this.getData().map((x) => x.id);
              const expanded = {};
              ids.forEach((id) => (expanded[id] = true));
              this.setState({ expanded });
            }
          );
        }
      })
      .catch(() => {
        this.setState({ isLoading: false });
      });
  }

  onSearchTextChange(t) {
    const val = String(t || '');
    this.setState({ searchText: val });

    if (this.searchTimer) clearTimeout(this.searchTimer);

    this.searchTimer = setTimeout(() => {
      this.dashboardApi();
    }, 500);
  }

  clearSearch() {
    if (this.searchTimer) clearTimeout(this.searchTimer);

    this.setState({ searchText: '' }, () => {
      this.dashboardApi();
    });
  }

  formatINR(n) {
    try {
      const num = Number(n) || 0;
      return `₹ ${num.toLocaleString('en-IN')}`;
    } catch (e) {
      return `₹ ${n}`;
    }
  }

  getStatusForItem(item) {
    const s = String(item?.stock_status ?? item?.low_stock ?? '').toLowerCase();
    if (s === 'in' || s === 'low' || s === 'out') return s;

    if (s === 'in_stock') return 'in';
    if (s === 'low_stock') return 'low';
    if (s === 'out_stock' || s === 'out_of_stock') return 'out';

    return 'in';
  }

  statusTone(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'out') return 'red';
    if (s === 'low') return 'orange';
    return 'green';
  }

  renderQtyChip(text, tone) {
    const map = {
      green: { tx: '#0F7451' },
      blue: { tx: '#1F5FA8' },
      orange: { tx: '#cc9e2a' },
      red: { tx: '#B91C1C' },
      gray: { tx: '#374151' },
    };
    const t = map[tone] || map.gray;

    return (
      <View style={[styles.qtyChip, {}]}>
        <Text style={[styles.qtyChipText, { color: t.tx }]}>{text}</Text>
      </View>
    );
  }

  getData() {
    const data = this.state.dashboard_data || {};
    const cats = Array.isArray(data.category) ? data.category : [];

    return cats.map((cat, idx) => {
      const products = Array.isArray(cat.products) ? cat.products : [];

      const variants = products.map((p, pidx) => {
        const statusRaw = String(p?.low_stock ?? '').toLowerCase();
        return {
          id: `prod_${String(p.product_id ?? pidx)}`,
          name: String(p.name || ''),
          qty: Number(p.quantity || 0),
          unit: String(p.unit || 'Units'),
          rate: Number(p.price || 0),
          image: p.thumbnail ? { uri: String(p.thumbnail) } : null,
          subtitle: String(p.variant || ''),
          brand: String(cat.brand || ''),
          total_value: Number(p.total_value || 0),
          stock_status: statusRaw,
        };
      });

      const totalQty = Number(cat.total_units || 0);

      let alert = null;
      const outCount = variants.filter((v) => this.getStatusForItem(v) === 'out').length;
      const lowCount = variants.filter((v) => this.getStatusForItem(v) === 'low').length;

      if (outCount > 0) alert = { type: 'out', text: `Out of Stock (${outCount})` };
      else if (lowCount > 0) alert = { type: 'low', text: `Low Stock (${lowCount})` };
      else alert = { type: 'in', text: 'In Stock' };

      return {
        id: `cat_${String(cat.id ?? idx)}`,
        category: String(cat.name || 'Category'),
        title: String(cat.name || 'Category'),
        rightTag: { type: 'brand', text: String(cat.brand || ''), tone: 'brand' },
        icon: cat.new_icon ? { uri: String(cat.new_icon) } : null,
        totalRight: { qty: totalQty, unit: 'Units' },
        variants,
        alert,
      };
    });
  }

  getFilterOptions() {
    const raw = this.getData();

    const cats = Array.from(new Set(raw.map((g) => g.category || 'Category'))).sort();
    const brands = Array.from(new Set(raw.map((g) => String(g?.rightTag?.text || '').trim()).filter(Boolean))).sort();
    const variants = Array.from(
      new Set(
        raw
          .flatMap((g) => (g.variants || []).map((v) => String(v.subtitle || '').trim()).filter(Boolean))
          .filter(Boolean)
      )
    ).sort();

    return {
      category: [{ label: 'All', value: 'All' }, ...cats.map((c) => ({ label: c, value: c }))],
      brand: [{ label: 'All', value: 'All' }, ...brands.map((b) => ({ label: b, value: b }))],
      variant: [{ label: 'All', value: 'All' }, ...variants.map((v) => ({ label: v, value: v }))],
      status: [
        { label: 'All', value: 'All' },
        { label: 'In Stock', value: 'in' },
        { label: 'Low Stock', value: 'low' },
        { label: 'Out of Stock', value: 'out' },
      ],
    };
  }

  applyFilters(data) {
    const { category, brand, variant, status } = this.state.filters;

    return data
      .filter((group) => {
        if (category !== 'All' && group.category !== category) return false;
        return true;
      })
      .map((group) => {
        let v = [...(group.variants || [])];

        if (brand !== 'All') v = v.filter((x) => String(x.brand || '').toLowerCase() === String(brand).toLowerCase());
        if (variant !== 'All')
          v = v.filter((x) => String(x.subtitle || '').toLowerCase() === String(variant).toLowerCase());
        if (status !== 'All') v = v.filter((x) => this.getStatusForItem(x) === status);

        if (!v.length) return null;

        const totalQty = v.reduce((a, x) => a + (Number(x.qty) || 0), 0);

        let alert = null;
        const outCount = v.filter((x) => this.getStatusForItem(x) === 'out').length;
        const lowCount = v.filter((x) => this.getStatusForItem(x) === 'low').length;
        if (outCount > 0) alert = { type: 'out', text: `Out of Stock (${outCount})` };
        else if (lowCount > 0) alert = { type: 'low', text: `Low Stock (${lowCount})` };
        else alert = { type: 'in', text: 'In Stock' };

        return { ...group, variants: v, totalRight: { qty: totalQty, unit: 'Units' }, alert };
      })
      .filter(Boolean);
  }

  computeStats() {
    const summary = this.state.dashboard_data?.summary || {};
    return {
      totalSkus: Number(summary.total_skus || 0),
      totalQty: Number(summary.total_quantity || 0),
      totalValue: Number(summary.total_value || 0),
      lowStockItems: Number(summary.low_stock || 0),
    };
  }

  toggleProduct(id) {
    this.setState((prev) => ({ expanded: { ...prev.expanded, [id]: !prev.expanded[id] } }));
  }

  openFilter(key) {
    this.setState({ filterOpen: key });
  }

  closeFilter() {
    this.setState({ filterOpen: null });
  }

  selectFilter(key, value) {
    this.setState(
      (prev) => ({
        filters: { ...prev.filters, [key]: value },
        filterOpen: null,
      }),
      () => {
        this.dashboardApi();
      }
    );
  }

  renderStatCard({ iconName, title, value, sub, bg }) {
    return (
      <View style={[styles.statCard, { backgroundColor: bg, borderColor: bg }]}>
        <View style={styles.statLeft}>
          <Ionicons name={iconName} size={25} color="#fff" />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.statTitleFilled}>{title}</Text>
          <Text style={styles.statValueFilled}>{value}</Text>
          {!!sub ? <Text style={styles.statSubFilled}>{sub}</Text> : null}
        </View>
      </View>
    );
  }

  isFilterActive(key) {
    const v = this.state.filters?.[key];
    return v && v !== 'All';
  }

  render() {
    const rawData = this.state.dashboard_data ? this.getData() : [];
    const data = this.applyFilters(rawData);
    const stats = this.computeStats();

    const filterOptions = this.getFilterOptions();
    const { filterOpen, filters } = this.state;

    const profileImg = this.state.dashboard_data?.summary?.profile_image;

    return (
      <View style={{ flex: 1, backgroundColor: '#F3F5F7' }}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF" />

        <View style={styles.topHeader}>
          <TouchableOpacity onPress={() => this.props?.navigation?.navigate?.('Profile')}>
            {profileImg ? (
              <FastImage
                source={{ uri: String(profileImg) }}
                style={{ width: 40, height: 40, borderRadius: 20 }}
                resizeMode={FastImage.resizeMode.cover}
              />
            ) : (
              <Ionicons name="person-circle" size={40} color="#000" />
            )}
          </TouchableOpacity>

          <View style={styles.brandCenter}>
            <View style={styles.brandRow}>
              <View style={styles.leafCircle}>
                <Image style={{ height: 30, width: 30 }} source={require('./assets/logo.png')} />
              </View>
              <Text style={styles.brandTitle}>Gramik</Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity activeOpacity={0.8} onPress={() => this.props?.navigation?.navigate?.('Profile')}>
              <Ionicons name="notifications" size={27} color="#000" />
              {Number(this.state.notifCount || 0) > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{String(this.state.notifCount || 0)}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 92 }}>
          <View style={styles.sectionTop}>
            <View
              style={{
                flex: 1,
                height: 45,
                borderRadius: 12,
                backgroundColor: '#FFFFFF',
                borderWidth: 1,
                borderColor: '#D7DEE6',
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 10,
              }}
            >
              <Ionicons name="search-outline" size={22} color="grey" style={{ marginRight: 8 }} />

              <TextInput
                value={this.state.searchText}
                onChangeText={(t) => this.onSearchTextChange(t)}
                placeholder="Search"
                placeholderTextColor="grey"
                style={{
                  flex: 1,
                  height: 45,
                  paddingVertical: 0,
                  color: '#111827',
                  fontSize: 13,
                  fontFamily: 'OpenSansRoman-SemiBold',
                }}
                returnKeyType="search"
                onSubmitEditing={() => this.dashboardApi()}
              />

              {String(this.state.searchText || '').length > 0 ? (
                <TouchableOpacity activeOpacity={0.85} onPress={() => this.clearSearch()}>
                  <Image source={require('./assets/close.png')} style={{ width: 18, height: 18, resizeMode: 'contain' }} />
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.actionRow} />
          </View>

          <View style={styles.statsRowWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsRow}>
              {this.renderStatCard({
                iconName: 'cube-outline',
                title: 'Total SKUs',
                value: String(stats.totalSkus),
                sub: '',
                bg: '#0F7451',
              })}
              {this.renderStatCard({
                iconName: 'layers-outline',
                title: 'Total Quantity',
                value: String(stats.totalQty),
                sub: '',
                bg: '#273446',
              })}
              {this.renderStatCard({
                iconName: 'cash-outline',
                title: 'Total Value',
                value: this.formatINR(stats.totalValue),
                sub: '',
                bg: '#1F5FA8',
              })}
              {this.renderStatCard({
                iconName: 'warning-outline',
                title: 'Low Stock',
                value: String(stats.lowStockItems),
                sub: '',
                bg: '#B45309',
              })}
            </ScrollView>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRowScroll}>
            <TouchableOpacity
              style={[styles.filterPill, this.isFilterActive('category') ? styles.filterPillActive : null]}
              activeOpacity={0.9}
              onPress={() => this.openFilter('category')}
            >
              <Text style={[styles.filterText, this.isFilterActive('category') ? styles.filterTextActive : null]}>
                Category
              </Text>
              <Ionicons
                name="chevron-down-outline"
                size={12}
                color={this.isFilterActive('category') ? '#FFF' : '#374151'}
                style={{ marginLeft: 3 }}
              />
            </TouchableOpacity>

            {/* <TouchableOpacity
              style={[styles.filterPill, this.isFilterActive('brand') ? styles.filterPillActive : null]}
              activeOpacity={0.9}
              onPress={() => this.openFilter('brand')}
            >
              <Text style={[styles.filterText, this.isFilterActive('brand') ? styles.filterTextActive : null]}>
                Brand
              </Text>
              <Ionicons
                name="chevron-down-outline"
                size={12}
                color={this.isFilterActive('brand') ? '#FFF' : '#374151'}
                style={{ marginLeft: 3 }}
              />
            </TouchableOpacity> */}

            <TouchableOpacity
              style={[styles.filterPill, this.isFilterActive('variant') ? styles.filterPillActive : null]}
              activeOpacity={0.9}
              onPress={() => this.openFilter('variant')}
            >
              <Text style={[styles.filterText, this.isFilterActive('variant') ? styles.filterTextActive : null]}>
                Variant
              </Text>
              <Ionicons
                name="chevron-down-outline"
                size={12}
                color={this.isFilterActive('variant') ? '#FFF' : '#374151'}
                style={{ marginLeft: 3 }}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterPill, this.isFilterActive('status') ? styles.filterPillActive : null]}
              activeOpacity={0.9}
              onPress={() => this.openFilter('status')}
            >
              <Text style={[styles.filterText, this.isFilterActive('status') ? styles.filterTextActive : null]}>
                Stock
              </Text>
              <Ionicons
                name="chevron-down-outline"
                size={12}
                color={this.isFilterActive('status') ? '#FFF' : '#374151'}
                style={{ marginLeft: 3 }}
              />
            </TouchableOpacity>
          </ScrollView>

          <DropdownModal
            visible={filterOpen === 'category'}
            title={`Category (${filters.category})`}
            options={filterOptions.category}
            selected={filters.category}
            onClose={() => this.closeFilter()}
            onSelect={(v) => this.selectFilter('category', v)}
          />
          <DropdownModal
            visible={filterOpen === 'brand'}
            title={`Brand (${filters.brand})`}
            options={filterOptions.brand}
            selected={filters.brand}
            onClose={() => this.closeFilter()}
            onSelect={(v) => this.selectFilter('brand', v)}
          />
          <DropdownModal
            visible={filterOpen === 'variant'}
            title={`Variant (${filters.variant})`}
            options={filterOptions.variant}
            selected={filters.variant}
            onClose={() => this.closeFilter()}
            onSelect={(v) => this.selectFilter('variant', v)}
          />
          <DropdownModal
            visible={filterOpen === 'status'}
            title={`Stock Status (${filters.status})`}
            options={filterOptions.status}
            selected={filters.status}
            onClose={() => this.closeFilter()}
            onSelect={(v) => this.selectFilter('status', v)}
          />

          {data.map((p) => {
            const isOpen = !!this.state.expanded[p.id];
            const totalRight = p.totalRight ? `${p.totalRight.qty} ${p.totalRight.unit}` : null;

            return (
              <View key={p.id} style={styles.productCard}>
                <TouchableOpacity onPress={() => this.toggleProduct(p.id)} style={styles.productTop}>
                  <View style={[styles.productImgFake]}>
                    {p.icon ? (
                      <FastImage
                        source={p.icon}
                        style={{ width: 50, height: 50, alignSelf: 'center' }}
                        resizeMode={FastImage.resizeMode.contain}
                      />
                    ) : null}
                  </View>

                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <View style={styles.productTitleRow}>
                      <Text style={styles.productTitle}>{p.title}</Text>

                      {p.rightTag?.type === 'brand' && p.rightTag.text ? (
                        <View style={styles.brandPill}>
                          <Text style={styles.brandPillText}>{p.rightTag.text}</Text>
                        </View>
                      ) : null}

                      {p.rightTag?.type === 'tag' ? (
                        <View style={styles.tagPillGreen}>
                          <Text style={styles.tagPillGreenText}>{p.rightTag.text}</Text>
                        </View>
                      ) : null}
                    </View>

                    {!!totalRight ? (
                      <View style={styles.totalRight}>
                        <Text style={styles.totalRightText}>
                          <Text style={styles.totalRightBold}>{totalRight}</Text>
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <TouchableOpacity style={styles.chev} activeOpacity={0.75} onPress={() => this.toggleProduct(p.id)}>
                    <Ionicons name={isOpen ? 'chevron-up-outline' : 'chevron-down-outline'} size={18} color="#6B7280" />
                  </TouchableOpacity>
                </TouchableOpacity>

                {isOpen ? (
                  <View style={styles.variantBox}>
                    {(p.variants || []).map((v, idx) => {
                      const status = this.getStatusForItem(v);
                      const tone = this.statusTone(status);
                      const value = Number(v.total_value || 0);

                      let valueColor = '#111827';
                      if (value <= 0) valueColor = '#B91C1C';

                      return (
                        <View
                          key={v.id}
                          style={[styles.variantRow, idx === p.variants.length - 1 ? { borderBottomWidth: 0 } : null]}
                        >
                          <View style={[styles.leftCell, { flex: 2.8 }]}>
                            {v.image ? <Image source={v.image} style={styles.variantThumbImg} /> : null}

                            <View style={{ flex: 1 }}>
                              <Text style={styles.variantName}>{v.name}</Text>
                              {!!v.subtitle ? <Text style={styles.variantSub}>{v.subtitle}</Text> : null}
                              <View style={styles.tdCenter}>{this.renderQtyChip(`${v.qty} ${v.unit}`, tone)}</View>
                            </View>
                          </View>

                          <Text style={[styles.tdRightSmall, { flex: 0.7 }]}>{this.formatINR(v.rate)}</Text>

                          <Text style={[styles.tdRightSmall, { flex: 0.9, color: valueColor }]}>
                            {this.formatINR(value)}
                          </Text>
                        </View>
                      );
                    })}

                    <View style={styles.alertRow}>
                      {p.alert?.type === 'low' ? (
                        <View style={styles.alertPill}>
                          <Ionicons name="warning-outline" size={16} color="#B45309" />
                          <Text style={styles.alertText}>{p.alert.text}</Text>
                        </View>
                      ) : null}

                      {p.alert?.type === 'out' ? (
                        <View style={[styles.alertPill, { backgroundColor: '#FFE9E9', borderColor: '#FFB3B3' }]}>
                          <Ionicons name="close-circle-outline" size={16} color="#b9501c" />
                          <Text style={[styles.alertText, { color: '#B91C1C' }]}>{p.alert.text}</Text>
                        </View>
                      ) : null}

                       {p.alert?.type === 'in' ? (
                          <View style={[styles.alertPill, { backgroundColor: '#EEF9F2', borderColor: '#BFE6CF' }]}>
                            <Ionicons name="checkmark-circle-outline" size={16} color="#0F7451" />
                            <Text style={[styles.alertText, { color: '#0F7451' }]}>{p.alert.text}</Text>
                          </View>
                        ) : null}
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  }
}

export default class RetailerDashboard extends Component {
  state = { tab: 'Dashboard' };

  renderTab() {
    const { tab } = this.state;

    if (tab === 'Dashboard') return <DashboardHome navigation={this.props.navigation} />;
    if (tab === 'Orders') return <Orders navigation={this.props.navigation} />;
    if (tab === 'Inventory') return <InventoryScreen navigation={this.props.navigation} />;
    if (tab === 'Sales') return <CounterSaleScreen navigation={this.props.navigation} />;
    if (tab === 'Payments') return <PaymentsScreen navigation={this.props.navigation} />;

    return <DashboardHome navigation={this.props.navigation} />;
  }

  render() {
    const tabs = [
      { key: 'Dashboard', label: 'Dashboard', icon: 'home-outline' },
      { key: 'Orders', label: 'Orders', icon: 'receipt-outline' },
      { key: 'Inventory', label: 'Inventory', icon: 'cube-outline' },
      { key: 'Sales', label: 'Sales', icon: 'bar-chart-outline' },
      { key: 'Payments', label: 'Payments', icon: 'card-outline' },
    ];

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: this.state.tab === 'Dashboard' ? '#FFF' : '#0F7451' }}>
        {this.renderTab()}

        <View style={styles.bottomTab}>
          {tabs.map((t) => {
            const active = this.state.tab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                style={styles.tabBtn}
                activeOpacity={0.85}
                onPress={() => this.setState({ tab: t.key })}
              >
                <Ionicons
                  name={t.icon}
                  size={22}
                  color={active ? '#FFF' : '#dfe3ec'}
                  style={{ marginBottom: 2, alignSelf: 'center' }}
                />
                <Text style={[styles.tabLabel, active ? styles.tabLabelActive : null]}>{t.label}</Text>
                {active && <View style={styles.tabActiveDot} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  topHeader: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E6EBF1',
  },
  brandCenter: { flex: 1, alignItems: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  leafCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D9EFE2',
    backgroundColor: '#EEF9F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  brandTitle: { fontSize: 18, fontWeight: '700', color: '#0F7451' },
  headerRight: { flexDirection: 'row', alignItems: 'center', paddingRight: 5 },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: 'red',
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: '700' },

  sectionTop: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: '#F3F5F7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageTitle: { fontSize: 14, fontWeight: '700', color: '#111827', fontFamily: 'OpenSansRoman-SemiBold' },
  actionRow: { flexDirection: 'row', alignItems: 'center' },

  searchBtn: {
    marginLeft: 10,
    width: 40,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D7DEE6',
    justifyContent: 'center',
    alignItems: 'center',
  },

  statsRowWrap: { backgroundColor: '#F3F5F7', paddingBottom: 8 },
  statsRow: { paddingHorizontal: 10, gap: 7, paddingRight: 14 },

  statCard: {
    minWidth: 150,
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statLeft: { marginRight: 12 },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statTitleFilled: { fontSize: 10, fontWeight: '400', color: '#FFF' },
  statValueFilled: { marginTop: 5, fontSize: 17, fontWeight: '700', color: '#FFF' },
  statSubFilled: { marginTop: 0, fontSize: 11, fontWeight: '600', color: '#FFF' },

  filtersRowScroll: {
    paddingHorizontal: 10,
    paddingTop: 4,
    paddingBottom: 10,
    gap: 8,
    alignItems: 'center',
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D7DEE6',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  filterPillActive: {
    backgroundColor: '#F68A20',
    borderColor: '#F68A20',
  },
  filterText: { fontSize: 12, fontWeight: '400', color: '#000' },
  filterTextActive: { color: '#FFF', fontWeight: '700' },

  tableHead: {
    marginHorizontal: 10,
    backgroundColor: '#f79d43',
    borderRadius: 12,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: '#D7DEE6',
  },
  th: { fontSize: 12, fontWeight: '700', color: '#FFF' },

  productCard: {
    marginHorizontal: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginBottom: 5,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderWidth: 1,
    borderColor: '#D7DEE6',
    overflow: 'hidden',
  },
  productTop: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  productImgFake: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
    alignSelf: 'center',
  },
  productTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  productTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    flexWrap: 'wrap',
    flexShrink: 1,
    fontFamily: 'OpenSansRoman-SemiBold',
  },

  tagPillGreen: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#EEF9F2',
    borderWidth: 1,
    borderColor: '#BFE6CF',
  },
  tagPillGreenText: { fontSize: 11, fontWeight: '700', color: '#0F7451', fontFamily: 'OpenSansRoman-Regular' },

  brandPill: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#0F7451',
    borderWidth: 1,
    borderColor: '#E6EBF1',
  },
  brandPillText: { fontSize: 9, fontWeight: '600', color: '#FFF' },

  totalRight: { marginTop: 4 },
  totalRightText: { fontSize: 11, fontWeight: '400', color: 'grey' },
  totalRightBold: { fontWeight: '500', color: '#F37A20', fontSize: 11 },

  chev: { paddingHorizontal: 4, paddingVertical: 6 },

  variantBox: {
    marginHorizontal: 10,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D7DEE6',
    backgroundColor: '#FBFCFD',
    overflow: 'hidden',
  },
  variantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 5,
    paddingRight: 12,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },

  leftCell: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingRight: 8,
    justifyContent: 'center',
    alignSelf: 'center',
  },

  variantThumb: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  variantThumbImg: { width: 45, height: 45, resizeMode: 'contain', marginRight: 8, alignSelf: 'center' },

  variantName: {
    fontSize: 12,
    fontWeight: '400',
    color: '#111827',
    flexWrap: 'wrap',
  },
  variantSub: {
    marginTop: 5,
    fontSize: 12,
    fontWeight: '400',
    color: '#6B7280',
    flexWrap: 'wrap',
  },

  tdCenter: { alignSelf: 'flex-start', marginTop: 5 },
  tdRightSmall: {
    fontSize: 12,
    fontWeight: '400',
    color: '#111827',
    textAlign: 'right',
  },

  qtyChip: {
    paddingRight: 8,
    borderRadius: 12,
  },
  qtyChipText: { fontSize: 11, fontWeight: '500', fontFamily: 'OpenSansRoman-Regular' },

  alertRow: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  alertPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFD6A8',
    backgroundColor: '#FFF4E7',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    gap: 6,
  },
  alertText: { fontSize: 10, fontWeight: '500', color: '#B45309' },

  bottomActions: {
    marginHorizontal: 14,
    marginTop: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  bottomPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFE6CF',
    backgroundColor: '#FFFFFF',
  },
  bottomPillText: { fontSize: 12, fontWeight: '700', color: '#0F7451' },

  totalValuePill: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFE6CF',
    backgroundColor: '#FFFFFF',
  },
  totalValueLabel: { fontSize: 12, fontWeight: '700', color: '#111827', marginRight: 6 },
  totalValueText: { fontSize: 12.5, fontWeight: '700', color: '#0F7451', textAlign: 'center' },

  bottomTab: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 74,
    paddingBottom: 10,
    paddingTop: 8,
    backgroundColor: '#0F7451',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    flexDirection: 'row',
    paddingLeft: 20,
    paddingRight: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
  tabBtn: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabLabel: { fontSize: 10, fontWeight: '400', color: '#FFF' },
  tabLabelActive: { color: '#FFF', fontWeight: '700', fontSize: 10 },
  tabActiveDot: {
    marginTop: 4,
    width: 18,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#0F7451',
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderColor: '#E6EBF1',
    overflow: 'hidden',
    maxHeight: Platform.OS === 'ios' ? 420 : 440,
  },
  modalHeader: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F7451',
  },
  modalTitle: { fontSize: 14, fontWeight: '700', color: '#FFF', fontFamily: 'OpenSansRoman-SemiBold' },
  modalCloseBtn: {
    width: 34,
    height: 30,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSep: { height: 0.9, backgroundColor: '#EEF1F5' },
  modalRow: {
    paddingHorizontal: 15,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowActive: {
    paddingHorizontal: 15,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#4082417A',
  },
  modalRowText: { fontSize: 14, fontWeight: '400', color: '#000', fontFamily: 'OpenSans-Regular' },
  modalRowTextActive: { fontSize: 14, color: '#FFF', fontWeight: '700', fontFamily: 'OpenSans-SemiBold' },
});