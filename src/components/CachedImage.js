/**
 * CachedImage — drop-in replacement for <Image> that backs network URIs with
 * react-native-fast-image (SDWebImage on iOS, Glide on Android) so they hit a
 * persistent disk cache and render instantly on revisit.
 *
 * Local `require(...)` images keep using the standard <Image> (bundled assets
 * are already instant).
 *
 * If the FastImage native module isn't linked (e.g. JS-only reload after a
 * fresh `yarn add` without rebuilding the native app), we transparently fall
 * back to RN's built-in <Image>. The fallback removes the disk-cache speedup
 * but the app keeps rendering instead of crashing with
 * "View config not found for component `FastImageView`".
 */
import React from 'react';
import { Image, View } from 'react-native';

// Lazy-load FastImage so a missing/unlinked native module doesn't crash JS.
let FastImage = null;
let _fastImageReady = false;
try {
  // eslint-disable-next-line global-require
  FastImage = require('react-native-fast-image').default;
  // Touch the native config — accessing the view manager throws if unlinked.
  // eslint-disable-next-line no-unused-expressions
  FastImage?.resizeMode?.cover;
  _fastImageReady = !!FastImage?.resizeMode;
} catch (e) {
  console.log('[CachedImage] FastImage unavailable — falling back to RN Image:', e?.message || e);
  FastImage = null;
  _fastImageReady = false;
}

// Map RN Image resizeMode → FastImage resizeMode (only used when FastImage is ready).
const RESIZE_MAP = _fastImageReady
  ? {
      cover: FastImage.resizeMode.cover,
      contain: FastImage.resizeMode.contain,
      stretch: FastImage.resizeMode.stretch,
      center: FastImage.resizeMode.center,
    }
  : {};

const isUriSource = (src) => !!src && typeof src === 'object' && typeof src.uri === 'string' && src.uri.length > 0;

const DEFAULT_PRIORITY = _fastImageReady ? FastImage.priority.normal : 'normal';
const DEFAULT_CACHE = _fastImageReady ? FastImage.cacheControl.immutable : 'immutable';

export default function CachedImage({
  source,
  style,
  resizeMode,
  priority,
  onLoad,
  onError,
  ...rest
}) {
  // No FastImage native module → just use RN Image for everything.
  if (!_fastImageReady) {
    return <Image source={source} style={style} resizeMode={resizeMode} onLoad={onLoad} onError={onError} {...rest} />;
  }

  if (!isUriSource(source)) {
    // Bundled asset — already instant.
    return <Image source={source} style={style} resizeMode={resizeMode} onLoad={onLoad} onError={onError} {...rest} />;
  }

  // Strip "file://" local previews — FastImage handles them fine, but a plain
  // Image is slightly cheaper for local URIs.
  if (source.uri.startsWith('file:')) {
    return <Image source={source} style={style} resizeMode={resizeMode} onLoad={onLoad} onError={onError} {...rest} />;
  }

  return (
    <FastImage
      source={{ uri: source.uri, priority: priority || DEFAULT_PRIORITY, cache: DEFAULT_CACHE }}
      style={style}
      resizeMode={RESIZE_MAP[resizeMode] || FastImage.resizeMode.cover}
      onLoad={onLoad}
      onError={onError}
      {...rest}
    />
  );
}

// Public helpers so callers can warm the cache when a list of URLs is known
// (e.g. right after the orders API resolves).
export const preloadImages = (urls = [], { priority = 'normal' } = {}) => {
  if (!_fastImageReady) return;
  const pri = priority === 'high' ? FastImage.priority.high : FastImage.priority.normal;
  const list = (Array.isArray(urls) ? urls : [])
    .filter((u) => typeof u === 'string' && /^https?:\/\//i.test(u))
    .map((uri) => ({ uri, priority: pri, cache: FastImage.cacheControl.immutable }));
  if (list.length) FastImage.preload(list);
};

export const clearImageCache = async () => {
  if (!_fastImageReady) return;
  try {
    await FastImage.clearMemoryCache();
    await FastImage.clearDiskCache();
  } catch (e) {}
};
