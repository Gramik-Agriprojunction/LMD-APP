import React, { Component } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet, Linking, Platform, ActivityIndicator,
} from 'react-native';
import { checkForUpdate } from '../utils/updateCheck';
import { PLAY_STORE_URL } from '../utils/version';

const P = '#5D3FD3';

class UpdateModal extends Component {
  constructor() {
    super();
    this.state = {
      visible: false,
      latest: null,
      current: null,
      storeUrl: null,
      opening: false,
    };
  }

  componentDidMount() {
    // Delay slightly so the splash/login render isn't blocked by the network call.
    this._timer = setTimeout(() => this.runCheck(), 2500);
  }

  componentWillUnmount() {
    if (this._timer) clearTimeout(this._timer);
  }

  runCheck = async () => {
    const result = await checkForUpdate();
    if (result?.available) {
      this.setState({
        visible: true,
        latest: result.latest,
        current: result.current,
        storeUrl: result.storeUrl || (Platform.OS === 'android' ? PLAY_STORE_URL : null),
      });
    }
  };

  onUpdate = async () => {
    const url = this.state.storeUrl || (Platform.OS === 'android' ? PLAY_STORE_URL : null);
    if (!url) return;
    this.setState({ opening: true });
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        // Last-resort fallback: try a plain https URL
        await Linking.openURL(url.replace(/^itms-apps:\/\//, 'https://'));
      }
    } catch (e) {}
    // Keep modal open in case user comes back without updating.
    this.setState({ opening: false });
  };

  onLater = () => {
    this.setState({ visible: false });
  };

  render() {
    const { visible, latest, current, opening } = this.state;
    if (!visible) return null;

    return (
      <Modal
        visible={true}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={this.onLater}
      >
        <View style={st.backdrop}>
          <View style={st.card}>
            {/* Top accent band */}
            <View style={st.accentBar} />

            {/* Icon */}
            <View style={st.iconWrap}>
              <View style={st.iconCircle}>
                <Text style={st.iconArrow}>↑</Text>
              </View>
            </View>

            <Text style={st.title}>Update Available</Text>
            <Text style={st.subtitle}>
              A new version of Gramik LMD is available with improvements and bug fixes.
            </Text>

            {(current || latest) ? (
              <View style={st.versionRow}>
                {current ? (
                  <View style={st.versionPill}>
                    <Text style={st.versionPillLbl}>Current</Text>
                    <Text style={st.versionPillVal}>{current}</Text>
                  </View>
                ) : null}
                <View style={st.versionArrow}><Text style={st.versionArrowText}>›</Text></View>
                {latest ? (
                  <View style={[st.versionPill, st.versionPillNew]}>
                    <Text style={[st.versionPillLbl, st.versionPillLblNew]}>Latest</Text>
                    <Text style={[st.versionPillVal, st.versionPillValNew]}>{latest}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            <View style={st.btnRow}>
              <TouchableOpacity
                style={st.laterBtn}
                onPress={this.onLater}
                activeOpacity={0.7}
                disabled={opening}
              >
                <Text style={st.laterText}>Later</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[st.updateBtn, opening && { opacity: 0.7 }]}
                onPress={this.onUpdate}
                activeOpacity={0.85}
                disabled={opening}
              >
                {opening ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={st.updateText}>Update Now</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }
}

const st = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFF',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 20,
    alignItems: 'center',
    overflow: 'hidden',
    // soft shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: P,
  },
  iconWrap: {
    marginBottom: 18,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconArrow: {
    fontSize: 36,
    fontWeight: '900',
    color: P,
    marginTop: -2,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  versionPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    minWidth: 78,
  },
  versionPillNew: {
    backgroundColor: '#EDE9FE',
  },
  versionPillLbl: {
    fontSize: 9,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  versionPillLblNew: {
    color: P,
  },
  versionPillVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1F2937',
  },
  versionPillValNew: {
    color: P,
  },
  versionArrow: {
    paddingHorizontal: 10,
  },
  versionArrowText: {
    fontSize: 20,
    color: '#9CA3AF',
    fontWeight: '700',
  },
  btnRow: {
    flexDirection: 'row',
    width: '100%',
    alignItems: 'stretch',
    marginTop: 4,
  },
  laterBtn: {
    flex: 1,
    paddingVertical: 13,
    marginRight: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  laterText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '700',
  },
  updateBtn: {
    flex: 1.6,
    paddingVertical: 13,
    marginLeft: 8,
    borderRadius: 12,
    backgroundColor: P,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});

export default UpdateModal;
