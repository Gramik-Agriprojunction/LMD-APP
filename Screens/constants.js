const baseurl = 'https://b2c.gramik.in/public/api'


// const baseurl = 'https://uatb2c.gramik.in/api/lmd/'

const strings = {
  login: baseurl + 'login',
  verifyOtp : baseurl + 'verify-otp',
  homescreen : baseurl + 'home',
  orderList : baseurl + 'orderList',
  orderDetails : baseurl + 'orderDetails',
  updateStatus : baseurl + 'update_order_status',
  getQR : baseurl + 'genrate-qr/',
  cancelReasons : baseurl + 'cancel-reason',
  cashSettle : baseurl + 'cash-settlement',
  banks : baseurl + 'bank-list',
  profile : baseurl + 'profile',
  settleHistory : baseurl + 'cash-settlement?status=',
  checkSettle : baseurl + 'check-settlement',
  settleList : baseurl + 'cash-settlement-list',
  confirmSettle : baseurl + 'cash-settlement?status=',
};
export default strings;
