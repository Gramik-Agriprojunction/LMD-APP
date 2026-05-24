import React from 'react';
import {
  View, Modal, StyleSheet, TouchableWithoutFeedback,
  Dimensions, Animated, PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const SH = Dimensions.get('window').height;

export default class BottomSheet extends React.Component {
  static defaultProps = { enablePanDownToClose: true };

  constructor(props) {
    super(props);
    this.translateY = new Animated.Value(SH);

    // Drag-to-close from anywhere inside the sheet.
    // - Capture phase fires before children (ScrollViews, lists, buttons) get
    //   the gesture, so a downward drag steals focus even when the touch lands
    //   on scrollable / tappable content.
    // - Direction guard (dy bigger than dx, downward only) prevents stealing
    //   from horizontal swipes or upward scrolls.
    // Lower threshold = snappier drag pickup. Direction guard keeps horizontal
    // swipes / upward scrolls from being stolen.
    const isDownwardDrag = (g) => g.dy > 6 && g.dy > Math.abs(g.dx) * 1.4;
    this.pan = PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, g) => isDownwardDrag(g),
      onMoveShouldSetPanResponderCapture: (_, g) => isDownwardDrag(g),
      onPanResponderGrant: () => {
        // Stop any in-flight spring so the drag tracks the finger from 0.
        this.translateY.stopAnimation();
      },
      onPanResponderMove: (_, g) => { if (g.dy > 0) this.translateY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 0.5) this.close();
        else Animated.spring(this.translateY, { toValue: 0, friction: 10, tension: 50, useNativeDriver: true }).start();
      },
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
    });
  }

  componentDidMount() {
    Animated.spring(this.translateY, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }).start();
    if (typeof this.props.onChange === 'function') this.props.onChange(0);
  }

  close = () => {
    Animated.timing(this.translateY, { toValue: SH, duration: 250, useNativeDriver: true }).start(() => {
      if (typeof this.props.onSheetClose === 'function') this.props.onSheetClose();
      if (typeof this.props.onChange === 'function') this.props.onChange(-1);
    });
  };

  render() {
    const { visible, children } = this.props;
    if (visible === false) return null;

    return (
      <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={() => this.close()}>
        <View style={$.root}>
          <TouchableWithoutFeedback onPress={() => this.close()}>
            <View style={$.touchArea} />
          </TouchableWithoutFeedback>
          <Animated.View
            {...this.pan.panHandlers}
            style={[$.sheet, { maxHeight: SH * 0.9, transform: [{ translateY: this.translateY }] }]}
          >
            <View style={$.handleWrap}>
              <View style={$.handle} />
            </View>
            <SafeAreaView edges={['bottom']}>
              {children}
            </SafeAreaView>
          </Animated.View>
        </View>
      </Modal>
    );
  }
}

const $ = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  touchArea: { flex: 1 },
  sheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 6,
  },
  handleWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 6 },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: '#CBD5E1' },
});
