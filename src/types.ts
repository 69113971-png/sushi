export type UserRole = 'admin' | 'staff' | 'user';
export type AccountStatus = 'active' | 'suspended';
export type PlateColor = 'white' | 'red' | 'silver' | 'gold' | 'black';
export type LanguageCode = 'th' | 'en' | 'jp';

export type ScreenId =
  | 'splash'
  | 'login'
  | 'register'
  | 'forgot_password'
  | 'customer_home'
  | 'menu'
  | 'menu_details'
  | 'customer_profile'
  | 'customer_current_bill'
  | 'staff_dashboard'
  | 'table_management'
  | 'plate_counter'
  | 'bill_summary'
  | 'payment_selection'
  | 'ppqr_payment'
  | 'split_bill'
  | 'payment_status'
  | 'rewards'
  | 'reward_redemption'
  | 'order_history'
  | 'receipt_details'
  | 'admin_dashboard'
  | 'menu_management'
  | 'price_settings'
  | 'staff_management'
  | 'promotion_management'
  | 'sales_reports'
  | 'restaurant_settings';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  status: AccountStatus;
  pointsBalance: number;
  preferredLanguage: LanguageCode;
  dietaryNotes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  nameTh: string;
  nameEn: string;
  nameJp: string;
  sortOrder: number;
  active: boolean;
}

export interface MenuItem {
  id: string;
  categoryId: string;
  nameTh: string;
  nameEn: string;
  nameJp: string;
  descriptionTh: string;
  descriptionEn: string;
  plateColor: PlateColor;
  imageUrl: string;
  calories: number;
  allergens: string;
  available: boolean;
  featured: boolean;
  createdAt: string;
}

export interface DiningTable {
  id: string;
  tableCode: string;
  zone: 'counter' | 'main' | 'tatami';
  capacity: number;
  status: 'available' | 'occupied' | 'waiting_payment';
  currentBillId: string | null;
  assignedCustomerId: string | null;
  assignedCustomerName: string | null;
}

export type PlateCounts = Record<PlateColor, number>;
export type PlatePrices = Record<PlateColor, number>;

export interface BillLineItem {
  menuId: string;
  nameTh: string;
  nameEn: string;
  plateColor: PlateColor;
  platePrice: number;
  quantity: number;
}

export interface OrderRequestItem {
  menuId: string;
  nameTh: string;
  nameEn: string;
  plateColor: PlateColor;
  platePrice: number;
  quantity: number;
}

export interface OrderRequest {
  id: string;
  billId: string | null;
  tableId: string;
  tableCode: string;
  customerId: string;
  customerName: string;
  items: OrderRequestItem[];
  note: string;
  estimatedFoodSubtotal: number;
  status: 'pending' | 'served' | 'cancelled';
  servedByStaffName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Bill {
  id: string;
  receiptNumber: string;
  tableId: string;
  tableCode: string;
  customerId: string | null;
  customerName: string;
  staffId: string;
  staffName: string;
  plateCounts: PlateCounts;
  items: BillLineItem[];
  promotionId: string | null;
  promotionCode: string | null;
  promotionDiscount: number;
  foodSubtotal: number;
  serviceChargeRate: number;
  serviceCharge: number;
  netTotal: number;
  status: 'open' | 'pending_payment' | 'paid' | 'cancelled';
  paymentMethod: 'cash' | 'ppqr' | 'split' | null;
  pointsAwarded: boolean;
  pointsEarned: number;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
}

export interface PaymentRecord {
  id: string;
  billId: string;
  receiptNumber: string;
  customerId: string | null;
  method: 'cash' | 'ppqr';
  amount: number;
  status: 'pending' | 'paid' | 'failed';
  ppqrUrl: string;
  referenceCode: string;
  confirmedByStaffId: string | null;
  confirmedByStaffName: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SplitParticipant {
  id: string;
  participantName: string;
  amount: number;
  method: 'cash' | 'ppqr';
  status: 'pending' | 'paid' | 'failed';
  ppqrUrl: string;
  confirmedByStaffId: string | null;
  paidAt: string | null;
}

export interface SplitPayment {
  id: string;
  billId: string;
  mode: 'equal' | 'custom';
  totalAmount: number;
  splits: SplitParticipant[];
  createdAt: string;
  updatedAt: string;
}

export interface PointTransaction {
  id: string;
  userId: string;
  billId: string | null;
  rewardId: string | null;
  type: 'earn' | 'redeem' | 'adjust';
  points: number;
  description: string;
  createdAt: string;
}

export interface RewardItem {
  id: string;
  titleTh: string;
  titleEn: string;
  titleJp: string;
  descriptionTh: string;
  descriptionEn: string;
  pointsCost: number;
  imageUrl: string;
  stock: number;
  active: boolean;
}

export interface RedemptionRecord {
  id: string;
  userId: string;
  userName: string;
  rewardId: string;
  rewardTitle: string;
  pointsSpent: number;
  voucherCode: string;
  status: 'active' | 'used';
  createdAt: string;
  usedAt: string | null;
}

export interface Promotion {
  id: string;
  titleTh: string;
  titleEn: string;
  descriptionTh: string;
  descriptionEn: string;
  code: string;
  discountPercent: number;
  minSpend: number;
  active: boolean;
  validUntil: string;
}

export interface RestaurantSettings {
  restaurantName: string;
  tagline: string;
  branchName: string;
  address: string;
  phone: string;
  taxId: string;
  openingHours: string;
  currency: string;
  defaultLanguage: LanguageCode;
  platePrices: PlatePrices;
  serviceChargeRate: number;
  pointsBahtRate: number;
  ppqrBaseUrl: string;
}

export interface AuthState {
  needsAdminSetup: boolean;
  user: UserProfile | null;
  token: string | null;
}
