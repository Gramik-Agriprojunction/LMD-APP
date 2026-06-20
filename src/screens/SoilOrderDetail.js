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
const PAD = 10;
const SCREEN_BG = '#edf1f7';
const FOOTER_H = 70;

const ICO = {
  cal: require('./assets/cal.png'),
  pay: require('./assets/pay.png'),
  money: require('./assets/money.png'),
  soil: require('./assets/soil.png'),
  trk: require('./assets/trk.png'),
  pkg: require('./assets/organic.png'),
  pdf: require('./assets/pdf.png'),
  call: require('./assets/call.png'),
  whatsapp: require('./assets/whatsapp.png'),
  farmer: require('./assets/farmernew.png'),
  clock: require('./assets/clock.png'),
  fertilizer: require('./assets/fertilizer.png'),
  down: require('./assets/down.png'),
};

const STEP_META = [
  { key: 'pickup', label: 'Pickup', wait: 'Pending', ico: ICO.clock, color: S.ORANGE, bg: S.ORANGE_BG },
  { key: 'lab', label: 'Lab', wait: 'Waiting', ico: ICO.fertilizer, color: S.BLUE, bg: S.BLUE_BG },
  { key: 'ready', label: 'Report', wait: 'Pending', ico: ICO.pdf, color: S.GREEN_DARK, bg: S.GREEN_BG },
];

const STAGE = {
  0: { color: S.ORANGE, bg: S.ORANGE_BG, label: 'Pickup pending' },
  1: { color: S.BLUE, bg: S.BLUE_BG, label: 'In lab' },
  2: { color: S.GREEN_DARK, bg: S.GREEN_BG, label: 'Report ready' },
};

const PKG = {
  BASIC: { color: S.GREEN_DARK, bg: S.GREEN_BG, label: 'Basic' },
  ADVANCE: { color: S.P_DARK, bg: S.P_TINT, label: 'Advance' },
  PREMIUM: { color: S.AMBER, bg: S.AMBER_BG, label: 'Premium' },
};

const payLbl = (m) => {
  const s = String(m || '').toLowerCase();
  if (s === 'cash_on_delivery' || s === 'cod') return 'COD';
  if (s.includes('google')) return 'GPay';
  if (s === 'online' || s === 'upi') return 'Online';
  return m || '-';
};

const maskMobile = (p) => {
  if (!p) return '';
  const s = String(p).replace(/\s+/g, '');
  if (s.length < 6) return s;
  return `${s.slice(0, 2)}****${s.slice(-2)}`;
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

const getReportUrl = (item) => {
  const u = item?.media_path || item?.image_path || item?.url || '';
  return String(u).trim();
};

const getReportDate = (item) => item?.report_generated_date || item?.date || null;

const fileNameFromUrl = (url) => {
  try {
    const last = decodeURIComponent(String(url).split('?')[0].split('/').pop() || 'file.pdf');
    return last.replace(/^\d+_/, '');
  } catch (e) {
    return 'file.pdf';
  }
};

const reportMeta = (item) => {
  const url = getReportUrl(item);
  const name = fileNameFromUrl(url);
  const isInvoice = /invoice/i.test(name) || String(item?.type || '').toLowerCase() === 'invoice';
  return {
    url,
    name,
    isInvoice,
    title: isInvoice ? 'Invoice' : 'Soil Report',
    sub: isInvoice ? 'Payment invoice' : 'Lab test result',
    color: isInvoice ? S.BLUE : S.GREEN_DARK,
    bg: isInvoice ? S.BLUE_BG : S.GREEN_BG,
  };
};

function DetailRow({ icon, label, value, valueColor, last }) {
  return (
    <View style={[st.dRow, !last && st.dRowBorder]}>
      {!!icon && <Image source={icon} style={st.dIco} resizeMode="contain" />}
      <Text style={st.dLbl}>{label}</Text>
      <Text style={[st.dVal, valueColor && { color: valueColor }]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function SectionCard({ title, badge, children, style }) {
  return (
    <View style={[st.card, style]}>
      {(!!title || badge != null) && (
        <View style={st.secHead}>
          {!!title && <Text style={[st.secTitle, st.secTitleInCard]}>{title}</Text>}
          {badge != null && (
            <View style={st.secBadge}><Text style={st.secBadgeTxt}>{badge}</Text></View>
          )}
        </View>
      )}
      {children}
    </View>
  );
}

class SoilOrderDetail extends Component {
  constructor(props) {
    super(props);
    const preview = props?.navigation?.getParam('order') || {};
    this.state = { loading: true, cancelling: false, order: preview, dlIndex: -1 };
    this.fade = new Animated.Value(0);
    this._seq = 0;
    this._BlobUtil = null;
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
          this.setState({ loading: false, order }, () => this.runIntro());
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

  runIntro = () => {
    this.fade.setValue(0);
    Animated.timing(this.fade, {
      toValue: 1,
      duration: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
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
        await new Promise((res) => setTimeout(res, 120));
        await BlobUtil.ios.openDocument(rawPath);
      } else {
        await BlobUtil.android.actionViewIntent(rawPath, 'application/pdf');
      }
    } catch (e) {
      console.log('Open PDF error', e);
      try { await Linking.openURL(`file://${rawPath}`); }
      catch (e2) { Toast.show('PDF open nahi ho paya', Toast.SHORT); }
    }
  };

  openReport = async (item, index) => {
    if (this.state.dlIndex !== -1) return;
    const url = getReportUrl(item);
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
      const exists = await BlobUtil.fs.exists(localPath.replace(/^file:\/\//, ''));
      this.setState({ dlIndex: -1 });
      if (!exists) {
        Toast.show('Download fail hua, dobara try karein', Toast.SHORT);
        return;
      }
      Toast.show('Ready — khol rahe hain', Toast.SHORT);
      this.openLocalPdf(localPath);
    } catch (e) {
      console.log('Report download error', e);
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
            this.setState({ cancelling: false, order: updated }, () => this.runIntro());
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

  renderTracker = (active, order) => {
    const liveStatus = order?.report_status || STEP_META[active]?.label || '';
    const sm = STAGE[active] || STAGE[0];

    return (
      <View style={st.steps}>
        <View style={st.stepsHead}>
          <Text style={st.stepsTitle}>Order progress</Text>
          <View style={[st.stepsPill, { backgroundColor: sm.bg }]}>
            <View style={[st.stepsPillDot, { backgroundColor: sm.color }]} />
            <Text style={[st.stepsPillTxt, { color: sm.color }]} numberOfLines={1}>{liveStatus}</Text>
          </View>
        </View>

        <View style={st.stepsRow}>
          {STEP_META.map((step, i) => {
            const done = i < active;
            const on = i === active;
            const sub = done ? 'Done' : on ? 'Now' : 'Wait';
            return (
              <React.Fragment key={step.key}>
                {i > 0 && (
                  <View style={st.stepConnWrap}>
                    <View style={[st.stepConn, i <= active && { backgroundColor: STEP_META[i - 1].color }]} />
                  </View>
                )}
                <View style={st.stepCol}>
                  <View style={[
                    st.stepDot,
                    done && { backgroundColor: step.color, borderColor: step.color },
                    on && { backgroundColor: step.bg, borderColor: step.color, borderWidth: 2 },
                    !done && !on && { backgroundColor: '#FFF', borderColor: '#E2E8F0' },
                  ]}>
                    {done ? (
                      <Image source={I.tick} style={st.stepTick} />
                    ) : (
                      <Image source={step.ico} style={st.stepIco} resizeMode="contain" />
                    )}
                  </View>
                  <Text style={[st.stepLbl, (done || on) && { color: step.color }]} numberOfLines={1}>
                    {step.label}
                  </Text>
                  <Text style={[st.stepSub, on && { color: step.color, fontWeight: '600' }]} numberOfLines={1}>
                    {sub}
                  </Text>
                </View>
              </React.Fragment>
            );
          })}
        </View>
      </View>
    );
  };

  renderFarmer = (name, addr, phone) => {
    if (!name && !addr && !phone) {
      return <Text style={st.addrEmpty}>Address abhi add nahi hui</Text>;
    }
    return (
      <View style={st.farmerWrap}>
        <View style={st.farmerMain}>
          <View style={st.farmerAvtRing}>
            <Image source={ICO.farmer} style={st.farmerAvt} resizeMode="contain" />
          </View>
          <View style={st.farmerMeta}>
            {!!name && <Text style={st.farmerCardName} numberOfLines={1}>{name}</Text>}
            {!!addr && (
              <View style={st.farmerLocChip}>
                <Image source={I.location} style={st.farmerLocIco} resizeMode="contain" />
                <Text style={st.farmerLocTxt} numberOfLines={1}>{addr}</Text>
              </View>
            )}
            {!!phone && !addr && (
              <Text style={st.farmerPhoneInline}>{maskMobile(phone)}</Text>
            )}
          </View>
          {!!phone && (
            <View style={st.farmerActs}>
              <TouchableOpacity
                style={st.farmerActBtn}
                activeOpacity={0.75}
                onPress={() => this.dial(phone)}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              >
                <Image source={ICO.call} style={st.farmerActIco} resizeMode="contain" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[st.farmerActBtn, st.farmerActBtnWa]}
                activeOpacity={0.75}
                onPress={() => this.whatsapp(phone)}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              >
                <Image source={ICO.whatsapp} style={st.farmerActIco} resizeMode="contain" />
              </TouchableOpacity>
            </View>
          )}
        </View>
        {!!phone && !!addr && (
          <View style={st.farmerPhoneBand}>
            <Image source={ICO.call} style={st.farmerPhoneBandIco} resizeMode="contain" />
            <Text style={st.farmerPhoneBandLbl}>Mobile</Text>
            <Text style={st.farmerPhoneBandVal}>{maskMobile(phone)}</Text>
          </View>
        )}
      </View>
    );
  };

  renderReports = (reports) => {
    if (!Array.isArray(reports) || !reports.length) return null;
    return (
      <SectionCard title="Reports & invoice" badge={reports.length}>
        <Text style={st.secHint}>Tap karein — PDF download hoke khul jayega</Text>
        {reports.map((item, i) => {
          const meta = reportMeta(item);
          if (!meta.url) return null;
          const busy = this.state.dlIndex === i;
          const date = getReportDate(item) ? moment(getReportDate(item)).format('DD MMM YYYY') : null;
          const isLast = i === reports.length - 1;
          return (
            <Pressable
              key={`${meta.url}-${i}`}
              onPress={() => this.openReport(item, i)}
              disabled={this.state.dlIndex !== -1}
              style={({ pressed }) => [
                st.reportRow,
                !isLast && st.reportRowGap,
                pressed && { opacity: 0.92 },
              ]}
            >
              <View style={[st.reportAccent, { backgroundColor: meta.color }]} />
              <Image source={ICO.pdf} style={st.reportIcoImg} resizeMode="contain" />
              <View style={st.reportInfo}>
                <Text style={st.reportTitle}>{meta.title}</Text>
                <Text style={st.reportSub} numberOfLines={1}>
                  {date ? `${meta.sub} · ${date}` : meta.sub}
                </Text>
                <Text style={st.reportFile} numberOfLines={1}>{meta.name}</Text>
              </View>
              <View style={[st.openBtn, { backgroundColor: meta.color }]}>
                {busy ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <>
                    <Text style={st.openBtnTxt}>Open</Text>
                    <Image source={I.arrow} style={st.openBtnArrow} />
                  </>
                )}
              </View>
            </Pressable>
          );
        })}
      </SectionCard>
    );
  };

  renderSupport = (support) => {
    if (!support?.enabled) return null;
    const phone = support?.phone || support?.mobile;
    const wa = support?.whatsapp;
    if (!phone && !wa) return null;

    return (
      <SectionCard title="Help chahiye?">
        <View style={st.helpRow}>
          {!!phone && (
            <TouchableOpacity style={st.helpBtn} activeOpacity={0.75} onPress={() => this.dial(phone)}>
              <Image source={ICO.call} style={st.helpIco} resizeMode="contain" />
              <View style={{ flex: 1 }}>
                <Text style={st.helpTxt}>Call</Text>
                <Text style={st.helpSub}>{phone}</Text>
              </View>
            </TouchableOpacity>
          )}
          {!!wa && (
            <TouchableOpacity style={[st.helpBtn, st.helpWa]} activeOpacity={0.75} onPress={() => this.whatsapp(wa)}>
              <Image source={ICO.whatsapp} style={st.helpIco} resizeMode="contain" />
              <View style={{ flex: 1 }}>
                <Text style={[st.helpTxt, { color: S.GREEN_DARK }]}>WhatsApp</Text>
                <Text style={st.helpSub}>{wa}</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </SectionCard>
    );
  };

  renderProducts = (products) => {
    if (!Array.isArray(products) || !products.length) return null;
    return (
      <View style={st.prodSection}>
        <SectionCard>
          <Text style={st.prodHead}>Recommended products</Text>
          <Text style={st.prodSub}>Aapke soil test ke hisaab se</Text>
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
                    <Image source={ICO.clock} style={st.prodNoteIco} resizeMode="contain" />
                    <Text style={st.prodNote} numberOfLines={1}>{p.note}</Text>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        </SectionCard>
      </View>
    );
  };

  render() {
    const { loading, order, cancelling } = this.state;
    const pkgLine = order?.packages?.[0];
    const pkg = pkgLine?.package || {};
    const farmer = order?.farmer || {};
    const addr = order?.address || {};
    const pickup = order?.sample_pickup_date ? moment(order.sample_pickup_date).format('DD MMM YYYY') : '-';
    const picked = order?.picked_date ? moment(order.picked_date).format('DD MMM YYYY') : null;
    const stage = getStage(order);
    const sm = STAGE[stage] || STAGE[0];
    const showCancel = canCancelOrder(order);
    const payStatus = String(order?.payment_status || 'unpaid');
    const unpaid = payStatus.toLowerCase() !== 'paid';
    const addrText = addr?.fullAddressLine || addr?.address || farmer?.address;
    const contactName = addr?.fullName || farmer?.name;
    const contactPhone = addr?.mobile || farmer?.mobile;
    const pkgKey = String(pkg?.name || pkg?.type || 'BASIC').toUpperCase();
    const pt = PKG[pkgKey] || PKG.BASIC;
    const pkgLabel = pt.label || pkgKey;
    const amount = order?.final_total_amount || pkg?.price || 0;

    return (
      <View style={st.root}>
        <StatusBar barStyle="light-content" backgroundColor={S.P} />
        <ScreenHeader
          bg={S.P}
          title={`Order #${order?.id || ''}`}
          kicker="Mitti Jaanch"
          onBack={this.goBack}
        />

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
                {/* summary */}
                <View style={[st.summary, { borderLeftColor: sm.color }]}>
                  <View style={st.summaryTop}>
                    <View style={[st.soilIco, { backgroundColor: pt.bg }]}>
                      <Image source={ICO.soil} style={st.soilImg} resizeMode="contain" />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={st.summaryTitleRow}>
                        <Text style={st.farmerName} numberOfLines={1}>{contactName || 'Farmer'}</Text>
                        <View style={[st.pkgChip, { backgroundColor: pt.bg }]}>
                          <Text style={[st.pkgChipTxt, { color: pt.color }]}>{pkgLabel}</Text>
                        </View>
                      </View>
                      <Text style={st.summaryMeta} numberOfLines={1}>
                        Order #{order?.id}{addrText ? ` · ${addrText}` : ''}
                      </Text>
                    </View>
                    <Text style={st.summaryPrice}>₹{Number(amount).toLocaleString('en-IN')}</Text>
                  </View>

                  {!isCancelled(order) && (
                    <>
                      <View style={st.summaryDivider} />
                      {this.renderTracker(stage, order)}
                    </>
                  )}

                  {isCancelled(order) && (
                    <View style={st.cancelBanner}>
                      <Image source={I.close} style={st.cancelBannerIco} />
                      <Text style={st.cancelBannerTxt}>
                        Order cancelled{order.cancelled_date ? ` · ${moment(order.cancelled_date).format('DD MMM YYYY')}` : ''}
                      </Text>
                    </View>
                  )}
                </View>

                {this.renderReports(order?.report)}

                {/* order info */}
                <SectionCard title="Order info">
                  <DetailRow icon={ICO.cal} label="Pickup date" value={pickup} />
                  {!!picked && <DetailRow icon={ICO.trk} label="Sample picked" value={picked} />}
                  <DetailRow
                    icon={ICO.pay}
                    label="Payment"
                    value={`${payLbl(order?.payment_mode)} · ${titleCase(payStatus)}`}
                    valueColor={unpaid ? S.ORANGE : S.GREEN_DARK}
                  />
                  <DetailRow icon={ICO.pkg} label="Quantity" value={String(pkgLine?.quantity || 1)} />
                  <DetailRow icon={ICO.pdf} label="Report in" value={`${pkg?.expected_report_by || 1} din`} last />
                </SectionCard>

                {/* farmer / address */}
                <SectionCard title="Farmer & pickup">
                  {this.renderFarmer(contactName, addrText, contactPhone)}
                </SectionCard>

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

const titleCase = (s) => {
  const t = String(s || '').toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: SCREEN_BG },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: PAD, paddingBottom: 28 },

  summary: {
    backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#E8ECF1', borderLeftWidth: 4,
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  summaryTop: { flexDirection: 'row', alignItems: 'flex-start' },
  soilIco: {
    width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 11,
  },
  soilImg: { width: 28, height: 28 },
  summaryTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 4, flexWrap: 'wrap' },
  farmerName: { fontSize: 16, fontWeight: '700', color: S.TXT, flexShrink: 1 },
  pkgChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  pkgChipTxt: { fontSize: 10.5, fontWeight: '700' },
  summaryPrice: { fontSize: 16, fontWeight: '700', color: S.TXT, marginLeft: 6 },
  summaryMeta: { fontSize: 12, fontWeight: '400', color: S.SUB },
  summaryDivider: {
    height: StyleSheet.hairlineWidth, backgroundColor: '#EEF2F6', marginTop: 14, marginBottom: 2,
  },

  steps: { marginTop: 10 },
  stepsHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8,
  },
  stepsTitle: { fontSize: 11, fontWeight: '700', color: S.MUTED, textTransform: 'uppercase', letterSpacing: 0.6 },
  stepsPill: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, gap: 5, maxWidth: '55%',
  },
  stepsPillDot: { width: 5, height: 5, borderRadius: 2.5 },
  stepsPillTxt: { fontSize: 10, fontWeight: '600', flexShrink: 1 },

  stepsRow: { flexDirection: 'row', alignItems: 'flex-start' },
  stepCol: { width: 54, alignItems: 'center' },
  stepConnWrap: { flex: 1, height: 26, justifyContent: 'center', paddingHorizontal: 2, minWidth: 8 },
  stepConn: { height: 2, borderRadius: 1, backgroundColor: '#E8EDF3' },
  stepDot: {
    width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: '#E2E8F0',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF',
  },
  stepIco: { width: 14, height: 14 },
  stepTick: { width: 12, height: 12, resizeMode: 'contain', tintColor: '#FFF' },
  stepLbl: { fontSize: 10, fontWeight: '600', color: S.MUTED, marginTop: 5, textAlign: 'center' },
  stepSub: { fontSize: 9, fontWeight: '500', color: S.MUTED, marginTop: 1, textAlign: 'center' },

  cancelBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 14, paddingVertical: 9, borderRadius: 8, backgroundColor: S.RED_BG,
  },
  cancelBannerIco: { width: 12, height: 12, resizeMode: 'contain', tintColor: S.RED, marginRight: 6 },
  cancelBannerTxt: { fontSize: 11.5, fontWeight: '600', color: S.RED },

  card: {
    backgroundColor: '#FFF', borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#E8ECF1',
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  secHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  secTitle: { fontSize: 11, fontWeight: '700', color: S.MUTED, textTransform: 'uppercase', letterSpacing: 0.6 },
  secTitleInCard: { marginBottom: 0 },
  secBadge: {
    minWidth: 22, height: 22, borderRadius: 11, backgroundColor: S.P_SOFT,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7,
  },
  secBadgeTxt: { fontSize: 10.5, fontWeight: '700', color: S.P_DARK },

  secHint: { fontSize: 11.5, fontWeight: '400', color: S.SUB, marginBottom: 10, marginTop: -2 },

  dRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, gap: 10 },
  dRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F1F5F9' },
  dIco: { width: 22, height: 22 },
  dLbl: { flex: 1, fontSize: 13, fontWeight: '500', color: S.SUB },
  dVal: { fontSize: 13, fontWeight: '600', color: S.TXT, textAlign: 'right', maxWidth: '44%' },

  reportRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingRight: 10, paddingLeft: 10,
    borderRadius: 10, backgroundColor: '#FAFBFC', borderWidth: 1, borderColor: '#EEF2F6', overflow: 'hidden', gap: 10,
  },
  reportRowGap: { marginBottom: 8 },
  reportAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  reportIcoImg: { width: 28, height: 28 },
  reportInfo: { flex: 1, minWidth: 0 },
  reportTitle: { fontSize: 13.5, fontWeight: '600', color: S.TXT },
  reportSub: { fontSize: 11, fontWeight: '400', color: S.SUB, marginTop: 2 },
  reportFile: { fontSize: 10, fontWeight: '400', color: S.MUTED, marginTop: 1 },
  openBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    minWidth: 62, height: 32, borderRadius: 8, justifyContent: 'center', paddingHorizontal: 10,
  },
  openBtnTxt: { fontSize: 11.5, fontWeight: '600', color: '#FFF' },
  openBtnArrow: { width: 10, height: 10, tintColor: '#FFF', resizeMode: 'contain' },

  farmerWrap: { marginTop: -2 },
  farmerMain: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  farmerAvtRing: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: S.P_SOFT,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: S.P_GLOW,
  },
  farmerAvt: { width: 32, height: 32 },
  farmerMeta: { flex: 1, minWidth: 0 },
  farmerCardName: { fontSize: 15, fontWeight: '700', color: S.TXT, marginBottom: 4 },
  farmerLocChip: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    backgroundColor: '#F8FAFC', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 4,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#E8ECF1', maxWidth: '100%',
  },
  farmerLocIco: { width: 13, height: 13 },
  farmerLocTxt: { fontSize: 11.5, fontWeight: '500', color: S.SUB, flexShrink: 1 },
  farmerPhoneInline: { fontSize: 12, fontWeight: '600', color: S.TXT, letterSpacing: 0.2 },
  farmerActs: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  farmerActBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: S.P_SOFT,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: S.P_GLOW,
  },
  farmerActBtnWa: { backgroundColor: S.GREEN_TINT, borderColor: '#BBF7D0' },
  farmerActIco: { width: 22, height: 22 },
  farmerPhoneBand: {
    flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingTop: 11,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F1F5F9', gap: 6,
  },
  farmerPhoneBandIco: { width: 16, height: 16 },
  farmerPhoneBandLbl: { fontSize: 12, fontWeight: '500', color: S.SUB },
  farmerPhoneBandVal: { fontSize: 12.5, fontWeight: '700', color: S.TXT, letterSpacing: 0.4 },
  addrEmpty: { fontSize: 12.5, fontWeight: '400', color: S.MUTED, fontStyle: 'italic' },

  helpRow: { flexDirection: 'row', gap: 8 },
  helpBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8FAFC', borderRadius: 10, padding: 11, gap: 10,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#E8ECF1',
  },
  helpWa: { backgroundColor: S.GREEN_TINT, borderColor: '#BBF7D0' },
  helpIco: { width: 26, height: 26 },
  helpTxt: { fontSize: 12.5, fontWeight: '600', color: S.TXT },
  helpSub: { fontSize: 11, fontWeight: '400', color: S.SUB, marginTop: 1 },

  prodSection: { marginBottom: 4 },
  prodHead: { fontSize: 14, fontWeight: '700', color: S.TXT, marginBottom: 2 },
  prodSub: { fontSize: 11.5, fontWeight: '400', color: S.SUB, marginBottom: 12 },
  prodScroll: { paddingBottom: 2, gap: 10, paddingRight: 2, marginHorizontal: -2 },
  prodCard: {
    width: SW * 0.42, backgroundColor: '#FAFBFC', borderRadius: 11, padding: 10,
    borderWidth: 1, borderColor: '#E8ECF1',
  },
  prodImgWrap: { position: 'relative', marginBottom: 8 },
  prodImg: { width: '100%', height: 88, borderRadius: 9, backgroundColor: S.BG },
  prodTagPill: {
    position: 'absolute', left: 6, bottom: 6, backgroundColor: 'rgba(15,23,42,0.75)',
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, maxWidth: '92%',
  },
  prodTagPillTxt: { fontSize: 9, fontWeight: '600', color: '#FFF' },
  prodName: { fontSize: 12, fontWeight: '600', color: S.TXT, lineHeight: 16, minHeight: 32 },
  prodPrice: { fontSize: 13, fontWeight: '700', color: S.GREEN_DARK, marginTop: 4 },
  prodNoteRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  prodNoteIco: { width: 13, height: 13, marginRight: 4 },
  prodNote: { fontSize: 10, fontWeight: '400', color: S.SUB, flex: 1 },

  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#FFF', paddingHorizontal: PAD, paddingTop: 8, paddingBottom: 6,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E8ECF1',
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 6,
  },
  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#FECACA', backgroundColor: S.RED_BG,
  },
  cancelBtnIco: { width: 13, height: 13, resizeMode: 'contain', tintColor: S.RED, marginRight: 7 },
  cancelTxt: { fontSize: 14, fontWeight: '600', color: S.RED },
});

export default withV4Navigation(SoilOrderDetail);
