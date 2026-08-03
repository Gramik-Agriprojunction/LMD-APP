import React, { Component } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar, Image, Animated,
  ActivityIndicator, Alert, Pressable, TouchableOpacity, Linking,
  Platform, Easing, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { safeBottomEdges, overlayBottomPadding } from '../utils/safeAreaInsets';
import moment from 'moment';
import Toast from 'react-native-simple-toast';
import constants from '../utils/constants';
import { withV4Navigation } from '../utils/v4Compat';
import ScreenHeader from '../components/ScreenHeader';
import BottomSheet from '../components/BottomSheet';
import { S, soilIcons as I } from '../utils/soilTheme';
import { callFarmerExotel } from '../utils/exotelCall';

const PAD = 8;
const FOOTER_PAD = 16;
const CARD_PAD = 10;
const PROD_IMG = 84;
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

const ORDER_STEPS = [
  { key: 'pending', label: 'Pending', ico: ICO.clock, color: S.ORANGE, bg: S.ORANGE_BG },
  { key: 'picked', label: 'Sample Picked', ico: ICO.soil, color: S.BLUE, bg: S.BLUE_BG },
  { key: 'terminal', label: 'Completed', cancelLabel: 'Cancelled', ico: ICO.pdf, color: S.GREEN_DARK, bg: S.GREEN_BG, cancelColor: S.RED, cancelBg: S.RED_BG },
];

const STAGE = {
  0: { color: S.ORANGE, bg: S.ORANGE_BG, label: 'Pending' },
  1: { color: S.BLUE, bg: S.BLUE_BG, label: 'Sample picked' },
  2: { color: S.GREEN_DARK, bg: S.GREEN_BG, label: 'Completed' },
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

const payIconUri = (order) => {
  const uri = order?.paymentMethod?.icon;
  return uri && String(uri).trim() ? String(uri).trim() : '';
};

const maskMobile = (p) => {
  if (!p) return '';
  const s = String(p).replace(/\s+/g, '');
  if (s.length < 6) return s;
  return `${s.slice(0, 2)}****${s.slice(-2)}`;
};

const isCancelled = (order) => {
  const st = String(order?.status || '').toLowerCase();
  return st === 'cancelled' || !!order?.cancelled_date;
};

const wasSamplePicked = (order) => {
  if (order?.picked_date) return true;
  const st = String(order?.status || '').toLowerCase();
  return ['picked_up', 'picked', 'sample_collected', 'in_lab', 'lab', 'processing', 'in_progress'].includes(st);
};

const isOrderCompleted = (order) => {
  const st = String(order?.status || '').toLowerCase();
  const rs = String(order?.report_status || '').toLowerCase();
  const hasReport = Array.isArray(order?.report) && order.report.length > 0;
  return hasReport || st === 'ready' || st === 'completed' || st === 'report_ready'
    || rs.includes('ready') || rs.includes('generated');
};

const getOrderProgress = (order) => {
  if (isCancelled(order)) {
    return { index: 2, terminal: 'cancelled', picked: wasSamplePicked(order) };
  }
  if (isOrderCompleted(order)) {
    return { index: 2, terminal: 'completed', picked: true };
  }
  if (wasSamplePicked(order)) {
    return { index: 1, terminal: null, picked: true };
  }
  return { index: 0, terminal: null, picked: false };
};

const getStage = (order) => getOrderProgress(order).index;

const parseOrderResponse = (json) => {
  const d = json?.data;
  let order = null;
  if (d && typeof d === 'object' && !Array.isArray(d)) order = d;
  else if (Array.isArray(d) && d.length) order = d[0];
  if (!order) return null;
  return {
    ...order,
    sample_pickup_date: order.order_sample_pickup_date || order.sample_pickup_date || null,
  };
};

const scheduledPickupRaw = (order) => order?.order_sample_pickup_date || order?.sample_pickup_date || null;

const formatScheduledPickup = (order) => {
  const raw = scheduledPickupRaw(order);
  if (!raw) return '-';
  return moment(raw).format('DD MMM YYYY');
};

const formatActualPickup = (order) => {
  if (order?.lmd_sample_pickup) return String(order.lmd_sample_pickup).trim();
  const raw = order?.picked_date || order?.mark_picked_at;
  if (!raw) return null;
  return moment(raw).format('DD MMM YYYY · hh:mm A');
};

const canCancelOrder = (order) => {
  if (!order?.id || isCancelled(order)) return false;
  const st = String(order?.status || '').toLowerCase();
  return !['completed', 'report_ready', 'ready'].includes(st);
};

const isPendingOrder = (order) => {
  if (!order?.id || isCancelled(order)) return false;
  return String(order?.status || '').toLowerCase() === 'pending';
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

function DetailRow({ icon, iconUri, label, value, valueColor, last }) {
  return (
    <View style={[st.dRow, !last && st.dRowBorder]}>
      {iconUri ? (
        <Image source={{ uri: iconUri }} style={st.dIco} resizeMode="contain" />
      ) : !!icon ? (
        <Image source={icon} style={st.dIco} resizeMode="contain" />
      ) : null}
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
    this.state = {
      loading: true,
      refreshing: false,
      cancelling: false,
      markingPickup: false,
      pickupSheetVisible: false,
      order: preview,
      dlIndex: -1,
    };
    this.pickupSheetRef = null;
    this.fade = new Animated.Value(0);
    this._seq = 0;
    this._BlobUtil = null;
    this._pendingOrderUpdate = null;
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

  fetchDetail = (fromRefresh = false) => {
    const id = this.orderId();
    if (!id) {
      Toast.show('Order ID nahi mila', Toast.SHORT);
      this.setState({ loading: false, refreshing: false });
      return;
    }

    const seq = ++this._seq;
    if (!fromRefresh) this.setState({ loading: true });

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
          this.setState({ loading: false, refreshing: false, order }, () => {
            if (!fromRefresh) this.runIntro();
            else this.fade.setValue(1);
          });
        } else {
          Toast.show(json?.message || 'Order detail nahi mila', Toast.SHORT);
          this.setState({ loading: false, refreshing: false });
        }
      })
      .catch(() => {
        if (seq !== this._seq) return;
        Toast.show('Order detail load nahi ho paya', Toast.SHORT);
        this.setState({ loading: false, refreshing: false });
      });
  };

  onRefresh = () => this.setState({ refreshing: true }, () => this.fetchDetail(true));

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

  onCallFarmer = (phone) => callFarmerExotel({
    orderId: this.orderId(),
    toPhone: phone,
    context: 'soil',
  });

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

  confirmMarkPickup = () => {
    if (this.state.markingPickup || this.state.cancelling) return;
    this.setState({ pickupSheetVisible: true });
  };

  closePickupSheet = () => {
    if (this.state.markingPickup) return;
    if (this.pickupSheetRef?.close) {
      this.pickupSheetRef.close();
      return;
    }
    this.onPickupSheetClosed();
  };

  onPickupSheetClosed = () => {
    this.setState({ pickupSheetVisible: false }, () => this.applyPendingPickupUpdate());
  };

  applyPendingPickupUpdate = () => {
    const updated = this._pendingOrderUpdate;
    if (!updated) return;
    this._pendingOrderUpdate = null;
    this.setState({ order: updated }, () => this.fade.setValue(1));
  };

  markSamplePickup = () => {
    const id = this.orderId();
    if (!id || this.state.markingPickup) return;
    this.setState({ markingPickup: true });

    fetch(constants.soilOrderPickup, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + global.token,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-localization': 'en',
      },
      body: JSON.stringify({ order_id: Number(id) }),
    })
      .then((r) => r.json())
      .then((json) => {
        if (json?.success || json?.status) {
          Toast.show(json?.message || 'Sample pickup mark ho gaya', Toast.SHORT);
          const updated = parseOrderResponse(json);
          if (updated) this._pendingOrderUpdate = updated;
          this.setState({ markingPickup: false }, () => {
            requestAnimationFrame(() => {
              if (this.pickupSheetRef?.close) {
                this.pickupSheetRef.close();
              } else {
                this.onPickupSheetClosed();
              }
            });
          });
        } else {
          Toast.show(json?.message || 'Pickup mark nahi ho paya', Toast.SHORT);
          this.setState({ markingPickup: false });
        }
      })
      .catch(() => {
        Toast.show('Kuch galat ho gaya', Toast.SHORT);
        this.setState({ markingPickup: false });
      });
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

  renderTracker = (order) => {
    const progress = getOrderProgress(order);
    const { index: active, terminal, picked } = progress;
    const cancelled = terminal === 'cancelled';
    const stepStatus = cancelled
      ? ORDER_STEPS[2].cancelLabel
      : active === 2
        ? ORDER_STEPS[2].label
        : ORDER_STEPS[active]?.label || '';
    const sm = cancelled
      ? { color: S.RED, bg: S.RED_BG, label: stepStatus }
      : STAGE[active] || STAGE[0];

    return (
      <View style={st.steps}>
        <View style={st.stepsHead}>
          <Text style={st.stepsTitle}>Order progress</Text>
          <View style={[st.stepsPill, { backgroundColor: sm.bg }]}>
            <View style={[st.stepsPillDot, { backgroundColor: sm.color }]} />
            <Text style={[st.stepsPillTxt, { color: sm.color }]} numberOfLines={1}>{stepStatus}</Text>
          </View>
        </View>

        <View style={st.stepsRow}>
          {ORDER_STEPS.map((step, i) => {
            const isTerminalStep = i === 2;
            const stepLabel = isTerminalStep && cancelled ? step.cancelLabel : step.label;
            const stepColor = isTerminalStep && cancelled && active === 2 ? step.cancelColor : step.color;
            const stepBg = isTerminalStep && cancelled && active === 2 ? step.cancelBg : step.bg;
            const done = i < active || (active === 2 && picked && i < 2);
            const on = i === active;
            return (
              <React.Fragment key={step.key}>
                {i > 0 && (
                  <View style={st.stepConnWrap}>
                    <View style={[st.stepConn, (done || on) && { backgroundColor: ORDER_STEPS[i - 1].color }]} />
                  </View>
                )}
                <View style={st.stepCol}>
                  <View style={[
                    st.stepDot,
                    done && { backgroundColor: stepColor, borderColor: stepColor },
                    on && { backgroundColor: stepBg, borderColor: stepColor, borderWidth: 2.5 },
                    !done && !on && { backgroundColor: '#FFF', borderColor: '#E2E8F0' },
                  ]}>
                    {done ? (
                      <Text style={st.stepTickTxt}>✓</Text>
                    ) : (
                      <Image source={step.ico} style={[st.stepIco, on && { tintColor: stepColor }]} resizeMode="contain" />
                    )}
                  </View>
                  <Text
                    style={[
                      st.stepLbl,
                      done && { color: stepColor },
                      on && { color: stepColor, fontWeight: '800' },
                    ]}
                    numberOfLines={2}
                  >
                    {stepLabel}
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
        <View style={st.farmerTopRow}>
          <View style={st.farmerAvtRing}>
            <Image source={ICO.farmer} style={st.farmerAvt} resizeMode="contain" />
          </View>
          <View style={st.farmerMeta}>
            <Text style={st.farmerCardName}>{name || 'Farmer'}</Text>
            {!!phone && (
              <Text style={st.farmerPhoneInline}>{maskMobile(phone)}</Text>
            )}
          </View>
          {!!phone && (
            <View style={st.farmerActs}>
              <TouchableOpacity
                style={st.farmerActBtn}
                activeOpacity={0.75}
                onPress={() => this.onCallFarmer(phone)}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              >
                <Image source={ICO.call} style={st.farmerActIco} resizeMode="contain" />
              </TouchableOpacity>
              <TouchableOpacity
                style={st.farmerActBtn}
                activeOpacity={0.75}
                onPress={() => this.whatsapp(phone)}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              >
                <Image source={ICO.whatsapp} style={st.farmerActIco} resizeMode="contain" />
              </TouchableOpacity>
            </View>
          )}
        </View>
        {!!addr && (
          <View style={st.farmerAddrRow}>
            <Image source={I.location} style={st.farmerLocIco} resizeMode="contain" />
            <Text style={st.farmerLocTxtFull}>{addr}</Text>
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
            <TouchableOpacity style={st.helpBtn} activeOpacity={0.75} onPress={() => this.whatsapp(wa)}>
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
          <View style={st.prodList}>
            {products.map((p, i) => (
              <View
                key={String(p.id)}
                style={[st.prodCard, i < products.length - 1 && st.prodCardGap]}
              >
                <View style={st.prodImgWrap}>
                  {!!p.image ? (
                    <Image source={{ uri: p.image }} style={st.prodImg} resizeMode="contain" />
                  ) : (
                    <View style={st.prodImgPlaceholder}>
                      <Image source={ICO.fertilizer} style={st.prodImgPlaceholderIco} resizeMode="contain" />
                    </View>
                  )}
                </View>
                <View style={st.prodBody}>
                  <View style={st.prodMetaRow}>
                    {!!p.subtitle && (
                      <Text style={st.prodSubtitle} numberOfLines={1}>{p.subtitle}</Text>
                    )}
                    {!!p.stageTag && (
                      <View style={st.prodStageChip}>
                        <Text style={st.prodStageChipTxt} numberOfLines={1}>{p.stageTag}</Text>
                      </View>
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
              </View>
            ))}
          </View>
        </SectionCard>
      </View>
    );
  };

  renderPickupSheet = () => {
    const { pickupSheetVisible, markingPickup, order } = this.state;
    if (!pickupSheetVisible) return null;

    const id = this.orderId();
    const farmer = order?.farmer?.name || order?.address?.fullName || 'Farmer';
    const pickupDate = scheduledPickupRaw(order)
      ? moment(scheduledPickupRaw(order)).format('DD MMM YYYY')
      : null;

    return (
      <BottomSheet
        ref={(r) => { this.pickupSheetRef = r; }}
        visible
        dynamicSize
        maxDynamicContentSize={380}
        onSheetClose={this.onPickupSheetClosed}
        enablePanDownToClose
      >
        <View style={[st.bsWrap, { paddingBottom: 20 + overlayBottomPadding() }]}>
          <View style={st.bsIconRing}>
            <Image source={ICO.soil} style={st.bsIcon} resizeMode="contain" />
          </View>
          <Text style={st.bsTitle}>Sample Pickup</Text>
          <Text style={st.bsSub}>Order #{id} · {farmer}</Text>
          {!!pickupDate && (
            <Text style={st.bsMeta}>Scheduled pickup · {pickupDate}</Text>
          )}
          <Text style={st.bsHint}>
            Confirm karein jab aap farmer se soil sample collect kar chuke hon.
          </Text>

          <TouchableOpacity
            activeOpacity={0.88}
            disabled={markingPickup}
            onPress={this.markSamplePickup}
            style={[st.bsConfirmBtn, markingPickup && { opacity: 0.6 }]}
          >
            {markingPickup ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={st.bsConfirmTxt}>Confirm Sample Pickup</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.75}
            disabled={markingPickup}
            onPress={() => this.pickupSheetRef?.close?.() || this.closePickupSheet()}
            style={st.bsCancelBtn}
          >
            <Text style={st.bsCancelTxt}>Abhi nahi</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>
    );
  };

  render() {
    const { loading, refreshing, order, cancelling, markingPickup } = this.state;
    const pkgLine = order?.packages?.[0];
    const pkg = pkgLine?.package || {};
    const farmer = order?.farmer || {};
    const addr = order?.address || {};
    const scheduledPickup = formatScheduledPickup(order);
    const actualPickup = formatActualPickup(order);
    const stage = getStage(order);
    const sm = STAGE[stage] || STAGE[0];
    const showCancel = canCancelOrder(order);
    const pending = isPendingOrder(order);
    const showFooter = showCancel || pending;
    const payStatus = String(order?.payment_status || 'unpaid');
    const unpaid = payStatus.toLowerCase() !== 'paid';
    const addrText = addr?.fullAddressLine || addr?.address || farmer?.address;
    const contactName = addr?.fullName || farmer?.name;
    const farmerDisplayName = farmer?.name || farmer?.farmer_name || contactName;
    const contactPhone = farmer?.mobile || farmer?.phone || addr?.mobile;
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

        <SafeAreaView edges={safeBottomEdges()} style={{ flex: 1 }}>
          {loading && !refreshing ? (
            <View style={st.loader}>
              <ActivityIndicator color={S.P} size="small" />
            </View>
          ) : (
            <Animated.View style={{ flex: 1, opacity: this.fade }}>
              <ScrollView
                contentContainerStyle={[st.scroll, showFooter && { paddingBottom: FOOTER_H + 8 }]}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={this.onRefresh}
                    colors={[S.P]}
                    tintColor={S.P}
                  />
                }
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

                  <View style={st.summaryDivider} />
                  {this.renderTracker(order)}

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
                  <DetailRow icon={ICO.cal} label="Scheduled pickup" value={scheduledPickup} />
                  {!!actualPickup && (
                    <DetailRow icon={ICO.trk} label="Sample picked" value={actualPickup} />
                  )}
                  <DetailRow
                    icon={ICO.pay}
                    iconUri={payIconUri(order) || undefined}
                    label="Payment"
                    value={`${payLbl(order?.payment_mode)} · ${titleCase(payStatus)}`}
                    valueColor={unpaid ? S.ORANGE : S.GREEN_DARK}
                  />
                  <DetailRow icon={ICO.pkg} label="Quantity" value={String(pkgLine?.quantity || 1)} />
                  <DetailRow icon={ICO.pdf} label="Report in" value={`${pkg?.expected_report_by || 1} din`} last />
                </SectionCard>

                {/* farmer / address */}
                <SectionCard title="Farmer & pickup">
                  {this.renderFarmer(farmerDisplayName, addrText, contactPhone)}
                </SectionCard>

                {this.renderSupport(order?.support)}
                {this.renderProducts(order?.recommendedProducts)}
              </ScrollView>
            </Animated.View>
          )}

          {showFooter && (
            <SafeAreaView edges={safeBottomEdges()} style={st.footer}>
              {pending ? (
                <View style={st.footerRow}>
                  <Pressable
                    onPress={this.confirmCancel}
                    disabled={cancelling || markingPickup}
                    style={({ pressed }) => [
                      st.cancelBtn,
                      st.cancelBtnCompact,
                      pressed && { opacity: 0.85 },
                      (cancelling || markingPickup) && { opacity: 0.5 },
                    ]}
                  >
                    {cancelling ? (
                      <ActivityIndicator color={S.RED} size="small" />
                    ) : (
                      <>
                        <Image source={I.close} style={st.cancelBtnIco} />
                        <Text style={st.cancelTxtCompact}>Cancel</Text>
                      </>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={this.confirmMarkPickup}
                    disabled={markingPickup || cancelling}
                    style={({ pressed }) => [
                      st.pickupBtn,
                      pressed && { opacity: 0.88 },
                      (markingPickup || cancelling) && { opacity: 0.55 },
                    ]}
                  >
                    <Image source={ICO.soil} style={st.pickupBtnIco} resizeMode="contain" />
                    <Text style={st.pickupBtnTxt} numberOfLines={1}>Sample Pickup</Text>
                  </Pressable>
                </View>
              ) : (
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
              )}
            </SafeAreaView>
          )}
          {this.renderPickupSheet()}
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
  scroll: { padding: PAD, paddingBottom: 20 },

  summary: {
    backgroundColor: '#FFF', borderRadius: 12, padding: CARD_PAD, marginBottom: 8,
    borderWidth: 1, borderColor: '#E8ECF1', borderLeftWidth: 4,
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  summaryTop: { flexDirection: 'row', alignItems: 'flex-start' },
  soilIco: {
    width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 9,
  },
  soilImg: { width: 26, height: 26 },
  summaryTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' },
  farmerName: { fontSize: 15, fontWeight: '700', color: S.TXT, flexShrink: 1 },
  pkgChip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  pkgChipTxt: { fontSize: 10, fontWeight: '700' },
  summaryPrice: { fontSize: 15, fontWeight: '700', color: S.TXT, marginLeft: 4 },
  summaryMeta: { fontSize: 11.5, fontWeight: '400', color: S.SUB },
  summaryDivider: {
    height: StyleSheet.hairlineWidth, backgroundColor: '#EEF2F6', marginTop: 10, marginBottom: 0,
  },

  steps: { marginTop: 8 },
  stepsHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8,
  },
  stepsTitle: { fontSize: 11, fontWeight: '700', color: S.MUTED, textTransform: 'uppercase', letterSpacing: 0.6 },
  stepsPill: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, gap: 5, maxWidth: '55%',
  },
  stepsPillDot: { width: 5, height: 5, borderRadius: 2.5 },
  stepsPillTxt: { fontSize: 10, fontWeight: '600', flexShrink: 1 },

  stepsRow: { flexDirection: 'row', alignItems: 'flex-start' },
  stepCol: { flex: 1, alignItems: 'center', minWidth: 0 },
  stepConnWrap: { flex: 1, height: 26, justifyContent: 'center', paddingHorizontal: 2, minWidth: 12, maxWidth: 36 },
  stepConn: { height: 2, borderRadius: 1, backgroundColor: '#E8EDF3' },
  stepDot: {
    width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: '#E2E8F0',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF',
  },
  stepIco: { width: 14, height: 14 },
  stepTickTxt: { fontSize: 14, fontWeight: '900', color: '#FFF', includeFontPadding: false, lineHeight: 16 },
  stepLbl: { fontSize: 9.5, fontWeight: '600', color: S.MUTED, marginTop: 5, textAlign: 'center', lineHeight: 12 },

  cancelBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: S.RED_BG,
  },
  cancelBannerIco: { width: 12, height: 12, resizeMode: 'contain', tintColor: S.RED, marginRight: 6 },
  cancelBannerTxt: { fontSize: 11.5, fontWeight: '600', color: S.RED },

  card: {
    backgroundColor: '#FFF', borderRadius: 12, padding: CARD_PAD, marginBottom: 8,
    borderWidth: 1, borderColor: '#E8ECF1',
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  secHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  secTitle: { fontSize: 11, fontWeight: '700', color: S.MUTED, textTransform: 'uppercase', letterSpacing: 0.6 },
  secTitleInCard: { marginBottom: 0 },
  secBadge: {
    minWidth: 22, height: 22, borderRadius: 11, backgroundColor: S.P_SOFT,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7,
  },
  secBadgeTxt: { fontSize: 10.5, fontWeight: '700', color: S.P_DARK },

  secHint: { fontSize: 11, fontWeight: '400', color: S.SUB, marginBottom: 8, marginTop: -2 },

  dRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 },
  dRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F1F5F9' },
  dIco: { width: 20, height: 20 },
  dLbl: { flex: 1, fontSize: 12.5, fontWeight: '500', color: S.SUB },
  dVal: { fontSize: 12.5, fontWeight: '600', color: S.TXT, textAlign: 'right', maxWidth: '44%' },

  reportRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingRight: 8, paddingLeft: 8,
    borderRadius: 9, backgroundColor: '#FAFBFC', borderWidth: 1, borderColor: '#EEF2F6', overflow: 'hidden', gap: 8,
  },
  reportRowGap: { marginBottom: 6 },
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
  farmerTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  farmerAvtRing: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: S.P_SOFT,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: S.P_GLOW,
  },
  farmerAvt: { width: 28, height: 28 },
  farmerMeta: { flex: 1, minWidth: 0, paddingTop: 2 },
  farmerCardName: { fontSize: 14, fontWeight: '700', color: S.TXT, marginBottom: 2 },
  farmerPhoneInline: { fontSize: 12, fontWeight: '600', color: S.SUB, letterSpacing: 0.3 },
  farmerAddrRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 10,
    paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F1F5F9',
  },
  farmerLocIco: { width: 14, height: 14, marginTop: 2, flexShrink: 0 },
  farmerLocTxtFull: { flex: 1, fontSize: 12.5, fontWeight: '500', color: S.SUB, lineHeight: 18 },
  farmerActs: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  farmerActBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  farmerActIco: { width: 28, height: 28, resizeMode: 'contain' },
  addrEmpty: { fontSize: 12.5, fontWeight: '400', color: S.MUTED, fontStyle: 'italic' },

  helpRow: { flexDirection: 'row', gap: 6 },
  helpBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8FAFC', borderRadius: 9, padding: 9, gap: 8,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#E8ECF1',
  },
  helpIco: { width: 28, height: 28, resizeMode: 'contain' },
  helpTxt: { fontSize: 12.5, fontWeight: '600', color: S.TXT },
  helpSub: { fontSize: 11, fontWeight: '400', color: S.SUB, marginTop: 1 },

  prodSection: { marginBottom: 2 },
  prodHead: { fontSize: 13.5, fontWeight: '700', color: S.TXT, marginBottom: 1 },
  prodSub: { fontSize: 11, fontWeight: '400', color: S.SUB, marginBottom: 8 },
  prodList: { gap: 0 },
  prodCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#FAFBFC',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E8ECF1',
    minHeight: PROD_IMG,
  },
  prodCardGap: { marginBottom: 8 },
  prodImgWrap: {
    width: PROD_IMG,
    height: PROD_IMG,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#E8ECF1',
  },
  prodImg: { width: '100%', height: '100%' },
  prodImgPlaceholder: {
    width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center',
  },
  prodImgPlaceholderIco: { width: 32, height: 32, opacity: 0.35 },
  prodBody: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  prodMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
    marginBottom: 3,
  },
  prodSubtitle: {
    fontSize: 9.5,
    fontWeight: '700',
    color: S.P_DARK,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  prodStageChip: {
    backgroundColor: S.P_SOFT,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    maxWidth: '100%',
  },
  prodStageChipTxt: { fontSize: 9, fontWeight: '600', color: S.P_DARK },
  prodName: { fontSize: 12, fontWeight: '600', color: S.TXT, lineHeight: 16 },
  prodPrice: { fontSize: 12.5, fontWeight: '700', color: S.GREEN_DARK, marginTop: 4 },
  prodNoteRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  prodNoteIco: { width: 11, height: 11, marginRight: 3, tintColor: S.MUTED },
  prodNote: { fontSize: 9.5, fontWeight: '400', color: S.SUB, flex: 1 },

  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#FFF', paddingHorizontal: FOOTER_PAD, paddingTop: 8, paddingBottom: 6,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E8ECF1',
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 6,
  },
  footerRow: { flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  cancelBtnCompact: {
    flexShrink: 0,
    paddingHorizontal: 14,
    minWidth: 88,
  },
  cancelTxtCompact: { fontSize: 13, fontWeight: '600', color: S.RED },
  pickupBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: S.GREEN_DARK,
    gap: 8,
  },
  pickupBtnIco: { width: 20, height: 20 },
  pickupBtnTxt: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#FECACA', backgroundColor: S.RED_BG,
  },
  cancelBtnIco: { width: 13, height: 13, resizeMode: 'contain', tintColor: S.RED, marginRight: 5 },
  cancelTxt: { fontSize: 14, fontWeight: '600', color: S.RED },

  bsWrap: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 20, alignItems: 'center' },
  bsIconRing: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: S.GREEN_BG,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
    borderWidth: 1, borderColor: '#BBF7D0',
  },
  bsIcon: { width: 30, height: 30 },
  bsTitle: { fontSize: 18, fontWeight: '700', color: S.TXT, marginBottom: 4 },
  bsSub: { fontSize: 13, fontWeight: '500', color: S.SUB, marginBottom: 4 },
  bsMeta: { fontSize: 12, fontWeight: '500', color: S.MUTED, marginBottom: 8 },
  bsHint: {
    fontSize: 13, fontWeight: '400', color: S.SUB, textAlign: 'center',
    lineHeight: 19, marginBottom: 18, paddingHorizontal: 8,
  },
  bsConfirmBtn: {
    width: '100%', height: 48, borderRadius: 12, backgroundColor: S.GREEN_DARK,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  bsConfirmTxt: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  bsCancelBtn: { paddingVertical: 10, paddingHorizontal: 16 },
  bsCancelTxt: { fontSize: 14, fontWeight: '500', color: S.MUTED },
});

export default withV4Navigation(SoilOrderDetail);
