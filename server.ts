import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import type {
  Bill,
  BillLineItem,
  Category,
  DiningTable,
  LanguageCode,
  MenuItem,
  OrderRequest,
  OrderRequestItem,
  PaymentRecord,
  PlateColor,
  PlateCounts,
  PointTransaction,
  Promotion,
  RedemptionRecord,
  RestaurantSettings,
  RewardItem,
  SplitParticipant,
  SplitPayment,
  UserProfile,
  UserRole,
} from './src/types.ts';

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.resolve(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'sushihouse.json');

interface StoredUser extends UserProfile {
  passwordHash: string;
}

interface ResetTokenRecord {
  email: string;
  code: string;
  expiresAt: number;
}

interface DatabaseState {
  users: StoredUser[];
  categories: Category[];
  menu: MenuItem[];
  tables: DiningTable[];
  bills: Bill[];
  orders: OrderRequest[];
  payments: PaymentRecord[];
  splitPayments: SplitPayment[];
  pointTransactions: PointTransaction[];
  rewards: RewardItem[];
  redemptions: RedemptionRecord[];
  promotions: Promotion[];
  settings: RestaurantSettings;
  resetTokens: ResetTokenRecord[];
}

interface SessionRecord {
  userId: string;
  createdAt: number;
  expiresAt: number;
}

const sessions = new Map<string, SessionRecord>();
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

const VALID_PLATE_COLORS: PlateColor[] = ['white', 'red', 'silver', 'gold', 'black'];
const VALID_ROLES: UserRole[] = ['admin', 'staff', 'user'];

function makeId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

function sanitizeUser(u: StoredUser): UserProfile {
  const { passwordHash: _ignored, ...profile } = u;
  return profile;
}

function createInitialState(): DatabaseState {
  const now = new Date().toISOString();
  return {
    users: [],
    categories: [
      { id: 'cat_nigiri', nameTh: 'นิกิริซูชิ', nameEn: 'Edomae Nigiri', nameJp: '握り寿司', sortOrder: 1, active: true },
      { id: 'cat_sashimi', nameTh: 'ซาชิมิสด', nameEn: 'Fresh Sashimi', nameJp: '刺身', sortOrder: 2, active: true },
      { id: 'cat_maki', nameTh: 'มากิและโรล', nameEn: 'Maki & Rolls', nameJp: '巻物', sortOrder: 3, active: true },
      { id: 'cat_omakase', nameTh: 'จานพิเศษโอมากาเสะ', nameEn: 'Omakase Cuts', nameJp: 'おまかせ', sortOrder: 4, active: true },
      { id: 'cat_beverage', nameTh: 'เครื่องดื่มและของหวาน', nameEn: 'Drinks & Wagashi', nameJp: '甘味・お飲み物', sortOrder: 5, active: true },
    ],
    menu: [
      {
        id: 'menu_tamago',
        categoryId: 'cat_nigiri',
        nameTh: 'ทามาโกะยากินิกิริ',
        nameEn: 'Artisan Tamagoyaki Nigiri',
        nameJp: '玉子握り',
        descriptionTh: 'ไข่หวานสูตรดั้งเดิมย่างถ่านเนื้อนุ่มละมุน เสิร์ฟคู่ข้าวซูชิอุ่นปรุงรสด้วยน้ำส้มสายชูแดง',
        descriptionEn: 'Traditional dashi-infused sweet omelette over warm akazu seasoned rice.',
        plateColor: 'white',
        imageUrl: '/src/assets/images/sushi_salmon_ikura_1795331466789.jpg',
        calories: 140,
        allergens: 'ไข่ (Egg)',
        available: true,
        featured: false,
        createdAt: now,
      },
      {
        id: 'menu_salmon',
        categoryId: 'cat_nigiri',
        nameTh: 'แซลมอนอะบุริยูซุ',
        nameEn: 'Aburi Salmon Yuzu Nigiri',
        nameJp: '炙りサーモン柚子',
        descriptionTh: 'แซลมอนนอร์เวย์ส่วนท้องลนไฟหอมกรุ่น แต้มผิวส้มยูซุญี่ปุ่นและเกลือทะเลโอกินาวา',
        descriptionEn: 'Flame-seared Norwegian salmon belly topped with fresh Kochi yuzu zest and sea salt.',
        plateColor: 'red',
        imageUrl: '/src/assets/images/sushi_salmon_ikura_1795331466789.jpg',
        calories: 185,
        allergens: 'ปลา (Fish)',
        available: true,
        featured: true,
        createdAt: now,
      },
      {
        id: 'menu_ikura',
        categoryId: 'cat_maki',
        nameTh: 'อิคุระกุนคันมากิ',
        nameEn: 'Hokkaido Ikura Gunkan',
        nameJp: 'いくら軍艦',
        descriptionTh: 'ไข่ปลาแซลมอนหมักโชยุสูตรลับจากฮอกไกโด ห่อด้วยสาหร่ายอาริอาเกะกรอบหอม',
        descriptionEn: 'Shoyu-marinated Hokkaido salmon roe wrapped in crisp Ariake nori.',
        plateColor: 'silver',
        imageUrl: '/src/assets/images/sushi_salmon_ikura_1795331466789.jpg',
        calories: 160,
        allergens: 'ปลา, ถั่วเหลือง (Fish, Soy)',
        available: true,
        featured: true,
        createdAt: now,
      },
      {
        id: 'menu_hotate',
        categoryId: 'cat_sashimi',
        nameTh: 'โฮตาเตะฮอกไกโดซาชิมิ',
        nameEn: 'Hokkaido Scallop Sashimi',
        nameJp: '帆立刺身',
        descriptionTh: 'หอยเชลล์ฮอกไกโดไซส์จัมโบ้เนื้อหวานฉ่ำ เสิร์ฟพร้อมวาซาบิสดขูดมือ',
        descriptionEn: 'Sweet sashimi-grade Hokkaido scallop served with freshly grated Shizuoka wasabi.',
        plateColor: 'silver',
        imageUrl: '/src/assets/images/sushi_otoro_nigiri_1795331466966.jpg',
        calories: 120,
        allergens: 'หอย (Shellfish)',
        available: true,
        featured: false,
        createdAt: now,
      },
      {
        id: 'menu_otoro',
        categoryId: 'cat_omakase',
        nameTh: 'โอโทโร่ฮอนมากุโระ',
        nameEn: 'Hon-Maguro Otoro Nigiri',
        nameJp: '本鮪大トロ',
        descriptionTh: 'ท้องปลาทูน่าครีบน้ำเงินส่วนที่นุ่มละลายในปาก ราดนิคิริโชยุบ่มไม้ซีดาร์',
        descriptionEn: 'Prime marbled bluefin tuna belly brushed with aged cedar-barrel nikiri soy.',
        plateColor: 'gold',
        imageUrl: '/src/assets/images/sushi_otoro_nigiri_1795331466966.jpg',
        calories: 210,
        allergens: 'ปลา, ถั่วเหลือง (Fish, Soy)',
        available: true,
        featured: true,
        createdAt: now,
      },
      {
        id: 'menu_chutoro',
        categoryId: 'cat_nigiri',
        nameTh: 'ชูโทโร่อะกามิ',
        nameEn: 'Chutoro Edomae Nigiri',
        nameJp: '中トロ握り',
        descriptionTh: 'ปลาทูน่าส่วนกลางที่มีความสมดุลระหว่างไขมันแทรกและความเข้มข้นของเนื้อปลา',
        descriptionEn: 'Balanced medium-fatty bluefin tuna over red-vinegar shari.',
        plateColor: 'gold',
        imageUrl: '/src/assets/images/sushi_otoro_nigiri_1795331466966.jpg',
        calories: 190,
        allergens: 'ปลา (Fish)',
        available: true,
        featured: false,
        createdAt: now,
      },
      {
        id: 'menu_uni_wagyu',
        categoryId: 'cat_omakase',
        nameTh: 'อูนิฮอกไกโด & วากิว A5',
        nameEn: 'Bafun Uni & Miyazaki Wagyu',
        nameJp: '雲丹和牛握り',
        descriptionTh: 'เนื้อวากิว A5 ลนไฟห่อไข่หอยเม่นบาฟุนสดจากฮอกไกโด ประดับทองคำเปลวบริสุทธิ์',
        descriptionEn: 'Seared Miyazaki A5 Wagyu crowned with Hokkaido Bafun Uni and edible gold leaf.',
        plateColor: 'black',
        imageUrl: '/src/assets/images/sushi_uni_black_1795331466903.jpg',
        calories: 270,
        allergens: 'สัตว์ทะเล (Seafood)',
        available: true,
        featured: true,
        createdAt: now,
      },
      {
        id: 'menu_matcha_set',
        categoryId: 'cat_beverage',
        nameTh: 'ชุดมัทฉะอุจิและวากาชิ',
        nameEn: 'Ceremonial Uji Matcha & Wagashi',
        nameJp: '宇治抹茶と和菓子',
        descriptionTh: 'ชาเขียวมัทฉะเกรดพิธีชงชาจากเกียวโต เสิร์ฟคู่ขนมวากาชิทำมือรสหวานละมุน',
        descriptionEn: 'Stone-milled Kyoto Uji matcha whisked tableside with seasonal artisanal wagashi.',
        plateColor: 'red',
        imageUrl: '/src/assets/images/sushi_matcha_sake_1795331467118.jpg',
        calories: 150,
        allergens: 'ถั่วแดง (Adzuki)',
        available: true,
        featured: true,
        createdAt: now,
      },
    ],
    tables: [
      { id: 'tbl_c1', tableCode: 'C1', zone: 'counter', capacity: 2, status: 'available', currentBillId: null, assignedCustomerId: null, assignedCustomerName: null },
      { id: 'tbl_c2', tableCode: 'C2', zone: 'counter', capacity: 2, status: 'available', currentBillId: null, assignedCustomerId: null, assignedCustomerName: null },
      { id: 'tbl_c3', tableCode: 'C3', zone: 'counter', capacity: 2, status: 'available', currentBillId: null, assignedCustomerId: null, assignedCustomerName: null },
      { id: 'tbl_c4', tableCode: 'C4', zone: 'counter', capacity: 2, status: 'available', currentBillId: null, assignedCustomerId: null, assignedCustomerName: null },
      { id: 'tbl_m1', tableCode: 'M1', zone: 'main', capacity: 4, status: 'available', currentBillId: null, assignedCustomerId: null, assignedCustomerName: null },
      { id: 'tbl_m2', tableCode: 'M2', zone: 'main', capacity: 4, status: 'available', currentBillId: null, assignedCustomerId: null, assignedCustomerName: null },
      { id: 'tbl_m3', tableCode: 'M3', zone: 'main', capacity: 4, status: 'available', currentBillId: null, assignedCustomerId: null, assignedCustomerName: null },
      { id: 'tbl_m4', tableCode: 'M4', zone: 'main', capacity: 6, status: 'available', currentBillId: null, assignedCustomerId: null, assignedCustomerName: null },
      { id: 'tbl_t1', tableCode: 'T1', zone: 'tatami', capacity: 6, status: 'available', currentBillId: null, assignedCustomerId: null, assignedCustomerName: null },
      { id: 'tbl_t2', tableCode: 'T2', zone: 'tatami', capacity: 8, status: 'available', currentBillId: null, assignedCustomerId: null, assignedCustomerName: null },
    ],
    bills: [],
    payments: [],
    splitPayments: [],
    pointTransactions: [],
    rewards: [
      {
        id: 'rwd_matcha',
        titleTh: 'ชาเขียวมัทฉะอุจิพิธีชงชา 1 ถ้วย',
        titleEn: 'Complimentary Uji Matcha Bowl',
        titleJp: '宇治抹茶一杯',
        descriptionTh: 'แลกรับมัทฉะร้อนหรือเย็นเกรดพรีเมียมจากเมืองอุจิ เกียวโต',
        descriptionEn: 'Redeem one stone-milled Uji matcha beverage at your table.',
        pointsCost: 15,
        imageUrl: '/src/assets/images/sushi_matcha_sake_1795331467118.jpg',
        stock: 40,
        active: true,
      },
      {
        id: 'rwd_salmon',
        titleTh: 'จานสีแดง: แซลมอนอะบุริยูซุ 1 จาน',
        titleEn: 'Red Plate: Aburi Salmon Yuzu',
        titleJp: '赤皿：炙りサーモン',
        descriptionTh: 'รับฟรีจานสีแดงเมนูแนะนำ แซลมอนลนไฟยูซุ 2 คำ',
        descriptionEn: 'Complimentary Red Plate of flame-seared Norwegian salmon.',
        pointsCost: 25,
        imageUrl: '/src/assets/images/sushi_salmon_ikura_1795331466789.jpg',
        stock: 30,
        active: true,
      },
      {
        id: 'rwd_otoro',
        titleTh: 'จานสีทอง: โอโทโร่ฮอนมากุโระ 1 จาน',
        titleEn: 'Gold Plate: Hon-Maguro Otoro',
        titleJp: '金皿：本鮪大トロ',
        descriptionTh: 'รับฟรีโอโทโร่ทูน่าครีบน้ำเงินเกรดโอมากาเสะ 1 จาน',
        descriptionEn: 'Complimentary Gold Plate of prime marbled bluefin tuna.',
        pointsCost: 50,
        imageUrl: '/src/assets/images/sushi_otoro_nigiri_1795331466966.jpg',
        stock: 20,
        active: true,
      },
      {
        id: 'rwd_uni',
        titleTh: 'จานสีดำ: อูนิฮอกไกโด & วากิว A5',
        titleEn: 'Black Plate: Uni & Wagyu A5',
        titleJp: '黒皿：雲丹和牛',
        descriptionTh: 'สิทธิพิเศษระดับสูงสุด จานสีดำซิกเนเจอร์ของเชฟ',
        descriptionEn: 'Chef signature Black Plate featuring Hokkaido Uni and A5 Wagyu.',
        pointsCost: 80,
        imageUrl: '/src/assets/images/sushi_uni_black_1795331466903.jpg',
        stock: 12,
        active: true,
      },
    ],
    redemptions: [],
    orders: [],
    promotions: [
      {
        id: 'promo_omakase10',
        titleTh: 'สิทธิพิเศษสมาชิกใหม่ลด 10%',
        titleEn: 'Member Welcome 10% Privilege',
        descriptionTh: 'ส่วนลดค่าอาหาร 10% เมื่อรับประทานครบ 800 บาทขึ้นไป',
        descriptionEn: '10% off food subtotal for bills from 800 THB.',
        code: 'ELEGANCE10',
        discountPercent: 10,
        minSpend: 800,
        active: true,
        validUntil: '2026-12-31',
      },
      {
        id: 'promo_lunch15',
        titleTh: 'Midday Kaisei ลด 15%',
        titleEn: 'Midday Kaisei 15% Off',
        descriptionTh: 'รับส่วนลด 15% สำหรับมื้อกลางวันเมื่อยอดอาหารครบ 1,200 บาท',
        descriptionEn: '15% food discount on orders above 1,200 THB.',
        code: 'KAISEI15',
        discountPercent: 15,
        minSpend: 1200,
        active: true,
        validUntil: '2026-12-31',
      },
    ],
    settings: {
      restaurantName: 'SUSHI HOUSE',
      tagline: 'A Taste of Japanese Elegance',
      branchName: 'Thonglor Flagship Sanctuary',
      address: '88 Thonglor Soi 13, Watthana, Bangkok 10110',
      phone: '02-088-9918',
      taxId: '0105569012345',
      openingHours: '11:30 – 22:30 น.',
      currency: 'THB',
      defaultLanguage: 'th',
      platePrices: {
        white: 30,
        red: 40,
        silver: 60,
        gold: 80,
        black: 120,
      },
      serviceChargeRate: 0.1,
      pointsBahtRate: 25,
      ppqrBaseUrl: 'https://ppqr.app/',
    },
    resetTokens: [],
  };
}

function loadDatabase(): DatabaseState {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    const initial = createInitialState();
    saveDatabase(initial);
    return initial;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as DatabaseState;
    if (!Array.isArray(parsed.orders)) {
      parsed.orders = [];
    }
    return parsed;
  } catch {
    const initial = createInitialState();
    saveDatabase(initial);
    return initial;
  }
}

function saveDatabase(state: DatabaseState): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tempPath = `${DB_FILE}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(state, null, 2), 'utf-8');
  fs.renameSync(tempPath, DB_FILE);
}

const db: DatabaseState = loadDatabase();

function ensureDefaultProfiles(): void {
  const now = new Date().toISOString();
  let changed = false;

  const ensureRole = (id: string, role: UserRole, name: string, email: string) => {
    if (!db.users.some((u) => u.role === role && u.status === 'active')) {
      db.users.push({
        id,
        name,
        email,
        phone: '',
        role,
        status: 'active',
        pointsBalance: 0,
        preferredLanguage: db.settings.defaultLanguage || 'th',
        dietaryNotes: '',
        passwordHash: '',
        createdAt: now,
        updatedAt: now,
      });
      changed = true;
    }
  };

  ensureRole('usr_customer_default', 'user', 'ลูกค้าทั่วไป (Guest)', 'guest@sushihouse.th');
  ensureRole('usr_staff_default', 'staff', 'พนักงานบริการ', 'staff@sushihouse.th');
  ensureRole('usr_admin_default', 'admin', 'ผู้ดูแลระบบ', 'admin@sushihouse.th');

  if (changed) {
    saveDatabase(db);
  }
}

ensureDefaultProfiles();

function hasAnyAdmin(): boolean {
  return db.users.some((u) => u.role === 'admin' && u.status === 'active');
}

function computeBillTotals(
  plateCounts: PlateCounts,
  settings: RestaurantSettings,
  promotion: Promotion | null
): {
  foodSubtotal: number;
  serviceCharge: number;
  promotionDiscount: number;
  netTotal: number;
} {
  let foodSubtotal = 0;
  for (const color of VALID_PLATE_COLORS) {
    const count = Math.max(0, Math.floor(Number(plateCounts[color] || 0)));
    const price = Number(settings.platePrices[color] || 0);
    foodSubtotal += count * price;
  }
  const serviceCharge = Math.round(foodSubtotal * settings.serviceChargeRate * 100) / 100;
  let promotionDiscount = 0;
  if (promotion && promotion.active && foodSubtotal >= promotion.minSpend) {
    promotionDiscount = Math.round(foodSubtotal * (promotion.discountPercent / 100) * 100) / 100;
  }
  const netTotal = Math.max(0, Math.round((foodSubtotal + serviceCharge - promotionDiscount) * 100) / 100);
  return { foodSubtotal, serviceCharge, promotionDiscount, netTotal };
}

function generateReceiptNumber(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const seq = String(db.bills.length + 1).padStart(4, '0');
  return `SH-${ymd}-${seq}`;
}

function buildPpqrUrl(baseUrl: string, amount: number): string {
  const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const formatted = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  return `${cleanBase}?amount=${encodeURIComponent(formatted)}`;
}

function awardPointsForPaidBill(bill: Bill): void {
  if (bill.status !== 'paid' || bill.pointsAwarded || !bill.customerId) {
    return;
  }
  const customer = db.users.find((u) => u.id === bill.customerId);
  if (!customer) return;

  const rate = Math.max(1, Number(db.settings.pointsBahtRate || 25));
  const earned = Math.floor(bill.netTotal / rate);
  bill.pointsAwarded = true;
  bill.pointsEarned = earned;

  if (earned > 0) {
    customer.pointsBalance += earned;
    customer.updatedAt = new Date().toISOString();
    db.pointTransactions.unshift({
      id: makeId('pt'),
      userId: customer.id,
      billId: bill.id,
      rewardId: null,
      type: 'earn',
      points: earned,
      description: `รับคะแนนจากใบเสร็จ ${bill.receiptNumber} (ยอดสุทธิ ${bill.netTotal.toLocaleString()} บาท)`,
      createdAt: new Date().toISOString(),
    });
  }
}

function finalizeBillAsPaid(bill: Bill, method: 'cash' | 'ppqr' | 'split'): void {
  const now = new Date().toISOString();
  bill.status = 'paid';
  bill.paymentMethod = method;
  bill.paidAt = now;
  bill.updatedAt = now;

  awardPointsForPaidBill(bill);

  const table = db.tables.find((t) => t.id === bill.tableId);
  if (table && table.currentBillId === bill.id) {
    table.status = 'available';
    table.currentBillId = null;
    table.assignedCustomerId = null;
    table.assignedCustomerName = null;
  }
}

interface AuthedRequest extends Request {
  authUser?: StoredUser;
  authToken?: string;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    const token = header.slice('Bearer '.length).trim();
    const sess = sessions.get(token);
    if (sess && sess.expiresAt >= Date.now()) {
      const user = db.users.find((u) => u.id === sess.userId);
      if (user && user.status === 'active' && VALID_ROLES.includes(user.role)) {
        req.authUser = user;
        req.authToken = token;
        next();
        return;
      }
    }
  }

  // No-login mode: resolve active profile from X-Active-User-Id or X-Active-Role
  const requestedUserId = typeof req.headers['x-active-user-id'] === 'string' ? req.headers['x-active-user-id'].trim() : '';
  const requestedRoleRaw = typeof req.headers['x-active-role'] === 'string' ? req.headers['x-active-role'].trim() : '';
  const requestedRole: UserRole = VALID_ROLES.includes(requestedRoleRaw as UserRole)
    ? (requestedRoleRaw as UserRole)
    : 'user';

  let user: StoredUser | undefined;
  if (requestedUserId) {
    user = db.users.find((u) => u.id === requestedUserId);
    if (user && user.status !== 'active') {
      res.status(403).json({ error: 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ' });
      return;
    }
  }
  if (!user) {
    user =
      db.users.find((u) => u.role === requestedRole && u.status === 'active') ||
      db.users.find((u) => u.status === 'active');
  }

  if (!user) {
    ensureDefaultProfiles();
    user = db.users.find((u) => u.role === requestedRole && u.status === 'active') || db.users[0];
  }

  if (!user || user.status !== 'active' || !VALID_ROLES.includes(user.role)) {
    res.status(403).json({ error: 'สิทธิ์ผู้ใช้งานไม่ถูกต้อง' });
    return;
  }

  req.authUser = user;
  next();
}

function requireRole(...allowed: UserRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    if (!req.authUser || !allowed.includes(req.authUser.role)) {
      res.status(403).json({ error: 'คุณไม่มีสิทธิ์เข้าถึงส่วนนี้' });
      return;
    }
    next();
  };
}

function createSession(userId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, {
    userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  return token;
}

const app = express();
app.use(express.json({ limit: '1mb' }));

// Security headers (no wildcard CORS)
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// ======================== AUTH & BOOTSTRAP ========================

app.get('/api/auth/bootstrap-status', (_req, res) => {
  res.json({
    needsAdminSetup: !hasAnyAdmin(),
    hasEnvPasscode: Boolean(process.env.ADMIN_PASSCODE && process.env.ADMIN_PASSCODE.trim().length > 0),
    settings: {
      restaurantName: db.settings.restaurantName,
      tagline: db.settings.tagline,
      defaultLanguage: db.settings.defaultLanguage,
    },
  });
});

app.post('/api/auth/claim-admin', (req, res) => {
  if (hasAnyAdmin()) {
    res.status(409).json({ error: 'ระบบมีบัญชีผู้ดูแลระบบอยู่แล้ว' });
    return;
  }
  const { name, email, phone, password, passcode } = req.body || {};
  const envPasscode = process.env.ADMIN_PASSCODE?.trim();
  if (envPasscode) {
    if (typeof passcode !== 'string' || passcode !== envPasscode) {
      res.status(403).json({ error: 'รหัสยืนยันผู้ดูแลระบบ (ADMIN_PASSCODE) ไม่ถูกต้อง' });
      return;
    }
  }
  if (typeof name !== 'string' || name.trim().length < 2 || typeof email !== 'string' || !email.includes('@') || typeof password !== 'string' || password.length < 6) {
    res.status(400).json({ error: 'กรุณากรอกชื่อ อีเมล และรหัสผ่านอย่างน้อย 6 ตัวอักษร' });
    return;
  }
  const cleanEmail = email.trim().toLowerCase();
  if (db.users.some((u) => u.email.toLowerCase() === cleanEmail)) {
    res.status(409).json({ error: 'อีเมลนี้ถูกใช้งานแล้ว' });
    return;
  }
  const now = new Date().toISOString();
  const adminUser: StoredUser = {
    id: makeId('usr'),
    name: name.trim(),
    email: cleanEmail,
    phone: typeof phone === 'string' ? phone.trim() : '',
    role: 'admin',
    status: 'active',
    pointsBalance: 0,
    preferredLanguage: db.settings.defaultLanguage,
    dietaryNotes: '',
    passwordHash: hashPassword(password),
    createdAt: now,
    updatedAt: now,
  };
  db.users.push(adminUser);
  saveDatabase(db);
  const token = createSession(adminUser.id);
  res.status(201).json({ token, user: sanitizeUser(adminUser) });
});

app.post('/api/auth/register', (req, res) => {
  const { name, email, phone, password } = req.body || {};
  if (typeof name !== 'string' || name.trim().length < 2) {
    res.status(400).json({ error: 'กรุณากรอกชื่อ-นามสกุล' });
    return;
  }
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    res.status(400).json({ error: 'รูปแบบอีเมลไม่ถูกต้อง' });
    return;
  }
  if (typeof password !== 'string' || password.length < 6) {
    res.status(400).json({ error: 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร' });
    return;
  }
  const cleanEmail = email.trim().toLowerCase();
  if (db.users.some((u) => u.email.toLowerCase() === cleanEmail)) {
    res.status(409).json({ error: 'อีเมลนี้มีบัญชีอยู่แล้ว' });
    return;
  }
  const now = new Date().toISOString();
  // Public registration ALWAYS forces role: 'user'
  const newUser: StoredUser = {
    id: makeId('usr'),
    name: name.trim(),
    email: cleanEmail,
    phone: typeof phone === 'string' ? phone.trim() : '',
    role: 'user',
    status: 'active',
    pointsBalance: 0,
    preferredLanguage: 'th',
    dietaryNotes: '',
    passwordHash: hashPassword(password),
    createdAt: now,
    updatedAt: now,
  };
  db.users.push(newUser);
  saveDatabase(db);
  const token = createSession(newUser.id);
  res.status(201).json({ token, user: sanitizeUser(newUser) });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'กรุณากรอกอีเมลและรหัสผ่าน' });
    return;
  }
  const cleanEmail = email.trim().toLowerCase();
  const user = db.users.find((u) => u.email.toLowerCase() === cleanEmail);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
    return;
  }
  if (user.status !== 'active') {
    res.status(403).json({ error: 'บัญชีของท่านถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ' });
    return;
  }
  if (!VALID_ROLES.includes(user.role)) {
    res.status(403).json({ error: 'บัญชีนี้ไม่มีสิทธิ์ที่ถูกต้องในระบบ' });
    return;
  }
  const token = createSession(user.id);
  res.json({ token, user: sanitizeUser(user) });
});

app.post('/api/auth/logout', requireAuth, (req: AuthedRequest, res) => {
  if (req.authToken) {
    sessions.delete(req.authToken);
  }
  res.json({ ok: true });
});

app.get('/api/profiles', (_req, res) => {
  res.json({
    profiles: db.users.filter((u) => u.status === 'active').map(sanitizeUser),
  });
});

app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
  res.json({ user: sanitizeUser(req.authUser!) });
});

app.post('/api/auth/forgot-password', (req, res) => {
  const { email } = req.body || {};
  if (typeof email !== 'string' || !email.includes('@')) {
    res.status(400).json({ error: 'กรุณาระบุอีเมลที่ถูกต้อง' });
    return;
  }
  const cleanEmail = email.trim().toLowerCase();
  const user = db.users.find((u) => u.email.toLowerCase() === cleanEmail);
  const code = String(crypto.randomInt(100000, 999999));
  if (user) {
    db.resetTokens = db.resetTokens.filter((t) => t.email !== cleanEmail);
    db.resetTokens.push({ email: cleanEmail, code, expiresAt: Date.now() + 1000 * 60 * 15 });
    saveDatabase(db);
  }
  // Return generic confirmation; in preview mode without SMTP server, expose verification notice clearly
  res.json({
    ok: true,
    message: 'หากอีเมลนี้อยู่ในระบบ รหัสยืนยันการรีเซ็ตรหัสผ่านถูกสร้างเรียบร้อยแล้ว (15 นาที)',
    previewVerificationCode: user ? code : undefined,
  });
});

app.post('/api/auth/reset-password', (req, res) => {
  const { email, code, newPassword } = req.body || {};
  if (typeof email !== 'string' || typeof code !== 'string' || typeof newPassword !== 'string' || newPassword.length < 6) {
    res.status(400).json({ error: 'ข้อมูลไม่ครบถ้วนหรือรหัสผ่านสั้นกว่า 6 ตัวอักษร' });
    return;
  }
  const cleanEmail = email.trim().toLowerCase();
  const rec = db.resetTokens.find((t) => t.email === cleanEmail && t.code === code.trim() && t.expiresAt >= Date.now());
  if (!rec) {
    res.status(400).json({ error: 'รหัสยืนยันไม่ถูกต้องหรือหมดอายุแล้ว' });
    return;
  }
  const user = db.users.find((u) => u.email.toLowerCase() === cleanEmail);
  if (!user) {
    res.status(404).json({ error: 'ไม่พบบัญชีผู้ใช้งาน' });
    return;
  }
  user.passwordHash = hashPassword(newPassword);
  user.updatedAt = new Date().toISOString();
  db.resetTokens = db.resetTokens.filter((t) => t.email !== cleanEmail);
  saveDatabase(db);
  res.json({ ok: true });
});

// ======================== USER PROFILE ========================

app.patch('/api/profile', requireAuth, (req: AuthedRequest, res) => {
  const user = req.authUser!;
  const { name, phone, preferredLanguage, dietaryNotes } = req.body || {};
  if (typeof name === 'string' && name.trim().length >= 2) {
    user.name = name.trim().slice(0, 100);
  }
  if (typeof phone === 'string') {
    user.phone = phone.trim().slice(0, 30);
  }
  if (preferredLanguage === 'th' || preferredLanguage === 'en' || preferredLanguage === 'jp') {
    user.preferredLanguage = preferredLanguage as LanguageCode;
  }
  if (typeof dietaryNotes === 'string') {
    user.dietaryNotes = dietaryNotes.trim().slice(0, 300);
  }
  // STRICT: User CANNOT modify role, status, or pointsBalance!
  user.updatedAt = new Date().toISOString();
  saveDatabase(db);
  res.json({ user: sanitizeUser(user) });
});

app.post('/api/profile/change-password', requireAuth, (req: AuthedRequest, res) => {
  const user = req.authUser!;
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || newPassword.length < 6) {
    res.status(400).json({ error: 'กรุณากรอกรหัสผ่านเดิมและรหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)' });
    return;
  }
  if (!verifyPassword(currentPassword, user.passwordHash)) {
    res.status(400).json({ error: 'รหัสผ่านเดิมไม่ถูกต้อง' });
    return;
  }
  user.passwordHash = hashPassword(newPassword);
  user.updatedAt = new Date().toISOString();
  saveDatabase(db);
  res.json({ ok: true });
});

// ======================== PUBLIC/AUTHED CATALOG & SETTINGS ========================

app.get('/api/storefront', requireAuth, (req: AuthedRequest, res) => {
  const role = req.authUser!.role;
  const uid = req.authUser!.id;

  const visibleBills =
    role === 'admin' || role === 'staff'
      ? db.bills
      : db.bills.filter((b) => b.customerId === uid);

  const visibleBillIds = new Set(visibleBills.map((b) => b.id));

  const visiblePayments =
    role === 'admin' || role === 'staff'
      ? db.payments
      : db.payments.filter((p) => visibleBillIds.has(p.billId) || p.customerId === uid);

  const visibleSplits =
    role === 'admin' || role === 'staff'
      ? db.splitPayments
      : db.splitPayments.filter((s) => visibleBillIds.has(s.billId));

  const visiblePointTx =
    role === 'admin'
      ? db.pointTransactions
      : db.pointTransactions.filter((t) => t.userId === uid);

  const visibleRedemptions =
    role === 'admin' || role === 'staff'
      ? db.redemptions
      : db.redemptions.filter((r) => r.userId === uid);

  // Staff needs customer lookup list (non-sensitive id/name/email only) to assign customers to tables
  const customersForStaff =
    role === 'staff' || role === 'admin'
      ? db.users
          .filter((u) => u.role === 'user' && u.status === 'active')
          .map((u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, pointsBalance: u.pointsBalance }))
      : [];

  const visibleOrders =
    role === 'admin' || role === 'staff'
      ? db.orders
      : db.orders.filter((o) => o.customerId === uid);

  res.json({
    settings: db.settings,
    categories: db.categories,
    menu: db.menu,
    promotions: db.promotions,
    rewards: db.rewards,
    tables: role === 'staff' || role === 'admin' ? db.tables : db.tables.map((t) => ({ ...t, assignedCustomerName: t.assignedCustomerId === uid ? t.assignedCustomerName : null })),
    bills: visibleBills,
    orders: visibleOrders,
    payments: visiblePayments,
    splitPayments: visibleSplits,
    pointTransactions: visiblePointTx,
    redemptions: visibleRedemptions,
    customersForStaff,
    allUsers: role === 'admin' ? db.users.map(sanitizeUser) : [],
  });
});

// ======================== CUSTOMER SELF-ORDERING ========================

app.post('/api/orders', requireAuth, (req: AuthedRequest, res) => {
  const user = req.authUser!;
  const { tableId, note, items } = req.body || {};

  if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
    res.status(400).json({ error: 'กรุณาเลือกรายการอาหารอย่างน้อย 1 รายการ' });
    return;
  }

  // Resolve target table: either the customer's active open bill table or an available table
  const customerOpenBill = db.bills.find(
    (b) => b.customerId === user.id && (b.status === 'open' || b.status === 'pending_payment')
  );

  let targetTable = db.tables.find((t) => t.id === tableId);
  if (!targetTable && customerOpenBill) {
    targetTable = db.tables.find((t) => t.id === customerOpenBill.tableId);
  }
  if (!targetTable) {
    res.status(400).json({ error: 'กรุณาเลือกโต๊ะอาหารก่อนส่งคำสั่งซื้อ' });
    return;
  }

  // Prevent customer from ordering into someone else's occupied table
  if (
    user.role === 'user' &&
    targetTable.status !== 'available' &&
    targetTable.assignedCustomerId !== user.id
  ) {
    res.status(403).json({ error: 'โต๊ะนี้ถูกใช้งานโดยท่านอื่นอยู่ กรุณาเลือกโต๊ะว่างหรือแจ้งพนักงาน' });
    return;
  }

  const orderItems: OrderRequestItem[] = [];
  let estimatedFoodSubtotal = 0;

  for (const raw of items) {
    if (!raw || typeof raw.menuId !== 'string') continue;
    const menuEntry = db.menu.find((m) => m.id === raw.menuId && m.available);
    if (!menuEntry) {
      res.status(400).json({ error: 'มีบางรายการอาหารที่ปิดให้บริการชั่วคราวแล้ว' });
      return;
    }
    const qty = Math.max(1, Math.min(50, Math.floor(Number(raw.quantity || 1))));
    const platePrice = db.settings.platePrices[menuEntry.plateColor];
    estimatedFoodSubtotal += platePrice * qty;
    orderItems.push({
      menuId: menuEntry.id,
      nameTh: menuEntry.nameTh,
      nameEn: menuEntry.nameEn,
      plateColor: menuEntry.plateColor,
      platePrice,
      quantity: qty,
    });
  }

  if (orderItems.length === 0) {
    res.status(400).json({ error: 'ไม่พบรายการอาหารที่ถูกต้อง' });
    return;
  }

  const now = new Date().toISOString();
  const order: OrderRequest = {
    id: makeId('ord'),
    billId: customerOpenBill && customerOpenBill.tableId === targetTable.id ? customerOpenBill.id : null,
    tableId: targetTable.id,
    tableCode: targetTable.tableCode,
    customerId: user.id,
    customerName: user.name,
    items: orderItems,
    note: typeof note === 'string' ? note.trim().slice(0, 200) : '',
    estimatedFoodSubtotal,
    status: 'pending',
    servedByStaffName: null,
    createdAt: now,
    updatedAt: now,
  };

  db.orders.unshift(order);
  saveDatabase(db);
  res.status(201).json({ order });
});

app.post('/api/orders/:id/serve', requireAuth, requireRole('staff', 'admin'), (req: AuthedRequest, res) => {
  const order = db.orders.find((o) => o.id === req.params.id);
  if (!order) {
    res.status(404).json({ error: 'ไม่พบรายการสั่งอาหาร' });
    return;
  }
  if (order.status !== 'pending') {
    res.status(400).json({ error: 'รายการนี้ถูกดำเนินการไปแล้ว' });
    return;
  }

  const table = db.tables.find((t) => t.id === order.tableId);
  if (!table) {
    res.status(404).json({ error: 'ไม่พบโต๊ะอาหารของรายการนี้' });
    return;
  }

  const now = new Date().toISOString();
  let bill =
    (order.billId ? db.bills.find((b) => b.id === order.billId && b.status !== 'paid' && b.status !== 'cancelled') : undefined) ||
    (table.currentBillId ? db.bills.find((b) => b.id === table.currentBillId && b.status !== 'paid' && b.status !== 'cancelled') : undefined);

  if (!bill) {
    bill = {
      id: makeId('bill'),
      receiptNumber: generateReceiptNumber(),
      tableId: table.id,
      tableCode: table.tableCode,
      customerId: order.customerId,
      customerName: order.customerName,
      staffId: req.authUser!.id,
      staffName: req.authUser!.name,
      plateCounts: { white: 0, red: 0, silver: 0, gold: 0, black: 0 },
      items: [],
      promotionId: null,
      promotionCode: null,
      promotionDiscount: 0,
      foodSubtotal: 0,
      serviceChargeRate: db.settings.serviceChargeRate,
      serviceCharge: 0,
      netTotal: 0,
      status: 'open',
      paymentMethod: null,
      pointsAwarded: false,
      pointsEarned: 0,
      createdAt: now,
      updatedAt: now,
      paidAt: null,
    };
    db.bills.unshift(bill);
    table.status = 'occupied';
    table.currentBillId = bill.id;
    table.assignedCustomerId = order.customerId;
    table.assignedCustomerName = order.customerName;
  }

  for (const item of order.items) {
    bill.plateCounts[item.plateColor] = (bill.plateCounts[item.plateColor] || 0) + item.quantity;
    const existingItem = bill.items.find((bi) => bi.menuId === item.menuId);
    if (existingItem) {
      existingItem.quantity += item.quantity;
    } else {
      bill.items.push({
        menuId: item.menuId,
        nameTh: item.nameTh,
        nameEn: item.nameEn,
        plateColor: item.plateColor,
        platePrice: db.settings.platePrices[item.plateColor],
        quantity: item.quantity,
      });
    }
  }

  const promo = bill.promotionId ? db.promotions.find((p) => p.id === bill!.promotionId && p.active) || null : null;
  const totals = computeBillTotals(bill.plateCounts, db.settings, promo);
  bill.foodSubtotal = totals.foodSubtotal;
  bill.serviceChargeRate = db.settings.serviceChargeRate;
  bill.serviceCharge = totals.serviceCharge;
  bill.promotionDiscount = totals.promotionDiscount;
  bill.netTotal = totals.netTotal;
  bill.updatedAt = now;

  order.status = 'served';
  order.billId = bill.id;
  order.servedByStaffName = req.authUser!.name;
  order.updatedAt = now;

  saveDatabase(db);
  res.json({ order, bill });
});

app.post('/api/orders/:id/cancel', requireAuth, (req: AuthedRequest, res) => {
  const order = db.orders.find((o) => o.id === req.params.id);
  if (!order) {
    res.status(404).json({ error: 'ไม่พบรายการสั่งอาหาร' });
    return;
  }
  const user = req.authUser!;
  if (user.role === 'user' && order.customerId !== user.id) {
    res.status(403).json({ error: 'คุณไม่มีสิทธิ์ยกเลิกรายการของผู้อื่น' });
    return;
  }
  if (order.status !== 'pending') {
    res.status(400).json({ error: 'ไม่สามารถยกเลิกรายการที่เสิร์ฟหรือปิดไปแล้วได้' });
    return;
  }
  order.status = 'cancelled';
  order.updatedAt = new Date().toISOString();
  saveDatabase(db);
  res.json({ order });
});

// ======================== STAFF & ADMIN: TABLES & BILLS ========================

app.post('/api/tables/:id/open', requireAuth, requireRole('staff', 'admin'), (req: AuthedRequest, res) => {
  const table = db.tables.find((t) => t.id === req.params.id);
  if (!table) {
    res.status(404).json({ error: 'ไม่พบโต๊ะที่ระบุ' });
    return;
  }
  if (table.currentBillId) {
    const existingBill = db.bills.find((b) => b.id === table.currentBillId && b.status !== 'paid' && b.status !== 'cancelled');
    if (existingBill) {
      res.json({ table, bill: existingBill });
      return;
    }
  }
  const { customerId, guestName } = req.body || {};
  let resolvedCustomer: StoredUser | undefined;
  if (typeof customerId === 'string' && customerId.trim()) {
    resolvedCustomer = db.users.find((u) => u.id === customerId && u.status === 'active');
  }

  const now = new Date().toISOString();
  const billId = makeId('bill');
  const plateCounts: PlateCounts = { white: 0, red: 0, silver: 0, gold: 0, black: 0 };
  const newBill: Bill = {
    id: billId,
    receiptNumber: generateReceiptNumber(),
    tableId: table.id,
    tableCode: table.tableCode,
    customerId: resolvedCustomer ? resolvedCustomer.id : null,
    customerName: resolvedCustomer
      ? resolvedCustomer.name
      : typeof guestName === 'string' && guestName.trim()
        ? guestName.trim()
        : `แขกโต๊ะ ${table.tableCode}`,
    staffId: req.authUser!.id,
    staffName: req.authUser!.name,
    plateCounts,
    items: [],
    promotionId: null,
    promotionCode: null,
    promotionDiscount: 0,
    foodSubtotal: 0,
    serviceChargeRate: db.settings.serviceChargeRate,
    serviceCharge: 0,
    netTotal: 0,
    status: 'open',
    paymentMethod: null,
    pointsAwarded: false,
    pointsEarned: 0,
    createdAt: now,
    updatedAt: now,
    paidAt: null,
  };

  db.bills.unshift(newBill);
  table.status = 'occupied';
  table.currentBillId = newBill.id;
  table.assignedCustomerId = newBill.customerId;
  table.assignedCustomerName = newBill.customerName;
  saveDatabase(db);
  res.status(201).json({ table, bill: newBill });
});

app.patch('/api/bills/:id/assign-customer', requireAuth, requireRole('staff', 'admin'), (req: AuthedRequest, res) => {
  const bill = db.bills.find((b) => b.id === req.params.id);
  if (!bill) {
    res.status(404).json({ error: 'ไม่พบบิลที่ระบุ' });
    return;
  }
  if (bill.status === 'paid' || bill.status === 'cancelled') {
    res.status(400).json({ error: 'ไม่สามารถแก้ไขบิลที่ปิดแล้วได้' });
    return;
  }
  const { customerId, guestName } = req.body || {};
  const customer = typeof customerId === 'string' ? db.users.find((u) => u.id === customerId && u.status === 'active') : undefined;
  bill.customerId = customer ? customer.id : null;
  bill.customerName = customer ? customer.name : typeof guestName === 'string' && guestName.trim() ? guestName.trim() : bill.customerName;
  bill.updatedAt = new Date().toISOString();

  const table = db.tables.find((t) => t.id === bill.tableId);
  if (table && table.currentBillId === bill.id) {
    table.assignedCustomerId = bill.customerId;
    table.assignedCustomerName = bill.customerName;
  }
  saveDatabase(db);
  res.json({ bill });
});

app.patch('/api/bills/:id/plates', requireAuth, requireRole('staff', 'admin'), (req: AuthedRequest, res) => {
  const bill = db.bills.find((b) => b.id === req.params.id);
  if (!bill) {
    res.status(404).json({ error: 'ไม่พบบิลที่ระบุ' });
    return;
  }
  if (bill.status === 'paid' || bill.status === 'cancelled') {
    res.status(400).json({ error: 'ไม่สามารถแก้ไขบิลที่ชำระแล้วหรือยกเลิกแล้วได้' });
    return;
  }
  const { plateCounts, items, promotionId } = req.body || {};
  if (plateCounts && typeof plateCounts === 'object') {
    for (const color of VALID_PLATE_COLORS) {
      const val = Number(plateCounts[color]);
      if (!Number.isFinite(val) || val < 0 || val > 500) {
        res.status(400).json({ error: 'จำนวนจานไม่ถูกต้อง' });
        return;
      }
      bill.plateCounts[color] = Math.floor(val);
    }
  }
  if (Array.isArray(items)) {
    const cleanItems: BillLineItem[] = [];
    for (const raw of items) {
      if (!raw || typeof raw.menuId !== 'string') continue;
      const menuEntry = db.menu.find((m) => m.id === raw.menuId);
      if (!menuEntry) continue;
      const qty = Math.max(1, Math.min(200, Math.floor(Number(raw.quantity || 1))));
      cleanItems.push({
        menuId: menuEntry.id,
        nameTh: menuEntry.nameTh,
        nameEn: menuEntry.nameEn,
        plateColor: menuEntry.plateColor,
        platePrice: db.settings.platePrices[menuEntry.plateColor],
        quantity: qty,
      });
    }
    bill.items = cleanItems;
  }

  let promo: Promotion | null = null;
  if (promotionId === null) {
    bill.promotionId = null;
    bill.promotionCode = null;
  } else if (typeof promotionId === 'string' && promotionId.trim()) {
    promo = db.promotions.find((p) => p.id === promotionId && p.active) || null;
    bill.promotionId = promo ? promo.id : null;
    bill.promotionCode = promo ? promo.code : null;
  } else if (bill.promotionId) {
    promo = db.promotions.find((p) => p.id === bill.promotionId && p.active) || null;
  }

  const totals = computeBillTotals(bill.plateCounts, db.settings, promo);
  bill.foodSubtotal = totals.foodSubtotal;
  bill.serviceChargeRate = db.settings.serviceChargeRate;
  bill.serviceCharge = totals.serviceCharge;
  bill.promotionDiscount = totals.promotionDiscount;
  bill.netTotal = totals.netTotal;
  bill.updatedAt = new Date().toISOString();

  saveDatabase(db);
  res.json({ bill });
});

app.post('/api/bills/:id/apply-promotion', requireAuth, (req: AuthedRequest, res) => {
  const bill = db.bills.find((b) => b.id === req.params.id);
  if (!bill) {
    res.status(404).json({ error: 'ไม่พบบิลที่ระบุ' });
    return;
  }
  const user = req.authUser!;
  if (user.role === 'user' && bill.customerId !== user.id) {
    res.status(403).json({ error: 'คุณไม่มีสิทธิ์เข้าถึงบิลนี้' });
    return;
  }
  if (bill.status === 'paid' || bill.status === 'cancelled') {
    res.status(400).json({ error: 'บิลนี้ปิดรายการแล้ว' });
    return;
  }
  const { promotionId, code } = req.body || {};
  let promo: Promotion | null = null;
  if (typeof promotionId === 'string' && promotionId) {
    promo = db.promotions.find((p) => p.id === promotionId && p.active) || null;
  } else if (typeof code === 'string' && code.trim()) {
    promo = db.promotions.find((p) => p.code.toUpperCase() === code.trim().toUpperCase() && p.active) || null;
  }
  if (!promo) {
    res.status(404).json({ error: 'ไม่พบโปรโมชั่นหรือโค้ดส่วนลดที่ใช้งานได้' });
    return;
  }
  if (bill.foodSubtotal < promo.minSpend) {
    res.status(400).json({ error: `ยอดอาหารต้องครบ ${promo.minSpend.toLocaleString()} บาท จึงจะใช้โปรโมชั่นนี้ได้` });
    return;
  }
  bill.promotionId = promo.id;
  bill.promotionCode = promo.code;
  const totals = computeBillTotals(bill.plateCounts, db.settings, promo);
  bill.foodSubtotal = totals.foodSubtotal;
  bill.serviceCharge = totals.serviceCharge;
  bill.promotionDiscount = totals.promotionDiscount;
  bill.netTotal = totals.netTotal;
  bill.updatedAt = new Date().toISOString();
  saveDatabase(db);
  res.json({ bill });
});

// ======================== PAYMENTS (CASH & PPQR) ========================

app.post('/api/payments', requireAuth, (req: AuthedRequest, res) => {
  const { billId, method } = req.body || {};
  const bill = db.bills.find((b) => b.id === billId);
  if (!bill) {
    res.status(404).json({ error: 'ไม่พบบิลที่ระบุ' });
    return;
  }
  const user = req.authUser!;
  if (user.role === 'user' && bill.customerId !== user.id) {
    res.status(403).json({ error: 'คุณไม่มีสิทธิ์ชำระบิลของผู้อื่น' });
    return;
  }
  if (bill.status === 'paid') {
    res.status(400).json({ error: 'บิลนี้ชำระเงินเรียบร้อยแล้ว' });
    return;
  }
  if (bill.netTotal <= 0) {
    res.status(400).json({ error: 'ยอดชำระต้องมากกว่า 0 บาท กรุณานับจานก่อนชำระเงิน' });
    return;
  }
  if (method !== 'cash' && method !== 'ppqr') {
    res.status(400).json({ error: 'ช่องทางชำระเงินไม่ถูกต้อง' });
    return;
  }

  // Recompute server-side before creating payment
  const promo = bill.promotionId ? db.promotions.find((p) => p.id === bill.promotionId && p.active) || null : null;
  const totals = computeBillTotals(bill.plateCounts, db.settings, promo);
  bill.foodSubtotal = totals.foodSubtotal;
  bill.serviceCharge = totals.serviceCharge;
  bill.promotionDiscount = totals.promotionDiscount;
  bill.netTotal = totals.netTotal;
  bill.status = 'pending_payment';
  bill.paymentMethod = method;
  bill.updatedAt = new Date().toISOString();

  const table = db.tables.find((t) => t.id === bill.tableId);
  if (table && table.currentBillId === bill.id) {
    table.status = 'waiting_payment';
  }

  const now = new Date().toISOString();
  // IMPORTANT: Status starts as 'pending' ALWAYS (even for PPQR!). Never mark paid on QR generation.
  const payment: PaymentRecord = {
    id: makeId('pay'),
    billId: bill.id,
    receiptNumber: bill.receiptNumber,
    customerId: bill.customerId,
    method,
    amount: bill.netTotal,
    status: 'pending',
    ppqrUrl: method === 'ppqr' ? buildPpqrUrl(db.settings.ppqrBaseUrl, bill.netTotal) : '',
    referenceCode: `SHPAY-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    confirmedByStaffId: null,
    confirmedByStaffName: null,
    failureReason: null,
    createdAt: now,
    updatedAt: now,
  };

  db.payments.unshift(payment);
  saveDatabase(db);
  res.status(201).json({ payment, bill });
});

// ONLY authorized Staff or Admin can confirm or fail a payment!
app.post('/api/payments/:id/confirm', requireAuth, requireRole('staff', 'admin'), (req: AuthedRequest, res) => {
  const payment = db.payments.find((p) => p.id === req.params.id);
  if (!payment) {
    res.status(404).json({ error: 'ไม่พบรายการชำระเงิน' });
    return;
  }
  if (payment.status === 'paid') {
    res.status(400).json({ error: 'รายการนี้ถูกยืนยันการชำระเงินไปแล้ว' });
    return;
  }
  const bill = db.bills.find((b) => b.id === payment.billId);
  if (!bill) {
    res.status(404).json({ error: 'ไม่พบบิลที่เกี่ยวข้อง' });
    return;
  }
  const now = new Date().toISOString();
  payment.status = 'paid';
  payment.confirmedByStaffId = req.authUser!.id;
  payment.confirmedByStaffName = req.authUser!.name;
  payment.failureReason = null;
  payment.updatedAt = now;

  finalizeBillAsPaid(bill, payment.method);
  saveDatabase(db);
  res.json({ payment, bill });
});

app.post('/api/payments/:id/fail', requireAuth, requireRole('staff', 'admin'), (req: AuthedRequest, res) => {
  const payment = db.payments.find((p) => p.id === req.params.id);
  if (!payment) {
    res.status(404).json({ error: 'ไม่พบรายการชำระเงิน' });
    return;
  }
  if (payment.status === 'paid') {
    res.status(400).json({ error: 'ไม่สามารถยกเลิกรายการที่ชำระสำเร็จแล้ว' });
    return;
  }
  const { reason } = req.body || {};
  payment.status = 'failed';
  payment.failureReason = typeof reason === 'string' && reason.trim() ? reason.trim() : 'ไม่พบยอดโอนหรือถูกยกเลิกโดยพนักงาน';
  payment.confirmedByStaffId = req.authUser!.id;
  payment.confirmedByStaffName = req.authUser!.name;
  payment.updatedAt = new Date().toISOString();
  saveDatabase(db);
  res.json({ payment });
});

// ======================== SPLIT BILL ========================

app.post('/api/split-payments', requireAuth, (req: AuthedRequest, res) => {
  const { billId, mode, participants } = req.body || {};
  const bill = db.bills.find((b) => b.id === billId);
  if (!bill) {
    res.status(404).json({ error: 'ไม่พบบิลที่ระบุ' });
    return;
  }
  const user = req.authUser!;
  if (user.role === 'user' && bill.customerId !== user.id) {
    res.status(403).json({ error: 'คุณไม่มีสิทธิ์แบ่งบิลของผู้อื่น' });
    return;
  }
  if (bill.status === 'paid') {
    res.status(400).json({ error: 'บิลนี้ชำระเรียบร้อยแล้ว' });
    return;
  }
  if (bill.netTotal <= 0) {
    res.status(400).json({ error: 'ยอดบิลต้องมากกว่า 0 บาท' });
    return;
  }
  if (mode !== 'equal' && mode !== 'custom') {
    res.status(400).json({ error: 'โหมดการแบ่งบิลไม่ถูกต้อง' });
    return;
  }
  if (!Array.isArray(participants) || participants.length < 2 || participants.length > 20) {
    res.status(400).json({ error: 'ต้องมีผู้ร่วมจ่ายอย่างน้อย 2 คน (สูงสุด 20 คน)' });
    return;
  }

  const normalized: SplitParticipant[] = [];
  if (mode === 'equal') {
    const n = participants.length;
    const totalSatang = Math.round(bill.netTotal * 100);
    const baseSatang = Math.floor(totalSatang / n);
    let remainder = totalSatang - baseSatang * n;
    for (const p of participants) {
      const shareSatang = baseSatang + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder -= 1;
      const amount = shareSatang / 100;
      const method: 'cash' | 'ppqr' = p.method === 'cash' ? 'cash' : 'ppqr';
      normalized.push({
        id: makeId('sp'),
        participantName: typeof p.participantName === 'string' && p.participantName.trim() ? p.participantName.trim().slice(0, 60) : 'เพื่อน',
        amount,
        method,
        status: 'pending',
        ppqrUrl: buildPpqrUrl(db.settings.ppqrBaseUrl, amount),
        confirmedByStaffId: null,
        paidAt: null,
      });
    }
  } else {
    let sum = 0;
    for (const p of participants) {
      const amt = Math.round(Number(p.amount) * 100) / 100;
      if (!Number.isFinite(amt) || amt <= 0) {
        res.status(400).json({ error: 'ยอดแบ่งของแต่ละคนต้องมากกว่า 0 บาท' });
        return;
      }
      sum += amt;
      const method: 'cash' | 'ppqr' = p.method === 'cash' ? 'cash' : 'ppqr';
      normalized.push({
        id: makeId('sp'),
        participantName: typeof p.participantName === 'string' && p.participantName.trim() ? p.participantName.trim().slice(0, 60) : 'เพื่อน',
        amount: amt,
        method,
        status: 'pending',
        ppqrUrl: buildPpqrUrl(db.settings.ppqrBaseUrl, amt),
        confirmedByStaffId: null,
        paidAt: null,
      });
    }
    if (Math.abs(Math.round(sum * 100) - Math.round(bill.netTotal * 100)) > 1) {
      res.status(400).json({ error: `ผลรวมยอดแบ่ง (${sum.toLocaleString()} บาท) ต้องเท่ากับยอดบิลสุทธิ (${bill.netTotal.toLocaleString()} บาท)` });
      return;
    }
  }

  const now = new Date().toISOString();
  const existingIdx = db.splitPayments.findIndex((s) => s.billId === bill.id);
  const splitRecord: SplitPayment = {
    id: existingIdx >= 0 ? db.splitPayments[existingIdx].id : makeId('split'),
    billId: bill.id,
    mode,
    totalAmount: bill.netTotal,
    splits: normalized,
    createdAt: existingIdx >= 0 ? db.splitPayments[existingIdx].createdAt : now,
    updatedAt: now,
  };

  if (existingIdx >= 0) {
    db.splitPayments[existingIdx] = splitRecord;
  } else {
    db.splitPayments.unshift(splitRecord);
  }

  bill.status = 'pending_payment';
  bill.paymentMethod = 'split';
  bill.updatedAt = now;
  const table = db.tables.find((t) => t.id === bill.tableId);
  if (table && table.currentBillId === bill.id) {
    table.status = 'waiting_payment';
  }

  saveDatabase(db);
  res.status(201).json({ splitPayment: splitRecord, bill });
});

app.post('/api/split-payments/:splitId/participants/:participantId/confirm', requireAuth, requireRole('staff', 'admin'), (req: AuthedRequest, res) => {
  const split = db.splitPayments.find((s) => s.id === req.params.splitId);
  if (!split) {
    res.status(404).json({ error: 'ไม่พบข้อมูลการแบ่งบิล' });
    return;
  }
  const part = split.splits.find((p) => p.id === req.params.participantId);
  if (!part) {
    res.status(404).json({ error: 'ไม่พบผู้ร่วมจ่าย' });
    return;
  }
  const now = new Date().toISOString();
  part.status = 'paid';
  part.confirmedByStaffId = req.authUser!.id;
  part.paidAt = now;
  split.updatedAt = now;

  const bill = db.bills.find((b) => b.id === split.billId);
  if (bill && split.splits.every((p) => p.status === 'paid')) {
    finalizeBillAsPaid(bill, 'split');
  }
  saveDatabase(db);
  res.json({ splitPayment: split, bill });
});

// ======================== REWARDS & REDEMPTION ========================

app.post('/api/rewards/:id/redeem', requireAuth, (req: AuthedRequest, res) => {
  const user = req.authUser!;
  const reward = db.rewards.find((r) => r.id === req.params.id && r.active);
  if (!reward) {
    res.status(404).json({ error: 'ไม่พบของรางวัลนี้หรือปิดการแลกแล้ว' });
    return;
  }
  if (reward.stock <= 0) {
    res.status(400).json({ error: 'ของรางวัลนี้หมดสต็อกชั่วคราว' });
    return;
  }
  if (user.pointsBalance < reward.pointsCost) {
    res.status(400).json({ error: `คะแนนสะสมไม่เพียงพอ (ต้องการ ${reward.pointsCost} คะแนน)` });
    return;
  }

  const now = new Date().toISOString();
  user.pointsBalance -= reward.pointsCost;
  user.updatedAt = now;
  reward.stock -= 1;

  const redemption: RedemptionRecord = {
    id: makeId('rdm'),
    userId: user.id,
    userName: user.name,
    rewardId: reward.id,
    rewardTitle: reward.titleTh,
    pointsSpent: reward.pointsCost,
    voucherCode: `SH-RWD-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    status: 'active',
    createdAt: now,
    usedAt: null,
  };

  db.redemptions.unshift(redemption);
  db.pointTransactions.unshift({
    id: makeId('pt'),
    userId: user.id,
    billId: null,
    rewardId: reward.id,
    type: 'redeem',
    points: -reward.pointsCost,
    description: `แลกของรางวัล: ${reward.titleTh} (${redemption.voucherCode})`,
    createdAt: now,
  });

  saveDatabase(db);
  res.status(201).json({ redemption, user: sanitizeUser(user), reward });
});

app.post('/api/redemptions/:id/mark-used', requireAuth, requireRole('staff', 'admin'), (req: AuthedRequest, res) => {
  const redemption = db.redemptions.find((r) => r.id === req.params.id);
  if (!redemption) {
    res.status(404).json({ error: 'ไม่พบคูปองของรางวัล' });
    return;
  }
  redemption.status = 'used';
  redemption.usedAt = new Date().toISOString();
  saveDatabase(db);
  res.json({ redemption });
});

// ======================== ADMIN CONSOLES ========================

app.post('/api/admin/menu', requireAuth, requireRole('admin'), (req: AuthedRequest, res) => {
  const { categoryId, nameTh, nameEn, nameJp, descriptionTh, descriptionEn, plateColor, imageUrl, calories, allergens, available, featured } = req.body || {};
  if (typeof nameTh !== 'string' || !nameTh.trim() || !VALID_PLATE_COLORS.includes(plateColor)) {
    res.status(400).json({ error: 'กรุณาระบุชื่อเมนูและสีจานให้ครบถ้วน' });
    return;
  }
  const item: MenuItem = {
    id: makeId('menu'),
    categoryId: typeof categoryId === 'string' && db.categories.some((c) => c.id === categoryId) ? categoryId : db.categories[0].id,
    nameTh: nameTh.trim(),
    nameEn: typeof nameEn === 'string' && nameEn.trim() ? nameEn.trim() : nameTh.trim(),
    nameJp: typeof nameJp === 'string' ? nameJp.trim() : '',
    descriptionTh: typeof descriptionTh === 'string' ? descriptionTh.trim() : '',
    descriptionEn: typeof descriptionEn === 'string' ? descriptionEn.trim() : '',
    plateColor,
    imageUrl: typeof imageUrl === 'string' && imageUrl.startsWith('/src/assets/images/') ? imageUrl : '/src/assets/images/sushi_otoro_nigiri_1795331466966.jpg',
    calories: Math.max(0, Number(calories || 150)),
    allergens: typeof allergens === 'string' ? allergens.trim() : '-',
    available: available !== false,
    featured: Boolean(featured),
    createdAt: new Date().toISOString(),
  };
  db.menu.unshift(item);
  saveDatabase(db);
  res.status(201).json({ item });
});

app.patch('/api/admin/menu/:id', requireAuth, requireRole('admin'), (req: AuthedRequest, res) => {
  const item = db.menu.find((m) => m.id === req.params.id);
  if (!item) {
    res.status(404).json({ error: 'ไม่พบรายการเมนู' });
    return;
  }
  const b = req.body || {};
  if (typeof b.categoryId === 'string' && db.categories.some((c) => c.id === b.categoryId)) item.categoryId = b.categoryId;
  if (typeof b.nameTh === 'string' && b.nameTh.trim()) item.nameTh = b.nameTh.trim();
  if (typeof b.nameEn === 'string' && b.nameEn.trim()) item.nameEn = b.nameEn.trim();
  if (typeof b.nameJp === 'string') item.nameJp = b.nameJp.trim();
  if (typeof b.descriptionTh === 'string') item.descriptionTh = b.descriptionTh.trim();
  if (typeof b.descriptionEn === 'string') item.descriptionEn = b.descriptionEn.trim();
  if (VALID_PLATE_COLORS.includes(b.plateColor)) item.plateColor = b.plateColor;
  if (typeof b.imageUrl === 'string' && b.imageUrl.startsWith('/src/assets/images/')) item.imageUrl = b.imageUrl;
  if (typeof b.calories === 'number' && b.calories >= 0) item.calories = b.calories;
  if (typeof b.allergens === 'string') item.allergens = b.allergens.trim();
  if (typeof b.available === 'boolean') item.available = b.available;
  if (typeof b.featured === 'boolean') item.featured = b.featured;
  saveDatabase(db);
  res.json({ item });
});

app.delete('/api/admin/menu/:id', requireAuth, requireRole('admin'), (req: AuthedRequest, res) => {
  const idx = db.menu.findIndex((m) => m.id === req.params.id);
  if (idx < 0) {
    res.status(404).json({ error: 'ไม่พบรายการเมนู' });
    return;
  }
  db.menu.splice(idx, 1);
  saveDatabase(db);
  res.json({ ok: true });
});

app.patch('/api/admin/settings', requireAuth, requireRole('admin'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  const s = db.settings;
  if (typeof b.restaurantName === 'string' && b.restaurantName.trim()) s.restaurantName = b.restaurantName.trim();
  if (typeof b.tagline === 'string' && b.tagline.trim()) s.tagline = b.tagline.trim();
  if (typeof b.branchName === 'string' && b.branchName.trim()) s.branchName = b.branchName.trim();
  if (typeof b.address === 'string') s.address = b.address.trim();
  if (typeof b.phone === 'string') s.phone = b.phone.trim();
  if (typeof b.taxId === 'string') s.taxId = b.taxId.trim();
  if (typeof b.openingHours === 'string') s.openingHours = b.openingHours.trim();
  if (b.defaultLanguage === 'th' || b.defaultLanguage === 'en' || b.defaultLanguage === 'jp') s.defaultLanguage = b.defaultLanguage;
  if (typeof b.ppqrBaseUrl === 'string' && b.ppqrBaseUrl.startsWith('https://')) s.ppqrBaseUrl = b.ppqrBaseUrl.trim();
  if (typeof b.serviceChargeRate === 'number' && b.serviceChargeRate >= 0 && b.serviceChargeRate <= 0.3) {
    s.serviceChargeRate = b.serviceChargeRate;
  }
  if (typeof b.pointsBahtRate === 'number' && b.pointsBahtRate >= 1 && b.pointsBahtRate <= 1000) {
    s.pointsBahtRate = Math.floor(b.pointsBahtRate);
  }
  if (b.platePrices && typeof b.platePrices === 'object') {
    for (const color of VALID_PLATE_COLORS) {
      const p = Number(b.platePrices[color]);
      if (Number.isFinite(p) && p > 0 && p <= 10000) {
        s.platePrices[color] = Math.round(p);
      }
    }
  }
  saveDatabase(db);
  res.json({ settings: db.settings });
});

app.post('/api/admin/users', requireAuth, requireRole('admin'), (req: AuthedRequest, res) => {
  const { name, email, phone, password, role } = req.body || {};
  if (typeof name !== 'string' || name.trim().length < 2 || typeof email !== 'string' || !email.includes('@')) {
    res.status(400).json({ error: 'กรุณากรอกชื่อและอีเมลให้ครบถ้วน' });
    return;
  }
  if (!VALID_ROLES.includes(role)) {
    res.status(400).json({ error: 'สิทธิ์ผู้ใช้ไม่ถูกต้อง' });
    return;
  }
  const cleanEmail = email.trim().toLowerCase();
  if (db.users.some((u) => u.email.toLowerCase() === cleanEmail)) {
    res.status(409).json({ error: 'อีเมลนี้ถูกใช้งานแล้ว' });
    return;
  }
  const now = new Date().toISOString();
  const created: StoredUser = {
    id: makeId('usr'),
    name: name.trim(),
    email: cleanEmail,
    phone: typeof phone === 'string' ? phone.trim() : '',
    role,
    status: 'active',
    pointsBalance: 0,
    preferredLanguage: 'th',
    dietaryNotes: '',
    passwordHash: typeof password === 'string' && password.length >= 6 ? hashPassword(password) : '',
    createdAt: now,
    updatedAt: now,
  };
  db.users.push(created);
  saveDatabase(db);
  res.status(201).json({ user: sanitizeUser(created) });
});

app.patch('/api/admin/users/:id', requireAuth, requireRole('admin'), (req: AuthedRequest, res) => {
  const target = db.users.find((u) => u.id === req.params.id);
  if (!target) {
    res.status(404).json({ error: 'ไม่พบผู้ใช้งาน' });
    return;
  }
  const { role, status, name, phone } = req.body || {};
  if (target.id === req.authUser!.id && (status === 'suspended' || (role && role !== 'admin'))) {
    res.status(400).json({ error: 'ไม่สามารถระงับหรือลดสิทธิ์บัญชี Admin ของตนเองได้' });
    return;
  }
  if (role && VALID_ROLES.includes(role)) target.role = role;
  if (status === 'active' || status === 'suspended') {
    target.status = status;
    if (status === 'suspended') {
      for (const [tok, sess] of sessions.entries()) {
        if (sess.userId === target.id) sessions.delete(tok);
      }
    }
  }
  if (typeof name === 'string' && name.trim()) target.name = name.trim();
  if (typeof phone === 'string') target.phone = phone.trim();
  target.updatedAt = new Date().toISOString();
  saveDatabase(db);
  res.json({ user: sanitizeUser(target) });
});

app.post('/api/admin/promotions', requireAuth, requireRole('admin'), (req: AuthedRequest, res) => {
  const { titleTh, titleEn, descriptionTh, descriptionEn, code, discountPercent, minSpend, validUntil } = req.body || {};
  if (typeof titleTh !== 'string' || !titleTh.trim() || typeof code !== 'string' || !code.trim()) {
    res.status(400).json({ error: 'กรุณาระบุชื่อโปรโมชั่นและโค้ดส่วนลด' });
    return;
  }
  const promo: Promotion = {
    id: makeId('promo'),
    titleTh: titleTh.trim(),
    titleEn: typeof titleEn === 'string' && titleEn.trim() ? titleEn.trim() : titleTh.trim(),
    descriptionTh: typeof descriptionTh === 'string' ? descriptionTh.trim() : '',
    descriptionEn: typeof descriptionEn === 'string' ? descriptionEn.trim() : '',
    code: code.trim().toUpperCase(),
    discountPercent: Math.max(1, Math.min(80, Number(discountPercent || 10))),
    minSpend: Math.max(0, Number(minSpend || 0)),
    active: true,
    validUntil: typeof validUntil === 'string' && validUntil ? validUntil : '2026-12-31',
  };
  db.promotions.unshift(promo);
  saveDatabase(db);
  res.status(201).json({ promotion: promo });
});

app.patch('/api/admin/promotions/:id', requireAuth, requireRole('admin'), (req: AuthedRequest, res) => {
  const promo = db.promotions.find((p) => p.id === req.params.id);
  if (!promo) {
    res.status(404).json({ error: 'ไม่พบโปรโมชั่น' });
    return;
  }
  const b = req.body || {};
  if (typeof b.active === 'boolean') promo.active = b.active;
  if (typeof b.titleTh === 'string' && b.titleTh.trim()) promo.titleTh = b.titleTh.trim();
  if (typeof b.discountPercent === 'number' && b.discountPercent > 0 && b.discountPercent <= 80) promo.discountPercent = b.discountPercent;
  if (typeof b.minSpend === 'number' && b.minSpend >= 0) promo.minSpend = b.minSpend;
  saveDatabase(db);
  res.json({ promotion: promo });
});

app.delete('/api/admin/promotions/:id', requireAuth, requireRole('admin'), (req: AuthedRequest, res) => {
  const idx = db.promotions.findIndex((p) => p.id === req.params.id);
  if (idx < 0) {
    res.status(404).json({ error: 'ไม่พบโปรโมชั่น' });
    return;
  }
  db.promotions.splice(idx, 1);
  saveDatabase(db);
  res.json({ ok: true });
});

app.post('/api/admin/rewards', requireAuth, requireRole('admin'), (req: AuthedRequest, res) => {
  const { titleTh, titleEn, titleJp, descriptionTh, descriptionEn, pointsCost, stock, imageUrl } = req.body || {};
  if (typeof titleTh !== 'string' || !titleTh.trim() || !Number.isFinite(Number(pointsCost)) || Number(pointsCost) <= 0) {
    res.status(400).json({ error: 'กรุณาระบุชื่อของรางวัลและคะแนนที่ใช้แลก' });
    return;
  }
  const reward: RewardItem = {
    id: makeId('rwd'),
    titleTh: titleTh.trim(),
    titleEn: typeof titleEn === 'string' && titleEn.trim() ? titleEn.trim() : titleTh.trim(),
    titleJp: typeof titleJp === 'string' ? titleJp.trim() : '',
    descriptionTh: typeof descriptionTh === 'string' ? descriptionTh.trim() : '',
    descriptionEn: typeof descriptionEn === 'string' ? descriptionEn.trim() : '',
    pointsCost: Math.floor(Number(pointsCost)),
    imageUrl: typeof imageUrl === 'string' && imageUrl.startsWith('/src/assets/images/') ? imageUrl : '/src/assets/images/sushi_matcha_sake_1795331467118.jpg',
    stock: Math.max(0, Math.floor(Number(stock || 10))),
    active: true,
  };
  db.rewards.unshift(reward);
  saveDatabase(db);
  res.status(201).json({ reward });
});

app.patch('/api/admin/rewards/:id', requireAuth, requireRole('admin'), (req: AuthedRequest, res) => {
  const reward = db.rewards.find((r) => r.id === req.params.id);
  if (!reward) {
    res.status(404).json({ error: 'ไม่พบของรางวัล' });
    return;
  }
  const b = req.body || {};
  if (typeof b.active === 'boolean') reward.active = b.active;
  if (typeof b.stock === 'number' && b.stock >= 0) reward.stock = Math.floor(b.stock);
  if (typeof b.pointsCost === 'number' && b.pointsCost > 0) reward.pointsCost = Math.floor(b.pointsCost);
  saveDatabase(db);
  res.json({ reward });
});

// ======================== VITE / STATIC HOSTING ========================

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SUSHI HOUSE server listening on http://localhost:${PORT}`);
  });
}

startServer();
