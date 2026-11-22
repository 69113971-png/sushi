import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  CreditCard,
  Gift,
  History,
  Minus,
  Plus,
  Printer,
  Receipt,
  Search,
  ShoppingBag,
  Split,
  Tag,
  Trash2,
  User as UserIcon,
} from 'lucide-react';
import { api } from '../api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DishImage } from '../components/DishImage';
import { PlateChip } from '../components/PlateChip';
import { PLATE_META, UI_TEXT } from '../i18n';
import type {
  Bill,
  Category,
  DiningTable,
  LanguageCode,
  MenuItem,
  OrderRequest,
  PlateColor,
  PointTransaction,
  Promotion,
  RedemptionRecord,
  RestaurantSettings,
  RewardItem,
  ScreenId,
  UserProfile,
  UserRole,
} from '../types';

interface CustomerScreensProps {
  screen:
    | 'customer_home'
    | 'menu'
    | 'menu_details'
    | 'customer_profile'
    | 'customer_current_bill'
    | 'rewards'
    | 'reward_redemption'
    | 'order_history'
    | 'receipt_details';
  lang: LanguageCode;
  user: UserProfile;
  settings: RestaurantSettings;
  categories: Category[];
  menu: MenuItem[];
  promotions: Promotion[];
  rewards: RewardItem[];
  redemptions: RedemptionRecord[];
  pointTransactions: PointTransaction[];
  bills: Bill[];
  tables: DiningTable[];
  orders: OrderRequest[];
  selectedMenuId: string | null;
  selectedBillId: string | null;
  selectedRewardId: string | null;
  onSelectMenu: (id: string) => void;
  onSelectBill: (id: string) => void;
  onSelectReward: (id: string) => void;
  onNavigate: (screen: ScreenId) => void;
  onChangeLang: (lang: LanguageCode) => void;
  onRefresh: () => Promise<void>;
  onUserUpdated: (user: UserProfile) => void;
  profiles: UserProfile[];
  onSwitchRole: (role: UserRole, userId?: string | null) => Promise<void>;
  onAddMenuItemToActiveBill?: (item: MenuItem) => Promise<void>;
}

const PLATE_ORDER: PlateColor[] = ['white', 'red', 'silver', 'gold', 'black'];

export function CustomerScreens({
  screen,
  lang,
  user,
  settings,
  categories,
  menu,
  promotions,
  rewards,
  redemptions,
  pointTransactions,
  bills,
  tables,
  orders,
  selectedMenuId,
  selectedBillId,
  selectedRewardId,
  onSelectMenu,
  onSelectBill,
  onSelectReward,
  onNavigate,
  onChangeLang,
  onRefresh,
  onUserUpdated,
  profiles,
  onSwitchRole,
  onAddMenuItemToActiveBill,
}: CustomerScreensProps) {
  const t = UI_TEXT[lang];

  // Menu filters
  const [catFilter, setCatFilter] = useState<string>('all');
  const [plateFilter, setPlateFilter] = useState<PlateColor | 'all'>('all');
  const [menuQuery, setMenuQuery] = useState('');
  const [menuActionMsg, setMenuActionMsg] = useState<string | null>(null);

  // Profile form
  const [profName, setProfName] = useState(user.name);
  const [profPhone, setProfPhone] = useState(user.phone);
  const [profDietary, setProfDietary] = useState(user.dietaryNotes);
  const [profLang, setProfLang] = useState<LanguageCode>(user.preferredLanguage);
  const [profBusy, setProfBusy] = useState(false);
  const [profMsg, setProfMsg] = useState<string | null>(null);
  const [profErr, setProfErr] = useState<string | null>(null);

  useEffect(() => {
    setProfName(user.name);
    setProfPhone(user.phone);
    setProfDietary(user.dietaryNotes);
    setProfLang(user.preferredLanguage);
  }, [user.id, user.name, user.phone, user.dietaryNotes, user.preferredLanguage]);

  // Current bill promo code
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [promoMsg, setPromoMsg] = useState<string | null>(null);
  const [promoErr, setPromoErr] = useState<string | null>(null);

  // Reward redemption
  const [redeemConfirmOpen, setRedeemConfirmOpen] = useState(false);
  const [redeemBusy, setRedeemBusy] = useState(false);
  const [redeemResult, setRedeemResult] = useState<RedemptionRecord | null>(null);
  const [redeemErr, setRedeemErr] = useState<string | null>(null);

  // Order history filter
  const [historyFilter, setHistoryFilter] = useState<'all' | 'paid' | 'open'>('all');

  // Self-order tray state
  const [cart, setCart] = useState<Array<{ menuId: string; quantity: number }>>([]);
  const [orderTableId, setOrderTableId] = useState<string>('');
  const [orderNote, setOrderNote] = useState<string>('');
  const [orderBusy, setOrderBusy] = useState(false);
  const [orderMsg, setOrderMsg] = useState<string | null>(null);
  const [orderErr, setOrderErr] = useState<string | null>(null);

  const addToCart = (item: MenuItem) => {
    if (!item.available) return;
    setOrderMsg(null);
    setOrderErr(null);
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.menuId === item.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...prev, { menuId: item.id, quantity: 1 }];
    });
  };

  const adjustCartQty = (menuId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => (c.menuId === menuId ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0)
    );
  };

  const selectableTables = useMemo(
    () =>
      tables.filter(
        (tb) => tb.status === 'available' || tb.assignedCustomerId === user.id || user.role !== 'user'
      ),
    [tables, user.id, user.role]
  );

  const resolvedOrderTableId = useMemo(() => {
    if (orderTableId && selectableTables.some((tb) => tb.id === orderTableId)) {
      return orderTableId;
    }
    const seatedTable = tables.find((tb) => tb.assignedCustomerId === user.id && tb.status !== 'available');
    if (seatedTable) return seatedTable.id;
    return selectableTables[0]?.id || '';
  }, [orderTableId, selectableTables, tables, user.id]);

  const cartDetails = useMemo(() => {
    return cart
      .map((entry) => {
        const item = menu.find((m) => m.id === entry.menuId);
        if (!item) return null;
        const price = settings.platePrices[item.plateColor];
        return { item, quantity: entry.quantity, lineTotal: price * entry.quantity };
      })
      .filter((x): x is { item: MenuItem; quantity: number; lineTotal: number } => Boolean(x));
  }, [cart, menu, settings.platePrices]);

  const cartSubtotal = useMemo(
    () => cartDetails.reduce((s, row) => s + row.lineTotal, 0),
    [cartDetails]
  );
  const cartItemCount = useMemo(
    () => cartDetails.reduce((s, row) => s + row.quantity, 0),
    [cartDetails]
  );

  const handleSubmitSelfOrder = async () => {
    if (cart.length === 0 || !resolvedOrderTableId) return;
    setOrderBusy(true);
    setOrderMsg(null);
    setOrderErr(null);
    try {
      await api.createOrder({
        tableId: resolvedOrderTableId,
        note: orderNote,
        items: cart,
      });
      setCart([]);
      setOrderNote('');
      setOrderMsg('ส่งรายการสั่งอาหารไปยังครัวและพนักงานแล้ว รอเสิร์ฟที่โต๊ะของท่าน');
      await onRefresh();
    } catch (err) {
      setOrderErr(err instanceof Error ? err.message : 'ส่งคำสั่งซื้อไม่สำเร็จ');
    } finally {
      setOrderBusy(false);
    }
  };

  const myActiveBill = useMemo(
    () =>
      bills.find(
        (b) =>
          (user.role === 'user' ? b.customerId === user.id : true) &&
          (b.status === 'open' || b.status === 'pending_payment')
      ) || null,
    [bills, user]
  );

  const activeReceiptBill = useMemo(
    () => bills.find((b) => b.id === selectedBillId) || myActiveBill || bills[0] || null,
    [bills, selectedBillId, myActiveBill]
  );

  const filteredMenu = useMemo(() => {
    return menu.filter((item) => {
      if (catFilter !== 'all' && item.categoryId !== catFilter) return false;
      if (plateFilter !== 'all' && item.plateColor !== plateFilter) return false;
      if (menuQuery.trim()) {
        const q = menuQuery.toLowerCase();
        return (
          item.nameTh.toLowerCase().includes(q) ||
          item.nameEn.toLowerCase().includes(q) ||
          item.nameJp.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [menu, catFilter, plateFilter, menuQuery]);

  // ======================== 5. CUSTOMER HOME ========================
  if (screen === 'customer_home') {
    const featuredItems = menu.filter((m) => m.featured && m.available).slice(0, 3);
    const activePromos = promotions.filter((p) => p.active);

    return (
      <div className="space-y-10">
        {/* Hero */}
        <section className="grid grid-cols-1 items-stretch overflow-hidden rounded-xl border border-[#171717]/10 bg-[#171717] text-[#F5F0E6] lg:grid-cols-12">
          <div className="flex flex-col justify-between p-7 sm:p-10 lg:col-span-6">
            <div>
              <p className="text-xs tracking-[0.2em] text-[#C6A56B] uppercase">
                {settings.branchName}
              </p>
              <h1 className="mt-3 font-display text-4xl font-semibold leading-tight text-[#F5F0E6] sm:text-5xl">
                {settings.tagline}
              </h1>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-[#F5F0E6]/75">
                ยินดีต้อนรับคุณ {user.name} · คะแนนสะสมคงเหลือ{' '}
                <span className="font-mono font-semibold tabular-nums text-[#C6A56B]">
                  {user.pointsBalance.toLocaleString()} {t.points}
                </span>
              </p>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate('menu')}
                className="rounded-lg bg-[#C6A56B] px-5 py-2.5 text-sm font-semibold text-[#171717] transition-colors hover:bg-[#D4B67F] whitespace-nowrap shrink-0"
              >
                ดูเมนูอาหารทั้งหมด
              </button>
              <button
                type="button"
                onClick={() => onNavigate('customer_current_bill')}
                className="rounded-lg border border-[#F5F0E6]/25 px-5 py-2.5 text-sm font-medium text-[#F5F0E6] transition-colors hover:border-[#C6A56B] hover:text-[#C6A56B] whitespace-nowrap shrink-0"
              >
                {t.navBill}
              </button>
            </div>
          </div>

          <div className="relative min-h-[260px] lg:col-span-6">
            <img
              src="/src/assets/images/hero_omakase_counter_1795331466265.jpg"
              alt="SUSHI HOUSE Counter"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#171717]/60 via-transparent to-transparent lg:bg-gradient-to-r lg:from-[#171717]/40 lg:to-transparent" />
          </div>
        </section>

        {/* Active Bill Alert */}
        {myActiveBill && (
          <section className="flex flex-col justify-between gap-4 rounded-xl border border-[#C6A56B] bg-[#FFFFFF] p-6 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-medium text-[#7B252B]">
                บิลที่กำลังเปิดอยู่ · โต๊ะ {myActiveBill.tableCode} · {myActiveBill.receiptNumber}
              </p>
              <p className="mt-1 text-lg font-semibold text-[#171717]">
                ยอดสุทธิปัจจุบัน{' '}
                <span className="font-mono tabular-nums text-[#7B252B]">
                  {myActiveBill.netTotal.toLocaleString()} {t.baht}
                </span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  onSelectBill(myActiveBill.id);
                  onNavigate('customer_current_bill');
                }}
                className="rounded-lg bg-[#171717] px-4 py-2.5 text-sm font-medium text-[#F5F0E6] transition-colors hover:bg-[#2F2B28] whitespace-nowrap shrink-0"
              >
                ตรวจสอบบิลและชำระเงิน
              </button>
            </div>
          </section>
        )}

        {/* Plate Color Price Strip */}
        <section className="rounded-xl border border-[#171717]/10 bg-[#FFFFFF] p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-2xl font-semibold text-[#171717]">
              อัตราราคาตามสีจาน (Plate Pricing)
            </h2>
            <span className="text-xs text-[#77716A]">
              ยังไม่รวมค่าบริการ {(settings.serviceChargeRate * 100).toFixed(0)}% · ทุก {settings.pointsBahtRate} บาท = 1 คะแนน
            </span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-5">
            {PLATE_ORDER.map((color) => (
              <div
                key={color}
                className="flex items-center justify-between rounded-lg border border-[#171717]/10 bg-[#F5F0E6]/45 px-4 py-3"
              >
                <PlateChip color={color} lang={lang} compact />
                <span className="font-mono text-sm font-semibold tabular-nums text-[#171717]">
                  {settings.platePrices[color]} ฿
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Featured Menu */}
        <section className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-semibold text-[#171717]">
              เมนูแนะนำโดยเชฟ (Chef&apos;s Selection)
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('menu')}
              className="text-sm font-medium text-[#7B252B] underline-offset-4 hover:underline"
            >
              ดูทั้งหมด →
            </button>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {featuredItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectMenu(item.id);
                  onNavigate('menu_details');
                }}
                className="group overflow-hidden rounded-xl border border-[#171717]/10 bg-[#FFFFFF] text-left transition-transform hover:-translate-y-0.5"
              >
                <div className="aspect-[4/3] w-full overflow-hidden bg-[#171717]">
                  <DishImage
                    src={item.imageUrl}
                    alt={item.nameTh}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between gap-2">
                    <PlateChip color={item.plateColor} price={settings.platePrices[item.plateColor]} lang={lang} />
                    <span className="text-xs text-[#77716A]">{item.nameJp}</span>
                  </div>
                  <h3 className="mt-2.5 text-base font-semibold text-[#171717]">
                    {lang === 'en' ? item.nameEn : item.nameTh}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#77716A]">
                    {lang === 'en' ? item.descriptionEn : item.descriptionTh}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Active Promotions */}
        {activePromos.length > 0 && (
          <section className="space-y-4">
            <h2 className="font-display text-2xl font-semibold text-[#171717]">
              โปรโมชั่นพิเศษ (Privileges)
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {activePromos.map((promo) => (
                <div
                  key={promo.id}
                  className="flex flex-col justify-between rounded-xl border border-[#C6A56B]/40 bg-[#FFFFFF] p-5"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 text-xs text-[#7B252B]">
                      <span className="font-mono font-semibold">CODE: {promo.code}</span>
                      <span>ใช้ได้ถึง {promo.validUntil}</span>
                    </div>
                    <h3 className="mt-2 text-base font-semibold text-[#171717]">
                      {lang === 'en' ? promo.titleEn : promo.titleTh}
                    </h3>
                    <p className="mt-1 text-xs text-[#77716A]">
                      {lang === 'en' ? promo.descriptionEn : promo.descriptionTh}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  // ======================== 6. MENU ========================
  if (screen === 'menu') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="font-display text-3xl font-semibold text-[#171717]">{t.navMenu}</h1>
            <p className="mt-1 text-sm text-[#77716A]">
              เลือกชมรายการซูชิและอาหารญี่ปุ่น แบ่งตามหมวดหมู่และราคาสีจาน
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#77716A]" />
            <input
              type="text"
              value={menuQuery}
              onChange={(e) => setMenuQuery(e.target.value)}
              placeholder="ค้นหาชื่อเมนู..."
              className="w-full rounded-lg border border-[#171717]/15 bg-[#FFFFFF] py-2 pl-9 pr-3 text-sm outline-none focus:border-[#C6A56B]"
            />
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCatFilter('all')}
            className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              catFilter === 'all'
                ? 'bg-[#171717] text-[#F5F0E6]'
                : 'border border-[#171717]/10 bg-[#FFFFFF] text-[#77716A] hover:text-[#171717]'
            }`}
          >
            ทั้งหมด
          </button>
          {categories
            .filter((c) => c.active)
            .map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCatFilter(cat.id)}
                className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  catFilter === cat.id
                    ? 'bg-[#171717] text-[#F5F0E6]'
                    : 'border border-[#171717]/10 bg-[#FFFFFF] text-[#77716A] hover:text-[#171717]'
                }`}
              >
                {lang === 'en' ? cat.nameEn : lang === 'jp' ? cat.nameJp : cat.nameTh}
              </button>
            ))}
        </div>

        {/* Plate Filter */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[#171717]/10 pb-4">
          <span className="text-xs font-medium text-[#77716A]">กรองตามสีจาน:</span>
          <button
            type="button"
            onClick={() => setPlateFilter('all')}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
              plateFilter === 'all' ? 'bg-[#C6A56B] text-[#171717]' : 'bg-[#FFFFFF] text-[#77716A]'
            }`}
          >
            ทุกสี
          </button>
          {PLATE_ORDER.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setPlateFilter(color)}
              className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                plateFilter === color
                  ? 'border-[#171717] bg-[#FFFFFF]'
                  : 'border-transparent bg-[#FFFFFF]/60 opacity-80 hover:opacity-100'
              }`}
            >
              <PlateChip color={color} price={settings.platePrices[color]} lang={lang} />
            </button>
          ))}
        </div>

        {filteredMenu.length === 0 ? (
          <div className="rounded-xl border border-[#171717]/10 bg-[#FFFFFF] p-12 text-center text-sm text-[#77716A]">
            ไม่พบรายการเมนูที่ตรงกับเงื่อนไขการค้นหา
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredMenu.map((item) => (
              <div
                key={item.id}
                className="flex flex-col overflow-hidden rounded-xl border border-[#171717]/10 bg-[#FFFFFF]"
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelectMenu(item.id);
                    onNavigate('menu_details');
                  }}
                  className="aspect-[4/3] w-full overflow-hidden bg-[#171717] text-left"
                >
                  <DishImage src={item.imageUrl} alt={item.nameTh} className="h-full w-full object-cover" />
                </button>
                <div className="flex flex-1 flex-col justify-between p-5">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <PlateChip color={item.plateColor} price={settings.platePrices[item.plateColor]} lang={lang} />
                      <span className="text-xs text-[#77716A]">
                        {item.available ? 'พร้อมเสิร์ฟ' : 'หมดชั่วคราว'}
                      </span>
                    </div>
                    <h3 className="mt-2 text-base font-semibold text-[#171717]">
                      {lang === 'en' ? item.nameEn : item.nameTh}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-xs text-[#77716A]">
                      {lang === 'en' ? item.descriptionEn : item.descriptionTh}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#171717]/10 pt-3">
                    <span className="font-mono text-sm font-semibold tabular-nums text-[#7B252B]">
                      {settings.platePrices[item.plateColor]} {t.baht}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectMenu(item.id);
                          onNavigate('menu_details');
                        }}
                        className="rounded-lg border border-[#171717]/15 px-3 py-1.5 text-xs font-medium text-[#171717] hover:bg-[#F5F0E6]"
                      >
                        รายละเอียด
                      </button>
                      <button
                        type="button"
                        disabled={!item.available}
                        onClick={() => addToCart(item)}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#7B252B] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#5E1B20] disabled:opacity-40"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>สั่ง</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Self-Order Tray */}
        {(cartDetails.length > 0 || orderMsg || orders.length > 0) && (
          <section className="space-y-4 rounded-xl border border-[#C6A56B]/60 bg-[#FFFFFF] p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-display text-2xl font-semibold text-[#171717]">
                <ShoppingBag className="h-5 w-5 text-[#7B252B]" />
                <span>ถาดสั่งอาหารด้วยตนเอง ({cartItemCount} จาน)</span>
              </h2>
              {cartDetails.length > 0 && (
                <span className="font-mono text-base font-semibold text-[#7B252B]">
                  ยอดอาหารโดยประมาณ {cartSubtotal.toLocaleString()} {t.baht}
                </span>
              )}
            </div>

            {orderMsg && (
              <div className="rounded-lg border border-[#16A34A]/30 bg-[#16A34A]/5 px-4 py-3 text-xs font-medium text-[#16A34A]">
                {orderMsg}
              </div>
            )}
            {orderErr && (
              <div className="rounded-lg border border-[#7B252B]/30 bg-[#7B252B]/5 px-4 py-3 text-xs font-medium text-[#7B252B]">
                {orderErr}
              </div>
            )}

            {cartDetails.length > 0 && (
              <>
                <div className="divide-y divide-[#171717]/10">
                  {cartDetails.map(({ item, quantity, lineTotal }) => (
                    <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                      <div>
                        <p className="font-semibold text-[#171717]">{lang === 'en' ? item.nameEn : item.nameTh}</p>
                        <PlateChip color={item.plateColor} price={settings.platePrices[item.plateColor]} lang={lang} />
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => adjustCartQty(item.id, -1)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#171717]/15 hover:bg-[#F5F0E6]"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-6 text-center font-mono font-semibold">{quantity}</span>
                        <button
                          type="button"
                          onClick={() => adjustCartQty(item.id, 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#171717] text-white"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-20 text-right font-mono font-semibold text-[#7B252B]">
                          {lineTotal.toLocaleString()} ฿
                        </span>
                        <button
                          type="button"
                          onClick={() => adjustCartQty(item.id, -quantity)}
                          className="p-1.5 text-[#77716A] hover:text-[#7B252B]"
                          aria-label="ลบรายการ"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-3 border-t border-[#171717]/10 pt-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#77716A]">เลือกโต๊ะที่จะให้เสิร์ฟ</label>
                    <select
                      value={resolvedOrderTableId}
                      onChange={(e) => setOrderTableId(e.target.value)}
                      className="w-full rounded-lg border border-[#171717]/15 bg-white px-3 py-2.5 text-sm outline-none"
                    >
                      {selectableTables.map((tb) => (
                        <option key={tb.id} value={tb.id}>
                          โต๊ะ {tb.tableCode} ({tb.assignedCustomerId === user.id ? 'โต๊ะปัจจุบันของคุณ' : 'โต๊ะว่าง'})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#77716A]">หมายเหตุถึงเชฟ (ถ้ามี)</label>
                    <input
                      type="text"
                      value={orderNote}
                      onChange={(e) => setOrderNote(e.target.value)}
                      placeholder="เช่น ไม่ใส่วาซาบิ, แยกโชยุ"
                      className="w-full rounded-lg border border-[#171717]/15 px-3 py-2.5 text-sm outline-none focus:border-[#C6A56B]"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={orderBusy || !resolvedOrderTableId}
                  onClick={handleSubmitSelfOrder}
                  className="w-full rounded-lg bg-[#7B252B] px-5 py-3 text-sm font-medium text-white hover:bg-[#5E1B20] disabled:opacity-50"
                >
                  {orderBusy ? t.loading : `ยืนยันส่งออเดอร์ (${cartItemCount} จาน · โต๊ะ ${tables.find((tb) => tb.id === resolvedOrderTableId)?.tableCode || ''})`}
                </button>
              </>
            )}

            {orders.length > 0 && (
              <div className="border-t border-[#171717]/10 pt-4">
                <h3 className="text-xs font-semibold text-[#77716A]">สถานะรายการที่กดสั่งล่าสุด</h3>
                <div className="mt-2 divide-y divide-[#171717]/10">
                  {orders.slice(0, 5).map((ord) => (
                    <div key={ord.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs">
                      <div>
                        <span className="font-semibold text-[#171717]">โต๊ะ {ord.tableCode}</span>
                        <span className="mx-2 text-[#77716A]">·</span>
                        <span>{ord.items.map((i) => `${i.nameTh} ×${i.quantity}`).join(', ')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-medium ${
                            ord.status === 'served'
                              ? 'text-[#16A34A]'
                              : ord.status === 'cancelled'
                                ? 'text-[#77716A]'
                                : 'text-[#D97706]'
                          }`}
                        >
                          {ord.status === 'served'
                            ? 'เสิร์ฟลงบิลแล้ว'
                            : ord.status === 'cancelled'
                              ? 'ยกเลิกแล้ว'
                              : 'รอพนักงานเสิร์ฟ'}
                        </span>
                        {ord.status === 'pending' && (
                          <button
                            type="button"
                            onClick={async () => {
                              await api.cancelOrder(ord.id);
                              await onRefresh();
                            }}
                            className="rounded border border-[#7B252B]/30 px-2 py-0.5 text-[11px] text-[#7B252B]"
                          >
                            ยกเลิก
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    );
  }

  // ======================== 7. MENU DETAILS ========================
  if (screen === 'menu_details') {
    const item = menu.find((m) => m.id === selectedMenuId) || menu[0];
    if (!item) {
      return (
        <div className="rounded-xl border border-[#171717]/10 bg-[#FFFFFF] p-8 text-center">
          <p className="text-sm text-[#77716A]">ไม่พบข้อมูลเมนู</p>
          <button
            type="button"
            onClick={() => onNavigate('menu')}
            className="mt-4 rounded-lg bg-[#171717] px-4 py-2 text-xs text-white"
          >
            {t.back}
          </button>
        </div>
      );
    }

    const cat = categories.find((c) => c.id === item.categoryId);

    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => onNavigate('menu')}
          className="inline-flex items-center gap-2 text-sm font-medium text-[#77716A] hover:text-[#171717]"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>กลับไปยังเมนูอาหาร</span>
        </button>

        <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-[#171717]/10 bg-[#FFFFFF] lg:grid-cols-12">
          <div className="aspect-[4/3] bg-[#171717] lg:col-span-6 lg:aspect-auto">
            <DishImage src={item.imageUrl} alt={item.nameTh} className="h-full w-full object-cover" />
          </div>
          <div className="flex flex-col justify-between p-7 sm:p-10 lg:col-span-6">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#77716A]">
                <span>{cat ? (lang === 'en' ? cat.nameEn : cat.nameTh) : 'Sushi'}</span>
                <span>·</span>
                <span>{item.nameJp}</span>
                <span>·</span>
                <span>{item.available ? 'พร้อมเสิร์ฟ' : 'หมดชั่วคราว'}</span>
              </div>

              <h1 className="mt-3 font-display text-3xl font-semibold text-[#171717]">
                {item.nameTh}
              </h1>
              <p className="text-sm text-[#77716A]">{item.nameEn}</p>

              <div className="mt-5 flex items-center justify-between rounded-lg border border-[#171717]/10 bg-[#F5F0E6]/60 px-4 py-3">
                <PlateChip color={item.plateColor} lang={lang} />
                <span className="font-mono text-xl font-semibold tabular-nums text-[#7B252B]">
                  {settings.platePrices[item.plateColor]} {t.baht}
                </span>
              </div>

              <p className="mt-5 text-sm leading-relaxed text-[#171717]/85">
                {lang === 'en' ? item.descriptionEn : item.descriptionTh}
              </p>

              <div className="mt-6 grid grid-cols-2 gap-4 border-t border-[#171717]/10 pt-5 text-xs">
                <div>
                  <span className="block text-[#77716A]">พลังงานโดยประมาณ</span>
                  <span className="mt-1 block font-mono font-semibold text-[#171717]">
                    {item.calories} kcal
                  </span>
                </div>
                <div>
                  <span className="block text-[#77716A]">ข้อมูลผู้แพ้อาหาร</span>
                  <span className="mt-1 block font-medium text-[#171717]">{item.allergens || '-'}</span>
                </div>
              </div>
            </div>

            <div className="mt-8 space-y-3 border-t border-[#171717]/10 pt-5">
              {(user.role === 'staff' || user.role === 'admin') && onAddMenuItemToActiveBill ? (
                <button
                  type="button"
                  disabled={!item.available}
                  onClick={async () => {
                    await onAddMenuItemToActiveBill(item);
                    setMenuActionMsg('เพิ่มรายการและนับสีจานลงบิลโต๊ะเรียบร้อยแล้ว');
                  }}
                  className="w-full rounded-lg bg-[#7B252B] px-5 py-3 text-sm font-medium text-white hover:bg-[#5E1B20] disabled:opacity-50"
                >
                  เพิ่มรายการนี้ลงบิลโต๊ะที่กำลังจัดการ
                </button>
              ) : (
                <div className="space-y-3">
                  <button
                    type="button"
                    disabled={!item.available}
                    onClick={() => {
                      addToCart(item);
                      setMenuActionMsg(`เพิ่ม "${item.nameTh}" ลงถาดสั่งอาหารแล้ว (${cartItemCount + 1} จาน)`);
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#7B252B] px-5 py-3 text-sm font-medium text-white hover:bg-[#5E1B20] disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                    <span>เพิ่มลงถาดสั่งอาหารด้วยตนเอง</span>
                  </button>
                  {cartItemCount > 0 && (
                    <button
                      type="button"
                      onClick={() => onNavigate('menu')}
                      className="w-full rounded-lg border border-[#171717] py-2.5 text-xs font-semibold text-[#171717] hover:bg-[#F5F0E6]"
                    >
                      ดูถาดสั่งอาหารและยืนยันสั่ง ({cartItemCount} จาน · {cartSubtotal.toLocaleString()} บาท) →
                    </button>
                  )}
                </div>
              )}
              {menuActionMsg && (
                <p className="text-xs font-medium text-[#16A34A]">{menuActionMsg}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ======================== 8. CUSTOMER PROFILE ========================
  if (screen === 'customer_profile') {
    const handleSaveProfile = async (e: React.FormEvent) => {
      e.preventDefault();
      setProfBusy(true);
      setProfMsg(null);
      setProfErr(null);
      try {
        const res = await api.updateProfile({
          name: profName,
          phone: profPhone,
          preferredLanguage: profLang,
          dietaryNotes: profDietary,
        });
        onUserUpdated(res.user);
        onChangeLang(profLang);
        setProfMsg('บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว');
      } catch (err) {
        setProfErr(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
      } finally {
        setProfBusy(false);
      }
    };

    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#171717]/10 bg-[#FFFFFF] p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#171717] text-[#C6A56B]">
              <UserIcon className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-semibold text-[#171717]">{user.name}</h1>
              <p className="text-xs text-[#77716A]">
                {user.email} · สิทธิ์:{' '}
                <strong className="text-[#7B252B]">
                  {user.role === 'admin' ? t.roleAdmin : user.role === 'staff' ? t.roleStaff : t.roleUser}
                </strong>
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="block text-xs text-[#77716A]">คะแนนสะสม (ไม่สามารถแก้ไขเอง)</span>
            <span className="font-mono text-2xl font-semibold tabular-nums text-[#7B252B]">
              {user.pointsBalance.toLocaleString()} {t.points}
            </span>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4 rounded-xl border border-[#171717]/10 bg-[#FFFFFF] p-6">
          <h2 className="text-base font-semibold text-[#171717]">ข้อมูลส่วนตัวและการตั้งค่าภาษา</h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#77716A]">{t.fullName}</label>
              <input
                type="text"
                required
                value={profName}
                onChange={(e) => setProfName(e.target.value)}
                className="w-full rounded-lg border border-[#171717]/15 px-3.5 py-2.5 text-sm outline-none focus:border-[#C6A56B]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#77716A]">{t.phone}</label>
              <input
                type="tel"
                value={profPhone}
                onChange={(e) => setProfPhone(e.target.value)}
                className="w-full rounded-lg border border-[#171717]/15 px-3.5 py-2.5 text-sm outline-none focus:border-[#C6A56B]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#77716A]">ภาษาที่ต้องการใช้งาน</label>
              <select
                value={profLang}
                onChange={(e) => setProfLang(e.target.value as LanguageCode)}
                className="w-full rounded-lg border border-[#171717]/15 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#C6A56B]"
              >
                <option value="th">ไทย (Thai)</option>
                <option value="en">English</option>
                <option value="jp">日本語 (Japanese)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#77716A]">ข้อมูลการแพ้อาหาร / หมายเหตุ</label>
              <input
                type="text"
                value={profDietary}
                onChange={(e) => setProfDietary(e.target.value)}
                placeholder="เช่น ไม่ทานวาซาบิ, แพ้กุ้ง"
                className="w-full rounded-lg border border-[#171717]/15 px-3.5 py-2.5 text-sm outline-none focus:border-[#C6A56B]"
              />
            </div>
          </div>

          {profMsg && <p className="text-xs font-medium text-[#16A34A]">{profMsg}</p>}
          {profErr && <p className="text-xs font-medium text-[#7B252B]">{profErr}</p>}

          <button
            type="submit"
            disabled={profBusy}
            className="rounded-lg bg-[#171717] px-5 py-2.5 text-sm font-medium text-[#F5F0E6] hover:bg-[#2F2B28] disabled:opacity-60"
          >
            {profBusy ? t.loading : t.save}
          </button>
        </form>

        <div className="space-y-4 rounded-xl border border-[#171717]/10 bg-[#FFFFFF] p-6">
          <h2 className="text-base font-semibold text-[#171717]">สลับโหมดใช้งานและโปรไฟล์ (ไม่ต้องล็อกอิน)</h2>
          <p className="text-xs text-[#77716A]">
            เลือกโปรไฟล์หรือบทบาทที่ต้องการใช้งานได้ทันทีระหว่าง ลูกค้า พนักงาน และผู้ดูแลระบบ
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {profiles.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onSwitchRole(p.role, p.id)}
                className={`rounded-lg border p-3.5 text-left transition-colors ${
                  user.id === p.id
                    ? 'border-[#7B252B] bg-[#7B252B]/5'
                    : 'border-[#171717]/15 bg-[#F5F0E6]/40 hover:bg-[#F5F0E6]'
                }`}
              >
                <p className="text-xs font-semibold text-[#7B252B] uppercase">
                  {p.role === 'admin' ? t.roleAdmin : p.role === 'staff' ? t.roleStaff : t.roleUser}
                </p>
                <p className="mt-1 truncate text-sm font-semibold text-[#171717]">{p.name}</p>
                <p className="truncate text-xs text-[#77716A]">{p.email}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ======================== 9. CUSTOMER CURRENT BILL ========================
  if (screen === 'customer_current_bill') {
    const bill = bills.find((b) => b.id === selectedBillId && (b.status === 'open' || b.status === 'pending_payment')) || myActiveBill;

    const handleApplyPromo = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!bill) return;
      setPromoMsg(null);
      setPromoErr(null);
      try {
        await api.applyPromotion(bill.id, { code: promoCodeInput });
        setPromoMsg('ใช้โค้ดส่วนลดเรียบร้อยแล้ว');
        setPromoCodeInput('');
        await onRefresh();
      } catch (err) {
        setPromoErr(err instanceof Error ? err.message : 'ไม่สามารถใช้โค้ดนี้ได้');
      }
    };

    if (!bill) {
      const pendingOrders = orders.filter((o) => o.status === 'pending');
      return (
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="rounded-xl border border-[#171717]/10 bg-[#FFFFFF] p-10 text-center">
            <Receipt className="mx-auto h-10 w-10 text-[#C6A56B]" />
            <h1 className="mt-4 font-display text-2xl font-semibold text-[#171717]">
              ยังไม่มีบิลที่เปิดอยู่ในขณะนี้
            </h1>
            <p className="mt-2 text-sm text-[#77716A]">
              ท่านสามารถกดสั่งอาหารด้วยตนเองจากหน้าเมนู เมื่อพนักงานเสิร์ฟอาหารที่โต๊ะ ระบบจะเปิดบิลและแสดงยอดสุทธิให้ที่นี่โดยอัตโนมัติ
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate('menu')}
                className="rounded-lg bg-[#7B252B] px-5 py-2.5 text-sm font-medium text-white"
              >
                ไปหน้าเมนูเพื่อสั่งอาหาร
              </button>
              <button
                type="button"
                onClick={() => onNavigate('order_history')}
                className="rounded-lg border border-[#171717]/15 px-5 py-2.5 text-sm font-medium text-[#171717]"
              >
                ดูประวัติบิลที่ผ่านมา
              </button>
            </div>
          </div>

          {pendingOrders.length > 0 && (
            <div className="rounded-xl border border-[#C6A56B]/50 bg-[#FFFFFF] p-6">
              <h2 className="text-sm font-semibold text-[#171717]">คำสั่งซื้อที่รอพนักงานเสิร์ฟ</h2>
              <div className="mt-3 divide-y divide-[#171717]/10">
                {pendingOrders.map((ord) => (
                  <div key={ord.id} className="flex items-center justify-between py-2.5 text-xs">
                    <span>
                      <strong>โต๊ะ {ord.tableCode}</strong> · {ord.items.map((i) => `${i.nameTh} ×${i.quantity}`).join(', ')}
                    </span>
                    <span className="font-mono font-semibold text-[#D97706]">รอเสิร์ฟ (~{ord.estimatedFoodSubtotal} ฿)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-[#7B252B]">
              โต๊ะ {bill.tableCode} · {bill.receiptNumber} ·{' '}
              {bill.status === 'pending_payment' ? 'รอตรวจสอบการชำระเงิน' : 'กำลังเปิดบิล'}
            </p>
            <h1 className="mt-1 font-display text-3xl font-semibold text-[#171717]">
              {t.navBill}
            </h1>
          </div>
          <span className="text-xs text-[#77716A]">
            โหมดอ่านอย่างเดียว (เฉพาะพนักงานที่แก้ไขจำนวนจานได้)
          </span>
        </div>

        {/* Plate Breakdown */}
        <div className="rounded-xl border border-[#171717]/10 bg-[#FFFFFF] p-6">
          <h2 className="text-sm font-semibold text-[#171717]">รายละเอียดจานตามสี</h2>
          <div className="mt-4 divide-y divide-[#171717]/10">
            {PLATE_ORDER.map((color) => {
              const count = bill.plateCounts[color] || 0;
              const price = settings.platePrices[color];
              if (count === 0) return null;
              return (
                <div key={color} className="flex items-center justify-between py-3 text-sm">
                  <PlateChip color={color} price={price} lang={lang} />
                  <div className="font-mono tabular-nums text-[#171717]">
                    {count} {t.plates} × {price} = <strong>{(count * price).toLocaleString()} {t.baht}</strong>
                  </div>
                </div>
              );
            })}
            {PLATE_ORDER.every((c) => (bill.plateCounts[c] || 0) === 0) && (
              <p className="py-4 text-sm text-[#77716A]">ยังไม่มีการบันทึกจำนวนจาน</p>
            )}
          </div>

          {bill.items.length > 0 && (
            <div className="mt-5 border-t border-[#171717]/10 pt-4">
              <h3 className="text-xs font-semibold text-[#77716A]">รายการอาหารที่สั่ง</h3>
              <ul className="mt-2 space-y-1.5 text-sm">
                {bill.items.map((it) => (
                  <li key={it.menuId} className="flex items-center justify-between">
                    <span>
                      {lang === 'en' ? it.nameEn : it.nameTh} × {it.quantity}
                    </span>
                    <PlateChip color={it.plateColor} lang={lang} compact />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Promo Code */}
          <form onSubmit={handleApplyPromo} className="mt-5 flex gap-2 border-t border-[#171717]/10 pt-5">
            <div className="relative flex-1">
              <Tag className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#77716A]" />
              <input
                type="text"
                value={promoCodeInput}
                onChange={(e) => setPromoCodeInput(e.target.value)}
                placeholder="กรอกโค้ดโปรโมชั่น (เช่น ELEGANCE10)"
                className="w-full rounded-lg border border-[#171717]/15 py-2 pl-9 pr-3 text-sm uppercase outline-none focus:border-[#C6A56B]"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg border border-[#171717]/20 px-4 py-2 text-sm font-medium text-[#171717] hover:bg-[#F5F0E6]"
            >
              ใช้โค้ด
            </button>
          </form>
          {promoMsg && <p className="mt-2 text-xs text-[#16A34A]">{promoMsg}</p>}
          {promoErr && <p className="mt-2 text-xs text-[#7B252B]">{promoErr}</p>}

          {/* Totals */}
          <div className="mt-6 space-y-2 border-t border-[#171717]/15 pt-4 text-sm">
            <div className="flex justify-between text-[#77716A]">
              <span>{t.foodSubtotal}</span>
              <span className="font-mono tabular-nums">{bill.foodSubtotal.toLocaleString()} {t.baht}</span>
            </div>
            <div className="flex justify-between text-[#77716A]">
              <span>{t.serviceCharge}</span>
              <span className="font-mono tabular-nums">{bill.serviceCharge.toLocaleString()} {t.baht}</span>
            </div>
            {bill.promotionDiscount > 0 && (
              <div className="flex justify-between text-[#16A34A]">
                <span>{t.discount} ({bill.promotionCode})</span>
                <span className="font-mono tabular-nums">-{bill.promotionDiscount.toLocaleString()} {t.baht}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-[#171717]/10 pt-3 text-lg font-semibold text-[#171717]">
              <span>{t.netTotal}</span>
              <span className="font-mono tabular-nums text-[#7B252B]">
                {bill.netTotal.toLocaleString()} {t.baht}
              </span>
            </div>
            <p className="text-xs text-[#77716A]">
              หลังชำระเงินสำเร็จ ท่านจะได้รับ{' '}
              <strong className="text-[#171717]">
                {Math.floor(bill.netTotal / settings.pointsBahtRate)} {t.points}
              </strong>{' '}
              ({settings.pointsBahtRate} บาท = 1 คะแนน)
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={bill.netTotal <= 0}
            onClick={() => {
              onSelectBill(bill.id);
              onNavigate('payment_selection');
            }}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#7B252B] px-5 py-3 text-sm font-medium text-white hover:bg-[#5E1B20] disabled:opacity-50"
          >
            <CreditCard className="h-4 w-4" />
            <span>เลือกวิธีชำระเงิน / PPQR</span>
          </button>
          <button
            type="button"
            disabled={bill.netTotal <= 0}
            onClick={() => {
              onSelectBill(bill.id);
              onNavigate('split_bill');
            }}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#171717] bg-[#FFFFFF] px-5 py-3 text-sm font-medium text-[#171717] hover:bg-[#F5F0E6] disabled:opacity-50"
          >
            <Split className="h-4 w-4" />
            <span>แบ่งบิลกับเพื่อน (Split Bill)</span>
          </button>
        </div>
      </div>
    );
  }

  // ======================== 18. REWARDS ========================
  if (screen === 'rewards') {
    const activeRewards = rewards.filter((r) => r.active);
    return (
      <div className="space-y-8">
        <div className="flex flex-col justify-between gap-4 rounded-xl border border-[#C6A56B]/50 bg-[#171717] p-7 text-[#F5F0E6] sm:flex-row sm:items-center">
          <div>
            <p className="text-xs tracking-widest text-[#C6A56B] uppercase">SUSHI HOUSE Privilege</p>
            <h1 className="mt-1 font-display text-3xl font-semibold">คะแนนสะสมและของรางวัล</h1>
            <p className="mt-1 text-xs text-[#F5F0E6]/75">
              รับ 1 คะแนนทุกๆ {settings.pointsBahtRate} บาทหลังชำระเงินสำเร็จ (ปัดเศษลง)
            </p>
          </div>
          <div className="text-left sm:text-right">
            <span className="block text-xs text-[#C6A56B]">คะแนนคงเหลือของคุณ</span>
            <span className="font-mono text-4xl font-semibold tabular-nums text-[#F5F0E6]">
              {user.pointsBalance.toLocaleString()}
            </span>
            <span className="ml-1.5 text-sm text-[#C6A56B]">{t.points}</span>
          </div>
        </div>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-semibold text-[#171717]">ของรางวัลที่สามารถแลกได้</h2>
            <button
              type="button"
              onClick={() => onNavigate('reward_redemption')}
              className="text-sm font-medium text-[#7B252B] underline-offset-4 hover:underline"
            >
              คูปองของฉัน ({redemptions.length}) →
            </button>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {activeRewards.map((r) => {
              const canRedeem = user.pointsBalance >= r.pointsCost && r.stock > 0;
              return (
                <div
                  key={r.id}
                  className="flex flex-col overflow-hidden rounded-xl border border-[#171717]/10 bg-[#FFFFFF]"
                >
                  <div className="aspect-[4/3] bg-[#171717]">
                    <DishImage src={r.imageUrl} alt={r.titleTh} className="h-full w-full object-cover" />
                  </div>
                  <div className="flex flex-1 flex-col justify-between p-4">
                    <div>
                      <div className="flex items-center justify-between text-xs text-[#77716A]">
                        <span>{r.titleJp}</span>
                        <span>คงเหลือ {r.stock}</span>
                      </div>
                      <h3 className="mt-1.5 text-sm font-semibold text-[#171717]">
                        {lang === 'en' ? r.titleEn : r.titleTh}
                      </h3>
                      <p className="mt-1 text-xs text-[#77716A]">
                        {lang === 'en' ? r.descriptionEn : r.descriptionTh}
                      </p>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-[#171717]/10 pt-3">
                      <span className="font-mono text-sm font-semibold tabular-nums text-[#7B252B]">
                        {r.pointsCost} {t.points}
                      </span>
                      <button
                        type="button"
                        disabled={!canRedeem}
                        onClick={() => {
                          onSelectReward(r.id);
                          setRedeemResult(null);
                          setRedeemErr(null);
                          onNavigate('reward_redemption');
                        }}
                        className="rounded-lg bg-[#171717] px-3 py-1.5 text-xs font-medium text-[#F5F0E6] hover:bg-[#2F2B28] disabled:opacity-40"
                      >
                        แลกรางวัล
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Point Transactions Ledger */}
        <section className="rounded-xl border border-[#171717]/10 bg-[#FFFFFF] p-6">
          <h2 className="text-base font-semibold text-[#171717]">ประวัติการได้รับและใช้คะแนน</h2>
          {pointTransactions.length === 0 ? (
            <p className="mt-4 text-sm text-[#77716A]">ยังไม่มีรายการเคลื่อนไหวคะแนนสะสม</p>
          ) : (
            <div className="mt-4 divide-y divide-[#171717]/10">
              {pointTransactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <div>
                    <p className="font-medium text-[#171717]">{tx.description}</p>
                    <p className="text-xs text-[#77716A]">{new Date(tx.createdAt).toLocaleString('th-TH')}</p>
                  </div>
                  <span
                    className={`font-mono font-semibold tabular-nums ${
                      tx.points >= 0 ? 'text-[#16A34A]' : 'text-[#7B252B]'
                    }`}
                  >
                    {tx.points >= 0 ? `+${tx.points}` : tx.points} {t.points}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  // ======================== 19. REWARD REDEMPTION ========================
  if (screen === 'reward_redemption') {
    const reward = rewards.find((r) => r.id === selectedRewardId) || rewards[0] || null;

    const handleRedeemConfirm = async () => {
      if (!reward) return;
      setRedeemBusy(true);
      setRedeemErr(null);
      try {
        const res = await api.redeemReward(reward.id);
        setRedeemResult(res.redemption);
        onUserUpdated(res.user);
        setRedeemConfirmOpen(false);
        await onRefresh();
      } catch (err) {
        setRedeemErr(err instanceof Error ? err.message : 'แลกของรางวัลไม่สำเร็จ');
        setRedeemConfirmOpen(false);
      } finally {
        setRedeemBusy(false);
      }
    };

    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <button
          type="button"
          onClick={() => onNavigate('rewards')}
          className="inline-flex items-center gap-2 text-sm font-medium text-[#77716A] hover:text-[#171717]"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>กลับไปหน้ารวมคะแนนและรางวัล</span>
        </button>

        {reward && (
          <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-[#171717]/10 bg-[#FFFFFF] md:grid-cols-12">
            <div className="aspect-[4/3] bg-[#171717] md:col-span-5 md:aspect-auto">
              <DishImage src={reward.imageUrl} alt={reward.titleTh} className="h-full w-full object-cover" />
            </div>
            <div className="flex flex-col justify-between p-6 md:col-span-7">
              <div>
                <p className="text-xs text-[#77716A]">{reward.titleJp}</p>
                <h1 className="mt-1 font-display text-2xl font-semibold text-[#171717]">
                  {reward.titleTh}
                </h1>
                <p className="mt-2 text-sm text-[#77716A]">{reward.descriptionTh}</p>
                <div className="mt-4 flex items-center justify-between rounded-lg bg-[#F5F0E6] px-4 py-3 text-sm">
                  <span>คะแนนที่ใช้แลก</span>
                  <span className="font-mono font-semibold text-[#7B252B]">{reward.pointsCost} {t.points}</span>
                </div>
                <p className="mt-2 text-xs text-[#77716A]">
                  คะแนนคงเหลือของคุณ: <strong className="font-mono">{user.pointsBalance}</strong> {t.points} · สต็อกคงเหลือ: {reward.stock}
                </p>
              </div>

              {redeemErr && (
                <p className="mt-3 text-xs font-medium text-[#7B252B]">{redeemErr}</p>
              )}

              {redeemResult && (
                <div className="mt-4 rounded-lg border border-[#16A34A]/40 bg-[#16A34A]/5 p-4 text-sm">
                  <div className="flex items-center gap-2 font-semibold text-[#16A34A]">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>แลกรับของรางวัลสำเร็จ!</span>
                  </div>
                  <p className="mt-1 text-xs text-[#171717]">
                    รหัสคูปอง: <strong className="font-mono text-sm">{redeemResult.voucherCode}</strong>
                  </p>
                </div>
              )}

              <button
                type="button"
                disabled={user.pointsBalance < reward.pointsCost || reward.stock <= 0}
                onClick={() => setRedeemConfirmOpen(true)}
                className="mt-5 w-full rounded-lg bg-[#7B252B] px-5 py-3 text-sm font-medium text-white hover:bg-[#5E1B20] disabled:opacity-40"
              >
                ยืนยันการแลกรางวัล ({reward.pointsCost} คะแนน)
              </button>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-[#171717]/10 bg-[#FFFFFF] p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[#171717]">
            <Gift className="h-4 w-4 text-[#C6A56B]" />
            <span>คูปองของรางวัลที่แลกแล้ว</span>
          </h2>
          {redemptions.length === 0 ? (
            <p className="mt-3 text-sm text-[#77716A]">ยังไม่มีประวัติการแลกของรางวัล</p>
          ) : (
            <div className="mt-4 divide-y divide-[#171717]/10">
              {redemptions.map((rd) => (
                <div key={rd.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-medium text-[#171717]">{rd.rewardTitle}</p>
                    <p className="font-mono text-xs text-[#77716A]">
                      {rd.voucherCode} · -{rd.pointsSpent} {t.points} · {new Date(rd.createdAt).toLocaleString('th-TH')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-medium ${
                        rd.status === 'active' ? 'text-[#16A34A]' : 'text-[#77716A]'
                      }`}
                    >
                      {rd.status === 'active' ? 'พร้อมใช้งาน' : 'ใช้สิทธิ์แล้ว'}
                    </span>
                    {(user.role === 'staff' || user.role === 'admin') && rd.status === 'active' && (
                      <button
                        type="button"
                        onClick={async () => {
                          await api.markRedemptionUsed(rd.id);
                          await onRefresh();
                        }}
                        className="rounded-md border border-[#171717]/20 px-2.5 py-1 text-xs hover:bg-[#F5F0E6]"
                      >
                        บันทึกใช้สิทธิ์แล้ว
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <ConfirmDialog
          open={redeemConfirmOpen}
          title="ยืนยันการแลกคะแนน"
          description={
            reward
              ? `ระบบจะหักคะแนนจำนวน ${reward.pointsCost} คะแนน เพื่อแลกรับ "${reward.titleTh}"`
              : ''
          }
          confirmLabel="ยืนยันแลกรางวัล"
          cancelLabel={t.cancel}
          busy={redeemBusy}
          onConfirm={handleRedeemConfirm}
          onCancel={() => setRedeemConfirmOpen(false)}
        />
      </div>
    );
  }

  // ======================== 20. ORDER HISTORY ========================
  if (screen === 'order_history') {
    const filteredBills = bills.filter((b) => {
      if (historyFilter === 'paid') return b.status === 'paid';
      if (historyFilter === 'open') return b.status === 'open' || b.status === 'pending_payment';
      return true;
    });

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold text-[#171717]">{t.navHistory}</h1>
            <p className="mt-1 text-sm text-[#77716A]">รายการบิลและใบเสร็จย้อนหลังทั้งหมด</p>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-[#171717]/10 bg-[#FFFFFF] p-1">
            {(['all', 'paid', 'open'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setHistoryFilter(f)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                  historyFilter === f ? 'bg-[#171717] text-[#F5F0E6]' : 'text-[#77716A]'
                }`}
              >
                {f === 'all' ? 'ทั้งหมด' : f === 'paid' ? 'ชำระเงินแล้ว' : 'ยังไม่ปิดบิล'}
              </button>
            ))}
          </div>
        </div>

        {filteredBills.length === 0 ? (
          <div className="rounded-xl border border-[#171717]/10 bg-[#FFFFFF] p-12 text-center">
            <History className="mx-auto h-9 w-9 text-[#C6A56B]" />
            <p className="mt-3 text-sm text-[#77716A]">ยังไม่มีประวัติคำสั่งซื้อในหมวดนี้</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[#171717]/10 bg-[#FFFFFF]">
            <div className="divide-y divide-[#171717]/10">
              {filteredBills.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 hover:bg-[#F5F0E6]/40"
                >
                  <div>
                    <div className="flex items-center gap-2 text-xs text-[#77716A]">
                      <span className="font-mono font-semibold text-[#171717]">{b.receiptNumber}</span>
                      <span>·</span>
                      <span>โต๊ะ {b.tableCode}</span>
                      <span>·</span>
                      <span>{new Date(b.createdAt).toLocaleString('th-TH')}</span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-[#171717]">
                      ลูกค้า: {b.customerName} · สถานะ:{' '}
                      <span className={b.status === 'paid' ? 'text-[#16A34A]' : 'text-[#D97706]'}>
                        {b.status === 'paid'
                          ? 'ชำระเงินสำเร็จ'
                          : b.status === 'pending_payment'
                            ? 'รอตรวจสอบการชำระ'
                            : 'กำลังเปิดบิล'}
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="block font-mono text-base font-semibold tabular-nums text-[#7B252B]">
                        {b.netTotal.toLocaleString()} {t.baht}
                      </span>
                      {b.pointsEarned > 0 && (
                        <span className="block text-xs text-[#16A34A]">+{b.pointsEarned} {t.points}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectBill(b.id);
                        onNavigate('receipt_details');
                      }}
                      className="rounded-lg border border-[#171717]/20 px-3.5 py-2 text-xs font-medium text-[#171717] hover:bg-[#F5F0E6]"
                    >
                      ดูใบเสร็จ
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ======================== 21. RECEIPT DETAILS ========================
  if (!activeReceiptBill) {
    return (
      <div className="rounded-xl border border-[#171717]/10 bg-[#FFFFFF] p-10 text-center">
        <p className="text-sm text-[#77716A]">ไม่พบข้อมูลใบเสร็จ</p>
        <button
          type="button"
          onClick={() => onNavigate('order_history')}
          className="mt-4 rounded-lg bg-[#171717] px-4 py-2 text-xs text-white"
        >
          {t.back}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="no-print flex items-center justify-between">
        <button
          type="button"
          onClick={() => onNavigate('order_history')}
          className="inline-flex items-center gap-2 text-sm font-medium text-[#77716A] hover:text-[#171717]"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>กลับไปประวัติบิล</span>
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-[#171717] px-4 py-2 text-xs font-medium text-[#F5F0E6] hover:bg-[#2E2A27]"
        >
          <Printer className="h-4 w-4" />
          <span>พิมพ์ใบเสร็จ</span>
        </button>
      </div>

      <div className="rounded-xl border border-[#171717]/15 bg-[#FFFFFF] p-8">
        <div className="border-b border-dashed border-[#171717]/20 pb-6 text-center">
          <h1 className="font-display text-3xl font-semibold tracking-wider text-[#171717]">
            {settings.restaurantName}
          </h1>
          <p className="mt-1 text-xs text-[#C6A56B]">{settings.tagline}</p>
          <p className="mt-2 text-xs text-[#77716A]">
            {settings.branchName} · {settings.address}
          </p>
          <p className="text-xs text-[#77716A]">
            โทร. {settings.phone} · Tax ID: {settings.taxId}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 border-b border-dashed border-[#171717]/20 py-4 text-xs">
          <div>
            <span className="text-[#77716A]">เลขที่ใบเสร็จ: </span>
            <strong className="font-mono">{activeReceiptBill.receiptNumber}</strong>
          </div>
          <div className="text-right">
            <span className="text-[#77716A]">โต๊ะ: </span>
            <strong>{activeReceiptBill.tableCode}</strong>
          </div>
          <div>
            <span className="text-[#77716A]">ลูกค้า: </span>
            <strong>{activeReceiptBill.customerName}</strong>
          </div>
          <div className="text-right">
            <span className="text-[#77716A]">พนักงาน: </span>
            <strong>{activeReceiptBill.staffName}</strong>
          </div>
          <div>
            <span className="text-[#77716A]">วันที่: </span>
            <span>{new Date(activeReceiptBill.createdAt).toLocaleString('th-TH')}</span>
          </div>
          <div className="text-right">
            <span className="text-[#77716A]">สถานะ: </span>
            <strong className={activeReceiptBill.status === 'paid' ? 'text-[#16A34A]' : 'text-[#D97706]'}>
              {activeReceiptBill.status === 'paid' ? 'PAID / ชำระแล้ว' : 'PENDING'}
            </strong>
          </div>
        </div>

        <div className="space-y-2.5 border-b border-dashed border-[#171717]/20 py-5 text-sm">
          {PLATE_ORDER.map((color) => {
            const qty = activeReceiptBill.plateCounts[color] || 0;
            if (!qty) return null;
            const unit = settings.platePrices[color];
            return (
              <div key={color} className="flex items-center justify-between">
                <span>
                  {PLATE_META[color].labelTh} ({unit} ฿) × {qty}
                </span>
                <span className="font-mono tabular-nums">{(qty * unit).toLocaleString()}</span>
              </div>
            );
          })}
        </div>

        <div className="space-y-2 py-5 text-sm">
          <div className="flex justify-between text-[#77716A]">
            <span>{t.foodSubtotal}</span>
            <span className="font-mono tabular-nums">{activeReceiptBill.foodSubtotal.toLocaleString()} {t.baht}</span>
          </div>
          <div className="flex justify-between text-[#77716A]">
            <span>{t.serviceCharge}</span>
            <span className="font-mono tabular-nums">{activeReceiptBill.serviceCharge.toLocaleString()} {t.baht}</span>
          </div>
          {activeReceiptBill.promotionDiscount > 0 && (
            <div className="flex justify-between text-[#16A34A]">
              <span>{t.discount}</span>
              <span className="font-mono tabular-nums">-{activeReceiptBill.promotionDiscount.toLocaleString()} {t.baht}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-[#171717]/15 pt-3 text-lg font-semibold text-[#171717]">
            <span>{t.netTotal}</span>
            <span className="font-mono tabular-nums text-[#7B252B]">
              {activeReceiptBill.netTotal.toLocaleString()} {t.baht}
            </span>
          </div>
        </div>

        <div className="border-t border-dashed border-[#171717]/20 pt-4 text-center text-xs text-[#77716A]">
          <p>
            ช่องทางชำระ: {activeReceiptBill.paymentMethod ? activeReceiptBill.paymentMethod.toUpperCase() : '-'}
            {activeReceiptBill.pointsEarned > 0 && ` · คะแนนที่ได้รับ: +${activeReceiptBill.pointsEarned} คะแนน`}
          </p>
          <p className="mt-2 font-display text-sm italic text-[#171717]">
            ขอบคุณที่ใช้บริการ {settings.restaurantName}
          </p>
        </div>
      </div>
    </div>
  );
}
