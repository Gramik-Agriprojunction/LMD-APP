import React, { Component } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar, Image, Animated,
  ActivityIndicator, Alert, Pressable, TouchableOpacity, Linking,
  Dimensions, Platform, Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import moment from 'moment';
import Toast from 'react-native-simple-toast';
import constants from '../utils/constants';
import { withV4Navigation } from '../utils/v4Compat';
import ScreenHeader from '../components/ScreenHeader';
import { S, soilIcons as I } from '../utils/soilTheme';

const SW = Dimensions.get('window').width;
const FOOTER_H = 70;

const STEPS = [
  { key: 'pickup', label: 'Pickup', ico: I.clock },
  { key: 'lab', label: 'Lab', ico: I.fertilizer },
  { key: 'ready', label: 'Report', ico: I.doc },
];

const STAGE = {
  0: { color: '#EA580C', bg: '#FFF7ED', label: 'Pickup pending' },
  1: { color: '#2563EB', bg: '#EFF6FF', label: 'In lab' },
  2: { color: '#059669', bg: '#ECFDF5', label: 'Report ready' },
};

const PKG = {
  BASIC: { color: '#059669', bg: '#ECFDF5' },
  ADVANCE: { color: '#7C3AED', bg: '#F5F3FF' },
  PREMIUM: { color: '#D97706', bg: '#FFFBEB' },
};

const payLbl = (m) => {
  const s = String(m || '').toLowerCase();
  if (s === 'cash_on_delivery' || s === 'cod') return 'COD';
  if (s === 'online' || s === 'upi') return 'Online';
  return m || '-';
};

const getStage = (order) => {
  const st = String(order?.status || '').toLowerCase();
  const rs = String(order?.report_status || '').toLowerCase();
  const hasReport = Array.isArray(order?.report) && order.report.length > 0;
  if (hasReport || st === 'ready' || st === 'completed' || st === 'report_ready' || rs.includes('ready') || rs.includes('generated')) return 2;
  if (['in_lab', 'lab', 'processing', 'sample_collected', 'picked_up', 'in_progress'].includes(st) || rs.includes('test') || rs.includes('pending')) return 1;
  return 0;
};

const parseOrderResponse = (json) => {
  const d = json?.data;
  if (d && typeof d === 'object' && !Array.isArray(d)) return d;
  if (Array.isArray(d) && d.length) return d[0];
  return null;
};

const isCancelled = (order) => {
  const st = String(order?.status || '').toLowerCase();
  return st === 'cancelled' || !!order?.cancelled_date;
};

const canCancelOrder = (order) => {
  if (!order?.id || isCancelled(order)) return false;
  const st = String(order?.status || '').toLowerCase();
  return !['completed', 'report_ready', 'ready'].includes(st);
};

// Pull a human filename out of an S3 url; drop the timestamp prefix.
const fileNameFromUrl = (url) => {
  try {
    const last = decodeURIComponent(String(url).split('?')[0].split('/').pop() || 'file.pdf');
    return last.replace(/^\d+_/, '');
  } catch (e) {
    return 'file.pdf';
  }
};

const reportMeta = (item) => {
  const name = fileNameFromUrl(item?.image_path);
  const isInvoice = /invoice/i.test(name);
  return {
    name,
    isInvoice,
    title: isInvoice ? 'Invoice' : 'Soil Report',
    sub: isInvoice ? 'Payment invoice (PDF)' : 'Lab test result (PDF)',
    color: isInvoice ? '#2563EB' : '#059669',
    bg: isInvoice ? '#EFF6FF' : '#ECFDF5',
  };
};

function DetailRow({ icon, label, value, last, valueColor }) {
  return (
    <View style={[st.dRow, !last && st.dRowBorder]}>
      <View style={st.dLblWrap}>
        {!!icon && <Image source={icon} style={st.dLblIco} />}
        <Text style={st.dLbl}>{label}</Text>
      </View>
      <Text style={[st.dVal, valueColor && { color: valueColor }]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

class SoilOrderDetail extends Component {
  constructor(props) {
    super(props);
    const preview = props?.navigation?.getParam('order') || {};
    this.state = { loading: true, cancelling: false, order: preview, dlIndex: -1 };
    this.progress = new Animated.Value(0);
    this.fade = new Animated.Value(0);
    this._seq = 0;
    this._BlobUtil = null;
    this._RNShare = null;
  }

  componentDidMount() {
    this.fetchDetail();
  }

  orderId = () => {
    const fromParam = this.props?.navigation?.getParam('orderId');
    if (fromParam) return String(fromParam);
    const order = this.props?.navigation?.getParam('order');
    return order?.id ? String(order.id) : '';
  };

  fetchDetail = () => {
    const id = this.orderId();
    if (!id) {
      Toast.show('Order ID nahi mila', Toast.SHORT);
      this.setState({ loading: false });
      return;
    }

    const seq = ++this._seq;
    this.setState({ loading: true });

    fetch(`${constants.soilOrderDetail}${id}`, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + global.token,
        Accept: 'application/json',
        'X-localization': 'en',
      },
    })
      .then((r) => r.json())
      .then((json) => {
        if (seq !== this._seq) return;
        const order = parseOrderResponse(json);
        if (order) {
          this.setState({ loading: false, order }, () => this.runIntro(order));
        } else {
          Toast.show(json?.message || 'Order detail nahi mila', Toast.SHORT);
          this.setState({ loading: false });
        }
      })
      .catch(() => {
        if (seq !== this._seq) return;
        Toast.show('Order detail load nahi ho paya', Toast.SHORT);
        this.setState({ loading: false });
      });
  };

  runIntro = (order) => {
    const stage = getStage(order);
    this.progress.setValue(0);
    this.fade.setValue(0);
    Animated.parallel([
      Animated.spring(this.progress, { toValue: stage / (STEPS.length - 1), friction: 8, tension: 45, useNativeDriver: false }),
      Animated.timing(this.fade, { toValue: 1, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  };

  goBack = () => this.props?.navigation?.goBack?.();

  dial = (phone) => {
    if (!phone) return;
    Linking.openURL(`tel:${String(phone).replace(/\s+/g, '')}`).catch(() => {});
  };

  whatsapp = (phone) => {
    if (!phone) return;
    const c = String(phone).replace(/[^\d]/g, '');
    Linking.openURL(`https://wa.me/91${c}`).catch(() => {});
  };

  // ── PDF download + auto-open ──────────────────────────────────────
  _ensureBlobUtil = () => {
    if (!this._BlobUtil) {
      try { this._BlobUtil = require('react-native-blob-util').default || require('react-native-blob-util'); }
      catch (e) { this._BlobUtil = null; }
    }
    return this._BlobUtil;
  };

  openLocalPdf = async (localPath) => {
    if (!localPath) return;
    const BlobUtil = this._ensureBlobUtil();
    const rawPath = String(localPath).replace(/^file:\/\//, '');
    try {
      if (Platform.OS === 'ios') {
        await new Promise((res) => setTimeout(res, 80));
        await BlobUtil.ios.openDocument(rawPath);
      } else {
        await BlobUtil.android.actionViewIntent(rawPath, 'application/pdf');
      }
    } catch (e) {
      try { await Linking.openURL(`file://${rawPath}`); }
      catch (e2) { Toast.show('PDF open nahi ho paya', Toast.SHORT); }
    }
  };

  downloadReport = async (item, index) => {
    if (this.state.dlIndex !== -1) return;
    const url = item?.image_path;
    if (!url) { Toast.show('File link nahi mila', Toast.SHORT); return; }

    const BlobUtil = this._ensureBlobUtil();
    if (!BlobUtil) { Toast.show('Download module available nahi hai', Toast.SHORT); return; }

    const meta = reportMeta(item);
    const safe = `${meta.title}-${this.orderId()}-${index + 1}`.replace(/[^\w-]/g, '_');
    const path = `${BlobUtil.fs.dirs.CacheDir}/${safe}.pdf`;

    this.setState({ dlIndex: index });
    Toast.show('Download ho raha hai…', Toast.SHORT);
    try {
      const res = await BlobUtil
        .config({ fileCache: true, path, appendExt: 'pdf' })
        .fetch('GET', url, { Accept: 'application/pdf' });
      const localPath = res.path();
      this.setState({ dlIndex: -1 });
      Toast.show('Ready — khol rahe hain', Toast.SHORT);
      this.openLocalPdf(localPath);
    } catch (e) {
      this.setState({ dlIndex: -1 });
      Toast.show('Download fail hua, dobara try karein', Toast.SHORT);
    }
  };

  confirmCancel = () => {
    const id = this.orderId();
    if (!id) return;
    Alert.alert(
      'Order cancel karein?',
      `Order #${id} cancel ho jayega. Sure hain?`,
      [
        { text: 'Nahi', style: 'cancel' },
        { text: 'Haan, cancel', style: 'destructive', onPress: this.cancelOrder },
      ],
    );
  };

  cancelOrder = () => {
    const id = this.orderId();
    if (!id || this.state.cancelling) return;
    this.setState({ cancelling: true });

    fetch(`${constants.cancelSoilOrder}${id}`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + global.token,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-localization': 'en',
      },
      body: JSON.stringify({}),
    })
      .then((r) => r.json())
      .then((json) => {
        if (json?.success || json?.status) {
          Toast.show(json?.message || 'Order cancel ho gaya', Toast.SHORT);
          const updated = parseOrderResponse(json);
          if (updated) {
            this.setState({ cancelling: false, order: updated }, () => this.runIntro(updated));
          } else {
            this.setState({ cancelling: false }, () => this.fetchDetail());
          }
        } else {
          Toast.show(json?.message || 'Cancel nahi ho paya', Toast.SHORT);
          this.setState({ cancelling: false });
        }
      })
      .catch(() => {
        Toast.show('Kuch galat ho gaya', Toast.SHORT);
        this.setState({ cancelling: false });
      });
  };

  // ── journey tracker ───────────────────────────────────────────────
  renderTracker = (active) => {
    const sm = STAGE[active] || STAGE[0];
    const fillW = this.progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
    return (
      <View style={st.track}>
        <View style={st.trackLineWrap}>
          <View style={st.trackLineBg} />
          <Animated.View style={[st.trackLineFill, { width: fillW, backgroundColor: sm.color }]} />
        </View>
        <View style={st.trackRow}>
          {STEPS.map((s, i) => {
            const done = i < active;
            const on = i === active;
            const reached = done || on;
            return (
              <View key={s.key} style={st.trackNode}>
                <View style={[
                  st.trackDot,
                  reached
                    ? { borderColor: sm.color, backgroundColor: sm.color }
                    : { borderColor: '#E2E8F0', backgroundColor: '#FFF' },
                  on && st.trackDotActive,
                ]}>
                  {done ? (
                    <Image source={I.tick} style={st.trackTick} />
                  ) : (
                    <Image source={s.ico} style={[st.trackIco, { tintColor: reached ? '#FFF' : '#C2CBD8' }]} />
                  )}
                </View>
                <Text style={[st.trackLbl, reached && { color: sm.color, fontWeight: '600' }]}>{s.label}</Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  renderReports = (reports) => {
    if (!Array.isArray(reports) || !reports.length) return null;
    return (
      <View style={st.card}>
        <View style={st.secHead}>
          <Text style={st.secTitle}>Soil report &amp; invoice</Text>
          <View style={st.secBadge}><Text style={st.secBadgeTxt}>{reports.length}</Text></View>
        </View>
        {reports.map((item, i) => {
          const meta = reportMeta(item);
          const busy = this.state.dlIndex === i;
          const date = item?.date ? moment(item.date).format('DD MMM YYYY') : null;
          return (
            <Pressable
              key={`${item?.image_path || i}`}
              onPress={() => this.downloadReport(item, i)}
              disabled={this.state.dlIndex !== -1}
              style={({ pressed }) => [st.fileRow, pressed && { backgroundColor: '#F8FAFC' }]}
            >
              <View style={[st.fileIcoWrap, { backgroundColor: meta.bg }]}>
                <Image source={I.doc} style={[st.fileIco, { tintColor: meta.color }]} />
              </View>
              <View style={st.fileInfo}>
                <Text style={st.fileTitle} numberOfLines={1}>{meta.title}</Text>
                <Text style={st.fileSub} numberOfLines={1}>{date ? `${meta.sub} · ${date}` : meta.sub}</Text>
              </View>
              <View style={[st.dlBtn, { backgroundColor: meta.color }]}>
                {busy ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Image source={I.down} style={st.dlIco} />
                )}
              </View>
            </Pressable>
          );
        })}
        <View style={st.fileHint}>
          <Image source={I.down} style={st.fileHintIco} />
          <Text style={st.fileHintTxt}>Tap kisi bhi file par — download hoke apne aap khulega</Text>
        </View>
      </View>
    );
  };

  renderSupport = (support) => {
    if (!support?.enabled) return null;
    const phone = support?.phone || support?.mobile;
    const wa = support?.whatsapp;
    if (!phone && !wa) return null;

    return (
      <View style={st.card}>
        <Text style={st.secTitle}>Help chahiye?</Text>
        <View style={st.helpRow}>
          {!!phone && (
            <TouchableOpacity style={st.helpBtn} activeOpacity={0.75} onPress={() => this.dial(phone)}>
              <View style={[st.helpIcoWrap, { backgroundColor: '#EEF2FF' }]}>
                <Image source={I.call} style={[st.helpIco, { tintColor: S.P }]} />
              </View>
              <View>
                <Text style={st.helpTxt}>Call</Text>
                <Text style={st.helpSub}>{phone}</Text>
              </View>
            </TouchableOpacity>
          )}
          {!!wa && (
            <TouchableOpacity style={[st.helpBtn, st.helpWa]} activeOpacity={0.75} onPress={() => this.whatsapp(wa)}>
              <View style={[st.helpIcoWrap, { backgroundColor: '#ECFDF5' }]}>
                <Image source={I.whatsapp} style={[st.helpIco, { tintColor: '#059669' }]} />
              </View>
              <View>
                <Text style={[st.helpTxt, { color: '#059669' }]}>WhatsApp</Text>
                <Text style={st.helpSub}>{wa}</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  renderProducts = (products) => {
    if (!Array.isArray(products) || !products.length) return null;
    return (
      <View style={st.section}>
        <Text style={st.secTitleOut}>Recommended products</Text>
        <Text style={st.secSubOut}>Aapke soil test ke hisaab se</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.prodScroll}>
          {products.map((p) => (
            <View key={String(p.id)} style={st.prodCard}>
              <View style={st.prodImgWrap}>
                {!!p.image && <Image source={{ uri: p.image }} style={st.prodImg} />}
                {!!p.stageTag && (
                  <View style={st.prodTagPill}><Text style={st.prodTagPillTxt} numberOfLines={1}>{p.stageTag}</Text></View>
                )}
              </View>
              <Text style={st.prodName} numberOfLines={2}>{p.name}</Text>
              {!!p.price && <Text style={st.prodPrice}>{p.price}</Text>}
              {!!p.note && (
                <View style={st.prodNoteRow}>
                  <Image source={I.clock} style={st.prodNoteIco} />
                  <Text style={st.prodNote} numberOfLines={1}>{p.note}</Text>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  render() {
    const { loading, order, cancelling } = this.state;
    const pkgLine = order?.packages?.[0];
    const pkg = pkgLine?.package || {};
    const addr = order?.address || {};
    const pickup = order?.sample_pickup_date ? moment(order.sample_pickup_date).format('DD MMM YYYY') : '-';
    const stage = getStage(order);
    const sm = STAGE[stage] || STAGE[0];
    const showCancel = canCancelOrder(order);
    const payStatus = String(order?.payment_status || 'unpaid');
    const unpaid = payStatus.toLowerCase() !== 'paid';
    const addrText = addr?.fullAddressLine || addr?.address;
    const type = String(pkg?.type || pkg?.name || 'Soil Test').toUpperCase();
    const pt = PKG[type] || PKG.BASIC;

    return (
      <View style={st.root}>
        <StatusBar barStyle="light-content" backgroundColor={S.P} />
        <ScreenHeader bg={S.P} title={`Order #${order?.id || ''}`} kicker="SOIL TEST DETAILS" onBack={this.goBack} />

        <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
          {loading ? (
            <View style={st.loader}>
              <ActivityIndicator color={S.P} size="small" />
            </View>
          ) : (
            <Animated.View style={{ flex: 1, opacity: this.fade }}>
              <ScrollView
                contentContainerStyle={[st.scroll, showCancel && { paddingBottom: FOOTER_H + 12 }]}
                showsVerticalScrollIndicator={false}
              >
                {/* hero */}
                <View style={st.hero}>
                  <View style={st.heroTop}>
                    <View style={[st.pkgIco, { backgroundColor: pt.bg }]}>
                      <Image source={I.package} style={[st.pkgIcoImg, { tintColor: pt.color }]} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={st.heroTitleRow}>
                        <Text style={st.heroType}>{type}</Text>
                        {isCancelled(order) ? (
                          <View style={[st.heroPill, { backgroundColor: '#FEF2F2' }]}>
                            <Text style={[st.heroPillTxt, { color: '#DC2626' }]}>Cancelled</Text>
                          </View>
                        ) : (
                          <View style={[st.heroPill, { backgroundColor: sm.bg }]}>
                            <View style={[st.heroPillDot, { backgroundColor: sm.color }]} />
                            <Text style={[st.heroPillTxt, { color: sm.color }]}>{order?.report_status || sm.label}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={st.heroSub}>Order #{order?.id} · Qty {pkgLine?.quantity || 1}</Text>
                    </View>
                    <Text style={st.heroPrice}>₹{order?.final_total_amount || pkg?.price || 0}</Text>
                  </View>

                  {!isCancelled(order) && this.renderTracker(stage)}

                  {isCancelled(order) && (
                    <View style={st.cancelBanner}>
                      <Image source={I.close} style={st.cancelBannerIco} />
                      <Text style={st.cancelBannerTxt}>
                        Order cancelled{order.cancelled_date ? ` · ${moment(order.cancelled_date).format('DD MMM YYYY')}` : ''}
                      </Text>
                    </View>
                  )}
                </View>

                {/* details */}
                <View style={st.card}>
                  <Text style={st.secTitle}>Order details</Text>
                  <DetailRow icon={I.calendar} label="Pickup date" value={pickup} />
                  <DetailRow icon={I.wallet} label="Payment" value={`${payLbl(order?.payment_mode)} · ${payStatus}`} valueColor={unpaid ? '#EA580C' : '#059669'} />
                  <DetailRow icon={I.package} label="Quantity" value={String(pkgLine?.quantity || 1)} />
                  <DetailRow icon={I.doc} label="Report in" value={`${pkg?.expected_report_by || 1} din`} last />
                </View>

                {/* report files */}
                {this.renderReports(order?.report)}

                {/* address */}
                <View style={st.card}>
                  <Text style={st.secTitle}>Pickup address</Text>
                  {addrText ? (
                    <View style={st.addrRow}>
                      <View style={st.addrIcoWrap}>
                        <Image source={I.location} style={st.addrIco} />
                      </View>
                      <View style={{ flex: 1 }}>
                        {!!addr?.fullName && <Text style={st.addrName}>{addr.fullName}</Text>}
                        <Text style={st.addrLine}>{addrText}</Text>
                        {!!addr?.mobile && <Text style={st.addrPhone}>{addr.mobile}</Text>}
                      </View>
                    </View>
                  ) : (
                    <Text style={st.addrEmpty}>Address abhi add nahi hui</Text>
                  )}
                </View>

                {this.renderSupport(order?.support)}
                {this.renderProducts(order?.recommendedProducts)}
              </ScrollView>
            </Animated.View>
          )}

          {showCancel && (
            <SafeAreaView edges={['bottom']} style={st.footer}>
              <Pressable
                onPress={this.confirmCancel}
                disabled={cancelling}
                style={({ pressed }) => [st.cancelBtn, pressed && { opacity: 0.85 }, cancelling && { opacity: 0.5 }]}
              >
                {cancelling ? (
                  <ActivityIndicator color={S.RED} size="small" />
                ) : (
                  <>
                    <Image source={I.close} style={st.cancelBtnIco} />
                    <Text style={st.cancelTxt}>Cancel order</Text>
                  </>
                )}
              </Pressable>
            </SafeAreaView>
          )}
        </SafeAreaView>
      </View>
    );
  }
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3F5F9' },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 12, paddingBottom: 24 },

  // hero
  hero: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 14, marginBottom: 11,
    borderWidth: 1, borderColor: '#EBEFF5',
    shadowColor: '#1E293B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center' },
  pkgIco: { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  pkgIcoImg: { width: 22, height: 22, resizeMode: 'contain' },
  heroTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 4, flexWrap: 'wrap' },
  heroType: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  heroPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  heroPillDot: { width: 5, height: 5, borderRadius: 2.5, marginRight: 5 },
  heroPillTxt: { fontSize: 10.5, fontWeight: '600' },
  heroSub: { fontSize: 12, fontWeight: '500', color: '#94A3B8' },
  heroPrice: { fontSize: 18, fontWeight: '700', color: '#1E293B', marginLeft: 8 },

  // tracker
  track: { marginTop: 18, paddingHorizontal: 6 },
  trackLineWrap: { position: 'absolute', left: 32, right: 32, top: 13, height: 3 },
  trackLineBg: { position: 'absolute', left: 0, right: 0, height: 3, borderRadius: 2, backgroundColor: '#E8EDF3' },
  trackLineFill: { position: 'absolute', left: 0, height: 3, borderRadius: 2 },
  trackRow: { flexDirection: 'row', justifyContent: 'space-between' },
  trackNode: { alignItems: 'center', flex: 1 },
  trackDot: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' },
  trackDotActive: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 4, elevation: 3 },
  trackIco: { width: 15, height: 15, resizeMode: 'contain' },
  trackTick: { width: 14, height: 14, resizeMode: 'contain', tintColor: '#FFF' },
  trackLbl: { fontSize: 10.5, fontWeight: '500', color: '#A0AAB9', marginTop: 6 },

  cancelBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 14, paddingVertical: 9, borderRadius: 10, backgroundColor: '#FEF2F2' },
  cancelBannerIco: { width: 13, height: 13, resizeMode: 'contain', tintColor: '#DC2626', marginRight: 6 },
  cancelBannerTxt: { fontSize: 12, fontWeight: '600', color: '#DC2626' },

  // cards
  card: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 14, marginBottom: 11,
    borderWidth: 1, borderColor: '#EBEFF5',
    shadowColor: '#1E293B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 9, elevation: 1,
  },
  secHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  secTitle: { fontSize: 11, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
  secBadge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, marginBottom: 6 },
  secBadgeTxt: { fontSize: 10.5, fontWeight: '700', color: '#64748B' },

  // detail rows
  dRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11 },
  dRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F1F5F9' },
  dLblWrap: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  dLblIco: { width: 14, height: 14, resizeMode: 'contain', tintColor: '#A0AAB9', marginRight: 8 },
  dLbl: { fontSize: 12.5, fontWeight: '500', color: '#94A3B8' },
  dVal: { fontSize: 12.5, fontWeight: '600', color: '#334155', flex: 1.1, textAlign: 'right' },

  // file rows
  fileRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderRadius: 10 },
  fileIcoWrap: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  fileIco: { width: 19, height: 19, resizeMode: 'contain' },
  fileInfo: { flex: 1 },
  fileTitle: { fontSize: 13.5, fontWeight: '600', color: '#1E293B' },
  fileSub: { fontSize: 11.5, fontWeight: '400', color: '#94A3B8', marginTop: 2 },
  dlBtn: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  dlIco: { width: 16, height: 16, resizeMode: 'contain', tintColor: '#FFF' },
  fileHint: { flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F1F5F9' },
  fileHintIco: { width: 12, height: 12, resizeMode: 'contain', tintColor: '#CBD5E1', marginRight: 6 },
  fileHintTxt: { fontSize: 11, fontWeight: '400', color: '#A0AAB9', flex: 1 },

  // address
  addrRow: { flexDirection: 'row', alignItems: 'flex-start' },
  addrIcoWrap: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#F5F3FF', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  addrIco: { width: 16, height: 16, resizeMode: 'contain', tintColor: S.P },
  addrName: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 3 },
  addrLine: { fontSize: 12.5, fontWeight: '400', color: '#64748B', lineHeight: 18 },
  addrPhone: { fontSize: 12.5, fontWeight: '500', color: S.P, marginTop: 4 },
  addrEmpty: { fontSize: 12.5, fontWeight: '400', color: '#CBD5E1', fontStyle: 'italic' },

  // help
  helpRow: { flexDirection: 'row', gap: 10, marginTop: 2 },
  helpBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, padding: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E8EDF3' },
  helpWa: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  helpIcoWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 9 },
  helpIco: { width: 16, height: 16, resizeMode: 'contain' },
  helpTxt: { fontSize: 13, fontWeight: '600', color: '#475569' },
  helpSub: { fontSize: 11, fontWeight: '400', color: '#94A3B8', marginTop: 1 },

  // products
  section: { marginBottom: 11 },
  secTitleOut: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 2, marginLeft: 2 },
  secSubOut: { fontSize: 11.5, fontWeight: '400', color: '#94A3B8', marginBottom: 11, marginLeft: 2 },
  prodScroll: { paddingBottom: 4, gap: 11, paddingRight: 4 },
  prodCard: {
    width: SW * 0.44, backgroundColor: '#FFF', borderRadius: 14, padding: 9,
    borderWidth: 1, borderColor: '#EBEFF5',
    shadowColor: '#1E293B', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.04, shadowRadius: 7, elevation: 1,
  },
  prodImgWrap: { position: 'relative', marginBottom: 8 },
  prodImg: { width: '100%', height: 92, borderRadius: 10, backgroundColor: '#F1F5F9' },
  prodTagPill: { position: 'absolute', left: 6, bottom: 6, backgroundColor: 'rgba(15,23,42,0.72)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, maxWidth: '90%' },
  prodTagPillTxt: { fontSize: 9.5, fontWeight: '600', color: '#FFF' },
  prodName: { fontSize: 12, fontWeight: '600', color: '#334155', lineHeight: 16, minHeight: 32 },
  prodPrice: { fontSize: 13, fontWeight: '700', color: '#059669', marginTop: 5 },
  prodNoteRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  prodNoteIco: { width: 11, height: 11, resizeMode: 'contain', tintColor: '#94A3B8', marginRight: 4 },
  prodNote: { fontSize: 10.5, fontWeight: '400', color: '#94A3B8', flex: 1 },

  // footer
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#FFF', paddingHorizontal: 12, paddingTop: 9, paddingBottom: 6,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E6EAF1',
    shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 8,
  },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  cancelBtnIco: { width: 13, height: 13, resizeMode: 'contain', tintColor: '#DC2626', marginRight: 7 },
  cancelTxt: { fontSize: 14, fontWeight: '600', color: '#DC2626' },
});

export default withV4Navigation(SoilOrderDetail);
