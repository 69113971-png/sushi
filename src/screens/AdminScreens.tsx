import { useState } from 'react';
import {
  Ban,
  BarChart3,
  CheckCircle2,
  Download,
  Edit3,
  Gift,
  Plus,
  Settings,
  Shield,
  Tag,
  Trash2,
  UserPlus,
  Utensils,
} from 'lucide-react';
import { api } from '../api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DishImage } from '../components/DishImage';
import { PlateChip } from '../components/PlateChip';
import { PLATE_META, UI_TEXT } from '../i18n';
import type {
  Bill,
  Category,
  LanguageCode,
  MenuItem,
  PaymentRecord,
  PlateColor,
  PlatePrices,
  PointTransaction,
  Promotion,
  RedemptionRecord,
  RestaurantSettings,
  RewardItem,
  ScreenId,
  UserProfile,
  UserRole,
} from '../types';

interface AdminScreensProps {
  screen:
    | 'admin_dashboard'
    | 'menu_management'
    | 'price_settings'
    | 'staff_management'
    | 'promotion_management'
    | 'sales_reports'
    | 'restaurant_settings';
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
  payments: PaymentRecord[];
  allUsers: UserProfile[];
  onNavigate: (screen: ScreenId) => void;
  onSelectBill: (id: string) => void;
  onSelectPayment: (id: string) => void;
  onRefresh: () => Promise<void>;
}

const PLATE_ORDER: PlateColor[] = ['white', 'red', 'silver', 'gold', 'black'];
const PRESET_IMAGES = [
  { label: 'Otoro Nigiri', url: '/src/assets/images/sushi_otoro_nigiri_1795331466966.jpg' },
  { label: 'Salmon & Ikura', url: '/src/assets/images/sushi_salmon_ikura_1795331466789.jpg' },
  { label: 'Uni & Wagyu Black', url: '/src/assets/images/sushi_uni_black_1795331466903.jpg' },
  { label: 'Matcha & Sake', url: '/src/assets/images/sushi_matcha_sake_1795331467118.jpg' },
];

export function AdminScreens({
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
  payments,
  allUsers,
  onNavigate,
  onSelectBill,
  onSelectPayment,
  onRefresh,
}: AdminScreensProps) {
  const t = UI_TEXT[lang];

  // Menu CRUD state
  const [editingMenu, setEditingMenu] = useState<MenuItem | null>(null);
  const [mNameTh, setMNameTh] = useState('');
  const [mNameEn, setMNameEn] = useState('');
  const [mNameJp, setMNameJp] = useState('');
  const [mDescTh, setMDescTh] = useState('');
  const [mCatId, setMCatId] = useState(categories[0]?.id || 'cat_nigiri');
  const [mPlate, setMPlate] = useState<PlateColor>('red');
  const [mImg, setMImg] = useState(PRESET_IMAGES[0].url);
  const [mCal, setMCal] = useState('180');
  const [mAllergens, setMAllergens] = useState('ปลา (Fish)');
  const [mFeatured, setMFeatured] = useState(false);
  const [mBusy, setMBusy] = useState(false);
  const [deleteMenuId, setDeleteMenuId] = useState<string | null>(null);

  // Price settings state
  const [prices, setPrices] = useState<PlatePrices>({ ...settings.platePrices });
  const [svcRate, setSvcRate] = useState(String(Math.round(settings.serviceChargeRate * 100)));
  const [ptsRate, setPtsRate] = useState(String(settings.pointsBahtRate));
  const [priceConfirmOpen, setPriceConfirmOpen] = useState(false);
  const [priceMsg, setPriceMsg] = useState<string | null>(null);

  // Staff / User creation state
  const [uName, setUName] = useState('');
  const [uEmail, setUEmail] = useState('');
  const [uPhone, setUPhone] = useState('');
  const [uRole, setURole] = useState<UserRole>('staff');
  const [uErr, setUErr] = useState<string | null>(null);
  const [uMsg, setUMsg] = useState<string | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<UserProfile | null>(null);

  // Promotion & Reward creation state
  const [pTitleTh, setPTitleTh] = useState('');
  const [pDescTh, setPDescTh] = useState('');
  const [pCode, setPCode] = useState('');
  const [pPct, setPPct] = useState('10');
  const [pMin, setPMin] = useState('500');
  const [pUntil, setPUntil] = useState('2026-12-31');
  const [deletePromoId, setDeletePromoId] = useState<string | null>(null);

  const [rTitleTh, setRTitleTh] = useState('');
  const [rDescTh, setRDescTh] = useState('');
  const [rCost, setRCost] = useState('30');
  const [rStock, setRStock] = useState('20');
  const [rImg, setRImg] = useState(PRESET_IMAGES[3].url);

  // Restaurant settings state
  const [restName, setRestName] = useState(settings.restaurantName);
  const [restTagline, setRestTagline] = useState(settings.tagline);
  const [restBranch, setRestBranch] = useState(settings.branchName);
  const [restAddr, setRestAddr] = useState(settings.address);
  const [restPhone, setRestPhone] = useState(settings.phone);
  const [restTax, setRestTax] = useState(settings.taxId);
  const [restHours, setRestHours] = useState(settings.openingHours);
  const [restLang, setRestLang] = useState<LanguageCode>(settings.defaultLanguage);
  const [restPpqr, setRestPpqr] = useState(settings.ppqrBaseUrl);
  const [restMsg, setRestMsg] = useState<string | null>(null);

  if (user.role !== 'admin') {
    return (
      <div className="rounded-xl border border-[#7B252B]/30 bg-[#FFFFFF] p-8 text-center text-sm text-[#7B252B]">
        หน้านี้จำกัดสิทธิ์เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น
      </div>
    );
  }

  const paidBills = bills.filter((b) => b.status === 'paid');
  const totalRevenue = paidBills.reduce((s, b) => s + b.netTotal, 0);
  const avgTicket = paidBills.length > 0 ? Math.round(totalRevenue / paidBills.length) : 0;
  const totalPointsEarned = pointTransactions.filter((p) => p.type === 'earn').reduce((s, p) => s + p.points, 0);
  const totalPointsRedeemed = Math.abs(pointTransactions.filter((p) => p.type === 'redeem').reduce((s, p) => s + p.points, 0));

  // ======================== 22. ADMIN DASHBOARD ========================
  if (screen === 'admin_dashboard') {
    const pendingPayments = payments.filter((p) => p.status === 'pending');

    return (
      <div className="space-y-8">
        <div>
          <p className="text-xs tracking-widest text-[#C6A56B] uppercase">Executive Console</p>
          <h1 className="mt-1 font-display text-3xl font-semibold text-[#171717]">{t.navAdminDesk}</h1>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-[#171717]/10 bg-[#FFFFFF] p-5">
            <span className="text-xs text-[#77716A]">ยอดขายสุทธิ (บิลที่ชำระแล้ว)</span>
            <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-[#7B252B]">
              {totalRevenue.toLocaleString()} ฿
            </p>
          </div>
          <div className="rounded-xl border border-[#171717]/10 bg-[#FFFFFF] p-5">
            <span className="text-xs text-[#77716A]">จำนวนบิลสำเร็จ / เฉลี่ยต่อบิล</span>
            <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-[#171717]">
              {paidBills.length}{' '}
              <span className="text-sm font-normal text-[#77716A]">({avgTicket.toLocaleString()} ฿)</span>
            </p>
          </div>
          <div className="rounded-xl border border-[#171717]/10 bg-[#FFFFFF] p-5">
            <span className="text-xs text-[#77716A]">คะแนนสะสม (แจก / แลกใช้)</span>
            <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-[#171717]">
              +{totalPointsEarned.toLocaleString()}{' '}
              <span className="text-sm text-[#7B252B]">/ -{totalPointsRedeemed.toLocaleString()}</span>
            </p>
          </div>
          <div className="rounded-xl border border-[#171717]/10 bg-[#FFFFFF] p-5">
            <span className="text-xs text-[#77716A]">ผู้ใช้งานทั้งหมด / รอตรวจชำระ</span>
            <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-[#171717]">
              {allUsers.length}{' '}
              <span className="text-sm font-normal text-[#D97706]">({pendingPayments.length} รอตรวจ)</span>
            </p>
          </div>
        </div>

        {/* Admin Quick Consoles */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { id: 'menu_management' as ScreenId, icon: Utensils, title: 'จัดการเมนูอาหาร', desc: `เพิ่ม ลบ แก้ไขเมนู (${menu.length} รายการ)` },
            { id: 'price_settings' as ScreenId, icon: Tag, title: 'ตั้งค่าราคาสีจาน', desc: 'กำหนดราคาจาน 5 สี และค่าบริการ 10%' },
            { id: 'staff_management' as ScreenId, icon: Shield, title: 'จัดการพนักงานและลูกค้า', desc: 'สร้างบัญชี Staff/Admin และระงับสิทธิ์' },
            { id: 'promotion_management' as ScreenId, icon: Gift, title: 'โปรโมชั่นและของรางวัล', desc: `โปรโมชั่น ${promotions.length} · รางวัล ${rewards.length}` },
            { id: 'sales_reports' as ScreenId, icon: BarChart3, title: 'รายงานยอดขายและคะแนน', desc: 'สรุปยอดตามสีจาน ช่องทางชำระ และ Export CSV' },
            { id: 'restaurant_settings' as ScreenId, icon: Settings, title: 'ตั้งค่าร้านอาหาร', desc: 'ข้อมูลสาขา Tax ID เวลาเปิดปิด และ PPQR' },
          ].map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => onNavigate(card.id)}
              className="flex items-start gap-4 rounded-xl border border-[#171717]/10 bg-[#FFFFFF] p-5 text-left transition-colors hover:border-[#C6A56B]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#171717] text-[#C6A56B]">
                <card.icon className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-[#171717]">{card.title}</h2>
                <p className="mt-1 text-xs text-[#77716A]">{card.desc}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Recent Bills & Payments Inspection */}
        <section className="rounded-xl border border-[#171717]/10 bg-[#FFFFFF] p-6">
          <h2 className="text-base font-semibold text-[#171717]">ตรวจสอบบิลและการชำระเงินล่าสุด</h2>
          {bills.length === 0 ? (
            <p className="mt-4 text-sm text-[#77716A]">ยังไม่มีรายการบิลในระบบ</p>
          ) : (
            <div className="mt-4 divide-y divide-[#171717]/10">
              {bills.slice(0, 8).map((b) => {
                const p = payments.find((pay) => pay.billId === b.id);
                return (
                  <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                    <div>
                      <span className="font-mono font-semibold text-[#171717]">{b.receiptNumber}</span>
                      <span className="mx-2 text-[#77716A]">·</span>
                      <span>โต๊ะ {b.tableCode} · {b.customerName}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-semibold tabular-nums text-[#7B252B]">
                        {b.netTotal.toLocaleString()} ฿
                      </span>
                      <span className={`text-xs font-medium ${b.status === 'paid' ? 'text-[#16A34A]' : 'text-[#D97706]'}`}>
                        {b.status === 'paid' ? 'ชำระแล้ว' : 'ยังไม่ปิด'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectBill(b.id);
                          if (p && p.status === 'pending') {
                            onSelectPayment(p.id);
                            onNavigate(p.method === 'ppqr' ? 'ppqr_payment' : 'payment_status');
                          } else {
                            onNavigate('receipt_details');
                          }
                        }}
                        className="rounded-md border border-[#171717]/20 px-3 py-1 text-xs hover:bg-[#F5F0E6]"
                      >
                        {p && p.status === 'pending' ? 'ตรวจชำระเงิน' : 'ดูใบเสร็จ'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    );
  }

  // ======================== 23. MENU MANAGEMENT ========================
  if (screen === 'menu_management') {
    const startEdit = (item: MenuItem) => {
      setEditingMenu(item);
      setMNameTh(item.nameTh);
      setMNameEn(item.nameEn);
      setMNameJp(item.nameJp);
      setMDescTh(item.descriptionTh);
      setMCatId(item.categoryId);
      setMPlate(item.plateColor);
      setMImg(item.imageUrl);
      setMCal(String(item.calories));
      setMAllergens(item.allergens);
      setMFeatured(item.featured);
    };

    const resetMenuForm = () => {
      setEditingMenu(null);
      setMNameTh('');
      setMNameEn('');
      setMNameJp('');
      setMDescTh('');
      setMPlate('red');
      setMCal('180');
      setMAllergens('ปลา (Fish)');
      setMFeatured(false);
    };

    const handleSubmitMenu = async (e: React.FormEvent) => {
      e.preventDefault();
      setMBusy(true);
      try {
        const payload = {
          categoryId: mCatId,
          nameTh: mNameTh,
          nameEn: mNameEn || mNameTh,
          nameJp: mNameJp,
          descriptionTh: mDescTh,
          descriptionEn: mDescTh,
          plateColor: mPlate,
          imageUrl: mImg,
          calories: Number(mCal || 150),
          allergens: mAllergens,
          featured: mFeatured,
        };
        if (editingMenu) {
          await api.updateMenuItem(editingMenu.id, payload);
        } else {
          await api.createMenuItem(payload);
        }
        resetMenuForm();
        await onRefresh();
      } finally {
        setMBusy(false);
      }
    };

    return (
      <div className="space-y-8">
        <h1 className="font-display text-3xl font-semibold text-[#171717]">{t.navMenuAdmin}</h1>

        <form onSubmit={handleSubmitMenu} className="space-y-4 rounded-xl border border-[#171717]/10 bg-[#FFFFFF] p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#171717]">
              {editingMenu ? `แก้ไขเมนู: ${editingMenu.nameTh}` : 'เพิ่มรายการเมนูใหม่'}
            </h2>
            {editingMenu && (
              <button type="button" onClick={resetMenuForm} className="text-xs text-[#7B252B] underline">
                ยกเลิกการแก้ไข
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <input
              type="text"
              required
              value={mNameTh}
              onChange={(e) => setMNameTh(e.target.value)}
              placeholder="ชื่อเมนูภาษาไทย *"
              className="rounded-lg border border-[#171717]/15 px-3.5 py-2.5 text-sm outline-none focus:border-[#C6A56B]"
            />
            <input
              type="text"
              value={mNameEn}
              onChange={(e) => setMNameEn(e.target.value)}
              placeholder="English Name"
              className="rounded-lg border border-[#171717]/15 px-3.5 py-2.5 text-sm outline-none focus:border-[#C6A56B]"
            />
            <input
              type="text"
              value={mNameJp}
              onChange={(e) => setMNameJp(e.target.value)}
              placeholder="日本語名"
              className="rounded-lg border border-[#171717]/15 px-3.5 py-2.5 text-sm outline-none focus:border-[#C6A56B]"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <select
              value={mCatId}
              onChange={(e) => setMCatId(e.target.value)}
              className="rounded-lg border border-[#171717]/15 bg-white px-3.5 py-2.5 text-sm outline-none"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameTh}
                </option>
              ))}
            </select>
            <select
              value={mPlate}
              onChange={(e) => setMPlate(e.target.value as PlateColor)}
              className="rounded-lg border border-[#171717]/15 bg-white px-3.5 py-2.5 text-sm outline-none"
            >
              {PLATE_ORDER.map((c) => (
                <option key={c} value={c}>
                  {PLATE_META[c].labelTh} ({settings.platePrices[c]} ฿)
                </option>
              ))}
            </select>
            <select
              value={mImg}
              onChange={(e) => setMImg(e.target.value)}
              className="rounded-lg border border-[#171717]/15 bg-white px-3.5 py-2.5 text-sm outline-none"
            >
              {PRESET_IMAGES.map((img) => (
                <option key={img.url} value={img.url}>
                  ภาพ: {img.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={mCal}
              onChange={(e) => setMCal(e.target.value)}
              placeholder="แคลอรี่ (kcal)"
              className="rounded-lg border border-[#171717]/15 px-3.5 py-2.5 text-sm outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <input
              type="text"
              value={mDescTh}
              onChange={(e) => setMDescTh(e.target.value)}
              placeholder="คำอธิบายเมนูอาหาร"
              className="sm:col-span-2 rounded-lg border border-[#171717]/15 px-3.5 py-2.5 text-sm outline-none focus:border-[#C6A56B]"
            />
            <input
              type="text"
              value={mAllergens}
              onChange={(e) => setMAllergens(e.target.value)}
              placeholder="ข้อมูลผู้แพ้อาหาร"
              className="rounded-lg border border-[#171717]/15 px-3.5 py-2.5 text-sm outline-none focus:border-[#C6A56B]"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <label className="inline-flex items-center gap-2 text-xs text-[#171717]">
              <input
                type="checkbox"
                checked={mFeatured}
                onChange={(e) => setMFeatured(e.target.checked)}
                className="h-4 w-4 accent-[#7B252B]"
              />
              <span>แสดงในเมนูแนะนำหน้าแรก (Chef&apos;s Selection)</span>
            </label>
            <button
              type="submit"
              disabled={mBusy}
              className="inline-flex items-center gap-2 rounded-lg bg-[#7B252B] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#5E1B20]"
            >
              <Plus className="h-4 w-4" />
              <span>{editingMenu ? 'บันทึกการแก้ไขเมนู' : 'เพิ่มเมนูเข้าสู่ระบบ'}</span>
            </button>
          </div>
        </form>

        <div className="overflow-hidden rounded-xl border border-[#171717]/10 bg-[#FFFFFF]">
          <div className="divide-y divide-[#171717]/10">
            {menu.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5">
                <div className="flex items-center gap-4">
                  <DishImage src={item.imageUrl} alt={item.nameTh} className="h-14 w-20 rounded-lg object-cover" />
                  <div>
                    <p className="text-sm font-semibold text-[#171717]">{item.nameTh}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <PlateChip color={item.plateColor} price={settings.platePrices[item.plateColor]} lang={lang} />
                      <span className="text-xs text-[#77716A]">
                        · {item.available ? 'เปิดขาย' : 'ปิดชั่วคราว'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await api.updateMenuItem(item.id, { available: !item.available });
                      await onRefresh();
                    }}
                    className="rounded-lg border border-[#171717]/15 px-3 py-1.5 text-xs font-medium hover:bg-[#F5F0E6]"
                  >
                    {item.available ? 'ปิดขายชั่วคราว' : 'เปิดขาย'}
                  </button>
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    className="rounded-lg border border-[#171717]/15 p-2 text-[#171717] hover:bg-[#F5F0E6]"
                    aria-label="แก้ไขเมนู"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteMenuId(item.id)}
                    className="rounded-lg border border-[#7B252B]/25 p-2 text-[#7B252B] hover:bg-[#7B252B]/10"
                    aria-label="ลบเมนู"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <ConfirmDialog
          open={Boolean(deleteMenuId)}
          title="ยืนยันการลบเมนู"
          description="เมื่อลบรายการเมนูนี้ออกจากระบบแล้ว จะไม่สามารถกู้คืนได้"
          confirmLabel="ลบเมนู"
          cancelLabel={t.cancel}
          destructive
          onConfirm={async () => {
            if (!deleteMenuId) return;
            await api.deleteMenuItem(deleteMenuId);
            setDeleteMenuId(null);
            await onRefresh();
          }}
          onCancel={() => setDeleteMenuId(null)}
        />
      </div>
    );
  }

  // ======================== 24. PRICE SETTINGS ========================
  if (screen === 'price_settings') {
    const savePrices = async () => {
      await api.updateSettings({
        platePrices: prices,
        serviceChargeRate: Number(svcRate) / 100,
        pointsBahtRate: Number(ptsRate),
      });
      setPriceConfirmOpen(false);
      setPriceMsg('บันทึกราคาสีจานและอัตราค่าบริการเรียบร้อยแล้ว');
      await onRefresh();
    };

    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="font-display text-3xl font-semibold text-[#171717]">{t.navPrices}</h1>

        <div className="space-y-4 rounded-xl border border-[#171717]/10 bg-[#FFFFFF] p-6">
          <h2 className="text-base font-semibold text-[#171717]">กำหนดราคาจานแต่ละสี (บาท)</h2>
          <div className="space-y-3">
            {PLATE_ORDER.map((color) => (
              <div key={color} className="flex items-center justify-between gap-4 border-b border-[#171717]/10 pb-3">
                <PlateChip color={color} lang={lang} />
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={prices[color]}
                    onChange={(e) =>
                      setPrices((prev) => ({ ...prev, [color]: Math.max(1, Number(e.target.value)) }))
                    }
                    className="w-28 rounded-lg border border-[#171717]/15 px-3 py-2 text-right font-mono text-sm outline-none focus:border-[#C6A56B]"
                  />
                  <span className="text-xs text-[#77716A]">บาท</span>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#77716A]">ค่าบริการ Service Charge (%)</label>
              <input
                type="number"
                min={0}
                max={30}
                value={svcRate}
                onChange={(e) => setSvcRate(e.target.value)}
                className="w-full rounded-lg border border-[#171717]/15 px-3.5 py-2.5 font-mono text-sm outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#77716A]">อัตราแลกคะแนน (กี่บาท = 1 คะแนน)</label>
              <input
                type="number"
                min={1}
                value={ptsRate}
                onChange={(e) => setPtsRate(e.target.value)}
                className="w-full rounded-lg border border-[#171717]/15 px-3.5 py-2.5 font-mono text-sm outline-none"
              />
            </div>
          </div>

          {priceMsg && <p className="text-xs font-medium text-[#16A34A]">{priceMsg}</p>}

          <button
            type="button"
            onClick={() => setPriceConfirmOpen(true)}
            className="rounded-lg bg-[#171717] px-5 py-2.5 text-sm font-medium text-[#F5F0E6] hover:bg-[#2F2B28]"
          >
            บันทึกการตั้งค่าราคา
          </button>
        </div>

        <ConfirmDialog
          open={priceConfirmOpen}
          title="ยืนยันการเปลี่ยนราคาจานและอัตราคำนวณ"
          description="ราคาใหม่จะมีผลทันทีกับการคิดเงินและบิลใหม่ทั้งหมด ต้องการบันทึกใช่หรือไม่?"
          confirmLabel="ยืนยันบันทึก"
          cancelLabel={t.cancel}
          onConfirm={savePrices}
          onCancel={() => setPriceConfirmOpen(false)}
        />
      </div>
    );
  }

  // ======================== 25. STAFF & USER MANAGEMENT ========================
  if (screen === 'staff_management') {
    const handleCreateUser = async (e: React.FormEvent) => {
      e.preventDefault();
      setUErr(null);
      setUMsg(null);
      try {
        await api.createAdminUser({
          name: uName,
          email: uEmail,
          phone: uPhone,
          role: uRole,
        });
        setUName('');
        setUEmail('');
        setUPhone('');
        setUMsg('สร้างโปรไฟล์ผู้ใช้งานเรียบร้อยแล้ว');
        await onRefresh();
      } catch (err) {
        setUErr(err instanceof Error ? err.message : 'สร้างโปรไฟล์ไม่สำเร็จ');
      }
    };

    return (
      <div className="space-y-8">
        <h1 className="font-display text-3xl font-semibold text-[#171717]">{t.navStaffAdmin}</h1>

        <form onSubmit={handleCreateUser} className="space-y-4 rounded-xl border border-[#171717]/10 bg-[#FFFFFF] p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[#171717]">
            <UserPlus className="h-4 w-4 text-[#7B252B]" />
            <span>เพิ่มโปรไฟล์พนักงาน (Staff) ลูกค้า (User) หรือผู้ดูแลระบบ (Admin)</span>
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <input
              type="text"
              required
              value={uName}
              onChange={(e) => setUName(e.target.value)}
              placeholder="ชื่อ-นามสกุล"
              className="rounded-lg border border-[#171717]/15 px-3 py-2 text-sm outline-none"
            />
            <input
              type="email"
              required
              value={uEmail}
              onChange={(e) => setUEmail(e.target.value)}
              placeholder="อีเมล"
              className="rounded-lg border border-[#171717]/15 px-3 py-2 text-sm outline-none"
            />
            <input
              type="tel"
              value={uPhone}
              onChange={(e) => setUPhone(e.target.value)}
              placeholder="เบอร์โทร"
              className="rounded-lg border border-[#171717]/15 px-3 py-2 text-sm outline-none"
            />
            <select
              value={uRole}
              onChange={(e) => setURole(e.target.value as UserRole)}
              className="rounded-lg border border-[#171717]/15 bg-white px-3 py-2 text-sm outline-none"
            >
              <option value="staff">Staff (พนักงาน)</option>
              <option value="admin">Admin (ผู้ดูแลระบบ)</option>
              <option value="user">User (ลูกค้า)</option>
            </select>
          </div>
          {uErr && <p className="text-xs font-medium text-[#7B252B]">{uErr}</p>}
          {uMsg && <p className="text-xs font-medium text-[#16A34A]">{uMsg}</p>}
          <button
            type="submit"
            className="rounded-lg bg-[#7B252B] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#5E1B20]"
          >
            สร้างบัญชีผู้ใช้
          </button>
        </form>

        <div className="overflow-hidden rounded-xl border border-[#171717]/10 bg-[#FFFFFF]">
          <div className="divide-y divide-[#171717]/10">
            {allUsers.map((u) => (
              <div key={u.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 text-sm">
                <div>
                  <p className="font-semibold text-[#171717]">
                    {u.name} <span className="font-normal text-[#77716A]">({u.email})</span>
                  </p>
                  <p className="mt-0.5 text-xs text-[#77716A]">
                    คะแนน: <strong className="font-mono">{u.pointsBalance}</strong> · สถานะ:{' '}
                    <strong className={u.status === 'active' ? 'text-[#16A34A]' : 'text-[#7B252B]'}>
                      {u.status === 'active' ? 'ใช้งานปกติ' : 'ถูกระงับ'}
                    </strong>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={u.role}
                    disabled={u.id === user.id}
                    onChange={async (e) => {
                      await api.updateAdminUser(u.id, { role: e.target.value as UserRole });
                      await onRefresh();
                    }}
                    className="rounded-lg border border-[#171717]/15 bg-white px-3 py-1.5 text-xs outline-none disabled:opacity-50"
                  >
                    <option value="user">User</option>
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                  </select>

                  {u.id !== user.id && (
                    <button
                      type="button"
                      onClick={() => setSuspendTarget(u)}
                      className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium ${
                        u.status === 'active'
                          ? 'border border-[#7B252B]/30 text-[#7B252B] hover:bg-[#7B252B]/10'
                          : 'bg-[#16A34A] text-white'
                      }`}
                    >
                      {u.status === 'active' ? (
                        <>
                          <Ban className="h-3.5 w-3.5" />
                          <span>ระงับบัญชี</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>เปิดใช้งาน</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <ConfirmDialog
          open={Boolean(suspendTarget)}
          title={suspendTarget?.status === 'active' ? 'ยืนยันการระงับบัญชี' : 'เปิดใช้งานบัญชีอีกครั้ง'}
          description={
            suspendTarget
              ? `ต้องการ${suspendTarget.status === 'active' ? 'ระงับสิทธิ์เข้าใช้งานของ' : 'เปิดใช้งานบัญชีของ'} ${suspendTarget.name} (${suspendTarget.email}) ใช่หรือไม่?`
              : ''
          }
          confirmLabel="ยืนยัน"
          cancelLabel={t.cancel}
          destructive={suspendTarget?.status === 'active'}
          onConfirm={async () => {
            if (!suspendTarget) return;
            await api.updateAdminUser(suspendTarget.id, {
              status: suspendTarget.status === 'active' ? 'suspended' : 'active',
            });
            setSuspendTarget(null);
            await onRefresh();
          }}
          onCancel={() => setSuspendTarget(null)}
        />
      </div>
    );
  }

  // ======================== 26. PROMOTION & REWARDS MANAGEMENT ========================
  if (screen === 'promotion_management') {
    const handleAddPromo = async (e: React.FormEvent) => {
      e.preventDefault();
      await api.createPromotion({
        titleTh: pTitleTh,
        descriptionTh: pDescTh,
        code: pCode,
        discountPercent: Number(pPct),
        minSpend: Number(pMin),
        validUntil: pUntil,
      });
      setPTitleTh('');
      setPDescTh('');
      setPCode('');
      await onRefresh();
    };

    const handleAddReward = async (e: React.FormEvent) => {
      e.preventDefault();
      await api.createReward({
        titleTh: rTitleTh,
        descriptionTh: rDescTh,
        pointsCost: Number(rCost),
        stock: Number(rStock),
        imageUrl: rImg,
      });
      setRTitleTh('');
      setRDescTh('');
      await onRefresh();
    };

    return (
      <div className="space-y-8">
        <h1 className="font-display text-3xl font-semibold text-[#171717]">
          จัดการโปรโมชั่นและของรางวัล
        </h1>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Promotions */}
          <section className="space-y-4">
            <form onSubmit={handleAddPromo} className="space-y-3 rounded-xl border border-[#171717]/10 bg-[#FFFFFF] p-6">
              <h2 className="text-base font-semibold text-[#171717]">สร้างโปรโมชั่นใหม่</h2>
              <input
                type="text"
                required
                value={pTitleTh}
                onChange={(e) => setPTitleTh(e.target.value)}
                placeholder="ชื่อโปรโมชั่น"
                className="w-full rounded-lg border border-[#171717]/15 px-3 py-2 text-sm outline-none"
              />
              <input
                type="text"
                value={pDescTh}
                onChange={(e) => setPDescTh(e.target.value)}
                placeholder="รายละเอียดโปรโมชั่น"
                className="w-full rounded-lg border border-[#171717]/15 px-3 py-2 text-sm outline-none"
              />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <input
                  type="text"
                  required
                  value={pCode}
                  onChange={(e) => setPCode(e.target.value)}
                  placeholder="โค้ด (CODE)"
                  className="rounded-lg border border-[#171717]/15 px-3 py-2 font-mono text-sm uppercase outline-none"
                />
                <input
                  type="number"
                  min={1}
                  max={80}
                  value={pPct}
                  onChange={(e) => setPPct(e.target.value)}
                  placeholder="ลด %"
                  className="rounded-lg border border-[#171717]/15 px-3 py-2 font-mono text-sm outline-none"
                />
                <input
                  type="number"
                  min={0}
                  value={pMin}
                  onChange={(e) => setPMin(e.target.value)}
                  placeholder="ขั้นต่ำ (฿)"
                  className="rounded-lg border border-[#171717]/15 px-3 py-2 font-mono text-sm outline-none"
                />
                <input
                  type="date"
                  value={pUntil}
                  onChange={(e) => setPUntil(e.target.value)}
                  className="rounded-lg border border-[#171717]/15 px-3 py-2 text-xs outline-none"
                />
              </div>
              <button
                type="submit"
                className="rounded-lg bg-[#171717] px-4 py-2 text-sm font-medium text-[#F5F0E6]"
              >
                เพิ่มโปรโมชั่น
              </button>
            </form>

            <div className="divide-y divide-[#171717]/10 rounded-xl border border-[#171717]/10 bg-[#FFFFFF]">
              {promotions.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                  <div>
                    <p className="font-semibold text-[#171717]">
                      {p.titleTh} · <span className="font-mono text-[#7B252B]">{p.code}</span>
                    </p>
                    <p className="text-xs text-[#77716A]">
                      ลด {p.discountPercent}% (ขั้นต่ำ {p.minSpend} ฿) · ถึง {p.validUntil}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await api.updatePromotion(p.id, { active: !p.active });
                        await onRefresh();
                      }}
                      className="rounded-md border border-[#171717]/15 px-2.5 py-1 text-xs"
                    >
                      {p.active ? 'เปิดใช้งาน' : 'ปิดอยู่'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletePromoId(p.id)}
                      className="rounded-md p-1.5 text-[#7B252B] hover:bg-[#7B252B]/10"
                      aria-label="ลบโปรโมชั่น"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Rewards */}
          <section className="space-y-4">
            <form onSubmit={handleAddReward} className="space-y-3 rounded-xl border border-[#171717]/10 bg-[#FFFFFF] p-6">
              <h2 className="text-base font-semibold text-[#171717]">เพิ่มของรางวัลแลกคะแนน</h2>
              <input
                type="text"
                required
                value={rTitleTh}
                onChange={(e) => setRTitleTh(e.target.value)}
                placeholder="ชื่อของรางวัล"
                className="w-full rounded-lg border border-[#171717]/15 px-3 py-2 text-sm outline-none"
              />
              <input
                type="text"
                value={rDescTh}
                onChange={(e) => setRDescTh(e.target.value)}
                placeholder="รายละเอียดของรางวัล"
                className="w-full rounded-lg border border-[#171717]/15 px-3 py-2 text-sm outline-none"
              />
              <div className="grid grid-cols-3 gap-3">
                <input
                  type="number"
                  min={1}
                  value={rCost}
                  onChange={(e) => setRCost(e.target.value)}
                  placeholder="คะแนนที่ใช้"
                  className="rounded-lg border border-[#171717]/15 px-3 py-2 font-mono text-sm outline-none"
                />
                <input
                  type="number"
                  min={0}
                  value={rStock}
                  onChange={(e) => setRStock(e.target.value)}
                  placeholder="สต็อก"
                  className="rounded-lg border border-[#171717]/15 px-3 py-2 font-mono text-sm outline-none"
                />
                <select
                  value={rImg}
                  onChange={(e) => setRImg(e.target.value)}
                  className="rounded-lg border border-[#171717]/15 bg-white px-2 py-2 text-xs outline-none"
                >
                  {PRESET_IMAGES.map((img) => (
                    <option key={img.url} value={img.url}>
                      {img.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="rounded-lg bg-[#7B252B] px-4 py-2 text-sm font-medium text-white"
              >
                เพิ่มของรางวัล
              </button>
            </form>

            <div className="divide-y divide-[#171717]/10 rounded-xl border border-[#171717]/10 bg-[#FFFFFF]">
              {rewards.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                  <div>
                    <p className="font-semibold text-[#171717]">{r.titleTh}</p>
                    <p className="font-mono text-xs text-[#77716A]">
                      {r.pointsCost} คะแนน · คงเหลือ {r.stock}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await api.updateReward(r.id, { active: !r.active });
                      await onRefresh();
                    }}
                    className="rounded-md border border-[#171717]/15 px-3 py-1 text-xs"
                  >
                    {r.active ? 'เปิดให้แลก' : 'ปิดการแลก'}
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>

        <ConfirmDialog
          open={Boolean(deletePromoId)}
          title="ยืนยันการลบโปรโมชั่น"
          description="ต้องการลบโปรโมชั่นนี้ใช่หรือไม่?"
          confirmLabel={t.delete}
          cancelLabel={t.cancel}
          destructive
          onConfirm={async () => {
            if (!deletePromoId) return;
            await api.deletePromotion(deletePromoId);
            setDeletePromoId(null);
            await onRefresh();
          }}
          onCancel={() => setDeletePromoId(null)}
        />
      </div>
    );
  }

  // ======================== 27. SALES REPORTS ========================
  if (screen === 'sales_reports') {
    const plateTotals: Record<PlateColor, { count: number; revenue: number }> = {
      white: { count: 0, revenue: 0 },
      red: { count: 0, revenue: 0 },
      silver: { count: 0, revenue: 0 },
      gold: { count: 0, revenue: 0 },
      black: { count: 0, revenue: 0 },
    };
    for (const b of paidBills) {
      for (const c of PLATE_ORDER) {
        const cnt = b.plateCounts[c] || 0;
        plateTotals[c].count += cnt;
        plateTotals[c].revenue += cnt * settings.platePrices[c];
      }
    }

    const handleDownloadCsv = () => {
      const headers = ['ReceiptNumber', 'Table', 'Customer', 'FoodSubtotal', 'ServiceCharge', 'Discount', 'NetTotal', 'PaymentMethod', 'Status', 'PaidAt'];
      const rows = bills.map((b) => [
        b.receiptNumber,
        b.tableCode,
        `"${b.customerName.replace(/"/g, '""')}"`,
        b.foodSubtotal,
        b.serviceCharge,
        b.promotionDiscount,
        b.netTotal,
        b.paymentMethod || '',
        b.status,
        b.paidAt || '',
      ]);
      const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sushihouse-sales-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold text-[#171717]">{t.navReports}</h1>
            <p className="mt-1 text-sm text-[#77716A]">รายงานยอดขายแยกตามสีจาน ช่องทางชำระเงิน และคะแนนสะสม</p>
          </div>
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="inline-flex items-center gap-2 rounded-lg bg-[#171717] px-4 py-2.5 text-xs font-medium text-[#F5F0E6] hover:bg-[#2F2B28]"
          >
            <Download className="h-4 w-4" />
            <span>ดาวน์โหลดรายงาน CSV</span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-[#171717]/10 bg-[#FFFFFF] p-5">
            <span className="text-xs text-[#77716A]">ยอดขายรวมที่ชำระสำเร็จ</span>
            <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-[#7B252B]">
              {totalRevenue.toLocaleString()} ฿
            </p>
          </div>
          <div className="rounded-xl border border-[#171717]/10 bg-[#FFFFFF] p-5">
            <span className="text-xs text-[#77716A]">คะแนนที่แจกให้ลูกค้า</span>
            <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-[#16A34A]">
              +{totalPointsEarned.toLocaleString()} {t.points}
            </p>
          </div>
          <div className="rounded-xl border border-[#171717]/10 bg-[#FFFFFF] p-5">
            <span className="text-xs text-[#77716A]">คะแนนที่ถูกแลก / คูปองทั้งหมด</span>
            <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-[#171717]">
              {totalPointsRedeemed.toLocaleString()} <span className="text-sm text-[#77716A]">({redemptions.length} ใบ)</span>
            </p>
          </div>
        </div>

        <section className="rounded-xl border border-[#171717]/10 bg-[#FFFFFF] p-6">
          <h2 className="text-base font-semibold text-[#171717]">สรุปยอดขายตามสีจาน (บิลที่ปิดแล้ว)</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#171717]/10 text-xs text-[#77716A]">
                <tr>
                  <th className="py-2.5">สีจาน</th>
                  <th className="py-2.5 text-right">ราคาต่อจาน</th>
                  <th className="py-2.5 text-right">จำนวนจานที่ขาย</th>
                  <th className="py-2.5 text-right">รายได้รวม (ก่อนค่าบริการ)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#171717]/10">
                {PLATE_ORDER.map((c) => (
                  <tr key={c}>
                    <td className="py-3">
                      <PlateChip color={c} lang={lang} />
                    </td>
                    <td className="py-3 text-right font-mono tabular-nums">
                      {settings.platePrices[c].toLocaleString()} ฿
                    </td>
                    <td className="py-3 text-right font-mono tabular-nums">
                      {plateTotals[c].count.toLocaleString()}
                    </td>
                    <td className="py-3 text-right font-mono font-semibold tabular-nums text-[#7B252B]">
                      {plateTotals[c].revenue.toLocaleString()} ฿
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }

  // ======================== 28. RESTAURANT SETTINGS ========================
  const handleSaveRestaurant = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.updateSettings({
      restaurantName: restName,
      tagline: restTagline,
      branchName: restBranch,
      address: restAddr,
      phone: restPhone,
      taxId: restTax,
      openingHours: restHours,
      defaultLanguage: restLang,
      ppqrBaseUrl: restPpqr,
    });
    setRestMsg('บันทึกการตั้งค่าร้านอาหารเรียบร้อยแล้ว');
    await onRefresh();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="font-display text-3xl font-semibold text-[#171717]">{t.navSettings}</h1>

      <form onSubmit={handleSaveRestaurant} className="space-y-4 rounded-xl border border-[#171717]/10 bg-[#FFFFFF] p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#77716A]">ชื่อร้านอาหาร</label>
            <input
              type="text"
              required
              value={restName}
              onChange={(e) => setRestName(e.target.value)}
              className="w-full rounded-lg border border-[#171717]/15 px-3.5 py-2.5 text-sm outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#77716A]">สโลแกน (Tagline)</label>
            <input
              type="text"
              required
              value={restTagline}
              onChange={(e) => setRestTagline(e.target.value)}
              className="w-full rounded-lg border border-[#171717]/15 px-3.5 py-2.5 text-sm outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#77716A]">ชื่อสาขา</label>
            <input
              type="text"
              value={restBranch}
              onChange={(e) => setRestBranch(e.target.value)}
              className="w-full rounded-lg border border-[#171717]/15 px-3.5 py-2.5 text-sm outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#77716A]">เบอร์โทรศัพท์ร้าน</label>
            <input
              type="text"
              value={restPhone}
              onChange={(e) => setRestPhone(e.target.value)}
              className="w-full rounded-lg border border-[#171717]/15 px-3.5 py-2.5 text-sm outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-[#77716A]">ที่อยู่ร้าน (แสดงบนใบเสร็จ)</label>
          <input
            type="text"
            value={restAddr}
            onChange={(e) => setRestAddr(e.target.value)}
            className="w-full rounded-lg border border-[#171717]/15 px-3.5 py-2.5 text-sm outline-none"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#77716A]">เลขประจำตัวผู้เสียภาษี</label>
            <input
              type="text"
              value={restTax}
              onChange={(e) => setRestTax(e.target.value)}
              className="w-full rounded-lg border border-[#171717]/15 px-3.5 py-2.5 font-mono text-sm outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#77716A]">เวลาเปิดให้บริการ</label>
            <input
              type="text"
              value={restHours}
              onChange={(e) => setRestHours(e.target.value)}
              className="w-full rounded-lg border border-[#171717]/15 px-3.5 py-2.5 text-sm outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#77716A]">ภาษาเริ่มต้น</label>
            <select
              value={restLang}
              onChange={(e) => setRestLang(e.target.value as LanguageCode)}
              className="w-full rounded-lg border border-[#171717]/15 bg-white px-3.5 py-2.5 text-sm outline-none"
            >
              <option value="th">ไทย (TH)</option>
              <option value="en">English (EN)</option>
              <option value="jp">日本語 (JP)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-[#77716A]">PPQR Base URL</label>
          <input
            type="url"
            value={restPpqr}
            onChange={(e) => setRestPpqr(e.target.value)}
            className="w-full rounded-lg border border-[#171717]/15 px-3.5 py-2.5 font-mono text-sm outline-none"
          />
        </div>

        {restMsg && <p className="text-xs font-medium text-[#16A34A]">{restMsg}</p>}

        <button
          type="submit"
          className="rounded-lg bg-[#171717] px-5 py-2.5 text-sm font-medium text-[#F5F0E6] hover:bg-[#2F2B28]"
        >
          {t.save}
        </button>
      </form>
    </div>
  );
}
