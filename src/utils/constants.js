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
  profile : baseurl + 'lmd/profile',
  cashSettle : baseurl + 'lmd/cash-settlement',
  settleHistory : baseurl + 'lmd/settlement-history',
  checkSettle : baseurl + 'lmd/check-settlement',
  settleList : baseurl + 'lmd/cash-settlement-list',
  settleDetail : baseurl + 'lmd/cash-settlement-detail/',
  submitSettlement : baseurl + 'lmd/submit-settlement',
  rejectReasons : baseurl + 'lmd/reject-list',
  disputeReasons : baseurl + 'lmd/dispute-reason',
  notification : baseurl + 'notification',
  orderVerifyOtp : baseurl + 'user/order-verify-otp',
  farmerSurveyForm : baseurl + 'lmd/farmer-survey/',
  fillSurvey : baseurl + 'lmd/create-farmer-survey',
  penaltyOrders : baseurl + 'lmd/penalty-orders',
  bulkPickupGenerateOtp : baseurl + 'lmd/bulk-pickup-generate-otp',
  bulkPickupOtpVerify : baseurl + 'lmd/bulk-pickup-otp-verify',
  soilOrders : baseurl + 'soil-testing/soil-order',
  soilOrderDetail : baseurl + 'soil-testing/soil-order/',
  cancelSoilOrder : baseurl + 'soil-testing/soil-order-cancelled/',
  soilOrderPickup : baseurl + 'soil-testing/soil-order-pickup',
  soilPackages : baseurl + 'soil-testing/soil-package',
  createSoilOrder : baseurl + 'soil-testing/soil-order',
  getPostOffice : baseurl + 'user/get-post-office',
  allFarmers : baseurl + 'user/all-farmer',
  exotelCall : baseurl + 'lmd/exotel/call',
};
export default strings;
