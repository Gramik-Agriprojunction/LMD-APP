/** Navigate into MainTabs (Home / Orders / Cash / Profile) from stack or sibling tabs. */
export function goTab(navigation, tabName, params) {
  if (!navigation?.navigate) return;

  const state = navigation.getState?.();
  if (state?.routeNames?.includes(tabName)) {
    navigation.navigate(tabName, params);
    return;
  }

  let nav = navigation.getParent?.();
  while (nav) {
    const st = nav.getState?.();
    if (st?.routeNames?.includes(tabName)) {
      nav.navigate(tabName, params);
      return;
    }
    if (st?.routeNames?.includes('MainTabs')) {
      nav.navigate('MainTabs', { screen: tabName, params });
      return;
    }
    nav = nav.getParent?.();
  }

  navigation.navigate('MainTabs', { screen: tabName, params });
}

export function goOrders(navigation, params) {
  goTab(navigation, 'Orders', params);
}

export function goCash(navigation, params) {
  goTab(navigation, 'Cash', params);
}

export function goProfile(navigation, params) {
  goTab(navigation, 'Profile', params);
}

export function goHome(navigation, params) {
  goTab(navigation, 'Home', params);
}
