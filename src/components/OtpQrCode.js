import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { create as createQr } from 'qrcode/lib/core/qrcode';

const DARK = '#2E1065';
const LIGHT = '#FFFFFF';
const QUIET_ZONE = 2;

function buildMatrix(code) {
  try {
    const qr = createQr(code, { errorCorrectionLevel: 'M' });
    const { size, data } = qr.modules;
    const rows = [];
    for (let r = 0; r < size; r++) {
      const row = [];
      for (let c = 0; c < size; c++) row.push(!!data[r * size + c]);
      rows.push(row);
    }
    return rows;
  } catch (e) {
    return null;
  }
}

export default function OtpQrCode({ value, size = 168, forFarmer = false }) {
  const code = String(value || '').trim();
  const matrix = useMemo(() => (code ? buildMatrix(code) : null), [code]);

  if (!code) return null;

  const hint = forFarmer
    ? 'Farmer is QR scan karke OTP verify karein'
    : 'Dark Store is QR scan karke OTP verify karein';

  const cells = matrix ? matrix.length + QUIET_ZONE * 2 : 0;
  const cell = cells ? Math.floor(size / cells) : 0;
  const drawSize = cell * cells;

  return (
    <View style={s.wrap}>
      <View style={s.qrFrame}>
        {matrix && cell > 0 ? (
          <View
            style={{ width: drawSize, height: drawSize, padding: cell * QUIET_ZONE, backgroundColor: LIGHT }}
            accessibilityLabel="OTP QR code"
          >
            {matrix.map((row, r) => (
              <View key={r} style={s.row}>
                {row.map((on, c) => (
                  <View
                    key={c}
                    style={{ width: cell, height: cell, backgroundColor: on ? DARK : LIGHT }}
                  />
                ))}
              </View>
            ))}
          </View>
        ) : (
          <View style={[s.fallbackBox, { width: size, height: size }]}>
            <Text style={s.fallback}>QR load nahi ho paya</Text>
          </View>
        )}
      </View>
      <Text style={s.hint}>{hint}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    marginBottom: 12,
  },
  qrFrame: {
    padding: 10,
    borderRadius: 16,
    backgroundColor: LIGHT,
    borderWidth: 1.5,
    borderColor: 'rgba(93,63,211,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row' },
  fallbackBox: { alignItems: 'center', justifyContent: 'center' },
  fallback: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    textAlign: 'center',
    padding: 8,
  },
  hint: {
    marginTop: 8,
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 16,
    lineHeight: 16,
  },
});
