// Live Base URL
// const baseurl = 'https://lens-api.gramik.in/api/v1/';

// UAT Base URL
const baseurl = 'https://uat-crm-backend.gramik.in/api/v1/';

const strings = {
  login: baseurl + 'auth/lmd/login',
  verifyOtp : baseurl + 'auth/lmd/verify-otp',
  homescreen : baseurl + 'lmd/home',
  orderList : baseurl + 'lmd/orderList',
  orderDetails : baseurl + 'lmd/orderDetails',
  updateStatus : baseurl + 'lmd/update_order_status',
  getQR : baseurl + 'lmd/genrate-qr/',
  cancelReasons : baseurl + 'lmd/cancel-reason',
  cashSettle : baseurl + 'lmd/cash-settlement',
  banks : baseurl + 'lmd/bank-list',
  profile : baseurl + 'lmd/profile',
  settleHistory : baseurl + 'lmd/cash-settlement?status=',
  checkSettle : baseurl + 'lmd/check-settlement',
  settleList : baseurl + 'lmd/cash-settlement-list',
  confirmSettle : baseurl + 'lmd/cash-settlement?status=',
  rejectReasons : baseurl + 'lmd/reject-list',
  notification : baseurl + 'notification',
  orderVerifyOtp : baseurl + 'user/order-verify-otp',
  farmerSurveyForm : baseurl + 'lmd/farmer-survey/',
  fillSurvey : baseurl + 'lmd/create-farmer-survey',
};
export default strings;
