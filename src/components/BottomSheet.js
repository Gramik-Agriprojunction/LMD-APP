import React from 'react';
import {
  View, Modal, StyleSheet, TouchableWithoutFeedback,
  Dimensions, Animated, PanResponder,
} from 'react-native';

const SH = Dimensions.get('window').height;

export default class BottomSheet extends React.Component {
  static defaultProps = { enablePanDownToClose: true };

  constructor(props) {
    super(props);
    this.translateY = new Animated.Value(SH);

    this.pan = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
      onPanResponderMove: (_, g) => { if (g.dy > 0) this.translateY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 0.5) this.close();
        else Animated.spring(this.translateY, { toValue: 0, friction: 10, tension: 50, useNativeDriver: true }).start();
      },
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
          <Animated.View style={[$.sheet, { maxHeight: SH * 0.8, transform: [{ translateY: this.translateY }] }]}>
            <View {...this.pan.panHandlers} style={$.handleWrap}>
              <View style={$.handle} />
            </View>
            {children}
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
    shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 24,
  },
  handleWrap: { alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB' },
});
