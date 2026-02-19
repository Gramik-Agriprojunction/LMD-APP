import React, { Component } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Image,
  ScrollView,
  TextInput,
  Dimensions,
  ActivityIndicator,
  Platform,
  Modal,
  Pressable,
  InteractionManager,
} from 'react-native';
import constants from './constants';
import Toast from 'react-native-simple-toast';
import ImageCropPicker from 'react-native-image-crop-picker';
import moment from 'moment';

const { width } = Dimensions.get('window');
const CARD_RADIUS = 14;

export default class SettlementHistory extends Component {
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
      selectedImage: null, // { uri, type, name }
      selectedSettlementId: null, // settlement_id string (GMT00001)

      // debug only
      missingFields: [],
    };

    this._presentingPicker = false; // prevent double opens
  }

  componentDidMount() {
    this.fetchHistory();
  }

  goBack = () => {
    const nav = this.props?.navigation;
    if (nav?.goBack) nav.goBack();
  };

  // ======================
  // ✅ API: Settlement History
  // ======================
  fetchHistory = () => {
    this.setState({ loading: true, missingFields: [] }, () => {
      fetch(constants.settleHistory + '', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + global.token,
          Accept: 'application/json',
        },
      })
        .then((r) => r.json())
        .then((json) => {
          console.log('settlement history response== ', JSON.stringify(json));

          const rows = Array.isArray(json?.data) ? json.data : [];

          const lc = json?.list_count || {};
          const pending = Number(lc?.pending_count ?? 0) || 0;
          const success = Number(lc?.settled_count ?? 0) || 0;
          const dispute = Number(lc?.disputed_count ?? 0) || 0; // API uses disputed_count
          const all = Number(lc?.total ?? rows.length) || rows.length;

          // missing fields (debug only)
          const missing = [];
          rows.forEach((it) => {
            if (!it?.settlement_id) missing.push('data[].settlement_id');
            if (!it?.status) missing.push('data[].status');
            if (it?.amount === undefined || it?.amount === null) missing.push('data[].amount');
            if (!it?.type) missing.push('data[].type');
            if (!it?.created_at) missing.push('data[].created_at');
          });

          const uniqMissing = Array.from(new Set(missing));
          if (uniqMissing.length) console.log('SETTLEMENT HISTORY MISSING FIELDS =>', uniqMissing);

          this.setState({
            loading: false,
            list: rows,
            counts: { all, success, pending, dispute },
            missingFields: uniqMissing,
          });
        })
        .catch((e) => {
          console.log('settlement history error== ', e);
          Toast.show('Failed to load settlement history', Toast.SHORT);
          this.setState({ loading: false, list: [] });
        });
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
        Toast.show('Camera failed', Toast.SHORT);
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
        Toast.show('Gallery failed', Toast.SHORT);
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
          console.log('submit verification response== ', JSON.stringify(json));
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
          console.log('submit verification error== ', e);
          this.setState({ submitting: false });
          Toast.show('Submit failed', Toast.SHORT);
        });
    });
  };

  // ======================
  // Helpers
  // ======================
  normalizeStatus = (s) => String(s || '').toLowerCase();

  mapTabFromStatus = (status) => {
    const st = this.normalizeStatus(status);
    if (st.includes('success')) return 'success';
    if (st.includes('pending')) return 'pending';
    if (st.includes('dispute')) return 'dispute';
    // settled -> show in All
    return 'all';
  };

  statusPillStyle = (statusRaw) => {
    const st = this.normalizeStatus(statusRaw);
    if (st.includes('success')) return { bg: '#1C8A62', text: '#FFFFFF' };
    if (st.includes('pending')) return { bg: '#F4B740', text: '#111827' };
    if (st.includes('dispute')) return { bg: '#D64545', text: '#FFFFFF' };
    if (st.includes('settled')) return { bg: '#1C8A62', text: '#FFFFFF' };
    return { bg: '#9CA3AF', text: '#FFFFFF' };
  };

  formatDate = (iso) => {
    if (!iso) return '';
    const m = moment(iso);
    if (!m.isValid()) return '';
    return m.format('DD MMM, YYYY');
  };

  formatTime = (iso) => {
    if (!iso) return '';
    const m = moment(iso);
    if (!m.isValid()) return '';
    return m.format('hh:mm A');
  };

  money = (v) => {
    if (v === undefined || v === null) return '';
    const s = String(v);
    if (s.endsWith('.00')) return s.replace('.00', '');
    return s;
  };

  filterList = () => {
    const { list, activeTab, search } = this.state;
    const q = String(search || '').trim().toLowerCase();

    return (Array.isArray(list) ? list : []).filter((it) => {
      const tab = this.mapTabFromStatus(it?.status);
      const matchTab = activeTab === 'all' ? true : tab === activeTab;

      if (!q) return matchTab;

      const sid = String(it?.settlement_id || '').toLowerCase();
      const amt = String(it?.amount || '').toLowerCase();
      return matchTab && (sid.includes(q) || amt.includes(q));
    });
  };

  // ======================
  // Card UI (neat like screenshot)
  // ======================
  renderRow = (item, idx) => {
    const settlementId = item?.settlement_id || '';
    const statusRaw = item?.status || '';
    const status = statusRaw ? String(statusRaw).toUpperCase() : '';
    const pill = this.statusPillStyle(statusRaw);

    const amountStr = this.money(item?.amount);
    const dateStr = this.formatDate(item?.created_at);

    const type = item?.type ? String(item.type).toUpperCase() : '';

    const verifiedDate = this.formatDate(item?.verify_date);
    const verifiedTime = this.formatTime(item?.verify_date);
    const hasVerify = !!item?.verify_date;

    const comment = item?.comment ? String(item.comment).trim() : '';

    return (
      <View key={`${settlementId || idx}-${idx}`} style={styles.card}>
        <View style={styles.cardTop}>
          {!!settlementId ? (
            <Text style={styles.settlementLine} numberOfLines={1}>
                 ID : <Text style={styles.settlementId}>{settlementId}</Text>
            </Text>
          ) : (
            <View style={{ flex: 1 }} />
          )}

          {!!status ? (
            <View style={[styles.pill, { backgroundColor: pill.bg }]}>
              <Text style={[styles.pillText, { color: pill.text }]}>{status}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.secondLine}>
          <View style={styles.leftMiniIconWrap}>
            <Image style={styles.miniWalletImg} source={require('./assets/crn.png')} />
          </View>

          <View style={{ flex: 1 }}>
            {!!amountStr ? <Text style={styles.amountInline}>{`₹ ${amountStr}`}</Text> : null}
            {!!dateStr ? <Text style={styles.datePart}>{dateStr}</Text> : null}

            {!!type ? <Text style={styles.smallLineText}>{`${type} TRANSFER`}</Text> : null}

            {!!comment ? (
              <Text style={styles.commentText} numberOfLines={2}>
                {comment}
              </Text>
            ) : null}
          </View>
        </View>

        {hasVerify ? (
            <View style={{flexDirection:'row',marginTop:10}}>
                  <Image style={{width: 18, height: 18, resizeMode: 'contain',marginRight:5,alignSelf:'center'}} source={require('./assets/check.png')} />

                <Text style={styles.verifiedText} numberOfLines={1}>
                    {`Verified : ${verifiedDate}${verifiedTime ? `, ${verifiedTime}` : ''}`}
                </Text>
            </View>    
        ) : null}

        {/* <TouchableOpacity activeOpacity={0.9} onPress={() => this.openPicker(settlementId)} style={styles.uploadBtn}>
          <View style={styles.uploadRow}>
            <Image style={styles.camImg} source={require('./assets/cam.png')} />
            <Text style={styles.uploadBtnText}>Upload Screenshot</Text>
          </View>
        </TouchableOpacity> */}
      </View>
    );
  };

  render() {
    const { loading, submitting, activeTab, search, pickerVisible, confirmVisible, selectedImage, counts } = this.state;
    const rows = this.filterList();

    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="#1C8A62" />

        {/* Header */}
        <View style={styles.headerWrap}>
          <SafeAreaView style={styles.headerSafe}>
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={this.goBack} style={styles.headerIconBtn} activeOpacity={0.8}>
                <Image style={styles.backImg} source={require('./assets/back.png')} />
              </TouchableOpacity>

              <Text style={styles.headerTitle} numberOfLines={1}>
                Settlement History
              </Text>

              <View style={{ width: 42, height: 42 }} />
            </View>
          </SafeAreaView>
        </View>

        <SafeAreaView style={styles.bodySafe}>
          <View style={{ flex: 1 }}>
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Search */}
              <View style={styles.searchBox}>
                <Image style={styles.searchImg} source={require('./assets/search.png')} />
                <TextInput
                  value={search}
                  onChangeText={(t) => this.setState({ search: t })}
                  placeholder="Search Settlement ID / Amount..."
                  placeholderTextColor="#9CA3AF"
                  style={styles.searchInput}
                  returnKeyType="search"
                />
              </View>

              {/* Tabs */}
              <View style={styles.tabsRow}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => this.setState({ activeTab: 'all' },()=> this.fetchHistory())}
                  style={[styles.tab, activeTab === 'all' ? styles.tabAllActive : styles.tabSoftGreen]}
                >
                  <Text style={[styles.tabText, activeTab === 'all' ? styles.tabAllActiveText : styles.tabGreenText]}>
                    {`All (${counts.all})`}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => this.setState({ activeTab: 'success' },()=> this.fetchHistory())}
                  style={[styles.tab, activeTab === 'success' ? styles.tabGreenActive : styles.tabSoftGreen]}
                >
                  <Text style={[styles.tabText, activeTab === 'success' ? styles.tabActiveText : styles.tabGreenText]}>
                    {`Settled (${counts.success})`}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => this.setState({ activeTab: 'pending' },()=> this.fetchHistory())}
                  style={[styles.tab, activeTab === 'pending' ? styles.tabOrangeActive : styles.tabSoftGreen]}
                >
                  <Text style={[styles.tabText, activeTab === 'pending' ? styles.tabActiveText : styles.tabOrangeText]}>
                    {`Pending (${counts.pending})`}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => this.setState({ activeTab: 'dispute' },()=> this.fetchHistory())}
                  style={[styles.tab, activeTab === 'dispute' ? styles.tabRedActive : styles.tabSoftGreen]}
                >
                  <Text style={[styles.tabText, activeTab === 'dispute' ? styles.tabActiveText : styles.tabRedText]}>
                    {`Dispute (${counts.dispute})`}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* List */}
              {loading ? (
                <View style={{ paddingVertical: 18, marginTop: 150 }}>
                  <ActivityIndicator size="large" color="#1C8A62" />
                </View>
              ) : rows.length ? (
                rows.map(this.renderRow)
              ) : (
                <View style={{ paddingVertical: 80, alignItems: 'center' }}>
                  <Text style={{ color: '#6B7280', fontSize: 15, fontWeight: '400' }}>No settlements found</Text>
                </View>
              )}

              <View style={{ height: 120 }} />
            </ScrollView>

            {/* Fixed bottom */}
            <View style={styles.footerWrap}>
              <Text style={styles.noteText}>Note: Verification by Gramik Finance team takes up to 24 hours.</Text>

              {/* <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => {
                  if (!selectedImage?.uri) {
                    Toast.show('Upload screenshot from a settlement card', Toast.SHORT);
                    return;
                  }
                  this.setState({ confirmVisible: true });
                }}
                style={[styles.submitBtn, submitting ? { opacity: 0.75 } : null]}
                disabled={submitting}
              >
                {!submitting ? (
                  <Text style={styles.submitText}>SUBMIT FOR VERIFICATION</Text>
                ) : (
                  <ActivityIndicator size="small" color="#FFF" />
                )}
              </TouchableOpacity> */}

              <SafeAreaView style={{ backgroundColor: '#F3F5F7' }} />
            </View>
          </View>
        </SafeAreaView>

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
  root: { flex: 1, backgroundColor: '#F3F5F7' },

  headerWrap: { backgroundColor: '#1C8A62' },
  headerSafe: { backgroundColor: '#1C8A62' },
  headerRow: { height: 56, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  headerIconBtn: { width: 42, height: 42, justifyContent: 'center', alignItems: 'center' },
  backImg: { width: 25, height: 25, resizeMode: 'contain', tintColor: '#FFF' },
  headerTitle: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 14, fontWeight: '800' },

  bodySafe: { flex: 1, backgroundColor: '#F3F5F7' },
  scrollContent: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 16 },

  // Search
  searchBox: {
    height: 48,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E6EAF0',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchImg: { width: 18, height: 18, resizeMode: 'contain', marginRight: 10, tintColor: '#9CA3AF' },
  searchInput: { flex: 1, fontSize: 13, fontWeight: '500', color: '#111827' },

  // Tabs
  tabsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, marginBottom: 12 },
  tab: {
    flex: 1,
    height: 32,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
  },
  tabSoftGreen: { backgroundColor: '#E7FAF3', borderColor: '#D6F3E8' },
  tabAllActive: { backgroundColor: '#0F7451', borderColor: '#0F7451' },
  tabGreenActive: { backgroundColor: '#1C8A62', borderColor: '#1C8A62' },
  tabOrangeActive: { backgroundColor: '#F4B740', borderColor: '#F4B740' },
  tabRedActive: { backgroundColor: '#D64545', borderColor: '#D64545' },

  tabText: { fontSize: 11, fontWeight: '600' },
  tabAllActiveText: { color: '#FFFFFF' },
  tabActiveText: { color: '#FFFFFF' },
  tabGreenText: { color: '#0F7451' },
  tabOrangeText: { color: '#B7791F' },
  tabRedText: { color: '#B10000' },

  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius: CARD_RADIUS,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E6EAF0',
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settlementLine: { fontSize: 11, fontWeight: '700', color: '#111827', flex: 1, paddingRight: 8 },
  settlementId: { color: '#F37A20', fontWeight: '700', fontSize: 11,letterSpacing:.4 },

  pill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12 },
  pillText: { fontSize: 8, fontWeight: '700', letterSpacing: 0.2 },

  secondLine: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 10 },
  leftMiniIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 5,
    backgroundColor: '#E7FAF3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  miniWalletImg: { width: 38, height: 38, resizeMode: 'contain' },

  amountInline: { color: '#0F7451', fontWeight: '900', fontSize: 14 },
  datePart: { color: '#000', fontSize: 12, marginTop: 5, fontWeight: '400' },
  smallLineText: { fontSize: 11, fontWeight: '400', color: '#000', marginTop: 5 },

  commentText: { marginTop: 5, fontSize: 12, fontWeight: '600', color: '#F37A20' },

  verifiedText: { color: '#000', fontSize: 11, fontWeight: '700',alignSelf:'center' },

  uploadBtn: {
    marginTop: 12,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#2F7D67',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadRow: { flexDirection: 'row', alignItems: 'center' },
  camImg: { width: 18, height: 18, resizeMode: 'contain', tintColor: '#fff', marginRight: 10 },
  uploadBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Fixed bottom
  footerWrap: {
    backgroundColor: '#F3F5F7',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 6 : 10,
    borderTopWidth: 1,
    borderTopColor: '#E6EAF0',
  },
  noteText: { fontSize: 12, color: 'grey', textAlign: 'center' },
  submitBtn: {
    height: 45,
    width: '95%',
    alignSelf: 'center',
    borderRadius: 10,
    backgroundColor: '#F37A20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: { color: '#fff', fontSize: 12, fontWeight: '800' },

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