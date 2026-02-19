// CashSettlement.js
// ✅ Preserves your current design (hero + pills + cards)
// ✅ No dummy/static data
// ✅ Banks vertical list; upload + preview ONLY for selected bank
// ✅ UPI: Pay Now + Upload Screenshot + preview
// ✅ Submit: constants.confirmSettle (order_ids[], type, bank_list_id) + sends ONLY relevant proof
// ⚠️ Pay Now requires API key: checkSettle.data.upi_vpa (not in your sample response)

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
  Platform,
  Modal,
  ActivityIndicator,
  InteractionManager,
  Linking,
  Dimensions,
} from 'react-native';

import constants from './constants';
import Toast from 'react-native-simple-toast';
import ImageCropPicker from 'react-native-image-crop-picker';
import moment from 'moment';


const THEME = {
  green: '#1C8A62',
  greenDark: '#2F7D67',
  greenPill: '#0F7451',
  bg: '#F3F5F7',
  card: '#FFFFFF',
  border: '#E6EAF0',
  text: '#111827',
  subText: '#6B7280',
  orange: '#F37A20',
  soft: '#E7FAF3',
  pillBg: '#EAF4F0',
  pillBorder: '#CFE6DC',
  radioBorder: '#CBD5E1',
  grayDot: '#36454F',
};


export default class CashSettlement extends Component {
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

    const formData = new FormData();
    orderIds.forEach((id, i) => formData.append(`order_ids[${i}]`, String(id)));

    this.setState({ loading: true }, () => {
      fetch(constants.checkSettle, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + global.token,
          Accept: 'application/json',
        },
        body: formData,
      })
        .then((r) => r.json())
        .then((json) => {
            console.log("checkSettle response== ", JSON.stringify(json))
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
        .catch(() => {
          this.setState({ loading: false });
          Toast.show('Failed to load settlement info', Toast.SHORT);
        });
    });
  };

  // --------- Upload UI flow ----------
  openPicker = (forType) => {
    this.setState({
      pickerVisible: true,
      pickingFor: forType,
      selectedType: forType === 'upi' ? 'upi' : 'bank',
    });
  };

  closePicker = () => this.setState({ pickerVisible: false });

  cancelConfirm = () => this.setState({ confirmVisible: false, pickingFor: null,pickerVisible : false });

 pickImage = async (source) => {
  if (this.pickLock) return;           // ✅ prevent double trigger
  this.pickLock = true;

  const pickingForNow = this.state.pickingFor; // ✅ capture before setState

  this.setState({ pickerVisible: false }, async () => {
    try {
      await this.wait(Platform.OS === 'ios' ? 700 : 300);

      // ✅ close any previous session (helps iOS)
      if (ImageCropPicker?.clean) {
        try { await ImageCropPicker.clean(); } catch (e) {}
      }

      const img =
        source === 'camera'
          ? await ImageCropPicker.openCamera({
              mediaType: 'photo',
              cropping: false,
              compressImageQuality: 0.85,
              forceJpg: true,
            })
          : await ImageCropPicker.openPicker({
              mediaType: 'photo',
              cropping: false,
              compressImageQuality: 0.85,
              forceJpg: true,
            });

      if (!img?.path) return;

      const file = {
        uri: img.path,
        type: img?.mime || 'image/jpeg',
        name: img?.filename || `${source}_${Date.now()}.jpg`,
      };

      if (pickingForNow === 'upi') this.setState({ upiImage: file, confirmVisible: true });
      if (pickingForNow === 'bank') this.setState({ bankImage: file, confirmVisible: true });
    } catch (e) {
      const msg = String(e?.message || '').toLowerCase();
      if (msg.includes('cancel')) return;
      Toast.show('Unable to open picker', Toast.SHORT);
    } finally {
      // ✅ unlock after a little delay to avoid iOS race
      setTimeout(() => {
        this.pickLock = false;
      }, Platform.OS === 'ios' ? 800 : 400);
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

    console.log("settle formData== ",JSON.stringify(fd))

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
                    console.log("confirmSettle response== ", JSON.stringify(json))
                    this.setState({ submitting: false, confirmVisible: false, pickingFor: null });
                    this.props.navigation.navigate('SettlementHistory')
            }
        })
        .catch(() => {
          this.setState({ submitting: false });
          Toast.show('Submit failed', Toast.SHORT);
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

    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={THEME.green} />

        {/* Header */}
        <View style={styles.headerWrap}>
          <SafeAreaView style={styles.headerSafe}>
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={this.goBack} style={styles.headerIconBtn} activeOpacity={0.85}>
                <Image style={styles.backImg} source={require('./assets/back.png')} />
              </TouchableOpacity>

              <Text style={styles.headerTitle} numberOfLines={1}>
                Cash Settlement
              </Text>

              <View style={{ width: 42 }} />
            </View>
          </SafeAreaView>
        </View>

        <SafeAreaView style={styles.bodySafe}>
          <View style={{ flex: 1 }}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
              {/* Hero */}
              <View style={styles.heroCard}>
                <View style={{ flexDirection: 'row' }}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flex: 1, flexDirection: 'row', alignSelf: 'center' }}>
                        <View style={styles.heroIcon}>
                          <Text style={styles.heroIconText}>₹</Text>
                        </View>
                        <Text style={styles.heroTitle}>Cash Settlement</Text>
                      </View>

                      <Image style={{ height: 40, width: 40, resizeMode: 'contain' }} source={require('./assets/crn.png')} />
                    </View>

                    {!!amountStr ? (
                      <Text style={styles.heroLine}>
                        You have settled : <Text style={styles.heroBold}>{`₹${amountStr}`}</Text>
                      </Text>
                    ) : null}

                    {orderCount ? (
                      <Text style={styles.heroLine}>
                        Cash for <Text style={styles.heroBold}>{`${orderCount}`}</Text> orders.
                      </Text>
                    ) : null}

                    <Text style={[styles.heroLine, { marginTop: 6 }]}>
                      Upload proof of cash deposit via <Text style={styles.heroBold}>UPI</Text> or bank deposit slip.
                    </Text>
                  </View>
                </View>

                {/* Collection pill */}
                {!!dateStr || !!timeStr ? (
                  <View style={styles.collectionPill}>
                    <Text style={styles.collectionText}>
                      Collection Date :{' '}
                      {!!dateStr ? <Text style={styles.collectionStrong}>{dateStr}</Text> : null}
                      {!!timeStr ? (
                        <>
                          <Text style={styles.collectionDot}>  •  </Text>
                          <Text style={styles.collectionStrong}>{timeStr}</Text>
                        </>
                      ) : null}
                    </Text>
                  </View>
                ) : null}

                {/* LMD pill */}
                {!!farmerName || !!farmerPhone ? (
                  <View style={styles.lmdPill}>
                    <View style={styles.lmdAvatar}>
                      {farmerImg ? <Image source={{ uri: farmerImg }} style={styles.lmdAvatarImg} /> : <Text style={{ color: '#fff', fontWeight: '800' }}>L</Text>}
                    </View>

                    <Text style={styles.lmdText} numberOfLines={1}>
                      {`LMD : `}
                      <Text style={styles.lmdStrong}>{farmerName || '-'}</Text>
                      {!!farmerPhone ? `  (${farmerPhone})` : ''}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* UPI Screenshot */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>UPI Screenshot</Text>

                <View style={styles.innerCard}>
                  <View style={styles.innerTopRow}>
                    <Text style={styles.innerTitle} numberOfLines={1}>
                      Upload UPI Transfer
                    </Text>
                    {!!amountStr ? <Text style={styles.innerAmt}>{`₹ ${amountStr}`}</Text> : null}
                    {!!upiImage?.uri ? <Image style={styles.tickImg} source={require('./assets/tick.png')} /> : null}
                  </View>

                  {!!upiImage?.uri ? <Image source={{ uri: upiImage.uri }} style={styles.previewImgInline} resizeMode="cover" /> : null}

                  <View style={{ flexDirection: 'row', marginTop: 10 }}>
                    {/* <TouchableOpacity
                      style={[styles.bigUploadBtn, { flex: .5, marginRight: 10, justifyContent: 'center' }]}
                      onPress={this.onPayNow}
                      activeOpacity={0.92}
                    >
                      <Text style={styles.bigUploadText}>Pay Now</Text>
                    </TouchableOpacity> */}

                    <TouchableOpacity
                      style={[styles.bigUploadBtn, { flex: 1, backgroundColor: THEME.green,marginTop:5 }]}
                      onPress={() => this.openPicker('upi')}
                      activeOpacity={0.92}
                    >
                      <Image style={styles.camIcon} source={require('./assets/cam.png')} />
                      <Text style={styles.bigUploadText}>Upload</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Bank Receipt */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Bank Receipt</Text>

                <View style={{ marginTop: 8 }}>
                  {loading ? (
                    <View style={{ paddingVertical: 10 }}>
                      <ActivityIndicator size="small" color={THEME.green} />
                    </View>
                  ) : Array.isArray(banks) && banks.length ? (
                    banks.map((b) => {
                      const selected = String(this.state.selectedBankId) === String(b?.id);

                      return (
                        <View key={String(b?.id)} style={{ marginBottom: 10 }}>
                          {this.renderBankRow(b)}

                          {selected ? (
                            <View style={{ marginTop: 10 }}>
                              <View style={[styles.receiptBox, { marginLeft: 0 }]}>
                                <Text style={styles.receiptTitle}>RECEIPT</Text>

                                {!!bankImage?.uri ? (
                                  <Image source={{ uri: bankImage.uri }} style={styles.receiptImg} resizeMode="contain" />
                                ) : (
                                  <Text style={styles.receiptPlaceholder} numberOfLines={2}>
                                    No receipt selected
                                  </Text>
                                )}
                              </View>

                              <TouchableOpacity style={styles.smallUploadBtn} onPress={() => this.openPicker('bank')} activeOpacity={0.92}>
                                <Image style={styles.camIcon} source={require('./assets/cam.png')} />
                                <Text style={styles.smallUploadText}>Upload Receipt</Text>
                              </TouchableOpacity>
                            </View>
                          ) : null}
                        </View>
                      );
                    })
                  ) : null}
                </View>

              </View>

              <View style={{ height: 170 }} />
            </ScrollView>

            {/* Fixed Footer */}
            <View style={styles.footerWrap}>
                <Text style={styles.noteText}>Note : Verification by Gramik Finance team takes up to 24 hours</Text>

              <TouchableOpacity activeOpacity={0.92} onPress={this.onSubmit} style={[styles.submitBtn, submitting ? { opacity: 0.75 } : null]} disabled={submitting}>
                {!submitting ? <Text style={styles.submitText}>SUBMIT FOR VERIFICATION</Text> : <ActivityIndicator size="small" color="#FFF" />}
              </TouchableOpacity>

              <TouchableOpacity style={styles.callSupportRow} onPress={this.onCallSupport} activeOpacity={0.92}>
                <Image style={styles.callImg} source={require('./assets/phone.png')} />
                <Text style={styles.callText}>Call Support</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>

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
  scrollContent: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 16 },

  // Hero card
  heroCard: {
    backgroundColor: THEME.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: 12,
  },
  heroIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.soft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  heroIconText: { fontWeight: '500', color: THEME.greenPill, fontSize: 22 },
  heroTitle: { fontSize: 15, fontWeight: '700', color: THEME.text, alignSelf: 'center' },
  heroLine: { marginTop: 6, fontSize: 12, fontWeight: '500', color: '#000', lineHeight: 18 },
  heroBold: { fontWeight: '800', color: '#F37A20', fontSize: 14 },

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
    marginTop: 10,
    backgroundColor: '#1C8A62',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
  },
  lmdAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    overflow: 'hidden',
    backgroundColor: '#0F7451',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  lmdAvatarImg: { width: 30, height: 30, resizeMode: 'cover' },
  lmdText: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '600' },
  lmdStrong: { fontWeight: '800', fontSize: 13 },

  sectionCard: {
    marginTop: 12,
    backgroundColor: THEME.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: 12,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: THEME.text },

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
  innerAmt: { fontSize: 16, fontWeight: '800', color: '#1C8A62' },
  tickImg: { width: 22, height: 22, resizeMode: 'contain',marginLeft:10 },

  bigUploadBtn: {
    backgroundColor: '#1C8A62',
    borderRadius: 8,
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

  noteText: { marginTop: 5, fontSize: 12, fontWeight: '400', color: 'grey', textAlign: 'center',marginBottom:10 },

  // Footer
  footerWrap: {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: '#E7FAF3',
  paddingHorizontal: 10,
  paddingTop: 12,

  // remove extra gap
  paddingBottom: 30,
  marginBottom: -25,

  borderTopLeftRadius: 20,
  borderTopRightRadius: 20,

  elevation: 3,
  shadowColor: 'grey',
  shadowOffset: { width: 0, height: -2 },
  shadowOpacity: 0.2,
  shadowRadius: 5,
},
  submitBtn: {
    height: 48,
    width: '95%',
    alignSelf: 'center',
    borderRadius: 8,
    backgroundColor: THEME.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  callSupportRow: {
    marginTop: 10,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#EEF7F3',
    borderWidth:.5,
    borderColor: '#53bb9a',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    width: '95%',
    alignSelf: 'center',
  },
  callImg: { width: 20, height: 20, resizeMode: 'contain', tintColor: THEME.greenPill, marginRight: 10 },
  callText: { fontSize: 13, fontWeight: '500', color: THEME.greenPill },

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
  modalTitle: { fontSize: 15, fontWeight: '800', color: '#F37A20', textAlign: 'center', marginBottom: 12 },
  modalBtn: {
    height: 44,
    borderRadius: 12,
    backgroundColor: THEME.soft,
    borderWidth: 1,
    borderColor: '#D6F3E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  modalBtnText: { fontSize: 13, fontWeight: '800', color: THEME.greenPill },
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