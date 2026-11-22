import { useCallback, useEffect, useState } from 'react';
import {
  Award,
  BarChart3,
  Calculator,
  Gift,
  History,
  Home,
  LayoutDashboard,
  Menu as MenuIcon,
  Receipt,
  Settings,
  Shield,
  Tag,
  User as UserIcon,
  Users,
  Utensils,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { api, setActiveContext, type StorefrontPayload } from './api';
import { UI_TEXT } from './i18n';
import { AdminScreens } from './screens/AdminScreens';
import { CustomerScreens } from './screens/CustomerScreens';
import { StaffAndPaymentScreens } from './screens/StaffAndPaymentScreens';
import type { LanguageCode, MenuItem, ScreenId, UserProfile, UserRole } from './types';

const ADMIN_SCREENS = new Set<ScreenId>([
  'admin_dashboard',
  'menu_management',
  'price_settings',
  'staff_management',
  'promotion_management',
  'sales_reports',
  'restaurant_settings',
]);

const STAFF_SCREENS = new Set<ScreenId>([
  'staff_dashboard',
  'table_management',
  'plate_counter',
  'bill_summary',
]);

function getHomeForRole(role: UserRole): ScreenId {
  if (role === 'admin') return 'admin_dashboard';
  if (role === 'staff') return 'staff_dashboard';
  return 'customer_home';
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);

  const [user, setUser] = useState<UserProfile | null>(null);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [screen, setScreen] = useState<ScreenId>('customer_home');
  const [lang, setLang] = useState<LanguageCode>('th');

  const [storefront, setStorefront] = useState<StorefrontPayload | null>(null);
  const [storeLoading, setStoreLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [selectedRewardId, setSelectedRewardId] = useState<string | null>(null);

  const refreshStorefront = useCallback(async () => {
    setStoreLoading(true);
    try {
      const [meRes, data, profRes] = await Promise.all([
        api.getMe(),
        api.getStorefront(),
        api.getProfiles(),
      ]);
      setUser(meRes.user);
      setStorefront(data);
      setProfiles(profRes.profiles);
    } catch (err) {
      setBootError(err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลร้านได้');
    } finally {
      setStoreLoading(false);
    }
  }, []);

  const loadBootstrap = useCallback(async () => {
    setBooting(true);
    setBootError(null);
    try {
      setActiveContext('user', null);
      const [boot, meRes, data, profRes] = await Promise.all([
        api.getBootstrapStatus(),
        api.getMe(),
        api.getStorefront(),
        api.getProfiles(),
      ]);
      setUser(meRes.user);
      setStorefront(data);
      setProfiles(profRes.profiles);
      if (boot.settings.defaultLanguage) {
        setLang(boot.settings.defaultLanguage);
      }
      setScreen('customer_home');
    } catch (err) {
      setBootError(err instanceof Error ? err.message : 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    } finally {
      setBooting(false);
    }
  }, []);

  useEffect(() => {
    loadBootstrap();
  }, [loadBootstrap]);

  const handleSwitchRole = async (nextRole: UserRole, userId?: string | null) => {
    setActiveContext(nextRole, userId ?? null);
    setMobileMenuOpen(false);
    setStoreLoading(true);
    try {
      const [meRes, data, profRes] = await Promise.all([
        api.getMe(),
        api.getStorefront(),
        api.getProfiles(),
      ]);
      setUser(meRes.user);
      setStorefront(data);
      setProfiles(profRes.profiles);
      setScreen(getHomeForRole(meRes.user.role));
    } finally {
      setStoreLoading(false);
    }
  };

  // Workspace RBAC Screen Guard
  const navigate = (target: ScreenId) => {
    setMobileMenuOpen(false);
    if (!user) return;
    if (ADMIN_SCREENS.has(target) && user.role !== 'admin') {
      setScreen(getHomeForRole(user.role));
      return;
    }
    if (STAFF_SCREENS.has(target) && user.role !== 'staff' && user.role !== 'admin') {
      setScreen(getHomeForRole(user.role));
      return;
    }
    setScreen(target);
  };

  const handleAddMenuItemToActiveBill = async (item: MenuItem) => {
    if (!storefront) return;
    const openBill =
      storefront.bills.find((b) => b.id === selectedBillId && b.status !== 'paid') ||
      storefront.bills.find((b) => b.status === 'open');
    if (!openBill) {
      navigate('table_management');
      return;
    }
    const nextCounts = { ...openBill.plateCounts };
    nextCounts[item.plateColor] = (nextCounts[item.plateColor] || 0) + 1;
    const nextItems = [...openBill.items];
    const existingIdx = nextItems.findIndex((i) => i.menuId === item.id);
    if (existingIdx >= 0) {
      nextItems[existingIdx] = { ...nextItems[existingIdx], quantity: nextItems[existingIdx].quantity + 1 };
    } else {
      nextItems.push({
        menuId: item.id,
        nameTh: item.nameTh,
        nameEn: item.nameEn,
        plateColor: item.plateColor,
        platePrice: storefront.settings.platePrices[item.plateColor],
        quantity: 1,
      });
    }
    await api.updateBillPlates(openBill.id, {
      plateCounts: nextCounts,
      items: nextItems.map((i) => ({ menuId: i.menuId, quantity: i.quantity })),
    });
    setSelectedBillId(openBill.id);
    await refreshStorefront();
  };

  if (booting) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#171717] text-[#F5F0E6]">
        <p className="font-display text-3xl tracking-widest text-[#C6A56B]">SUSHI HOUSE</p>
        <p className="mt-2 text-xs text-[#F5F0E6]/70">กำลังเตรียมร้านอาหารและเมนูสำหรับคุณ...</p>
      </div>
    );
  }

  if (bootError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F5F0E6] p-6 text-center text-[#171717]">
        <h1 className="font-display text-2xl font-semibold text-[#7B252B]">ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้</h1>
        <p className="mt-2 text-sm text-[#77716A]">{bootError}</p>
        <button
          type="button"
          onClick={loadBootstrap}
          className="mt-5 rounded-lg bg-[#171717] px-5 py-2.5 text-sm font-medium text-[#F5F0E6]"
        >
          ลองใหม่อีกครั้ง
        </button>
      </div>
    );
  }

  if (!storefront || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F0E6] text-sm text-[#77716A]">
        {UI_TEXT[lang].loading}
      </div>
    );
  }

  const t = UI_TEXT[lang];

  // Top navigation links (4–5 concise single-line links per role)
  const topNavLinks: Array<{ id: ScreenId; label: string }> =
    user.role === 'admin'
      ? [
          { id: 'admin_dashboard', label: t.navAdminDesk },
          { id: 'staff_dashboard', label: t.navStaffDesk },
          { id: 'menu_management', label: t.navMenuAdmin },
          { id: 'sales_reports', label: t.navReports },
          { id: 'staff_management', label: t.navStaffAdmin },
        ]
      : user.role === 'staff'
        ? [
            { id: 'staff_dashboard', label: t.navStaffDesk },
            { id: 'table_management', label: t.navTables },
            { id: 'plate_counter', label: t.navPlateCounter },
            { id: 'menu', label: t.navMenu },
            { id: 'order_history', label: t.navHistory },
          ]
        : [
            { id: 'customer_home', label: t.navHome },
            { id: 'menu', label: t.navMenu },
            { id: 'customer_current_bill', label: t.navBill },
            { id: 'rewards', label: t.navRewards },
            { id: 'order_history', label: t.navHistory },
          ];

  // Full sidebar links for Staff & Admin operational access to all 28 screens
  const staffAdminSidebarLinks: Array<{ id: ScreenId; label: string; icon: typeof Home }> =
    user.role === 'admin'
      ? [
          { id: 'admin_dashboard', label: t.navAdminDesk, icon: LayoutDashboard },
          { id: 'menu_management', label: t.navMenuAdmin, icon: Utensils },
          { id: 'price_settings', label: t.navPrices, icon: Tag },
          { id: 'staff_management', label: t.navStaffAdmin, icon: Shield },
          { id: 'promotion_management', label: 'โปรโมชั่น & รางวัล', icon: Gift },
          { id: 'sales_reports', label: t.navReports, icon: BarChart3 },
          { id: 'restaurant_settings', label: t.navSettings, icon: Settings },
          { id: 'staff_dashboard', label: t.navStaffDesk, icon: Users },
          { id: 'table_management', label: t.navTables, icon: LayoutDashboard },
          { id: 'plate_counter', label: t.navPlateCounter, icon: Calculator },
          { id: 'order_history', label: t.navHistory, icon: History },
        ]
      : [
          { id: 'staff_dashboard', label: t.navStaffDesk, icon: LayoutDashboard },
          { id: 'table_management', label: t.navTables, icon: Users },
          { id: 'plate_counter', label: t.navPlateCounter, icon: Calculator },
          { id: 'bill_summary', label: 'สรุปยอดบิล', icon: Receipt },
          { id: 'menu', label: t.navMenu, icon: Utensils },
          { id: 'order_history', label: t.navHistory, icon: History },
        ];

  const isOperationalRole = user.role === 'admin' || user.role === 'staff';

  return (
    <div className="min-h-screen bg-[#F5F0E6] text-[#171717] flex flex-col">
      {/* Three-Zone Top Bar Contract */}
      <header className="no-print sticky top-0 z-40 flex items-center justify-between gap-8 border-b border-[#171717]/10 bg-[#FFFFFF] px-4 py-3.5 sm:px-6 lg:px-10">
        {/* Zone 1: Brand Wordmark only */}
        <button
          type="button"
          onClick={() => navigate(getHomeForRole(user.role))}
          className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#171717] text-[#C6A56B]">
            <UtensilsCrossed className="h-4 w-4" />
          </span>
          <span className="font-display text-lg font-semibold tracking-wider text-[#171717]">
            {storefront.settings.restaurantName}
          </span>
        </button>

        {/* Zone 2: 4–5 single-line navigation links */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-[#77716A]">
          {topNavLinks.map((link) => (
            <button
              key={link.id}
              type="button"
              onClick={() => navigate(link.id)}
              className={`border-b-2 py-1 transition-colors whitespace-nowrap shrink-0 ${
                screen === link.id
                  ? 'border-[#7B252B] font-semibold text-[#171717]'
                  : 'border-transparent hover:text-[#171717]'
              }`}
            >
              {link.label}
            </button>
          ))}
        </nav>

        {/* Zone 3: Workspace mode switch + primary profile action + mobile menu trigger */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="hidden sm:inline-flex items-center rounded-lg border border-[#171717]/15 bg-[#F5F0E6]/70 p-0.5 text-xs font-medium">
            {(
              [
                { role: 'user' as UserRole, label: 'ลูกค้า' },
                { role: 'staff' as UserRole, label: 'พนักงาน' },
                { role: 'admin' as UserRole, label: 'แอดมิน' },
              ]
            ).map((opt) => (
              <button
                key={opt.role}
                type="button"
                onClick={() => handleSwitchRole(opt.role)}
                className={`rounded-md px-2.5 py-1.5 transition-colors whitespace-nowrap shrink-0 ${
                  user.role === opt.role
                    ? 'bg-[#7B252B] text-white'
                    : 'text-[#77716A] hover:text-[#171717]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => navigate('customer_profile')}
            className="inline-flex items-center gap-2 rounded-lg bg-[#171717] px-3.5 py-2 text-xs font-medium text-[#F5F0E6] transition-colors hover:bg-[#2F2B28] whitespace-nowrap shrink-0"
          >
            <UserIcon className="h-3.5 w-3.5 text-[#C6A56B]" />
            <span className="max-w-[120px] truncate">{user.name}</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="rounded-lg border border-[#171717]/15 p-2 text-[#171717] lg:hidden"
            aria-label="Toggle Menu"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <MenuIcon className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="no-print space-y-3 border-b border-[#171717]/10 bg-[#FFFFFF] px-4 py-4 lg:hidden">
          <div className="grid grid-cols-3 gap-1.5 rounded-lg border border-[#171717]/10 bg-[#F5F0E6]/60 p-1">
            {(
              [
                { role: 'user' as UserRole, label: 'โหมดลูกค้า' },
                { role: 'staff' as UserRole, label: 'โหมดพนักงาน' },
                { role: 'admin' as UserRole, label: 'โหมดแอดมิน' },
              ]
            ).map((opt) => (
              <button
                key={opt.role}
                type="button"
                onClick={() => handleSwitchRole(opt.role)}
                className={`rounded-md px-2 py-1.5 text-xs font-medium ${
                  user.role === opt.role ? 'bg-[#7B252B] text-white' : 'text-[#171717]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(isOperationalRole ? staffAdminSidebarLinks : topNavLinks).map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={() => navigate(link.id)}
                className={`rounded-lg px-3 py-2 text-left text-xs font-medium ${
                  screen === link.id ? 'bg-[#171717] text-[#F5F0E6]' : 'bg-[#F5F0E6]/60 text-[#171717]'
                }`}
              >
                {link.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Workspace Body */}
      <div className="mx-auto flex w-full max-w-[1440px] flex-1">
        {isOperationalRole && (
          <aside className="no-print hidden w-64 shrink-0 border-r border-[#171717]/10 bg-[#FFFFFF] p-5 lg:block">
            <p className="px-2 text-xs font-semibold text-[#77716A]">
              {user.role === 'admin' ? t.roleAdmin : t.roleStaff}
            </p>
            <nav className="mt-3 space-y-1">
              {staffAdminSidebarLinks.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item.id)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
                    screen === item.id
                      ? 'bg-[#171717] text-[#F5F0E6]'
                      : 'text-[#77716A] hover:bg-[#F5F0E6] hover:text-[#171717]'
                  }`}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
            </nav>

            <div className="mt-6 border-t border-[#171717]/10 pt-4">
              <p className="px-2 text-xs text-[#77716A]">ภาษา (Language)</p>
              <div className="mt-2 flex gap-1 px-2">
                {(['th', 'en', 'jp'] as LanguageCode[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setLang(c)}
                    className={`rounded px-2 py-1 text-xs font-medium ${
                      lang === c ? 'bg-[#7B252B] text-white' : 'bg-[#F5F0E6] text-[#171717]'
                    }`}
                  >
                    {c.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        )}

        <main className="flex-1 px-4 py-7 sm:px-6 lg:px-10">
          {storeLoading && !storefront && (
            <div className="py-12 text-center text-sm text-[#77716A]">{t.loading}</div>
          )}

          {/* Customer & Shared Screens */}
          {(screen === 'customer_home' ||
            screen === 'menu' ||
            screen === 'menu_details' ||
            screen === 'customer_profile' ||
            screen === 'customer_current_bill' ||
            screen === 'rewards' ||
            screen === 'reward_redemption' ||
            screen === 'order_history' ||
            screen === 'receipt_details') && (
            <CustomerScreens
              screen={screen}
              lang={lang}
              user={user}
              settings={storefront.settings}
              categories={storefront.categories}
              menu={storefront.menu}
              promotions={storefront.promotions}
              rewards={storefront.rewards}
              redemptions={storefront.redemptions}
              pointTransactions={storefront.pointTransactions}
              bills={storefront.bills}
              tables={storefront.tables}
              orders={storefront.orders}
              selectedMenuId={selectedMenuId}
              selectedBillId={selectedBillId}
              selectedRewardId={selectedRewardId}
              onSelectMenu={setSelectedMenuId}
              onSelectBill={setSelectedBillId}
              onSelectReward={setSelectedRewardId}
              onNavigate={navigate}
              onChangeLang={setLang}
              onRefresh={refreshStorefront}
              onUserUpdated={setUser}
              profiles={profiles}
              onSwitchRole={handleSwitchRole}
              onAddMenuItemToActiveBill={isOperationalRole ? handleAddMenuItemToActiveBill : undefined}
            />
          )}

          {/* Staff & Payment Screens */}
          {(screen === 'staff_dashboard' ||
            screen === 'table_management' ||
            screen === 'plate_counter' ||
            screen === 'bill_summary' ||
            screen === 'payment_selection' ||
            screen === 'ppqr_payment' ||
            screen === 'split_bill' ||
            screen === 'payment_status') && (
            <StaffAndPaymentScreens
              screen={screen}
              lang={lang}
              user={user}
              settings={storefront.settings}
              tables={storefront.tables}
              menu={storefront.menu}
              promotions={storefront.promotions}
              bills={storefront.bills}
              orders={storefront.orders}
              payments={storefront.payments}
              splitPayments={storefront.splitPayments}
              customersForStaff={storefront.customersForStaff}
              selectedBillId={selectedBillId}
              selectedPaymentId={selectedPaymentId}
              onSelectBill={setSelectedBillId}
              onSelectPayment={setSelectedPaymentId}
              onNavigate={navigate}
              onRefresh={refreshStorefront}
            />
          )}

          {/* Admin Screens */}
          {(screen === 'admin_dashboard' ||
            screen === 'menu_management' ||
            screen === 'price_settings' ||
            screen === 'staff_management' ||
            screen === 'promotion_management' ||
            screen === 'sales_reports' ||
            screen === 'restaurant_settings') && (
            <AdminScreens
              screen={screen}
              lang={lang}
              user={user}
              settings={storefront.settings}
              categories={storefront.categories}
              menu={storefront.menu}
              promotions={storefront.promotions}
              rewards={storefront.rewards}
              redemptions={storefront.redemptions}
              pointTransactions={storefront.pointTransactions}
              bills={storefront.bills}
              payments={storefront.payments}
              allUsers={storefront.allUsers}
              onNavigate={navigate}
              onSelectBill={setSelectedBillId}
              onSelectPayment={setSelectedPaymentId}
              onRefresh={refreshStorefront}
            />
          )}
        </main>
      </div>

      {/* Customer Mobile Bottom Quick Nav (compact <= 15% height) */}
      {user.role === 'user' && (
        <nav className="no-print sticky bottom-0 z-30 grid grid-cols-5 border-t border-[#171717]/10 bg-[#FFFFFF] py-2 lg:hidden">
          {[
            { id: 'customer_home' as ScreenId, icon: Home, label: t.navHome },
            { id: 'menu' as ScreenId, icon: Utensils, label: t.navMenu },
            { id: 'customer_current_bill' as ScreenId, icon: Receipt, label: t.navBill },
            { id: 'rewards' as ScreenId, icon: Award, label: t.navRewards },
            { id: 'customer_profile' as ScreenId, icon: UserIcon, label: t.navProfile },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                screen === item.id ? 'text-[#7B252B]' : 'text-[#77716A]'
              }`}
            >
              <item.icon className="h-4 w-4" />
              <span className="truncate max-w-[64px]">{item.label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
