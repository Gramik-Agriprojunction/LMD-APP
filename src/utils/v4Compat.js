import React, { useEffect, useMemo } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';

export const NavigationActions = {
  navigate: ({ routeName, params }) => ({ __v4: 'navigate', routeName, params }),
};

export const StackActions = {
  reset: ({ index = 0, actions = [] }) => ({ __v4: 'reset', index, actions }),
  push: ({ routeName, params }) => ({ __v4: 'push', routeName, params }),
  replace: ({ routeName, params }) => ({ __v4: 'replace', routeName, params }),
};

function buildCompatNavigation(navigation, route) {
  return {
    ...navigation,
    navigate: (routeName, params) => navigation.navigate(routeName, params),
    push: (routeName, params) => navigation.push?.(routeName, params),
    replace: (routeName, params) => navigation.replace?.(routeName, params),
    goBack: () => navigation.goBack(),
    getParam: (key, def) => {
      const v = route?.params?.[key];
      return v === undefined ? def : v;
    },
    dispatch: (action) => {
      if (action?.__v4 === 'reset') {
        const target = action.actions?.[action.index] || action.actions?.[0];
        if (!target) return;
        navigation.reset({
          index: 0,
          routes: [{ name: target.routeName, params: target.params }],
        });
        return;
      }
      if (action?.__v4 === 'navigate') {
        navigation.navigate(action.routeName, action.params);
        return;
      }
      if (action?.__v4 === 'push') {
        navigation.push?.(action.routeName, action.params);
        return;
      }
      if (action?.__v4 === 'replace') {
        navigation.replace?.(action.routeName, action.params);
        return;
      }
      navigation.dispatch(action);
    },
  };
}

export function withV4Navigation(Component) {
  return function V4Wrapper(props) {
    const navigation = useNavigation();
    const route = useRoute();
    const compat = useMemo(() => buildCompatNavigation(navigation, route), [navigation, route]);
    return <Component {...props} navigation={compat} route={route} />;
  };
}

export function NavigationEvents({ onWillFocus, onDidFocus, onWillBlur, onDidBlur }) {
  const navigation = useNavigation();
  useEffect(() => {
    const subFocus = navigation.addListener('focus', () => {
      if (typeof onWillFocus === 'function') onWillFocus();
      if (typeof onDidFocus === 'function') onDidFocus();
    });
    const subBlur = navigation.addListener('blur', () => {
      if (typeof onWillBlur === 'function') onWillBlur();
      if (typeof onDidBlur === 'function') onDidBlur();
    });
    return () => {
      subFocus();
      subBlur();
    };
  }, [navigation, onWillFocus, onDidFocus, onWillBlur, onDidBlur]);
  return null;
}

export default {
  NavigationActions,
  StackActions,
  NavigationEvents,
  withV4Navigation,
};
