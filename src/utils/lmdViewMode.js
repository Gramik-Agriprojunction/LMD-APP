// Super Admin "view as LMD" mode (read-only). Mirrors old/LMD Flutter lmd_view_mode_provider.
// Normal LMD users are never affected: everything here is a no-op unless userType === 'superadmin'.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { invalidateAll } from './dataCache';
import { clearFarmerCache } from './farmerCache';

const KEY_ID = 'viewPartnerId';
const KEY_NAME = 'viewPartnerName';

export const READ_ONLY_MESSAGE = 'View only — Super Admin is mode me changes nahi kar sakte.';

export const isSuperAdmin = () => String(global.userType || '').toLowerCase() === 'superadmin';

export const getViewPartnerId = () => (isSuperAdmin() ? global.viewPartnerId || null : null);

export const getViewPartnerName = () => global.viewPartnerName || '';

export const isReadOnly = () => isSuperAdmin();

export const needsPartnerSelection = () => isSuperAdmin() && !global.viewPartnerId;

export async function loadViewPartner() {
  try {
    const [[, id], [, name]] = await AsyncStorage.multiGet([KEY_ID, KEY_NAME]);
    global.viewPartnerId = id || null;
    global.viewPartnerName = name || '';
  } catch (e) {
    global.viewPartnerId = null;
    global.viewPartnerName = '';
  }
}

export async function setViewPartner(id, name) {
  global.viewPartnerId = String(id);
  global.viewPartnerName = name || '';
  invalidateAll();
  clearFarmerCache();
  try {
    await AsyncStorage.multiSet([[KEY_ID, String(id)], [KEY_NAME, name || '']]);
  } catch (e) {}
}

export async function clearViewPartner() {
  global.viewPartnerId = null;
  global.viewPartnerName = '';
  try {
    await AsyncStorage.multiRemove([KEY_ID, KEY_NAME]);
  } catch (e) {}
}

export const VIEW_PARTNER_STORAGE_KEYS = [KEY_ID, KEY_NAME];
