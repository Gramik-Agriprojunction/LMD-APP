import React, { Component } from 'react';
import { withV4Navigation } from "../utils/v4Compat";
import { View, Text, StyleSheet } from 'react-native';

class Earnings extends Component {
  render() {
    return (
      <View style={styles.root}>
        <Text style={styles.h}>This Month</Text>
        <View style={styles.card}>
          <Text style={styles.title}>Total Earnings</Text>
          <Text style={styles.value}>₹ 8,420</Text>
          <Text style={styles.sub}>Includes COD settlements (demo)</Text>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3F5F7', padding: 14 },
  h: { fontSize: 12, fontWeight: '900', color: '#111827', marginBottom: 10 },
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E6EAF0', padding: 12 },
  title: { fontSize: 12, fontWeight: '800', color: '#4B5563' },
  value: { marginTop: 10, fontSize: 22, fontWeight: '900', color: '#1C8A62' },
  sub: { marginTop: 8, fontSize: 12, fontWeight: '700', color: '#6B7280' },
});
export default withV4Navigation(Earnings);
