import React, { Component } from 'react';
import { View, Text, ScrollView } from 'react-native';

export default class LedgerScreen extends Component {
  render() {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: '#F5F7F6' }}>

        <View style={{ backgroundColor: '#0F7451', padding: 20 }}>
          <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>
            Ledger
          </Text>
        </View>

        <View style={{
          backgroundColor: '#fff',
          margin: 15,
          padding: 20,
          borderRadius: 14
        }}>
          <Text style={{ fontSize: 16, fontWeight: '600' }}>
            Payable Balance
          </Text>
          <Text style={{ fontSize: 22, fontWeight: 'bold', marginVertical: 8 }}>
            ₹5,000
          </Text>
          <Text>Available for Withdrawal</Text>
        </View>

        <LedgerItem title="Grower Order Commission" amount="₹4,500" />
        <LedgerItem title="Direct Farmer Sale Commission" amount="₹6,800" />
        <LedgerItem title="Revenue Earned by Gramik" amount="₹8,300" />

      </ScrollView>
    );
  }
}

const LedgerItem = ({ title, amount }) => (
  <View style={{
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginVertical: 8,
    padding: 15,
    borderRadius: 12
  }}>
    <Text>{title}</Text>
    <Text style={{ fontWeight: '600' }}>{amount}</Text>
  </View>
);