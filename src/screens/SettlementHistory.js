import React, { Component } from 'react';
import { withV4Navigation } from "../utils/v4Compat";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Image,
  FlatList,
  TextInput,
  Dimensions,
  ActivityIndicator,
  Platform,
  Modal,
  Pressable,
  InteractionManager,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { safeBottomEdges } from '../utils/safeAreaInsets';
import constants from '../utils/constants';
import Toast from 'react-native-simple-toast';
import ImageCropPicker from 'react-native-image-crop-picker';
import moment from 'moment';
import { S } from '../utils/soilTheme';
import ProofImageViewer from '../components/ProofImageViewer';

const { width } = Dimensions.get('window');
const P = S.P;
const LIST_PAD = 12;
const SCREEN_BG = '#edf1f7';

const STATUS_STYLE = {
  pending: { bg: S.ORANGE_BG, text: S.ORANGE, bar: S.ORANGE, label: 'Pending' },
  success: { bg: S.GREEN_BG, text: S.GREEN_DARK, bar: S.GREEN_DARK, label: 'Settled' },
  settled: { bg: S.GREEN_BG, text: S.GREEN_DARK, bar: S.GREEN_DARK, label: 'Settled' },
  dispute: { bg: S.RED_BG, text: S.RED, bar: S.RED, label: 'Disputed' },
  default: { bg: S.BG, text: S.SUB, bar: S.MUTED, label: 'Unknown' },
};

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'success', label: 'Settled' },
  { key: 'dispute', label: 'Dispute' },
];

class SettlementHistory extends Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: false,
      submitting: false,

      search: '',
      activeTab: 'all', // all | success | pending | dispute

      list: [],
      counts: { all: 0, success: 0, pending: 0, dispute: 0 },

      // upload flow
      pickerVisible: false,
      confirmVisible: false,
      selectedImage: null,
      selectedSettlementId: null,
      refreshing: false,
      receiptPreview: null,

      missingFields: [],
    };

    this._presentingPicker = false;
  }

  componentDidMount() {
    this.fetchHistory();
  }

  openReceiptPreview = (uri) => {
    if (!uri) return;
    this.setState({ receiptPreview: uri });
  };

  closeReceiptPreview = () => this.setState({ receiptPreview: null });

  goBack = () => {
    const nav = this.props?.navigation;
    if (nav?.goBack) nav.goBack();
  };

  // ======================
  // ✅ API: Settlement History
  // ======================
  onRefresh = () => {
    this.setState({ refreshing: true }, () => this.fetchHistory(true));
  };

  fetchHistory = (fromRefresh = false) => {
    if (!fromRefresh) this.setState({ loading: true, missingFields: [] });

    const q = String(this.state.search || '').trim();
    const tab = this.state.activeTab;
    const params = [];
    if (tab && tab !== 'all') params.push(`status=${tab}`);
    if (q) params.push(`search=${encodeURIComponent(q)}`);
    const url = params.length
      ? `${constants.settleHistory}?${params.join('&')}`
      : constants.settleHistory;

    fetch(url, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + global.token,
        Accept: 'application/json',
      },
    })
      .then((r) => r.json())
      .then((json) => {
        console.log('Settlement History API response== ', JSON.stringify(json));

        const rows = Array.isArray(json?.data) ? json.data : [];

        const lc = json?.list_count || {};
        const pending = Number(lc?.pending_count ?? 0) || 0;
        const success = Number(lc?.settled_count ?? 0) || 0;
        const dispute = Number(lc?.disputed_count ?? 0) || 0;
        const all = Number(lc?.total ?? rows.length) || rows.length;

        this.setState({
          loading: false,
          refreshing: false,
          list: rows,
          counts: { all, success, pending, dispute },
          missingFields: [],
        });
      })
      .catch((e) => {
        console.log('Settlement History API error== ', e);
        Toast.show(e?.message || String(e), Toast.SHORT);
        this.setState({ loading: false, refreshing: false, list: [] });
      });
  };

  // ======================
  // Picker modal open/close
  // ======================
  openPicker = (settlementId = null) => {
    this.setState({
      pickerVisible: true,
      selectedSettlementId: settlementId, // ✅ settlement_id string
    });
  };

  closePicker = () => this.setState({ pickerVisible: false });

  // iOS-stable presenter (prevents modal close + picker open race)
  presentImagePicker = (fn) => {
    if (this._presentingPicker) return;

    this._presentingPicker = true;

    this.setState({ pickerVisible: false }, () => {
      InteractionManager.runAfterInteractions(() => {
        setTimeout(async () => {
          try {
            await fn();
          } finally {
            this._presentingPicker = false;
          }
        }, 350); // stable on iOS
      });
    });
  };

  pickFromCamera = () => {
    this.presentImagePicker(async () => {
      try {
        const img = await ImageCropPicker.openCamera({
          mediaType: 'photo',
          cropping: false,
          compressImageQuality: 0.85,
          // iOS sometimes needs this if photos permission is restricted:
          // forceJpg: true,
        });

        if (!img?.path) return;

        const type = img?.mime || 'image/jpeg';
        const name = img?.filename || `camera_${Date.now()}.jpg`;

        this.setState({
          selectedImage: { uri: img.path, type, name },
          confirmVisible: true,
        });
      } catch (e) {
        const msg = String(e?.message || '').toLowerCase();
        if (msg.includes('cancel')) return;
        console.log('camera pick error== ', e);
        Toast.show(e?.message || String(e), Toast.SHORT);
      }
    });
  };

  pickFromGallery = () => {
    this.presentImagePicker(async () => {
      try {
        const img = await ImageCropPicker.openPicker({
          mediaType: 'photo',
          cropping: false,
          compressImageQuality: 0.85,
        });

        if (!img?.path) return;

        const type = img?.mime || 'image/jpeg';
        const name = img?.filename || `gallery_${Date.now()}.jpg`;

        this.setState({
          selectedImage: { uri: img.path, type, name },
          confirmVisible: true,
        });
      } catch (e) {
        const msg = String(e?.message || '').toLowerCase();
        if (msg.includes('cancel')) return;
        console.log('gallery pick error== ', e);
        Toast.show(e?.message || String(e), Toast.SHORT);
      }
    });
  };

  cancelConfirm = () => {
    this.setState({
      confirmVisible: false,
      selectedImage: null,
      selectedSettlementId: null,
    });
  };

  // ======================
  // Submit for verification (multipart)
  // ======================
  onSubmitForVerification = () => {
    const { selectedImage, selectedSettlementId } = this.state;

    if (!selectedImage?.uri) {
      Toast.show('Please upload screenshot', Toast.SHORT);
      return;
    }

    if (!selectedSettlementId) {
      Toast.show('Upload screenshot from a settlement card', Toast.SHORT);
      return;
    }

    const formData = new FormData();
    formData.append('settlement_id', String(selectedSettlementId)); // ✅ GMT00001
    formData.append('screenshot', {
      uri: selectedImage.uri,
      type: selectedImage.type,
      name: selectedImage.name,
    });

    this.setState({ submitting: true }, () => {
      fetch(constants.cashSettle, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + global.token,
          Accept: 'application/json',
          // don't set multipart content-type manually
        },
        body: formData,
      })
        .then((r) => r.json())
        .then((json) => {
          console.log('Submit Verification API response== ', JSON.stringify(json));
          this.setState({
            submitting: false,
            confirmVisible: false,
            selectedImage: null,
            selectedSettlementId: null,
          });
          Toast.show(json?.message || 'Submitted', Toast.SHORT);
          this.fetchHistory();
        })
        .catch((e) => {
          console.log('Submit Verification API error== ', e);
          this.setState({ submitting: false });
          Toast.show(e?.message || String(e), Toast.SHORT);
        });
    });
  };

  // ======================
  // Helpers
  // ======================
  getSettlementStatus = (item) => String(item?.settlement_status || item?.status || '').trim();

  getOrders = (item) => (Array.isArray(item?.order) ? item.order : []);

  normalizeStatus = (s) => String(s || '').toLowerCase();

  mapTabFromStatus = (status) => {
    const st = this.normalizeStatus(status);
    if (st.includes('success') || st.includes('settled')) return 'success';
    if (st.includes('pending')) return 'pending';
    if (st.includes('disput')) return 'dispute';
    return 'all';
  };

  statusMeta = (statusRaw) => {
    const st = this.normalizeStatus(statusRaw);
    if (st.includes('pending')) return STATUS_STYLE.pending;
    if (st.includes('success') || st.includes('settled')) return STATUS_STYLE.settled;
    if (st.includes('disput')) return STATUS_STYLE.dispute;
    return STATUS_STYLE.default;
  };

  typeLabel = (type, bank) => {
    const t = String(type || '').toLowerCase();
    if (t === 'upi') return 'UPI';
    if (t === 'bank') return bank?.bank_name || bank?.name || 'Bank';
    return t ? t.toUpperCase() : '-';
  };

  parseSubmittedDate = (raw) => {
    if (!raw) return { date: '', time: '' };
    const fixed = String(raw).trim().replace(/(\d{1,2})(\d{4})/, '$1 $2');
    const m = moment(fixed, ['MMM DD YYYY hh:mm A', 'MMM D YYYY hh:mm A', moment.ISO_8601], true);
    if (m.isValid()) {
      return { date: m.format('DD MMM, YYYY'), time: m.format('hh:mm A') };
    }
    const loose = moment(fixed);
    if (loose.isValid()) {
      return { date: loose.format('DD MMM, YYYY'), time: loose.format('hh:mm A') };
    }
    return { date: fixed, time: '' };
  };

  formatApprovalDate = (raw) => {
    if (!raw) return { date: '', time: '' };
    return this.parseSubmittedDate(raw);
  };

  money = (v) => {
    if (v === undefined || v === null) return '';
    const s = String(v);
    if (s.endsWith('.00')) return s.replace('.00', '');
    return s;
  };

  // Tab filter kept client-side; text search now hits the API.
  filterList = () => {
    const { list, activeTab } = this.state;
    return (Array.isArray(list) ? list : []).filter((it) => {
      const tab = this.mapTabFromStatus(this.getSettlementStatus(it));
      return activeTab === 'all' ? true : tab === activeTab;
    });
  };

  onSearchChange = (text) => {
    this.setState({ search: text });
    if (this._searchTimer) clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => this.fetchHistory(), 400);
  };

  clearSearch = () => {
    if (this._searchTimer) clearTimeout(this._searchTimer);
    this.setState({ search: '' }, () => this.fetchHistory());
  };

  openDetail = (item) => {
    const settlementId = item?.id != null ? String(item.id).trim() : '';
    if (!settlementId) {
      Toast.show('Settlement ID nahi mila', Toast.SHORT);
      return;
    }
    this.props.navigation.navigate('SettlementDetail', { settlementId, preview: item });
  };

  switchTab = (key) => {
    if (key === this.state.activeTab) return;
    this.setState({ activeTab: key }, () => this.fetchHistory());
  };

  orderLineSummary = (orders) => {
    if (!orders.length) return '';
    const o = orders[0] || {};
    const farmer = String(o?.farmer_name || '').trim();
    const code = String(o?.order_code || '').trim();
    const mode = String(o?.payment_mode || '').trim();
    const lead = [farmer, code, mode].filter(Boolean).join(' · ');
    if (orders.length <= 1) return lead;
    return lead ? `${lead} +${orders.length - 1}` : `${orders.length} orders`;
  };

  renderRow = ({ item }) => {
    const settlementId = item?.settlement_id || '';
    const status = this.getSettlementStatus(item);
    const meta = this.statusMeta(status);
    const amountStr = this.money(item?.amount);
    const { date: dateStr, time: timeStr } = this.parseSubmittedDate(item?.submitted_date || item?.created_at);
    const type = this.typeLabel(item?.type, item?.selected_bank);
    const receipt = String(item?.reciept || item?.receipt || '').trim();
    const { date: approvedDate, time: approvedTime } = this.formatApprovalDate(item?.approval_date || item?.verify_date);
    const hasApproved = !!(item?.approval_date || item?.verify_date);
    const comment = String(item?.dispute_comment || item?.comment || '').trim();
    const orders = this.getOrders(item);
    const orderLine = this.orderLineSummary(orders);
    const when = [dateStr, timeStr].filter(Boolean).join(' · ');
    const subMeta = [when, type, orders.length ? `${orders.length} order${orders.length > 1 ? 's' : ''}` : '']
      .filter(Boolean)
      .join(' · ');

    return (
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => this.openDetail(item)}
        style={[styles.card, { borderLeftColor: meta.bar }]}
      >
        <View style={styles.cardBody}>
          <View style={styles.cardTopRow}>
            <View style={styles.cardMain}>
              <View style={styles.cardHead}>
                <Text style={styles.settlementId} numberOfLines={1}>{settlementId || '-'}</Text>
                <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                  <Text style={[styles.statusText, { color: meta.text }]}>{meta.label}</Text>
                </View>
              </View>
              {!!subMeta ? <Text style={styles.subMeta} numberOfLines={1}>{subMeta}</Text> : null}
              {!!orderLine ? <Text style={styles.orderLine} numberOfLines={1}>{orderLine}</Text> : null}
            </View>
            <View style={styles.cardRight}>
              <Text style={styles.amount}>₹{amountStr || '0'}</Text>
              {!!receipt ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => this.openReceiptPreview(receipt)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Image source={{ uri: receipt }} style={styles.proofMini} resizeMode="cover" />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {!!receipt ? (
            <TouchableOpacity
              activeOpacity={0.82}
              onPress={() => this.openReceiptPreview(receipt)}
              style={styles.proofRow}
            >
              <Text style={styles.proofText}>Payment proof</Text>
              <Text style={styles.proofChev}>›</Text>
            </TouchableOpacity>
          ) : null}

          {!!comment ? <Text style={styles.commentText} numberOfLines={2}>{comment}</Text> : null}

          {hasApproved ? (
            <Text style={styles.approvedText}>
              Approved · {approvedDate}{approvedTime ? `, ${approvedTime}` : ''}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  renderTabs = () => {
    const { activeTab, counts } = this.state;
    return (
      <View style={styles.tabRow}>
        {TABS.map((t) => {
          const isActive = activeTab === t.key;
          const count = counts[t.key] ?? 0;
          return (
            <TouchableOpacity
              key={t.key}
              activeOpacity={0.85}
              onPress={() => this.switchTab(t.key)}
              style={[styles.tabChip, isActive && styles.tabChipOn]}
            >
              <Text style={[styles.tabChipLbl, isActive && styles.tabChipLblOn]}>{t.label}</Text>
              <View style={[styles.tabChipBadge, isActive && styles.tabChipBadgeOn]}>
                <Text style={[styles.tabChipBadgeT, isActive && styles.tabChipBadgeTOn]}>{count}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  renderHeaderBlock = () => {
    const { search } = this.state;
    return (
      <View style={styles.headerBlock}>
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={this.goBack} style={styles.backBtn} activeOpacity={0.8}>
              <Image source={require('./assets/back.png')} style={styles.backIco} />
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>Settlement History</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.headerSearch}>
            <Image style={styles.searchImg} source={require('./assets/search.png')} />
            <TextInput
              value={search}
              onChangeText={this.onSearchChange}
              placeholder="Search ID or amount..."
              placeholderTextColor="rgba(255,255,255,0.55)"
              style={styles.searchInput}
              returnKeyType="search"
              onSubmitEditing={this.fetchHistory}
            />
            {!!search ? (
              <TouchableOpacity onPress={this.clearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.clearSearch}>✕</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {this.renderTabs()}
        </SafeAreaView>
      </View>
    );
  };

  renderEmpty = () => {
    const { loading, refreshing, activeTab } = this.state;
    if (loading && !refreshing) return null;
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconWrap}>
          <Image source={require('./assets/purse.png')} style={styles.emptyIcon} />
        </View>
        <Text style={styles.emptyTitle}>No settlements yet</Text>
        <Text style={styles.emptySubtitle}>
          {activeTab === 'all'
            ? 'Your settlements will appear here once submitted.'
            : `No ${activeTab === 'success' ? 'settled' : activeTab} settlements right now.`}
        </Text>
      </View>
    );
  };

  render() {
    const { loading, submitting, pickerVisible, confirmVisible, selectedImage, refreshing, receiptPreview } = this.state;
    const rows = this.filterList();

    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={P} />

        {this.renderHeaderBlock()}

        <View style={styles.bodySafe}>
          {loading && !refreshing ? (
            <View style={styles.loaderWrap}>
              <ActivityIndicator size="small" color={P} />
            </View>
          ) : (
            <FlatList
              data={rows}
              keyExtractor={(item, i) => String(item?.settlement_id || item?.id || i)}
              renderItem={this.renderRow}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              ListEmptyComponent={this.renderEmpty}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={this.onRefresh} colors={[P]} tintColor={P} />
              }
            />
          )}

          <View style={styles.footerWrap}>
            <Text style={styles.noteText}>Verification by Gramik Finance team takes up to 24 hours</Text>
            <SafeAreaView edges={safeBottomEdges()} style={{ backgroundColor: S.BG }} />
          </View>
        </View>

        <ProofImageViewer
          visible={!!receiptPreview}
          uri={receiptPreview}
          title="Payment receipt"
          onClose={this.closeReceiptPreview}
        />

        {/* Picker Modal (iOS-safe, no touch bubbling) */}
        <Modal visible={pickerVisible} transparent animationType="fade" onRequestClose={this.closePicker}>
          <Pressable style={styles.modalBackdrop} onPress={this.closePicker}>
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <Text style={styles.modalTitle}>Upload Screenshot</Text>

              <TouchableOpacity activeOpacity={0.9} onPress={this.pickFromCamera} style={styles.modalBtn}>
                <Text style={styles.modalBtnText}>Camera</Text>
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.9} onPress={this.pickFromGallery} style={styles.modalBtn}>
                <Text style={styles.modalBtnText}>Gallery</Text>
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.9} onPress={this.closePicker} style={styles.modalCancelBtn}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Confirm Modal (same safe structure) */}
        <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={this.cancelConfirm}>
          <Pressable style={styles.modalBackdrop} onPress={this.cancelConfirm}>
            <Pressable style={styles.confirmCard} onPress={() => {}}>
              <Text style={styles.modalTitle}>Confirm Screenshot</Text>

              {!!selectedImage?.uri ? (
                <Image source={{ uri: selectedImage.uri }} style={styles.previewImg} resizeMode="cover" />
              ) : null}

              <TouchableOpacity
                activeOpacity={0.9}
                onPress={this.onSubmitForVerification}
                style={[styles.confirmBtn, submitting ? { opacity: 0.75 } : null]}
                disabled={submitting}
              >
                {!submitting ? (
                  <Text style={styles.confirmBtnText}>Confirm & Send</Text>
                ) : (
                  <ActivityIndicator size="small" color="#FFF" />
                )}
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.9} onPress={this.cancelConfirm} style={styles.modalCancelBtn}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SCREEN_BG },

  headerBlock: { backgroundColor: P },
  headerSafe: { backgroundColor: P, paddingBottom: 10 },
  headerRow: {
    height: 56,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  backIco: { width: 17, height: 17, resizeMode: 'contain', tintColor: '#FFF' },
  headerTitle: { flex: 1, textAlign: 'center', color: '#FFF', fontSize: 16, fontWeight: '600' },
  headerSpacer: { width: 44, height: 40 },
  headerSearch: {
    marginHorizontal: 14,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchImg: { width: 15, height: 15, resizeMode: 'contain', marginRight: 8, tintColor: 'rgba(255,255,255,0.75)' },
  searchInput: { flex: 1, fontSize: 13.5, fontWeight: '400', color: '#FFF', paddingVertical: 0 },
  clearSearch: { fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '500', paddingLeft: 6 },

  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingTop: 10,
    gap: 6,
  },
  tabChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    gap: 4,
  },
  tabChipOn: {
    backgroundColor: '#FFF',
    borderColor: '#FFF',
  },
  tabChipLbl: { fontSize: 10.5, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  tabChipLblOn: { color: P },
  tabChipBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabChipBadgeOn: { backgroundColor: S.P_SOFT },
  tabChipBadgeT: { fontSize: 9, fontWeight: '700', color: '#FFF' },
  tabChipBadgeTOn: { color: P },

  bodySafe: { flex: 1 },
  listContent: { paddingHorizontal: LIST_PAD, paddingTop: 10, paddingBottom: 16, flexGrow: 1 },

  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },

  emptyState: { paddingVertical: 52, paddingHorizontal: 24, alignItems: 'center' },
  emptyIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: S.P_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: S.P_GLOW,
  },
  emptyIcon: { width: 30, height: 30, resizeMode: 'contain', tintColor: P },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: S.TXT, marginBottom: 5 },
  emptySubtitle: { fontSize: 12.5, fontWeight: '400', color: S.MUTED, textAlign: 'center', lineHeight: 18, maxWidth: 280 },

  card: {
    backgroundColor: S.CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8ECF1',
    borderLeftWidth: 4,
    overflow: 'hidden',
  },
  cardBody: { paddingHorizontal: 10, paddingVertical: 9 },
  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardMain: { flex: 1, minWidth: 0 },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  settlementId: { flex: 1, fontSize: 13, fontWeight: '700', color: S.TXT },
  statusPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  statusText: { fontSize: 9.5, fontWeight: '600' },
  subMeta: { fontSize: 10.5, fontWeight: '400', color: S.MUTED, marginTop: 3 },
  orderLine: { fontSize: 11, fontWeight: '500', color: S.SUB, marginTop: 2 },

  cardRight: { alignItems: 'flex-end', gap: 6 },
  amount: { fontSize: 16, fontWeight: '800', color: S.GREEN_DARK },
  proofMini: { width: 28, height: 28, borderRadius: 6, backgroundColor: S.BG },

  proofRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 7,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E8ECF1',
  },
  proofText: { flex: 1, fontSize: 11, fontWeight: '500', color: S.SUB },
  proofChev: { fontSize: 14, color: S.MUTED },

  commentText: { marginTop: 6, fontSize: 11, fontWeight: '400', color: S.ORANGE, lineHeight: 15 },
  approvedText: { marginTop: 6, fontSize: 10, fontWeight: '600', color: S.GREEN_DARK },

  footerWrap: {
    backgroundColor: SCREEN_BG,
    paddingHorizontal: LIST_PAD,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 2 : 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: S.BORDER,
  },
  noteText: { fontSize: 11.5, fontWeight: '400', color: S.MUTED, textAlign: 'center', lineHeight: 16 },

  // Modals
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E6EAF0',
    padding: 14,
  },
  confirmCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E6EAF0',
    padding: 14,
  },
  modalTitle: { fontSize: 14, fontWeight: '600', color: '#111827', textAlign: 'center', marginBottom: 12 },
  modalBtn: {
    height: 44,
    borderRadius: 12,
    backgroundColor: '#E7FAF3',
    borderWidth: 1,
    borderColor: '#D6F3E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  modalBtnText: { fontSize: 13, fontWeight: '600', color: '#0F7451' },
  modalCancelBtn: { paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  modalCancelText: { fontSize: 13, fontWeight: '600', color: '#111827' },

  previewImg: {
    width: '100%',
    height: Math.min(260, width * 0.65),
    borderRadius: 12,
    backgroundColor: '#F3F5F7',
    marginBottom: 12,
  },
  confirmBtn: {
    height: 44,
    borderRadius: 12,
    backgroundColor: '#1C8A62',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  confirmBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
export default withV4Navigation(SettlementHistory);
