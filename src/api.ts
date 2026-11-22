import type {
  Bill,
  Category,
  DiningTable,
  LanguageCode,
  MenuItem,
  OrderRequest,
  PaymentRecord,
  PlateCounts,
  Promotion,
  RedemptionRecord,
  RestaurantSettings,
  RewardItem,
  SplitPayment,
  UserProfile,
  UserRole,
  PointTransaction,
} from './types';

let memoryToken: string | null = null;
let activeRole: UserRole = 'user';
let activeUserId: string | null = null;

export function setAuthToken(token: string | null): void {
  memoryToken = token;
}

export function getAuthToken(): string | null {
  return memoryToken;
}

export function setActiveContext(role: UserRole, userId?: string | null): void {
  activeRole = role;
  activeUserId = userId ?? null;
}

export function getActiveRole(): UserRole {
  return activeRole;
}

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Active-Role': activeRole,
    ...(activeUserId ? { 'X-Active-User-Id': activeUserId } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };
  if (memoryToken) {
    headers['Authorization'] = `Bearer ${memoryToken}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export interface BootstrapStatus {
  needsAdminSetup: boolean;
  hasEnvPasscode: boolean;
  settings: {
    restaurantName: string;
    tagline: string;
    defaultLanguage: LanguageCode;
  };
}

export interface StorefrontPayload {
  settings: RestaurantSettings;
  categories: Category[];
  menu: MenuItem[];
  promotions: Promotion[];
  rewards: RewardItem[];
  tables: DiningTable[];
  bills: Bill[];
  orders: OrderRequest[];
  payments: PaymentRecord[];
  splitPayments: SplitPayment[];
  pointTransactions: PointTransaction[];
  redemptions: RedemptionRecord[];
  customersForStaff: Array<{
    id: string;
    name: string;
    email: string;
    phone: string;
    pointsBalance: number;
  }>;
  allUsers: UserProfile[];
}

export const api = {
  getBootstrapStatus: () => apiFetch<BootstrapStatus>('/api/auth/bootstrap-status'),
  claimAdmin: (body: { name: string; email: string; phone?: string; password: string; passcode?: string }) =>
    apiFetch<{ token: string; user: UserProfile }>('/api/auth/claim-admin', { method: 'POST', body: JSON.stringify(body) }),
  register: (body: { name: string; email: string; phone?: string; password: string }) =>
    apiFetch<{ token: string; user: UserProfile }>('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    apiFetch<{ token: string; user: UserProfile }>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => apiFetch<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  getProfiles: () => apiFetch<{ profiles: UserProfile[] }>('/api/profiles'),
  getMe: () => apiFetch<{ user: UserProfile }>('/api/auth/me'),
  forgotPassword: (email: string) =>
    apiFetch<{ ok: boolean; message: string; previewVerificationCode?: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  resetPassword: (body: { email: string; code: string; newPassword: string }) =>
    apiFetch<{ ok: boolean }>('/api/auth/reset-password', { method: 'POST', body: JSON.stringify(body) }),

  updateProfile: (body: Partial<Pick<UserProfile, 'name' | 'phone' | 'preferredLanguage' | 'dietaryNotes'>>) =>
    apiFetch<{ user: UserProfile }>('/api/profile', { method: 'PATCH', body: JSON.stringify(body) }),
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    apiFetch<{ ok: boolean }>('/api/profile/change-password', { method: 'POST', body: JSON.stringify(body) }),

  getStorefront: () => apiFetch<StorefrontPayload>('/api/storefront'),

  openTable: (tableId: string, body: { customerId?: string | null; guestName?: string }) =>
    apiFetch<{ table: DiningTable; bill: Bill }>(`/api/tables/${tableId}/open`, { method: 'POST', body: JSON.stringify(body) }),
  assignBillCustomer: (billId: string, body: { customerId?: string | null; guestName?: string }) =>
    apiFetch<{ bill: Bill }>(`/api/bills/${billId}/assign-customer`, { method: 'PATCH', body: JSON.stringify(body) }),
  updateBillPlates: (
    billId: string,
    body: {
      plateCounts?: PlateCounts;
      items?: Array<{ menuId: string; quantity: number }>;
      promotionId?: string | null;
    }
  ) => apiFetch<{ bill: Bill }>(`/api/bills/${billId}/plates`, { method: 'PATCH', body: JSON.stringify(body) }),
  applyPromotion: (billId: string, body: { promotionId?: string; code?: string }) =>
    apiFetch<{ bill: Bill }>(`/api/bills/${billId}/apply-promotion`, { method: 'POST', body: JSON.stringify(body) }),

  createOrder: (body: {
    tableId: string;
    note?: string;
    items: Array<{ menuId: string; quantity: number }>;
  }) => apiFetch<{ order: OrderRequest }>('/api/orders', { method: 'POST', body: JSON.stringify(body) }),
  serveOrder: (orderId: string) =>
    apiFetch<{ order: OrderRequest; bill: Bill }>(`/api/orders/${orderId}/serve`, { method: 'POST' }),
  cancelOrder: (orderId: string) =>
    apiFetch<{ order: OrderRequest }>(`/api/orders/${orderId}/cancel`, { method: 'POST' }),

  createPayment: (body: { billId: string; method: 'cash' | 'ppqr' }) =>
    apiFetch<{ payment: PaymentRecord; bill: Bill }>('/api/payments', { method: 'POST', body: JSON.stringify(body) }),
  confirmPayment: (paymentId: string) =>
    apiFetch<{ payment: PaymentRecord; bill: Bill }>(`/api/payments/${paymentId}/confirm`, { method: 'POST' }),
  failPayment: (paymentId: string, reason?: string) =>
    apiFetch<{ payment: PaymentRecord }>(`/api/payments/${paymentId}/fail`, { method: 'POST', body: JSON.stringify({ reason }) }),

  createSplitPayment: (body: {
    billId: string;
    mode: 'equal' | 'custom';
    participants: Array<{ participantName: string; amount?: number; method: 'cash' | 'ppqr' }>;
  }) => apiFetch<{ splitPayment: SplitPayment; bill: Bill }>('/api/split-payments', { method: 'POST', body: JSON.stringify(body) }),
  confirmSplitParticipant: (splitId: string, participantId: string) =>
    apiFetch<{ splitPayment: SplitPayment; bill: Bill }>(`/api/split-payments/${splitId}/participants/${participantId}/confirm`, {
      method: 'POST',
    }),

  redeemReward: (rewardId: string) =>
    apiFetch<{ redemption: RedemptionRecord; user: UserProfile; reward: RewardItem }>(`/api/rewards/${rewardId}/redeem`, {
      method: 'POST',
    }),
  markRedemptionUsed: (redemptionId: string) =>
    apiFetch<{ redemption: RedemptionRecord }>(`/api/redemptions/${redemptionId}/mark-used`, { method: 'POST' }),

  createMenuItem: (body: Partial<MenuItem>) =>
    apiFetch<{ item: MenuItem }>('/api/admin/menu', { method: 'POST', body: JSON.stringify(body) }),
  updateMenuItem: (id: string, body: Partial<MenuItem>) =>
    apiFetch<{ item: MenuItem }>(`/api/admin/menu/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteMenuItem: (id: string) => apiFetch<{ ok: boolean }>(`/api/admin/menu/${id}`, { method: 'DELETE' }),

  updateSettings: (body: Partial<RestaurantSettings>) =>
    apiFetch<{ settings: RestaurantSettings }>('/api/admin/settings', { method: 'PATCH', body: JSON.stringify(body) }),

  createAdminUser: (body: { name: string; email: string; phone?: string; password?: string; role: UserRole }) =>
    apiFetch<{ user: UserProfile }>('/api/admin/users', { method: 'POST', body: JSON.stringify(body) }),
  updateAdminUser: (id: string, body: { role?: UserRole; status?: 'active' | 'suspended'; name?: string; phone?: string }) =>
    apiFetch<{ user: UserProfile }>(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  createPromotion: (body: Partial<Promotion>) =>
    apiFetch<{ promotion: Promotion }>('/api/admin/promotions', { method: 'POST', body: JSON.stringify(body) }),
  updatePromotion: (id: string, body: Partial<Promotion>) =>
    apiFetch<{ promotion: Promotion }>(`/api/admin/promotions/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deletePromotion: (id: string) => apiFetch<{ ok: boolean }>(`/api/admin/promotions/${id}`, { method: 'DELETE' }),

  createReward: (body: Partial<RewardItem>) =>
    apiFetch<{ reward: RewardItem }>('/api/admin/rewards', { method: 'POST', body: JSON.stringify(body) }),
  updateReward: (id: string, body: Partial<RewardItem>) =>
    apiFetch<{ reward: RewardItem }>(`/api/admin/rewards/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
};
