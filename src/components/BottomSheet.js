import React, {
  forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef,
} from 'react';
import { StyleSheet } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetView,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';

const BottomSheet = forwardRef(function BottomSheet(props, ref) {
  const {
    visible = true,
    children,
    onSheetClose,
    enablePanDownToClose = true,
    enableContentPanningGesture: contentPanningGesture,
    onChange,
    scrollable = false,
    snapPoint = '92%',
    dynamicSize = false,
    maxDynamicContentSize,
  } = props;

  const modalRef = useRef(null);
  const snapPoints = useMemo(() => [snapPoint], [snapPoint]);
  const contentPanning = contentPanningGesture ?? enablePanDownToClose;

  useImperativeHandle(ref, () => ({
    close: () => modalRef.current?.dismiss(),
  }));

  useEffect(() => {
    if (visible) {
      const frame = requestAnimationFrame(() => {
        modalRef.current?.present();
      });
      return () => {
        cancelAnimationFrame(frame);
        modalRef.current?.dismiss();
      };
    }
    modalRef.current?.dismiss();
  }, [visible]);

  const renderBackdrop = useCallback((backdropProps) => (
    <BottomSheetBackdrop
      {...backdropProps}
      disappearsOnIndex={-1}
      appearsOnIndex={0}
      opacity={0.5}
      pressBehavior="close"
    />
  ), []);

  const handleChange = useCallback((index) => {
    onChange?.(index);
  }, [onChange]);

  const handleDismiss = useCallback(() => {
    onSheetClose?.();
    onChange?.(-1);
  }, [onSheetClose, onChange]);

  const Wrapper = scrollable ? BottomSheetScrollView : BottomSheetView;

  return (
    <BottomSheetModal
      ref={modalRef}
      snapPoints={dynamicSize ? undefined : snapPoints}
      enableDynamicSizing={dynamicSize}
      maxDynamicContentSize={maxDynamicContentSize}
      enablePanDownToClose={enablePanDownToClose}
      enableContentPanningGesture={contentPanning}
      enableHandlePanningGesture={enablePanDownToClose}
      backdropComponent={renderBackdrop}
      onChange={handleChange}
      onDismiss={handleDismiss}
      handleIndicatorStyle={$.handle}
      backgroundStyle={$.sheetBg}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
    >
      <Wrapper
        style={scrollable ? $.scrollWrap : $.content}
        contentContainerStyle={scrollable ? $.scrollInner : undefined}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </Wrapper>
    </BottomSheetModal>
  );
});

BottomSheet.defaultProps = { enablePanDownToClose: true };

export { BottomSheetScrollView };
export default BottomSheet;

const $ = StyleSheet.create({
  sheetBg: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handle: { width: 44, height: 5, backgroundColor: '#CBD5E1' },
  content: { flexGrow: 0 },
  scrollWrap: { flex: 1 },
  scrollInner: { paddingBottom: 8 },
});
