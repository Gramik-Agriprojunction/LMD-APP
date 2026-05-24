// Canonical color coding for every order status — applied app-wide:
// LiveOrdersGrid tiles, status pills, action buttons, screen header backgrounds,
// confirm flows (Reject Delivery, Mark Dispute, RTO), etc.
//
// Each status exposes:
//   bg      — solid background (header / tile / primary button)
//   tint    — light wash for pills, soft backgrounds
//   accent  — readable text color on tint
//   label   — human-friendly display label

export const STATUS = {
  ALL:        { key: 'ALL',        bg: '#5D3FD3', tint: '#EDE9FE', accent: '#4C1D95', label: 'All' },
  PENDING:    { key: 'PENDING',    bg: '#EA580C', tint: '#FFEDD5', accent: '#9A3412', label: 'Pending' },
  RESCHEDULE: { key: 'RESCHEDULE', bg: '#9333EA', tint: '#F3E8FF', accent: '#6B21A8', label: 'Rescheduled' },
  PICKUP:     { key: 'PICKUP',     bg: '#0891B2', tint: '#CFFAFE', accent: '#0E7490', label: 'Picked Up' },
  DELIVERED:  { key: 'DELIVERED',  bg: '#16A34A', tint: '#DCFCE7', accent: '#166534', label: 'Delivered' },
  DISPUTED:   { key: 'DISPUTED',   bg: '#CA8A04', tint: '#FEF3C7', accent: '#854D0E', label: 'Disputed' },
  CANCELLED:  { key: 'CANCELLED',  bg: '#F87171', tint: '#FEE2E2', accent: '#B91C1C', label: 'Cancelled' },
  REJECTED:   { key: 'REJECTED',   bg: '#FB7185', tint: '#FFE4E6', accent: '#9F1239', label: 'Rejected' },
  RTO:        { key: 'RTO',        bg: '#EF4444', tint: '#FEF2F2', accent: '#991B1B', label: 'RTO' },
};

// Display order for the Live Orders grid and Track Orders tabs.
// `In-Transit` is intentionally dropped from this surface.
export const STATUS_SEQUENCE = ['ALL', 'PENDING', 'REJECTED', 'RESCHEDULE', 'PICKUP', 'DELIVERED', 'DISPUTED', 'CANCELLED', 'RTO'];

// Maps the various raw status strings returned by the backend / used in routing
// (lowercase, snake_case, abbreviated) to the canonical STATUS key.
const ALIAS = {
  all: 'ALL',

  pending: 'PENDING',

  reschedule: 'RESCHEDULE',
  rescheduled: 'RESCHEDULE',
  reschedule_order: 'RESCHEDULE',

  pickup: 'PICKUP',
  picked_up: 'PICKUP',
  pickedup: 'PICKUP',

  // In-transit was previously a tile — fold it into Picked Up so colors stay
  // consistent if the API still returns it.
  in_transit: 'PICKUP',
  intransit: 'PICKUP',

  delivered: 'DELIVERED',
  deliver: 'DELIVERED',

  disputed: 'DISPUTED',
  dispute: 'DISPUTED',

  cancelled: 'CANCELLED',
  canceled: 'CANCELLED',
  cancel: 'CANCELLED',

  rejected: 'REJECTED',
  reject: 'REJECTED',

  rto: 'RTO',
};

export const normalizeStatus = (s) => {
  if (!s) return 'ALL';
  const key = String(s).toLowerCase().replace(/[\s-]+/g, '_');
  if (ALIAS[key]) return ALIAS[key];
  const upper = String(s).toUpperCase();
  if (STATUS[upper]) return upper;
  return 'ALL';
};

export const getStatus = (s) => STATUS[normalizeStatus(s)] || STATUS.ALL;

// Convenience accessor used by older code that only needs the solid color.
export const getStatusBg = (s) => getStatus(s).bg;
