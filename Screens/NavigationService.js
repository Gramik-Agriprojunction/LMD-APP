// NavigationService.js (React Navigation v4 style)
import { NavigationActions, StackActions } from 'react-navigation';

let _navigator = null;
const _queue = [];

function setTopLevelNavigator(navigatorRef) {
  _navigator = navigatorRef;
  // flush anything that tried to navigate before we had a ref
  while (_queue.length) {
    const action = _queue.shift();
    try { _navigator.dispatch(action); } catch {}
  }
}

function dispatchWhenReady(action) {
  if (_navigator) return _navigator.dispatch(action);
  _queue.push(action);
}

function navigate(routeName, params) {
  dispatchWhenReady(NavigationActions.navigate({ routeName, params }));
}

function push(routeName, params) {
  dispatchWhenReady(StackActions.push({ routeName, params }));
}

function resetTo(routeName, params) {
  const resetAction = StackActions.reset({
    index: 0,
    actions: [NavigationActions.navigate({ routeName, params })],
  });
  dispatchWhenReady(resetAction);
}

export default {
  setTopLevelNavigator,
  navigate,
  push,
  resetTo,
};