import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

/**
 * Catches JS render errors so a single screen failure doesn't take down the
 * whole activity (Play Console: "LMD keeps stopping").
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.log('[ErrorBoundary]', error?.message || error, info?.componentStack);
  }

  retry = () => this.setState({ hasError: false });

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={st.wrap}>
        <Text style={st.title}>Kuch gadbad ho gayi</Text>
        <Text style={st.sub}>App band nahi hui. Dobara try karein.</Text>
        <TouchableOpacity style={st.btn} onPress={this.retry} activeOpacity={0.85}>
          <Text style={st.btnT}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const st = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 18, fontWeight: '800', color: '#1E293B', marginBottom: 8, textAlign: 'center' },
  sub: { fontSize: 14, fontWeight: '500', color: '#64748B', textAlign: 'center', marginBottom: 20 },
  btn: { backgroundColor: '#5D3FD3', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12 },
  btnT: { color: '#FFF', fontSize: 14, fontWeight: '800' },
});
