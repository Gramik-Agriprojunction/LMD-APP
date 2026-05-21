// CashSettlement.js
// ✅ Preserves your current design (hero + pills + cards)
// ✅ No dummy/static data
// ✅ Banks vertical list; upload + preview ONLY for selected bank
// ✅ UPI: Pay Now + Upload Screenshot + preview
// ✅ Submit: constants.confirmSettle (order_ids[], type, bank_list_id) + sends ONLY relevant proof
// ⚠️ Pay Now requires API key: checkSettle.data.upi_vpa (not in your sample response)

import React, { Component } from 'react';
import { withV4Navigation } from "../utils/v4Compat";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Image,
  ScrollView,
  Platform,
  Modal,
  ActivityIndicator,
  InteractionManager,
  Linking,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import constants from '../utils/constants';
import Toast from 'react-native-simple-toast';
import { invalidateSettlementRelated } from '../utils/dataCache';
let ImageCropPicker = null;
try { ImageCropPicker = require('react-native-image-crop-picker').default || require('react-native-image-crop-picker'); } catch(e) { console.log('ImageCropPicker not available'); }
import moment from 'moment';


const THEME = {
  green: '#5D3FD3',
  greenDark: '#5D3FD3',
  greenPill: '#5D3FD3',
  bg: '#F0F3F8',
  card: '#FFFFFF',
  border: '#E2E8F0',
  text: '#1E293B',
  subText: '#64748B',
  orange: '#F37A20',
  soft: '#EEF2FF',
  pillBg: '#EEF2FF',
  pillBorder: '#C7D2FE',
  radioBorder: '#CBD5E1',
  grayDot: '#36454F',
};


class CashSettlement extends Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: false,
      submitting: false,

      // ✅ checkSettle response
      checkData: null, // data object from API
      banks: [], // data["bank-list"]
      selectedBankId: null,

      // ✅ type selection
      selectedType: 'bank', // 'bank' | 'upi'

      // upload flow
      pickerVisible: false,
      confirmVisible: false,
      pickingFor: null, // 'upi' | 'bank'
      upiImage: null, // { uri, type, name }
      bankImage: null, // { uri, type, name }
    };
  }

  componentDidMount() {
    this.checkSettleApi();
  }

  wait = (ms) => new Promise((r) => setTimeout(r, ms));
pickLock = false;

  // navigation
  getSettlement = () => this.props?.navigation?.getParam?.('settlement', null);
  getSelectedOrders = () => this.props?.navigation?.getParam?.('selectedOrders', []);

  goBack = () => {
    const nav = this.props?.navigation;
    if (nav?.goBack) nav.goBack();
  };

  // helpers
  toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  money = (v) => {
    if (v === undefined || v === null || v === '') return '';
    const s = String(v);
    return s.endsWith('.00') ? s.replace('.00', '') : s;
  };

  formatDate = (iso) => {
    if (!iso) return '';
    const m = moment(iso);
    if (!m.isValid()) return '';
    return m.format('DD MMMM, YYYY');
  };

  formatTime = (iso) => {
    if (!iso) return '';
    const m = moment(iso);
    if (!m.isValid()) return '';
    return m.format('hh:mm A');
  };

  // ✅ checkSettle API (POST)
  checkSettleApi = () => {
    const orderIds = Array.isArray(this.getSelectedOrders()) ? this.getSelectedOrders() : [];

    // If coming from history screen, there may be settlement param and no selectedOrders.
    // In that case, we can't call checkSettle (needs order_ids). UI will show only what settlement param has.
    if (!orderIds.length) {
      return;
    }

    const body = { order_ids: orderIds.map((id) => String(id)) };

    this.setState({ loading: true }, () => {
      fetch(constants.checkSettle, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + global.token,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      })
        .then((r) => r.json())
        .then((json) => {
            console.log("Check Settle API response== ", JSON.stringify(json))
          const dataObj = json?.data && typeof json.data === 'object' ? json.data : null;

          // bank-list key has hyphen -> must access with bracket
          const bankList = Array.isArray(dataObj?.['bank-list']) ? dataObj['bank-list'] : [];

          this.setState({
            loading: false,
            checkData: dataObj,
            banks: bankList,
            selectedBankId: bankList?.[0]?.id ?? null, // ✅ first bank from API (not dummy)
          });
        })
        .catch((e) => {
          this.setState({ loading: false });
          Toast.show(e?.message || String(e), Toast.SHORT);
        });
    });
  };

  // --------- Upload UI flow ----------
  openPicker = (forType) => {
    this.setState({
      pickerVisible: true,
      pickingFor: forType,
      selectedType: forType === 'upi' ? 'upi' : 'bank',
    }, () => {
      console.log('Open picker for:', forType);
    });
  };

  closePicker = () => this.setState({ pickerVisible: false });

  cancelConfirm = () => this.setState({ confirmVisible: false, pickingFor: null,pickerVisible : false });

 pickImage = async (source) => {
  if (this.pickLock) return;
  this.pickLock = true;

  if (!ImageCropPicker) {
    this.pickLock = false;
    this.setState({ pickerVisible: false });
    Toast.show('Image picker not available on this device', Toast.SHORT);
    return;
  }

  const pickingForNow = this.state.pickingFor;

  this.setState({ pickerVisible: false }, async () => {
    try {
      await this.wait(Platform.OS === 'ios' ? 700 : 300);

      try { if (ImageCropPicker.clean) await ImageCropPicker.clean(); } catch (e) {}

      const opts = { mediaType: 'photo', cropping: false, compressImageQuality: 0.85, forceJpg: true };
      let img = null;

      try {
        img = source === 'camera' ? await ImageCropPicker.openCamera(opts) : await ImageCropPicker.openPicker(opts);
      } catch (pickErr) {
        const msg = String(pickErr?.message || '').toLowerCase();
        if (!msg.includes('cancel')) Toast.show(pickErr?.message || 'Unable to pick image', Toast.SHORT);
        return;
      }

      if (!img?.path) return;

      const file = {
        uri: img.path,
        type: img?.mime || 'image/jpeg',
        name: img?.filename || `${source}_${Date.now()}.jpg`,
      };

      if (pickingForNow === 'upi') this.setState({ upiImage: file, confirmVisible: true });
      if (pickingForNow === 'bank') this.setState({ bankImage: file, confirmVisible: true });
    } catch (e) {
      console.log('pickImage error:', e);
      Toast.show('Something went wrong', Toast.SHORT);
    } finally {
      setTimeout(() => { this.pickLock = false; }, Platform.OS === 'ios' ? 800 : 400);
    }
  });
};

  // ✅ UPI Pay Now (requires API key: checkSettle.data.upi_vpa)
  onPayNow = async () => {
    const { checkData } = this.state;

    const pa = String(checkData?.upi_vpa || '').trim(); // REQUIRED from API
    const pn = String(checkData?.upi_name || 'Gramik').trim(); // optional
    const tn = String(checkData?.upi_note || 'Cash Settlement').trim(); // optional
    const amt = this.money(checkData?.total_amount);

    if (!pa || !amt) {
      Toast.show('UPI payment details not available', Toast.SHORT);
      return;
    }

    this.setState({ selectedType: 'upi' });

    const url =
      `upi://pay?pa=${encodeURIComponent(pa)}` +
      `&pn=${encodeURIComponent(pn)}` +
      `&am=${encodeURIComponent(String(amt))}` +
      `&cu=INR` +
      `&tn=${encodeURIComponent(tn)}`;

    try {
      await Linking.openURL(url);
    } catch (e) {
      Toast.show('Unable to open UPI app', Toast.SHORT);
    }
  };

  // ✅ Submit using confirmSettle API
  onSubmit = () => {
    const orderIds = Array.isArray(this.getSelectedOrders()) ? this.getSelectedOrders() : [];
    const { selectedType, selectedBankId, upiImage, bankImage } = this.state;

    if (!orderIds.length) {
      Toast.show('Order ids missing', Toast.SHORT);
      return;
    }

    if (selectedType === 'upi') {
      if (!upiImage?.uri) {
        Toast.show('Please upload UPI screenshot', Toast.SHORT);
        return;
      }
    }

    if (selectedType === 'bank') {
      if (!selectedBankId) {
        Toast.show('Please select bank', Toast.SHORT);
        return;
      }
      if (!bankImage?.uri) {
        Toast.show('Please upload bank receipt', Toast.SHORT);
        return;
      }
    }

    const fd = new FormData();
    orderIds.forEach((id, i) => fd.append(`order_ids[${i}]`, String(id)));
    fd.append('type', selectedType);

    if (selectedType === 'bank') fd.append('bank_list_id', String(selectedBankId));

    // ONLY relevant proof
    if (selectedType === 'upi') {
      fd.append('reciept', { uri: upiImage.uri, type: upiImage.type, name: upiImage.name });
    }
    if (selectedType === 'bank') {
      fd.append('reciept', { uri: bankImage.uri, type: bankImage.type, name: bankImage.name });
    }

    console.log("Confirm Settle API payload== ",JSON.stringify(fd))

    this.setState({ submitting: true }, () => {
      fetch(constants.confirmSettle, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + global.token,
          Accept: 'application/json',
        },
        body: fd,
      })
        .then((r) => r.json())
        .then((json) => {
             Toast.show(json?.message, Toast.SHORT);
            if(json.status)
            {
                    // Settlement made → invalidate dashboard, settlements, settlement history, earnings caches
                    invalidateSettlementRelated();
                    this.setState({ submitting: false, confirmVisible: false, pickingFor: null });
                    this.props.navigation.navigate('SettlementHistory')
            }
        })
        .catch((e) => {
          this.setState({ submitting: false });
          Toast.show(e?.message || String(e), Toast.SHORT);
        });
    });
  };

  onCallSupport = () => {
    const s = this.getSettlement();
    const { checkData } = this.state;

    // Use whichever is available from API; no dummy
    const phone = String(
      s?.support_phone ||
        s?.lmd_phone ||
        s?.phone ||
        checkData?.support_phone ||
        checkData?.helpline ||
        ''
    ).trim();

    if (!phone) {
      Toast.show('Support number not available', Toast.SHORT);
      return;
    }
    const url = `tel:${String(phone).replace(/\s/g, '')}`;
    Linking.openURL(url).catch(() => Toast.show('Unable to call', Toast.SHORT));
  };

  renderBankRow = (b) => {
    const selected = String(this.state.selectedBankId) === String(b?.id);
    const bankName = String(b?.bank_name || '').trim();
    const acc = String(b?.account_no || '').trim();
    const ifsc = String(b?.ifsc_code || '').trim();

    if (!bankName && !acc && !ifsc) return null;

    return (
      <TouchableOpacity
        key={String(b?.id)}
        activeOpacity={0.9}
        onPress={() => this.setState({ selectedBankId: b?.id, selectedType: 'bank' })}
        style={[styles.bankPickRow, selected ? styles.bankPickRowOn : null]}
      >
        <View style={[styles.radio, selected ? styles.radioOn : null]}>{selected ? <View style={styles.radioDot} /> : null}</View>

        <View style={{ flex: 1 }}>
          {!!bankName ? <Text style={styles.bankPickTitle}>{bankName}</Text> : null}
          {!!acc ? <Text style={styles.bankPickSub}>{`A/C: ${acc}`}</Text> : null}
          {!!ifsc ? <Text style={styles.bankPickSub}>{`IFSC: ${ifsc}`}</Text> : null}
        </View>
      </TouchableOpacity>
    );
  };

  render() {
    const s = this.getSettlement();
    const orderIds = Array.isArray(this.getSelectedOrders()) ? this.getSelectedOrders() : [];

    const { loading, submitting, checkData, banks, pickerVisible, confirmVisible, pickingFor, upiImage, bankImage } =
      this.state;

    // ✅ Amount & count: prefer checkSettle API, else settlement param, else selectedOrders count
    const amountStr = this.money(checkData?.total_amount) || this.money(s?.amount) || '';

    const orderCount =
      this.toNum(checkData?.total_order_count) ||
      this.toNum(s?.total_order_count) ||
      (orderIds.length ? orderIds.length : 0);

    // ✅ LMD / Farmer: from API farmer; else from settlement if available
    const farmer = checkData?.farmer || s?.farmer || null;
    const farmerName = String(farmer?.name || '').trim();
    const farmerPhone = String(farmer?.phone || '').trim();
    const farmerImg = String(farmer?.image || '').trim();

    // Collection date/time only if settlement has it (checkSettle sample doesn't)
    const createdAt = s?.created_at || null;
    const dateStr = this.formatDate(createdAt);
    const timeStr = this.formatTime(createdAt);

    const previewUri = pickingFor === 'upi' ? upiImage?.uri : pickingFor === 'bank' ? bankImage?.uri : null;

    const supportPhone = String(checkData?.support_phone || '').trim();

    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={THEME.green} />

        {/* Header */}
        <View style={styles.headerWrap}>
          <SafeAreaView edges={['top']} style={styles.headerSafe}>
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={this.goBack} style={styles.headerIconBtn} activeOpacity={0.85}>
                <Image style={styles.backImg} source={require('./assets/back.png')} />
              </TouchableOpacity>
              <Text style={styles.headerTitle} numberOfLines={1}>Cash Settlement</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {!!supportPhone ? (
                  <>
                    <TouchableOpacity onPress={() => { Linking.openURL(`tel:${supportPhone}`).catch(() => {}); }} activeOpacity={0.7} hitSlop={{top:8,bottom:8,left:8,right:8}}>
                      <Image source={require('./assets/call.png')} style={{ width: 28, height: 28, resizeMode: 'contain' }} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { Linking.openURL(`https://wa.me/${supportPhone.replace(/[^\d]/g,'')}`).catch(() => {}); }} activeOpacity={0.7} hitSlop={{top:8,bottom:8,left:8,right:8}} style={{ marginLeft: 8 }}>
                      <Image source={require('./assets/whatsapp.png')} style={{ width: 28, height: 28, resizeMode: 'contain' }} />
                    </TouchableOpacity>
                  </>
                ) : <View style={{ width: 42 }} />}
              </View>
            </View>
          </SafeAreaView>
        </View>

        <View style={{ flex: 1 }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {loading ? <ActivityIndicator size="large" color={THEME.green} style={{ marginTop: 40 }} /> : (
              <>
                {/* Amount hero */}
                <View style={styles.heroCard}>
                  <Text style={styles.heroLabel}>Settlement Amount</Text>
                  <Text style={styles.heroAmt}>{'₹'}{amountStr || '0'}</Text>
                  <Text style={styles.heroSub}>{orderCount || 0} order(s) selected</Text>

                  {!!farmerName ? (
                    <View style={styles.lmdPill}>
                      <View style={styles.lmdAvatar}>
                        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 11 }}>{(farmerName || 'L').charAt(0).toUpperCase()}</Text>
                      </View>
                      <Text style={styles.lmdText} numberOfLines={1}>{farmerName}</Text>
                      {!!farmerPhone ? <Text style={styles.lmdPhone}>{farmerPhone}</Text> : null}
                    </View>
                  ) : null}

                  <Text style={styles.heroHint}>Upload proof via UPI or bank deposit slip</Text>
                </View>

                {/* UPI Upload */}
                <View style={styles.sectionCard}>
                  <View style={styles.sectionHead}>
                    <Text style={styles.sectionTitle}>UPI Screenshot</Text>
                    {!!upiImage?.uri ? <View style={styles.uploadedBadge}><Text style={styles.uploadedBadgeT}>Uploaded</Text></View> : null}
                  </View>

                  {!!upiImage?.uri ? (
                    <Image source={{ uri: upiImage.uri }} style={styles.previewImgInline} resizeMode="cover" />
                  ) : null}

                  <TouchableOpacity style={styles.uploadBtn} onPress={() => this.openPicker('upi')} activeOpacity={0.85}>
                    <Image style={styles.camIcon} source={require('./assets/cam.png')} />
                    <Text style={styles.uploadBtnText}>{upiImage?.uri ? 'Re-upload' : 'Upload UPI Screenshot'}</Text>
                  </TouchableOpacity>
                </View>

                {/* Bank Receipt */}
                <View style={styles.sectionCard}>
                  <View style={styles.sectionHead}>
                    <Text style={styles.sectionTitle}>Bank Receipt</Text>
                    {!!bankImage?.uri ? <View style={styles.uploadedBadge}><Text style={styles.uploadedBadgeT}>Uploaded</Text></View> : null}
                  </View>

                  {Array.isArray(banks) && banks.length ? banks.map((b) => this.renderBankRow(b)) : null}

                  {!!bankImage?.uri ? (
                    <Image source={{ uri: bankImage.uri }} style={styles.previewImgInline} resizeMode="cover" />
                  ) : null}

                  <TouchableOpacity style={[styles.uploadBtn, { backgroundColor: '#F1F5F9' }]} onPress={() => this.openPicker('bank')} activeOpacity={0.85}>
                    <Image style={[styles.camIcon, { tintColor: '#475569' }]} source={require('./assets/cam.png')} />
                    <Text style={[styles.uploadBtnText, { color: '#475569' }]}>{bankImage?.uri ? 'Re-upload' : 'Upload Bank Receipt'}</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ height: 120 }} />
              </>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footerWrap}>
            <Text style={styles.noteText}>Verification by Gramik Finance team takes up to 24 hours</Text>
            <TouchableOpacity activeOpacity={0.85} onPress={this.onSubmit} style={[styles.submitBtn, submitting ? { opacity: 0.6 } : null]} disabled={submitting}>
              {!submitting ? <Text style={styles.submitText}>Submit for Verification</Text> : <ActivityIndicator size="small" color="#FFF" />}
            </TouchableOpacity>
          </View>
        </View>

        {/* Picker Modal */}
        <Modal visible={pickerVisible} transparent animationType="fade" onRequestClose={this.closePicker}>
  <View style={styles.modalBackdrop}>
    <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={this.closePicker} />

    <View style={styles.modalCard}>
      <Text style={styles.modalTitle}>
        {this.state.pickingFor === 'bank' ? 'Upload Bank Receipt' : 'Upload UPI Screenshot'}
      </Text>

      <TouchableOpacity activeOpacity={0.9} onPress={() => this.pickImage('camera')} style={styles.modalBtn}>
        <Text style={styles.modalBtnText}>Camera</Text>
      </TouchableOpacity>

      <TouchableOpacity activeOpacity={0.9} onPress={() => this.pickImage('gallery')} style={styles.modalBtn}>
        <Text style={styles.modalBtnText}>Gallery</Text>
      </TouchableOpacity>

      <TouchableOpacity activeOpacity={0.9} onPress={this.closePicker} style={styles.modalCancelBtn}>
        <Text style={styles.modalCancelText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>

        {/* Confirm Modal */}
        <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={this.cancelConfirm}>
          <TouchableOpacity activeOpacity={1} onPress={this.cancelConfirm} style={styles.modalBackdrop}>
            <TouchableOpacity activeOpacity={1} style={styles.confirmCard}>
              <Text style={styles.modalTitle}>Confirm Upload</Text>

              {!!previewUri ? <Image source={{ uri: previewUri }} style={styles.previewImg} resizeMode="contain" /> : null}

              <TouchableOpacity activeOpacity={0.9} onPress={() => this.setState({ confirmVisible: false, pickingFor: null })} style={styles.confirmBtn}>
                <Text style={styles.confirmBtnText}>Looks Good</Text>
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.9} onPress={this.cancelConfirm} style={styles.modalCancelBtn}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: THEME.bg },

  // Header
  headerWrap: { backgroundColor: THEME.green },
  headerSafe: { backgroundColor: THEME.green },
  headerRow: { height: 56, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  headerIconBtn: { width: 42, height: 42, justifyContent: 'center', alignItems: 'center' },
  backImg: { width: 24, height: 24, resizeMode: 'contain', tintColor: '#FFF' },
  headerTitle: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 15, fontWeight: '800' },

  bodySafe: { flex: 1, backgroundColor: THEME.bg },
  scrollContent: { paddingHorizontal: 10, paddingTop: 10, paddingBottom: 170 },

  // Hero card
  heroCard: {
    backgroundColor: '#5D3FD3',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  heroLabel: { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.5)', marginBottom: 4 },
  heroAmt: { fontSize: 38, fontWeight: '800', color: '#FFF' },
  heroSub: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  heroHint: { fontSize: 11, fontWeight: '400', color: 'rgba(255,255,255,0.4)', marginTop: 14 },

  collectionPill: {
    marginTop: 10,
    backgroundColor: '#E9EFEA',
    borderWidth: 1,
    borderColor: '#D8E6DE',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  collectionText: { fontSize: 13, fontWeight: '700', color: THEME.text },
  collectionStrong: { fontWeight: '900', color: THEME.text },
  collectionDot: { color: THEME.orange, fontWeight: '900' },

  lmdPill: {
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
  },
  lmdAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  lmdAvatarImg: { width: 30, height: 30, resizeMode: 'cover' },
  lmdText: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '600' },
  lmdPhone: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '400', marginLeft: 6 },

  sectionCard: {
    marginTop: 10,
    backgroundColor: THEME.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: 14,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: THEME.text },
  uploadedBadge: { backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  uploadedBadgeT: { fontSize: 10, fontWeight: '700', color: '#16A34A' },
  uploadBtn: { height: 44, borderRadius: 10, backgroundColor: '#16A34A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  uploadBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },

  innerCard: {
    marginTop: 10,
    borderRadius: 10,
    backgroundColor: '#F7FAFB',
    borderWidth: 1,
    borderColor: '#EEF2F6',
    padding: 12,
  },
  innerTopRow: { flexDirection: 'row', alignItems: 'center' },
  innerTitle: { flex: 1, fontSize: 12, fontWeight: '500', color: '#000' },
  innerAmt: { fontSize: 16, fontWeight: '800', color: '#16A34A' },
  tickImg: { width: 22, height: 22, resizeMode: 'contain',marginLeft:10 },

  bigUploadBtn: {
    backgroundColor: '#5D3FD3',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:'center'
  },
  camIcon: { width: 18, height: 18, resizeMode: 'contain', tintColor: '#fff', marginRight: 5},
  bigUploadText: { color: '#fff', fontSize: 12, fontWeight: '500' },

  previewImgInline: {
    width: '100%',
    height: Math.min(220, Dimensions.get('window').width * 0.55),
    borderRadius: 10,
    backgroundColor: THEME.bg,
    marginTop: 10,
  },

  // Bank list row
  bankPickRow: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: '#fff',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bankPickRowOn: { borderColor: THEME.greenDark, backgroundColor: THEME.soft },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: THEME.radioBorder,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: THEME.greenDark },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: THEME.greenDark },
  bankPickTitle: { fontSize: 13, fontWeight: '700', color: THEME.text },
  bankPickSub: { marginTop: 5, fontSize: 11, fontWeight: '600', color: THEME.subText },

  smallUploadBtn: {
    marginTop: 12,
    height: 42,
    borderRadius: 12,
    backgroundColor: THEME.greenDark,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  smallUploadText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  receiptBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: '#fff',
    padding: 10,
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptTitle: { fontSize: 13, fontWeight: '900', color: THEME.text, marginBottom: 8 },
  receiptImg: { width: '100%', height: 90, borderRadius: 10, backgroundColor: THEME.bg },
  receiptPlaceholder: { fontSize: 12, fontWeight: '600', color: THEME.subText, textAlign: 'center' },

  noteText: { fontSize: 11, fontWeight: '400', color: '#94A3B8', textAlign: 'center', marginBottom: 8 },

  // Footer
  footerWrap: {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: '#FFF',
  paddingHorizontal: 14,
  paddingTop: 10,
  paddingBottom: 34,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: -3 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 3,
},
  submitBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F37A20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Modals
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: 14,
  },
  confirmCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: 14,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#5D3FD3', textAlign: 'center', marginBottom: 14 },
  modalBtn: {
    height: 46,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  modalBtnText: { fontSize: 14, fontWeight: '700', color: '#5D3FD3' },
  modalCancelBtn: { paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  modalCancelText: { fontSize: 13, fontWeight: '800', color: THEME.text },

  previewImg: {
    width: '100%',
    height: Math.min(260, Dimensions.get('window').width * 0.65),
    borderRadius: 12,
    backgroundColor: THEME.bg,
    marginBottom: 12,
  },
  confirmBtn: {
    height: 44,
    borderRadius: 12,
    backgroundColor: THEME.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    width:'80%',
    alignSelf:'center'
  },
  confirmBtnText: { color: '#fff', fontSize: 13, fontWeight: '900' },
});
export default withV4Navigation(CashSettlement);
