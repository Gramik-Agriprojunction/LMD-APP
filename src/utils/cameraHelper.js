import { PermissionsAndroid, Platform } from 'react-native';

/** Request camera via the OS permission dialog only — no custom alerts. */
export const requestCameraOrPrompt = async () => {
  if (Platform.OS !== 'android') return true;

  const perm = PermissionsAndroid.PERMISSIONS.CAMERA;
  try {
    if (await PermissionsAndroid.check(perm)) return true;

    const result = await PermissionsAndroid.request(perm, {
      title: 'Camera permission',
      message: 'Delivery proof photo ke liye camera access chahiye',
      buttonPositive: 'Allow',
      buttonNegative: 'Cancel',
    });

    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch (e) {
    return false;
  }
};
