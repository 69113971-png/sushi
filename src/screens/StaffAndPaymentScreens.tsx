import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  Clock,
  ExternalLink,
  Minus,
  Plus,
  QrCode,
  Receipt,
  Split,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react';
import { api } from '../api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PlateChip } from '../components/PlateChip';
import { QrCodeCanvas } from '../components/QrCodeCanvas';
import { PLATE_META, UI_TEXT } from '../i18n';
import type {
  Bill,
  BillLineItem,
  DiningTable,
  LanguageCode,
  MenuItem,
  OrderRequest,
  PaymentRecord,
  PlateColor,
  PlateCounts,
  Promotion,
  RestaurantSettings,
  ScreenId,
  SplitPayment,
  UserProfile,
} from '../types';

interface StaffAndPaymentScreensProps {
  screen:
    | 'staff_dashboard'
    | 'table_management'
    | 'plate_counter'
    | 'bill_summary'
    | 'payment_selection'
    | 'ppqr_payment'
    | 'split_bill'
    | 'payment_status';
  lang: LanguageCode;
  user: UserProfile;
  settings: RestaurantSettings;
  tables: DiningTable[];
  menu: MenuItem[];
  promotions: Promotion[];
  bills: Bill[];
  orders: OrderRequest[];
  payments: PaymentRecord[];
  splitPayments: SplitPayment[];
  customersForStaff: Array<{ id: string; name: string; email: string; phone: string; pointsBalance: number }>;
  selectedBillId: string | null;
  selectedPaymentId: string | null;
  onSelectBill: (id: string) => void;
  onSelectPayment: (id: string) => void;
  onNavigate: (screen: ScreenId) => void;
  onRefresh: () => Promise<void>;
}

const PLATE_ORDER: PlateColor[] = ['white', 'red', 'silver', 'gold', 'black'];

export function StaffAndPaymentScreens({
  screen,
  lang,
  user,
  settings,
  tables,
  menu,
  promotions,
  bills,
  orders,
  payments,
  splitPayments,
  customersForStaff,
  selectedBillId,
  selectedPaymentId,
  onSelectBill,
  onSelectPayment,
  onNavigate,
  onRefresh,
}: StaffAndPaymentScreensProps) {
  const t = UI_TEXT[lang];
  const isStaffOrAdmin = user.role === 'staff' || user.role === 'admin';

  // Table open modal state
  const [openTableTarget, setOpenTableTarget] = useState<DiningTable | null>(null);
  const [openCustomerId, setOpenCustomerId] = useState<string>('');
  const [openGuestName, setOpenGuestName] = useState<string>('');
  const [tableBusy, setTableBusy] = useState(false);

  // Plate counter local state synced with active bill
  const activeBill = useMemo(
    () =>
      bills.find((b) => b.id === selectedBillId) ||
      bills.find((b) => b.status === 'open' || b.status === 'pending_payment') ||
      null,
    [bills, selectedBillId]
  );

  const [draftCounts, setDraftCounts] = useState<PlateCounts>({
    white: 0,
    red: 0,
    silver: 0,
    gold: 0,
    black: 0,
  });
  const [draftItems, setDraftItems] = useState<BillLineItem[]>([]);
  const [plateSaving, setPlateSaving] = useState(false);
  const [plateMsg, setPlateMsg] = useState<string | null>(null);
  const [plateErr, setPlateErr] = useState<string | null>(null);

  useEffect(() => {
    if (activeBill) {
      setDraftCounts({ ...activeBill.plateCounts });
      setDraftItems([...activeBill.items]);
      setPlateMsg(null);
      setPlateErr(null);
    }
  }, [activeBill?.id, activeBill?.updatedAt]);

  // Payment confirmation dialogs
  const [confirmPayId, setConfirmPayId] = useState<string | null>(null);
  const [failPayId, setFailPayId] = useState<string | null>(null);
  const [payBusy, setPayBusy] = useState(false);
  const [payErr, setPayErr] = useState<string | null>(null);
  const [cashCreateConfirm, setCashCreateConfirm] = useState(false);

  // Split bill editor state
  const [splitMode, setSplitMode] = useState<'equal' | 'custom'>('equal');
  const [splitParticipants, setSplitParticipants] = useState<
    Array<{ participantName: string; amount: string; method: 'cash' | 'ppqr' }>
  >([
    { participantName: 'คนที่ 1', amount: '', method: 'ppqr' },
    { participantName: 'คนที่ 2', amount: '', method: 'ppqr' },
  ]);
  const [splitBusy, setSplitBusy] = useState(false);
  const [splitErr, setSplitErr] = useState<string | null>(null);
  const [activeSplitQrUrl, setActiveSplitQrUrl] = useState<{ name: string; url: string; amount: number } | null>(null);
  const [confirmSplitTarget, setConfirmSplitTarget] = useState<{ splitId: string; participantId: string; name: string; amount: number } | null>(null);

  const activePayment = useMemo(() => {
    if (selectedPaymentId) {
      const found = payments.find((p) => p.id === selectedPaymentId);
      if (found) return found;
    }
    if (activeBill) {
      const byBill = payments.find((p) => p.billId === activeBill.id);
      if (byBill) return byBill;
    }
    return payments[0] || null;
  }, [payments, selectedPaymentId, activeBill]);

  const activeSplit = useMemo(() => {
    if (!activeBill) return null;
    return splitPayments.find((s) => s.billId === activeBill.id) || null;
  }, [splitPayments, activeBill]);

  // ======================== 10. STAFF DASHBOARD ========================
  if (screen === 'staff_dashboard') {
    if (!isStaffOrAdmin) {
      return (
        <div className="rounded-xl border border-[#7B252B]/30 bg-[#FFFFFF] p-8 text-center text-sm text-[#7B252B]">
          หน้านี้จำกัดเฉพาะพนักงาน (Staff) และผู้ดูแลระบบ (Admin) เท่านั้น
        </div>
      );
    }

    const occupiedTables = tables.filter((tb) => tb.status !== 'available');
    const pendingPayments = payments.filter((p) => p.status === 'pending');
    const paidBills = bills.filter((b) => b.status === 'paid');
    const totalSales = paidBills.reduce((acc, b) => acc + b.netTotal, 0);

    return (
      <div className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs tracking-widest text-[#C6A56B] uppercase">Service Operations</p>
            <h1 className="mt-1 font-display text-3xl font-semibold text-[#171717]">
              {t.navStaffDesk}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('table_management')}
              className="rounded-lg bg-[#171717] px-4 py-2.5 text-sm font-medium text-[#F5F0E6] hover:bg-[#2F2B28]"
            >
              เปิด / จัดการโต๊ะอาหาร
            </button>
            <button
              type="button"
              onClick={() => onNavigate('plate_counter')}
              className="rounded-lg bg-[#7B252B] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#5E1B20]"
            >
              นับจานตามสี
            </button>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-[#171717]/10 bg-[#FFFFFF] p-5">
            <span className="text-xs text-[#77716A]">โต๊ะที่กำลังใช้งาน</span>
            <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-[#171717]">
              {occupiedTables.length} / {tables.length}
            </p>
          </div>
          <div className="rounded-xl border border-[#171717]/10 bg-[#FFFFFF] p-5">
            <span className="text-xs text-[#77716A]">รอตรวจสอบการชำระเงิน</span>
            <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-[#7B252B]">
              {pendingPayments.length}
            </p>
          </div>
          <div className="rounded-xl border border-[#171717]/10 bg-[#FFFFFF] p-5">
            <span className="text-xs text-[#77716A]">บิลที่ปิดแล้วทั้งหมด</span>
            <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-[#171717]">
              {paidBills.length}
            </p>
          </div>
          <div className="rounded-xl border border-[#171717]/10 bg-[#FFFFFF] p-5">
            <span className="text-xs text-[#77716A]">ยอดขายสะสม (Paid)</span>
            <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-[#16A34A]">
              {totalSales.toLocaleString()} ฿
            </p>
          </div>
        </div>

        {/* Incoming Customer Self-Orders */}
        <section className="rounded-xl border border-[#C6A56B]/50 bg-[#FFFFFF] p-6">
          <h2 className="text-base font-semibold text-[#171717]">
            ออเดอร์ที่ลูกค้ากดสั่งด้วยตนเอง (รอเสิร์ฟและลงบิล: {orders.filter((o) => o.status === 'pending').length})
          </h2>
          {orders.filter((o) => o.status === 'pending').length === 0 ? (
            <p className="mt-3 text-sm text-[#77716A]">ยังไม่มีออเดอร์จากลูกค้าที่รอเสิร์ฟในขณะนี้</p>
          ) : (
            <div className="mt-4 divide-y divide-[#171717]/10">
              {orders
                .filter((o) => o.status === 'pending')
                .map((ord) => (
                  <div key={ord.id} className="flex flex-wrap items-center justify-between gap-4 py-3.5 text-sm">
                    <div>
                      <p className="font-semibold text-[#171717]">
                        โต๊ะ {ord.tableCode} · {ord.customerName}
                      </p>
                      <p className="mt-0.5 text-xs text-[#77716A]">
                        {ord.items.map((i) => `${i.nameTh} ×${i.quantity}`).join(', ')}
                        {ord.note ? ` · หมายเหตุ: ${ord.note}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="mr-2 font-mono font-semibold text-[#7B252B]">
                        ~{ord.estimatedFoodSubtotal.toLocaleString()} {t.baht}
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await api.serveOrder(ord.id);
                          onSelectBill(res.bill.id);
                          await onRefresh();
                        }}
                        className="rounded-lg bg-[#16A34A] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#15803D]"
                      >
                        เสิร์ฟแล้ว &amp; ลงบิล
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await api.cancelOrder(ord.id);
                          await onRefresh();
                        }}
                        className="rounded-lg border border-[#7B252B]/30 px-3 py-2 text-xs font-medium text-[#7B252B] hover:bg-[#7B252B]/10"
                      >
                        ยกเลิก
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </section>

        {/* Pending Payments Queue */}
        <section className="rounded-xl border border-[#171717]/10 bg-[#FFFFFF] p-6">
          <h2 className="text-base font-semibold text-[#171717]">
            รายการรอตรวจสอบและยืนยันการชำระเงิน (เงินสด / PPQR)
          </h2>
          {pendingPayments.length === 0 ? (
            <p className="mt-4 text-sm text-[#77716A]">ไม่มีรายการชำระเงินที่รอตรวจสอบในขณะนี้</p>
          ) : (
            <div className="mt-4 divide-y divide-[#171717]/10">
              {pendingPayments.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-4 py-3.5 text-sm">
                  <div>
                    <p className="font-semibold text-[#171717]">
                      {p.receiptNumber} · <span className="font-mono">{p.referenceCode}</span>
                    </p>
                    <p className="text-xs text-[#77716A]">
                      ช่องทาง: {p.method === 'ppqr' ? 'PPQR PromptPay' : 'เงินสด (Cash)'} ·{' '}
                      {new Date(p.createdAt).toLocaleTimeString('th-TH')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-base font-semibold tabular-nums text-[#7B252B]">
                      {p.amount.toLocaleString()} {t.baht}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectBill(p.billId);
                        onSelectPayment(p.id);
                        onNavigate(p.method === 'ppqr' ? 'ppqr_payment' : 'payment_status');
                      }}
                      className="rounded-lg bg-[#171717] px-3.5 py-2 text-xs font-medium text-[#F5F0E6] hover:bg-[#2F2B28]"
                    >
                      ตรวจสอบ / ยืนยัน
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Active Tables Quick List */}
        <section className="rounded-xl border border-[#171717]/10 bg-[#FFFFFF] p-6">
          <h2 className="text-base font-semibold text-[#171717]">บิลที่กำลังเปิดให้บริการ</h2>
          {occupiedTables.length === 0 ? (
            <p className="mt-4 text-sm text-[#77716A]">ยังไม่มีโต๊ะที่เปิดให้บริการ</p>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {occupiedTables.map((tb) => {
                const b = bills.find((x) => x.id === tb.currentBillId);
                return (
                  <div key={tb.id} className="rounded-lg border border-[#171717]/15 bg-[#F5F0E6]/40 p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-lg font-semibold text-[#171717]">โต๊ะ {tb.tableCode}</span>
                      <span className="text-xs font-medium text-[#7B252B]">
                        {tb.status === 'waiting_payment' ? 'รอชำระเงิน' : 'กำลังทาน'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#77716A]">ลูกค้า: {tb.assignedCustomerName || '-'}</p>
                    <p className="mt-2 font-mono text-base font-semibold tabular-nums text-[#171717]">
                      {b ? `${b.netTotal.toLocaleString()} ${t.baht}` : '0 บาท'}
                    </p>
                    <div className="mt-3 flex gap-2">
                      {b && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              onSelectBill(b.id);
                              onNavigate('plate_counter');
                            }}
                            className="flex-1 rounded-md bg-[#171717] px-3 py-1.5 text-xs font-medium text-[#F5F0E6]"
                          >
                            นับจาน
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onSelectBill(b.id);
                              onNavigate('bill_summary');
                            }}
                            className="flex-1 rounded-md border border-[#171717]/20 bg-white px-3 py-1.5 text-xs font-medium text-[#171717]"
                          >
                            สรุปบิล
                          </button>
                        </>
                      )}
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

  // ======================== 11. TABLE MANAGEMENT ========================
  if (screen === 'table_management') {
    if (!isStaffOrAdmin) {
      return (
        <div className="rounded-xl border border-[#7B252B]/30 bg-[#FFFFFF] p-8 text-center text-sm text-[#7B252B]">
          หน้านี้จำกัดเฉพาะพนักงานและผู้ดูแลระบบเท่านั้น
        </div>
      );
    }

    const handleConfirmOpenTable = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!openTableTarget) return;
      setTableBusy(true);
      try {
        const res = await api.openTable(openTableTarget.id, {
          customerId: openCustomerId || null,
          guestName: openGuestName || undefined,
        });
        await onRefresh();
        onSelectBill(res.bill.id);
        setOpenTableTarget(null);
        setOpenCustomerId('');
        setOpenGuestName('');
        onNavigate('plate_counter');
      } finally {
        setTableBusy(false);
      }
    };

    const zones: Array<{ key: DiningTable['zone']; label: string }> = [
      { key: 'counter', label: 'โซนเคาน์เตอร์เชฟ (Omakase Counter)' },
      { key: 'main', label: 'โซนห้องอาหารหลัก (Main Dining)' },
      { key: 'tatami', label: 'โซนห้องส่วนตัว (Tatami Room)' },
    ];

    return (
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-3xl font-semibold text-[#171717]">{t.navTables}</h1>
          <p className="mt-1 text-sm text-[#77716A]">
            เลือกโต๊ะเพื่อเริ่มเปิดบิล ผูกสมาชิกสำหรับสะสมคะแนน หรือจัดการรายการจาน
          </p>
        </div>

        {zones.map((z) => {
          const zTables = tables.filter((tb) => tb.zone === z.key);
          return (
            <section key={z.key} className="space-y-3">
              <h2 className="text-sm font-semibold text-[#171717]">{z.label}</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {zTables.map((tb) => {
                  const bill = bills.find((b) => b.id === tb.currentBillId);
                  return (
                    <div
                      key={tb.id}
                      className={`rounded-xl border p-5 transition-colors ${
                        tb.status === 'available'
                          ? 'border-[#171717]/10 bg-[#FFFFFF]'
                          : tb.status === 'waiting_payment'
                            ? 'border-[#C6A56B] bg-[#F5F0E6]'
                            : 'border-[#7B252B]/40 bg-[#FFFFFF]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-2xl font-semibold text-[#171717]">{tb.tableCode}</span>
                        <span
                          className={`text-xs font-medium ${
                            tb.status === 'available'
                              ? 'text-[#16A34A]'
                              : tb.status === 'waiting_payment'
                                ? 'text-[#C6A56B]'
                                : 'text-[#7B252B]'
                          }`}
                        >
                          {tb.status === 'available'
                            ? 'ว่าง'
                            : tb.status === 'waiting_payment'
                              ? 'รอชำระเงิน'
                              : 'มีลูกค้า'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#77716A]">รองรับ {tb.capacity} ที่นั่ง</p>
                      {tb.assignedCustomerName && (
                        <p className="mt-2 truncate text-xs font-medium text-[#171717]">
                          ลูกค้า: {tb.assignedCustomerName}
                        </p>
                      )}
                      {bill && (
                        <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-[#7B252B]">
                          {bill.netTotal.toLocaleString()} {t.baht}
                        </p>
                      )}

                      <div className="mt-4">
                        {tb.status === 'available' ? (
                          <button
                            type="button"
                            onClick={() => {
                              setOpenTableTarget(tb);
                              setOpenCustomerId('');
                              setOpenGuestName('');
                            }}
                            className="w-full rounded-lg bg-[#171717] px-3 py-2 text-xs font-medium text-[#F5F0E6] hover:bg-[#2F2B28]"
                          >
                            เปิดโต๊ะ / เริ่มบิลใหม่
                          </button>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (bill) onSelectBill(bill.id);
                                onNavigate('plate_counter');
                              }}
                              className="flex-1 rounded-lg bg-[#7B252B] px-3 py-2 text-xs font-medium text-white hover:bg-[#5E1B20]"
                            >
                              นับจาน
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (bill) onSelectBill(bill.id);
                                onNavigate('bill_summary');
                              }}
                              className="flex-1 rounded-lg border border-[#171717]/20 px-3 py-2 text-xs font-medium text-[#171717] hover:bg-[#F5F0E6]"
                            >
                              สรุปบิล
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        {/* Open Table Modal */}
        {openTableTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#171717]/70 p-4 backdrop-blur-xs">
            <form
              onSubmit={handleConfirmOpenTable}
              className="w-full max-w-md space-y-4 rounded-xl border border-[#C6A56B]/40 bg-[#FFFFFF] p-6"
            >
              <h3 className="font-display text-2xl font-semibold text-[#171717]">
                เปิดบิลโต๊ะ {openTableTarget.tableCode}
              </h3>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#77716A]">
                  ผูกบัญชีลูกค้าสมาชิก (เพื่อสะสมคะแนนและดูบิลบนมือถือ)
                </label>
                <select
                  value={openCustomerId}
                  onChange={(e) => setOpenCustomerId(e.target.value)}
                  className="w-full rounded-lg border border-[#171717]/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#C6A56B]"
                >
                  <option value="">-- ลูกค้าทั่วไป (Walk-in ไม่สะสมคะแนน) --</option>
                  {customersForStaff.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.email})
                    </option>
                  ))}
                </select>
              </div>
              {!openCustomerId && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#77716A]">ชื่อเรียกลูกค้า (ถ้ามี)</label>
                  <input
                    type="text"
                    value={openGuestName}
                    onChange={(e) => setOpenGuestName(e.target.value)}
                    placeholder={`แขกโต๊ะ ${openTableTarget.tableCode}`}
                    className="w-full rounded-lg border border-[#171717]/15 px-3 py-2.5 text-sm outline-none focus:border-[#C6A56B]"
                  />
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOpenTableTarget(null)}
                  className="rounded-lg border border-[#171717]/15 px-4 py-2 text-sm text-[#171717]"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={tableBusy}
                  className="rounded-lg bg-[#7B252B] px-5 py-2 text-sm font-medium text-white hover:bg-[#5E1B20]"
                >
                  {tableBusy ? t.loading : 'ยืนยันเปิดโต๊ะ'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  // ======================== 12. PLATE COUNTER ========================
  if (screen === 'plate_counter') {
    if (!isStaffOrAdmin) {
      return (
        <div className="rounded-xl border border-[#7B252B]/30 bg-[#FFFFFF] p-8 text-center text-sm text-[#7B252B]">
          เฉพาะพนักงานและผู้ดูแลระบบเท่านั้นที่สามารถบันทึกหรือแก้ไขจำนวนจานได้
        </div>
      );
    }

    if (!activeBill) {
      return (
        <div className="rounded-xl border border-[#171717]/10 bg-[#FFFFFF] p-10 text-center">
          <p className="text-sm text-[#77716A]">ยังไม่มีบิลที่เปิดอยู่ กรุณาเลือกเปิดโต๊ะก่อนนับจาน</p>
          <button
            type="button"
            onClick={() => onNavigate('table_management')}
            className="mt-4 rounded-lg bg-[#171717] px-5 py-2.5 text-sm text-[#F5F0E6]"
          >
            ไปหน้าจัดการโต๊ะ
          </button>
        </div>
      );
    }

    const previewFood = PLATE_ORDER.reduce(
      (sum, c) => sum + (draftCounts[c] || 0) * settings.platePrices[c],
      0
    );
    const previewService = Math.round(previewFood * settings.serviceChargeRate * 100) / 100;
    const previewNet = Math.max(0, previewFood + previewService - activeBill.promotionDiscount);

    const adjustPlate = (color: PlateColor, delta: number) => {
      setDraftCounts((prev) => ({
        ...prev,
        [color]: Math.max(0, (prev[color] || 0) + delta),
      }));
      setPlateMsg(null);
    };

    const addMenuDish = (m: MenuItem) => {
      setDraftCounts((prev) => ({
        ...prev,
        [m.plateColor]: (prev[m.plateColor] || 0) + 1,
      }));
      setDraftItems((prev) => {
        const idx = prev.findIndex((i) => i.menuId === m.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + 1 };
          return copy;
        }
        return [
          ...prev,
          {
            menuId: m.id,
            nameTh: m.nameTh,
            nameEn: m.nameEn,
            plateColor: m.plateColor,
            platePrice: settings.platePrices[m.plateColor],
            quantity: 1,
          },
        ];
      });
      setPlateMsg(null);
    };

    const handleSavePlates = async () => {
      setPlateSaving(true);
      setPlateMsg(null);
      setPlateErr(null);
      try {
        await api.updateBillPlates(activeBill.id, {
          plateCounts: draftCounts,
          items: draftItems.map((i) => ({ menuId: i.menuId, quantity: i.quantity })),
        });
        await onRefresh();
        setPlateMsg('บันทึกจำนวนจานและคำนวณยอดสุทธิเรียบร้อยแล้ว');
      } catch (err) {
        setPlateErr(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
      } finally {
        setPlateSaving(false);
      }
    };

    const openBills = bills.filter((b) => b.status === 'open' || b.status === 'pending_payment');

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-[#7B252B]">
              โต๊ะ {activeBill.tableCode} · {activeBill.receiptNumber} · ลูกค้า: {activeBill.customerName}
            </p>
            <h1 className="mt-1 font-display text-3xl font-semibold text-[#171717]">{t.navPlateCounter}</h1>
          </div>

          {openBills.length > 1 && (
            <select
              value={activeBill.id}
              onChange={(e) => onSelectBill(e.target.value)}
              className="rounded-lg border border-[#171717]/15 bg-[#FFFFFF] px-3 py-2 text-sm outline-none"
            >
              {openBills.map((b) => (
                <option key={b.id} value={b.id}>
                  โต๊ะ {b.tableCode} ({b.customerName})
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Plate Stack Controls */}
          <div className="space-y-3 lg:col-span-7">
            {PLATE_ORDER.map((color) => {
              const meta = PLATE_META[color];
              const price = settings.platePrices[color];
              const qty = draftCounts[color] || 0;
              return (
                <div
                  key={color}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#171717]/10 bg-[#FFFFFF] px-5 py-4"
                >
                  <div className="flex items-center gap-4">
                    <span
                      className="flex h-11 w-11 items-center justify-center rounded-full border-2 font-mono text-xs font-bold"
                      style={{ backgroundColor: meta.bgHex, borderColor: meta.ringHex, color: meta.textHex }}
                    >
                      {price}฿
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-[#171717]">{meta.labelTh}</p>
                      <p className="text-xs text-[#77716A]">
                        {meta.labelEn} · {price} บาท / จาน
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => adjustPlate(color, -1)}
                        disabled={qty <= 0}
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#171717]/15 bg-[#F5F0E6]/60 text-[#171717] hover:bg-[#F5F0E6] disabled:opacity-40"
                        aria-label={`ลด ${meta.labelTh}`}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-10 text-center font-mono text-xl font-semibold tabular-nums text-[#171717]">
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => adjustPlate(color, 1)}
                        className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#171717] text-[#F5F0E6] hover:bg-[#2F2B28]"
                        aria-label={`เพิ่ม ${meta.labelTh}`}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <span className="w-24 text-right font-mono text-sm font-semibold tabular-nums text-[#7B252B]">
                      {(qty * price).toLocaleString()} ฿
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Optional quick dish recording */}
            <div className="rounded-xl border border-[#171717]/10 bg-[#FFFFFF] p-5">
              <h2 className="text-sm font-semibold text-[#171717]">
                เพิ่มตามรายการเมนูอาหาร (จะนับสีจานให้อัตโนมัติ)
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {menu
                  .filter((m) => m.available)
                  .map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => addMenuDish(m)}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#171717]/15 bg-[#F5F0E6]/40 px-3 py-1.5 text-xs font-medium text-[#171717] hover:bg-[#F5F0E6]"
                    >
                      <Plus className="h-3 w-3 text-[#7B252B]" />
                      <span>{m.nameTh}</span>
                      <span className="font-mono text-[#77716A]">({settings.platePrices[m.plateColor]}฿)</span>
                    </button>
                  ))}
              </div>
            </div>
          </div>

          {/* Live Calculation Summary */}
          <div className="lg:col-span-5">
            <div className="sticky top-6 space-y-5 rounded-xl border border-[#C6A56B]/50 bg-[#FFFFFF] p-6">
              <h2 className="font-display text-2xl font-semibold text-[#171717]">
                คำนวณยอดบิลอัตโนมัติ
              </h2>

              <div className="space-y-2.5 border-t border-[#171717]/10 pt-4 text-sm">
                <div className="flex justify-between text-[#77716A]">
                  <span>{t.foodSubtotal}</span>
                  <span className="font-mono tabular-nums">{previewFood.toLocaleString()} {t.baht}</span>
                </div>
                <div className="flex justify-between text-[#77716A]">
                  <span>{t.serviceCharge}</span>
                  <span className="font-mono tabular-nums">{previewService.toLocaleString()} {t.baht}</span>
                </div>
                {activeBill.promotionDiscount > 0 && (
                  <div className="flex justify-between text-[#16A34A]">
                    <span>{t.discount}</span>
                    <span className="font-mono tabular-nums">-{activeBill.promotionDiscount.toLocaleString()} {t.baht}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-[#171717]/15 pt-3 text-xl font-semibold text-[#171717]">
                  <span>{t.netTotal}</span>
                  <span className="font-mono tabular-nums text-[#7B252B]">
                    {previewNet.toLocaleString()} {t.baht}
                  </span>
                </div>
              </div>

              {plateMsg && <p className="text-xs font-medium text-[#16A34A]">{plateMsg}</p>}
              {plateErr && <p className="text-xs font-medium text-[#7B252B]">{plateErr}</p>}

              <div className="space-y-2.5">
                <button
                  type="button"
                  disabled={plateSaving}
                  onClick={handleSavePlates}
                  className="w-full rounded-lg bg-[#171717] px-5 py-3 text-sm font-medium text-[#F5F0E6] hover:bg-[#2F2B28] disabled:opacity-60"
                >
                  {plateSaving ? t.loading : 'บันทึกจำนวนจานลงบิล'}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await handleSavePlates();
                    onNavigate('bill_summary');
                  }}
                  className="w-full rounded-lg bg-[#7B252B] px-5 py-3 text-sm font-medium text-white hover:bg-[#5E1B20]"
                >
                  บันทึกและไปหน้าสรุปยอดบิล →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ======================== 13. BILL SUMMARY ========================
  if (screen === 'bill_summary') {
    if (!activeBill) {
      return (
        <div className="rounded-xl border border-[#171717]/10 bg-[#FFFFFF] p-10 text-center text-sm text-[#77716A]">
          ไม่พบบิลที่เลือก กรุณากลับไปเลือกโต๊ะ
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-[#77716A]">
              โต๊ะ {activeBill.tableCode} · {activeBill.receiptNumber}
            </p>
            <h1 className="font-display text-3xl font-semibold text-[#171717]">สรุปรายการและยอดบิล</h1>
          </div>
          {isStaffOrAdmin && activeBill.status !== 'paid' && (
            <button
              type="button"
              onClick={() => onNavigate('plate_counter')}
              className="rounded-lg border border-[#171717]/20 px-4 py-2 text-xs font-medium text-[#171717] hover:bg-[#FFFFFF]"
            >
              แก้ไขจำนวนจาน
            </button>
          )}
        </div>

        {/* Assign Customer if Staff */}
        {isStaffOrAdmin && activeBill.status !== 'paid' && (
          <div className="rounded-xl border border-[#171717]/10 bg-[#FFFFFF] p-5">
            <label className="block text-xs font-semibold text-[#77716A]">
              ผูกบิลเข้ากับบัญชีลูกค้าสมาชิก (เพื่อให้ลูกค้าเห็นบิลและรับคะแนน)
            </label>
            <select
              value={activeBill.customerId || ''}
              onChange={async (e) => {
                await api.assignBillCustomer(activeBill.id, {
                  customerId: e.target.value || null,
                });
                await onRefresh();
              }}
              className="mt-2 w-full rounded-lg border border-[#171717]/15 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#C6A56B]"
            >
              <option value="">-- ไม่ผูกสมาชิก ({activeBill.customerName}) --</option>
              {customersForStaff.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.email})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="rounded-xl border border-[#171717]/10 bg-[#FFFFFF] p-6">
          <div className="divide-y divide-[#171717]/10">
            {PLATE_ORDER.map((color) => {
              const qty = activeBill.plateCounts[color] || 0;
              if (!qty) return null;
              const unit = settings.platePrices[color];
              return (
                <div key={color} className="flex items-center justify-between py-3 text-sm">
                  <PlateChip color={color} price={unit} lang={lang} />
                  <span className="font-mono tabular-nums">
                    {qty} × {unit} = <strong>{(qty * unit).toLocaleString()} {t.baht}</strong>
                  </span>
                </div>
              );
            })}
          </div>

          {/* Promotions quick select */}
          {activeBill.status !== 'paid' && promotions.some((p) => p.active) && (
            <div className="mt-4 border-t border-[#171717]/10 pt-4">
              <p className="text-xs font-medium text-[#77716A]">โปรโมชั่นที่ใช้ได้</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {promotions
                  .filter((p) => p.active)
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      disabled={activeBill.foodSubtotal < p.minSpend}
                      onClick={async () => {
                        await api.applyPromotion(activeBill.id, { promotionId: p.id });
                        await onRefresh();
                      }}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                        activeBill.promotionId === p.id
                          ? 'border-[#16A34A] bg-[#16A34A]/10 text-[#16A34A]'
                          : 'border-[#171717]/15 text-[#171717] hover:bg-[#F5F0E6]'
                      } disabled:opacity-40`}
                    >
                      {p.code} (-{p.discountPercent}% ขั้นต่ำ {p.minSpend}฿)
                    </button>
                  ))}
              </div>
            </div>
          )}

          <div className="mt-6 space-y-2 border-t border-[#171717]/15 pt-4 text-sm">
            <div className="flex justify-between text-[#77716A]">
              <span>{t.foodSubtotal}</span>
              <span className="font-mono tabular-nums">{activeBill.foodSubtotal.toLocaleString()} {t.baht}</span>
            </div>
            <div className="flex justify-between text-[#77716A]">
              <span>{t.serviceCharge}</span>
              <span className="font-mono tabular-nums">{activeBill.serviceCharge.toLocaleString()} {t.baht}</span>
            </div>
            {activeBill.promotionDiscount > 0 && (
              <div className="flex justify-between text-[#16A34A]">
                <span>{t.discount} ({activeBill.promotionCode})</span>
                <span className="font-mono tabular-nums">-{activeBill.promotionDiscount.toLocaleString()} {t.baht}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-[#171717]/10 pt-3 text-xl font-semibold text-[#171717]">
              <span>{t.netTotal}</span>
              <span className="font-mono tabular-nums text-[#7B252B]">
                {activeBill.netTotal.toLocaleString()} {t.baht}
              </span>
            </div>
          </div>
        </div>

        {activeBill.status !== 'paid' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={activeBill.netTotal <= 0}
              onClick={() => onNavigate('payment_selection')}
              className="rounded-lg bg-[#7B252B] px-5 py-3 text-sm font-medium text-white hover:bg-[#5E1B20] disabled:opacity-50"
            >
              ดำเนินการชำระเงิน
            </button>
            <button
              type="button"
              disabled={activeBill.netTotal <= 0}
              onClick={() => onNavigate('split_bill')}
              className="rounded-lg border border-[#171717] bg-[#FFFFFF] px-5 py-3 text-sm font-medium text-[#171717] hover:bg-[#F5F0E6] disabled:opacity-50"
            >
              แบ่งบิลกับเพื่อน (Split Bill)
            </button>
          </div>
        )}
      </div>
    );
  }

  // ======================== 14. PAYMENT SELECTION ========================
  if (screen === 'payment_selection') {
    if (!activeBill) {
      return <div className="p-8 text-center text-sm text-[#77716A]">ไม่พบบิลที่ต้องการชำระ</div>;
    }

    const handleInitiatePayment = async (method: 'cash' | 'ppqr') => {
      setPayBusy(true);
      setPayErr(null);
      try {
        const res = await api.createPayment({ billId: activeBill.id, method });
        await onRefresh();
        onSelectPayment(res.payment.id);
        setCashCreateConfirm(false);
        onNavigate(method === 'ppqr' ? 'ppqr_payment' : 'payment_status');
      } catch (err) {
        setPayErr(err instanceof Error ? err.message : 'ไม่สามารถสร้างรายการชำระเงินได้');
        setCashCreateConfirm(false);
      } finally {
        setPayBusy(false);
      }
    };

    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <button
          type="button"
          onClick={() => onNavigate(user.role === 'user' ? 'customer_current_bill' : 'bill_summary')}
          className="inline-flex items-center gap-2 text-sm text-[#77716A] hover:text-[#171717]"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{t.back}</span>
        </button>

        <div className="rounded-xl border border-[#171717]/10 bg-[#FFFFFF] p-6 text-center">
          <p className="text-xs text-[#77716A]">
            {activeBill.receiptNumber} · โต๊ะ {activeBill.tableCode}
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold text-[#171717]">เลือกช่องทางการชำระเงิน</h1>
          <p className="mt-4 font-mono text-4xl font-semibold tabular-nums text-[#7B252B]">
            {activeBill.netTotal.toLocaleString()} {t.baht}
          </p>
          <p className="mt-1 text-xs text-[#77716A]">
            รวมค่าบริการ 10% เรียบร้อยแล้ว · รับ {Math.floor(activeBill.netTotal / settings.pointsBahtRate)} คะแนนเมื่อชำระสำเร็จ
          </p>
        </div>

        {payErr && (
          <div className="rounded-lg border border-[#7B252B]/30 bg-[#7B252B]/5 px-4 py-3 text-xs font-medium text-[#7B252B]">
            {payErr}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button
            type="button"
            disabled={payBusy}
            onClick={() => handleInitiatePayment('ppqr')}
            className="flex flex-col items-start justify-between rounded-xl border border-[#C6A56B] bg-[#FFFFFF] p-6 text-left transition-colors hover:bg-[#F5F0E6]/50"
          >
            <QrCode className="h-8 w-8 text-[#7B252B]" />
            <div className="mt-4">
              <h2 className="text-base font-semibold text-[#171717]">PPQR PromptPay</h2>
              <p className="mt-1 text-xs text-[#77716A]">
                สร้าง QR Code ยอดชำระจริงผ่าน ppqr.app พร้อมรอพนักงานตรวจสอบยอดเงินเข้า
              </p>
            </div>
          </button>

          <button
            type="button"
            disabled={payBusy}
            onClick={() => setCashCreateConfirm(true)}
            className="flex flex-col items-start justify-between rounded-xl border border-[#171717]/15 bg-[#FFFFFF] p-6 text-left transition-colors hover:bg-[#F5F0E6]/50"
          >
            <Banknote className="h-8 w-8 text-[#171717]" />
            <div className="mt-4">
              <h2 className="text-base font-semibold text-[#171717]">ชำระด้วยเงินสด (Cash)</h2>
              <p className="mt-1 text-xs text-[#77716A]">
                แจ้งพนักงานเพื่อชำระเงินสดที่โต๊ะหรือเคาน์เตอร์ (ยืนยันโดยพนักงานเท่านั้น)
              </p>
            </div>
          </button>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('split_bill')}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#171717]/15 bg-[#FFFFFF] py-3.5 text-sm font-medium text-[#171717] hover:bg-[#F5F0E6]"
        >
          <Split className="h-4 w-4" />
          <span>หรือแบ่งจ่ายกับเพื่อน (Split Bill)</span>
        </button>

        <ConfirmDialog
          open={cashCreateConfirm}
          title="แจ้งชำระด้วยเงินสด"
          description={`ยืนยันส่งคำขอชำระเงินสดยอด ${activeBill.netTotal.toLocaleString()} บาท ให้พนักงานตรวจสอบและรับเงิน?`}
          confirmLabel="ส่งคำขอชำระเงินสด"
          cancelLabel={t.cancel}
          busy={payBusy}
          onConfirm={() => handleInitiatePayment('cash')}
          onCancel={() => setCashCreateConfirm(false)}
        />
      </div>
    );
  }

  // ======================== 15. PPQR PAYMENT ========================
  if (screen === 'ppqr_payment') {
    if (!activePayment) {
      return (
        <div className="rounded-xl border border-[#171717]/10 bg-[#FFFFFF] p-10 text-center">
          <p className="text-sm text-[#77716A]">ไม่พบรายการชำระ PPQR</p>
          <button
            type="button"
            onClick={() => onNavigate('payment_selection')}
            className="mt-4 rounded-lg bg-[#171717] px-4 py-2 text-xs text-white"
          >
            กลับไปเลือกวิธีชำระเงิน
          </button>
        </div>
      );
    }

    const handleConfirmPay = async () => {
      if (!confirmPayId) return;
      setPayBusy(true);
      setPayErr(null);
      try {
        await api.confirmPayment(confirmPayId);
        await onRefresh();
        setConfirmPayId(null);
        onNavigate('payment_status');
      } catch (err) {
        setPayErr(err instanceof Error ? err.message : 'ยืนยันไม่สำเร็จ');
        setConfirmPayId(null);
      } finally {
        setPayBusy(false);
      }
    };

    const handleFailPay = async () => {
      if (!failPayId) return;
      setPayBusy(true);
      try {
        await api.failPayment(failPayId, 'ไม่พบรายการโอนเงินเข้าบัญชีร้าน');
        await onRefresh();
        setFailPayId(null);
        onNavigate('payment_status');
      } finally {
        setPayBusy(false);
      }
    };

    return (
      <div className="mx-auto max-w-xl space-y-6">
        <div className="rounded-xl border border-[#C6A56B]/60 bg-[#FFFFFF] p-7 text-center">
          <p className="text-xs font-mono text-[#77716A]">
            {activePayment.receiptNumber} · Ref: {activePayment.referenceCode}
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-[#171717]">
            PPQR PromptPay Payment
          </h1>
          <p className="mt-3 font-mono text-4xl font-semibold tabular-nums text-[#7B252B]">
            {activePayment.amount.toLocaleString()} {t.baht}
          </p>

          <div className="mt-6 flex justify-center">
            <QrCodeCanvas value={activePayment.ppqrUrl} size={220} />
          </div>

          <p className="mt-4 break-all font-mono text-xs text-[#77716A]">{activePayment.ppqrUrl}</p>

          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <a
              href={activePayment.ppqrUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-[#171717] bg-[#F5F0E6] px-4 py-2.5 text-xs font-semibold text-[#171717] hover:bg-[#EAE2D3]"
            >
              <ExternalLink className="h-4 w-4" />
              <span>เปิดลิงก์ PPQR เพื่อชำระเงิน</span>
            </a>
            <button
              type="button"
              onClick={async () => {
                await onRefresh();
                onNavigate('payment_status');
              }}
              className="rounded-lg border border-[#171717]/20 px-4 py-2.5 text-xs font-medium text-[#171717] hover:bg-[#F5F0E6]"
            >
              ดูสถานะการชำระเงิน
            </button>
          </div>

          {/* Explicit Status */}
          <div className="mt-6 rounded-lg border border-[#D97706]/30 bg-[#D97706]/5 px-4 py-3 text-xs text-[#171717]">
            <p className="font-semibold text-[#D97706]">
              สถานะปัจจุบัน:{' '}
              {activePayment.status === 'paid'
                ? 'ชำระเงินสำเร็จ (Verified)'
                : activePayment.status === 'failed'
                  ? 'ชำระเงินไม่สำเร็จ'
                  : 'รอชำระเงิน / รอพนักงานตรวจสอบยอดเข้า'}
            </p>
            <p className="mt-1 text-[#77716A]">
              หมายเหตุความปลอดภัย: การเปิดลิงก์หรือสร้าง QR จะยังไม่ถือว่าชำระสำเร็จจนกว่าพนักงานจะตรวจสอบสลิปหรือยอดเงินเข้าเรียบร้อย
            </p>
          </div>

          {payErr && <p className="mt-3 text-xs font-medium text-[#7B252B]">{payErr}</p>}

          {isStaffOrAdmin && activePayment.status === 'pending' && (
            <div className="mt-6 grid grid-cols-1 gap-3 border-t border-[#171717]/10 pt-5 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setConfirmPayId(activePayment.id)}
                className="rounded-lg bg-[#16A34A] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#15803D]"
              >
                พนักงานยืนยัน: ได้รับเงินแล้ว
              </button>
              <button
                type="button"
                onClick={() => setFailPayId(activePayment.id)}
                className="rounded-lg bg-[#7B252B] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#5E1B20]"
              >
                แจ้งชำระเงินไม่สำเร็จ
              </button>
            </div>
          )}
        </div>

        <ConfirmDialog
          open={Boolean(confirmPayId)}
          title="ยืนยันการรับชำระเงิน PPQR"
          description={`ยืนยันว่าตรวจสอบยอดเงินเข้าจำนวน ${activePayment.amount.toLocaleString()} บาทเรียบร้อยแล้ว ระบบจะปิดบิลและคำนวณคะแนนให้ลูกค้าทันที`}
          confirmLabel="ยืนยันรับเงินสำเร็จ"
          cancelLabel={t.cancel}
          busy={payBusy}
          onConfirm={handleConfirmPay}
          onCancel={() => setConfirmPayId(null)}
        />
        <ConfirmDialog
          open={Boolean(failPayId)}
          title="บันทึกชำระเงินไม่สำเร็จ"
          description="ต้องการเปลี่ยนสถานะรายการชำระนี้เป็น ชำระเงินไม่สำเร็จ ใช่หรือไม่?"
          confirmLabel="ยืนยันไม่สำเร็จ"
          cancelLabel={t.cancel}
          destructive
          busy={payBusy}
          onConfirm={handleFailPay}
          onCancel={() => setFailPayId(null)}
        />
      </div>
    );
  }

  // ======================== 16. SPLIT BILL ========================
  if (screen === 'split_bill') {
    if (!activeBill) {
      return <div className="p-8 text-center text-sm text-[#77716A]">ไม่พบบิลที่ต้องการแบ่งจ่าย</div>;
    }

    const totalCustom = splitParticipants.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const remaining = Math.round((activeBill.netTotal - totalCustom) * 100) / 100;

    const handleSaveSplit = async (e: React.FormEvent) => {
      e.preventDefault();
      setSplitErr(null);
      if (splitMode === 'custom' && Math.abs(remaining) > 0.01) {
        setSplitErr(`ผลรวมยอดแบ่งต้องเท่ากับ ${activeBill.netTotal.toLocaleString()} บาท (คงเหลือ ${remaining.toLocaleString()} บาท)`);
        return;
      }
      setSplitBusy(true);
      try {
        await api.createSplitPayment({
          billId: activeBill.id,
          mode: splitMode,
          participants: splitParticipants.map((p) => ({
            participantName: p.participantName,
            amount: splitMode === 'custom' ? Number(p.amount) : undefined,
            method: p.method,
          })),
        });
        await onRefresh();
      } catch (err) {
        setSplitErr(err instanceof Error ? err.message : 'บันทึกการแบ่งบิลไม่สำเร็จ');
      } finally {
        setSplitBusy(false);
      }
    };

    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs text-[#77716A]">
              {activeBill.receiptNumber} · โต๊ะ {activeBill.tableCode}
            </p>
            <h1 className="font-display text-3xl font-semibold text-[#171717]">แบ่งบิลกับเพื่อน (Split Bill)</h1>
          </div>
          <div className="text-right">
            <span className="block text-xs text-[#77716A]">ยอดบิลสุทธิทั้งหมด</span>
            <span className="font-mono text-2xl font-semibold tabular-nums text-[#7B252B]">
              {activeBill.netTotal.toLocaleString()} {t.baht}
            </span>
          </div>
        </div>

        {/* Create/Update Split Configuration */}
        {activeBill.status !== 'paid' && (
          <form onSubmit={handleSaveSplit} className="space-y-5 rounded-xl border border-[#171717]/10 bg-[#FFFFFF] p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex rounded-lg border border-[#171717]/15 bg-[#F5F0E6]/50 p-1">
                <button
                  type="button"
                  onClick={() => setSplitMode('equal')}
                  className={`rounded-md px-4 py-1.5 text-xs font-medium ${
                    splitMode === 'equal' ? 'bg-[#171717] text-[#F5F0E6]' : 'text-[#77716A]'
                  }`}
                >
                  แบ่งเท่ากันทุกคน (Equal)
                </button>
                <button
                  type="button"
                  onClick={() => setSplitMode('custom')}
                  className={`rounded-md px-4 py-1.5 text-xs font-medium ${
                    splitMode === 'custom' ? 'bg-[#171717] text-[#F5F0E6]' : 'text-[#77716A]'
                  }`}
                >
                  กำหนดยอดเงินเอง (Custom)
                </button>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSplitParticipants((prev) => [
                    ...prev,
                    { participantName: `เพื่อนคนที่ ${prev.length + 1}`, amount: '', method: 'ppqr' },
                  ])
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#171717]/20 px-3 py-1.5 text-xs font-medium text-[#171717] hover:bg-[#F5F0E6]"
              >
                <Users className="h-3.5 w-3.5" />
                <span>เพิ่มชื่อเพื่อน</span>
              </button>
            </div>

            <div className="space-y-3">
              {splitParticipants.map((p, idx) => {
                const equalPreview =
                  Math.round((activeBill.netTotal / splitParticipants.length) * 100) / 100;
                return (
                  <div key={idx} className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-center">
                    <input
                      type="text"
                      required
                      value={p.participantName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSplitParticipants((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, participantName: val } : item))
                        );
                      }}
                      placeholder="ชื่อเพื่อน"
                      className="sm:col-span-5 rounded-lg border border-[#171717]/15 px-3 py-2 text-sm outline-none focus:border-[#C6A56B]"
                    />
                    {splitMode === 'custom' ? (
                      <input
                        type="number"
                        step="0.01"
                        min="1"
                        required
                        value={p.amount}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSplitParticipants((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, amount: val } : item))
                          );
                        }}
                        placeholder="จำนวนเงิน (บาท)"
                        className="sm:col-span-3 rounded-lg border border-[#171717]/15 px-3 py-2 font-mono text-sm outline-none focus:border-[#C6A56B]"
                      />
                    ) : (
                      <div className="sm:col-span-3 rounded-lg bg-[#F5F0E6]/60 px-3 py-2 font-mono text-sm tabular-nums text-[#171717]">
                        ≈ {equalPreview.toLocaleString()} ฿
                      </div>
                    )}
                    <select
                      value={p.method}
                      onChange={(e) => {
                        const m = e.target.value as 'cash' | 'ppqr';
                        setSplitParticipants((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, method: m } : item))
                        );
                      }}
                      className="sm:col-span-3 rounded-lg border border-[#171717]/15 bg-white px-3 py-2 text-sm outline-none"
                    >
                      <option value="ppqr">PPQR</option>
                      <option value="cash">เงินสด</option>
                    </select>
                    <div className="sm:col-span-1 flex justify-end">
                      {splitParticipants.length > 2 && (
                        <button
                          type="button"
                          onClick={() =>
                            setSplitParticipants((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="rounded-lg p-2 text-[#77716A] hover:bg-[#7B252B]/10 hover:text-[#7B252B]"
                          aria-label="ลบเพื่อน"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {splitMode === 'custom' && (
              <div className="flex items-center justify-between rounded-lg bg-[#F5F0E6] px-4 py-2.5 text-sm">
                <span>ยอดคงเหลือที่ต้องแบ่งเพิ่มให้ครบยอดบิล</span>
                <span
                  className={`font-mono font-semibold tabular-nums ${
                    Math.abs(remaining) < 0.01 ? 'text-[#16A34A]' : 'text-[#7B252B]'
                  }`}
                >
                  {remaining.toLocaleString()} {t.baht}
                </span>
              </div>
            )}

            {splitErr && <p className="text-xs font-medium text-[#7B252B]">{splitErr}</p>}

            <button
              type="submit"
              disabled={splitBusy}
              className="rounded-lg bg-[#171717] px-5 py-2.5 text-sm font-medium text-[#F5F0E6] hover:bg-[#2F2B28]"
            >
              {splitBusy ? t.loading : 'สร้างรายการแบ่งบิลและ QR รายบุคคล'}
            </button>
          </form>
        )}

        {/* Active Split Payment Status List */}
        {activeSplit && (
          <div className="rounded-xl border border-[#C6A56B]/50 bg-[#FFFFFF] p-6">
            <h2 className="text-base font-semibold text-[#171717]">สถานะการชำระเงินรายบุคคล</h2>
            <div className="mt-4 divide-y divide-[#171717]/10">
              {activeSplit.splits.map((sp) => (
                <div key={sp.id} className="flex flex-wrap items-center justify-between gap-4 py-3.5 text-sm">
                  <div>
                    <p className="font-semibold text-[#171717]">{sp.participantName}</p>
                    <p className="text-xs text-[#77716A]">
                      ช่องทาง: {sp.method === 'ppqr' ? 'PPQR' : 'เงินสด'} · สถานะ:{' '}
                      <strong className={sp.status === 'paid' ? 'text-[#16A34A]' : 'text-[#D97706]'}>
                        {sp.status === 'paid' ? 'ชำระแล้ว' : 'รอชำระเงิน'}
                      </strong>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="mr-2 font-mono text-base font-semibold tabular-nums text-[#7B252B]">
                      {sp.amount.toLocaleString()} {t.baht}
                    </span>
                    {sp.method === 'ppqr' && sp.status !== 'paid' && (
                      <button
                        type="button"
                        onClick={() =>
                          setActiveSplitQrUrl({ name: sp.participantName, url: sp.ppqrUrl, amount: sp.amount })
                        }
                        className="rounded-lg border border-[#171717]/20 px-3 py-1.5 text-xs font-medium text-[#171717] hover:bg-[#F5F0E6]"
                      >
                        เปิด QR ชำระ
                      </button>
                    )}
                    {isStaffOrAdmin && sp.status !== 'paid' && (
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmSplitTarget({
                            splitId: activeSplit.id,
                            participantId: sp.id,
                            name: sp.participantName,
                            amount: sp.amount,
                          })
                        }
                        className="rounded-lg bg-[#16A34A] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#15803D]"
                      >
                        ยืนยันรับเงินส่วนนี้
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Per-person PPQR QR Modal */}
        {activeSplitQrUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#171717]/70 p-4 backdrop-blur-xs">
            <div className="w-full max-w-sm rounded-xl border border-[#C6A56B]/50 bg-[#FFFFFF] p-6 text-center">
              <h3 className="font-display text-2xl font-semibold text-[#171717]">
                PPQR: {activeSplitQrUrl.name}
              </h3>
              <p className="mt-1 font-mono text-2xl font-semibold text-[#7B252B]">
                {activeSplitQrUrl.amount.toLocaleString()} {t.baht}
              </p>
              <div className="mt-4 flex justify-center">
                <QrCodeCanvas value={activeSplitQrUrl.url} size={200} />
              </div>
              <a
                href={activeSplitQrUrl.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#171717] px-4 py-2 text-xs font-medium text-[#F5F0E6]"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>เปิดลิงก์ ppqr.app</span>
              </a>
              <button
                type="button"
                onClick={() => setActiveSplitQrUrl(null)}
                className="mt-3 block w-full rounded-lg border border-[#171717]/15 py-2 text-xs text-[#77716A]"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        )}

        <ConfirmDialog
          open={Boolean(confirmSplitTarget)}
          title="ยืนยันการชำระเงินรายบุคคล"
          description={
            confirmSplitTarget
              ? `ยืนยันรับยอดเงินจาก "${confirmSplitTarget.name}" จำนวน ${confirmSplitTarget.amount.toLocaleString()} บาท ใช่หรือไม่?`
              : ''
          }
          confirmLabel="ยืนยันรับเงิน"
          cancelLabel={t.cancel}
          onConfirm={async () => {
            if (!confirmSplitTarget) return;
            await api.confirmSplitParticipant(
              confirmSplitTarget.splitId,
              confirmSplitTarget.participantId
            );
            setConfirmSplitTarget(null);
            await onRefresh();
          }}
          onCancel={() => setConfirmSplitTarget(null)}
        />
      </div>
    );
  }

  // ======================== 17. PAYMENT STATUS ========================
  if (!activePayment) {
    return (
      <div className="rounded-xl border border-[#171717]/10 bg-[#FFFFFF] p-10 text-center text-sm text-[#77716A]">
        ยังไม่มีรายการชำระเงินล่าสุด
      </div>
    );
  }

  const relatedBill = bills.find((b) => b.id === activePayment.billId);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="rounded-xl border border-[#171717]/10 bg-[#FFFFFF] p-8 text-center">
        {activePayment.status === 'paid' ? (
          <CheckCircle2 className="mx-auto h-14 w-14 text-[#16A34A]" />
        ) : activePayment.status === 'failed' ? (
          <XCircle className="mx-auto h-14 w-14 text-[#7B252B]" />
        ) : (
          <Clock className="mx-auto h-14 w-14 text-[#D97706]" />
        )}

        <h1 className="mt-4 font-display text-3xl font-semibold text-[#171717]">
          {activePayment.status === 'paid'
            ? 'ชำระเงินสำเร็จ'
            : activePayment.status === 'failed'
              ? 'ชำระเงินไม่สำเร็จ'
              : 'รอตรวจสอบการชำระเงิน'}
        </h1>

        <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-[#7B252B]">
          {activePayment.amount.toLocaleString()} {t.baht}
        </p>

        <div className="mt-6 space-y-2 border-t border-[#171717]/10 pt-4 text-left text-xs text-[#77716A]">
          <div className="flex justify-between">
            <span>เลขที่บิล</span>
            <strong className="font-mono text-[#171717]">{activePayment.receiptNumber}</strong>
          </div>
          <div className="flex justify-between">
            <span>รหัสอ้างอิง</span>
            <strong className="font-mono text-[#171717]">{activePayment.referenceCode}</strong>
          </div>
          <div className="flex justify-between">
            <span>ช่องทางชำระ</span>
            <strong className="text-[#171717]">
              {activePayment.method === 'ppqr' ? 'PPQR PromptPay' : 'เงินสด (Cash)'}
            </strong>
          </div>
          {activePayment.confirmedByStaffName && (
            <div className="flex justify-between">
              <span>ยืนยันโดยพนักงาน</span>
              <strong className="text-[#171717]">{activePayment.confirmedByStaffName}</strong>
            </div>
          )}
          {activePayment.failureReason && (
            <div className="flex justify-between text-[#7B252B]">
              <span>สาเหตุ</span>
              <strong>{activePayment.failureReason}</strong>
            </div>
          )}
          {relatedBill && relatedBill.pointsEarned > 0 && (
            <div className="flex justify-between text-[#16A34A]">
              <span>คะแนนสะสมที่ได้รับ</span>
              <strong>+{relatedBill.pointsEarned} คะแนน</strong>
            </div>
          )}
        </div>

        {isStaffOrAdmin && activePayment.status === 'pending' && (
          <div className="mt-6 grid grid-cols-1 gap-3 border-t border-[#171717]/10 pt-5 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setConfirmPayId(activePayment.id)}
              className="rounded-lg bg-[#16A34A] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#15803D]"
            >
              พนักงานยืนยัน: รับเงินแล้ว
            </button>
            <button
              type="button"
              onClick={() => setFailPayId(activePayment.id)}
              className="rounded-lg bg-[#7B252B] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#5E1B20]"
            >
              แจ้งชำระไม่สำเร็จ
            </button>
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {relatedBill && (
            <button
              type="button"
              onClick={() => {
                onSelectBill(relatedBill.id);
                onNavigate('receipt_details');
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-[#171717] px-5 py-2.5 text-xs font-medium text-[#F5F0E6]"
            >
              <Receipt className="h-4 w-4" />
              <span>ดูใบเสร็จรับเงิน</span>
            </button>
          )}
          {activePayment.status === 'failed' && relatedBill && (
            <button
              type="button"
              onClick={() => {
                onSelectBill(relatedBill.id);
                onNavigate('payment_selection');
              }}
              className="rounded-lg border border-[#171717]/20 px-5 py-2.5 text-xs font-medium text-[#171717]"
            >
              ลองชำระเงินอีกครั้ง
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(confirmPayId)}
        title="ยืนยันการรับชำระเงิน"
        description={`ยืนยันการรับชำระเงินจำนวน ${activePayment.amount.toLocaleString()} บาท เรียบร้อยแล้วใช่หรือไม่?`}
        confirmLabel="ยืนยันรับเงินสำเร็จ"
        cancelLabel={t.cancel}
        busy={payBusy}
        onConfirm={async () => {
          if (!confirmPayId) return;
          setPayBusy(true);
          try {
            await api.confirmPayment(confirmPayId);
            await onRefresh();
            setConfirmPayId(null);
          } finally {
            setPayBusy(false);
          }
        }}
        onCancel={() => setConfirmPayId(null)}
      />

      <ConfirmDialog
        open={Boolean(failPayId)}
        title="บันทึกชำระเงินไม่สำเร็จ"
        description="ยืนยันการเปลี่ยนสถานะเป็นชำระเงินไม่สำเร็จ?"
        confirmLabel="ยืนยัน"
        cancelLabel={t.cancel}
        destructive
        busy={payBusy}
        onConfirm={async () => {
          if (!failPayId) return;
          setPayBusy(true);
          try {
            await api.failPayment(failPayId, 'การชำระเงินไม่ผ่านการตรวจสอบ');
            await onRefresh();
            setFailPayId(null);
          } finally {
            setPayBusy(false);
          }
        }}
        onCancel={() => setFailPayId(null)}
      />
    </div>
  );
}
