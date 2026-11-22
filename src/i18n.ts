import type { LanguageCode, PlateColor } from './types';

export const PLATE_META: Record<
  PlateColor,
  {
    labelTh: string;
    labelEn: string;
    labelJp: string;
    bgHex: string;
    ringHex: string;
    textHex: string;
  }
> = {
  white: {
    labelTh: 'จานสีขาว',
    labelEn: 'White Plate',
    labelJp: '白皿',
    bgHex: '#FFFFFF',
    ringHex: '#D6D0C4',
    textHex: '#171717',
  },
  red: {
    labelTh: 'จานสีแดง',
    labelEn: 'Red Plate',
    labelJp: '赤皿',
    bgHex: '#7B252B',
    ringHex: '#5C1A1F',
    textHex: '#FFFFFF',
  },
  silver: {
    labelTh: 'จานสีเงิน',
    labelEn: 'Silver Plate',
    labelJp: '銀皿',
    bgHex: '#D8D6D1',
    ringHex: '#9A958E',
    textHex: '#171717',
  },
  gold: {
    labelTh: 'จานสีทอง',
    labelEn: 'Gold Plate',
    labelJp: '金皿',
    bgHex: '#C6A56B',
    ringHex: '#9E804B',
    textHex: '#171717',
  },
  black: {
    labelTh: 'จานสีดำ',
    labelEn: 'Black Plate',
    labelJp: '黒皿',
    bgHex: '#171717',
    ringHex: '#44403C',
    textHex: '#F5F0E6',
  },
};

export const UI_TEXT: Record<
  LanguageCode,
  {
    appName: string;
    tagline: string;
    enterApp: string;
    login: string;
    register: string;
    forgotPassword: string;
    logout: string;
    email: string;
    password: string;
    fullName: string;
    phone: string;
    confirm: string;
    cancel: string;
    save: string;
    delete: string;
    edit: string;
    add: string;
    back: string;
    loading: string;
    foodSubtotal: string;
    serviceCharge: string;
    discount: string;
    netTotal: string;
    baht: string;
    points: string;
    plates: string;
    roleAdmin: string;
    roleStaff: string;
    roleUser: string;
    navHome: string;
    navMenu: string;
    navBill: string;
    navRewards: string;
    navHistory: string;
    navProfile: string;
    navStaffDesk: string;
    navTables: string;
    navPlateCounter: string;
    navAdminDesk: string;
    navMenuAdmin: string;
    navPrices: string;
    navStaffAdmin: string;
    navPromos: string;
    navReports: string;
    navSettings: string;
  }
> = {
  th: {
    appName: 'SUSHI HOUSE',
    tagline: 'A Taste of Japanese Elegance',
    enterApp: 'เข้าสู่ระบบร้านอาหาร',
    login: 'เข้าสู่ระบบ',
    register: 'สมัครสมาชิก',
    forgotPassword: 'ลืมรหัสผ่าน',
    logout: 'ออกจากระบบ',
    email: 'อีเมล',
    password: 'รหัสผ่าน',
    fullName: 'ชื่อ-นามสกุล',
    phone: 'เบอร์โทรศัพท์',
    confirm: 'ยืนยัน',
    cancel: 'ยกเลิก',
    save: 'บันทึกข้อมูล',
    delete: 'ลบ',
    edit: 'แก้ไข',
    add: 'เพิ่ม',
    back: 'ย้อนกลับ',
    loading: 'กำลังโหลดข้อมูล...',
    foodSubtotal: 'ยอดอาหารรวม',
    serviceCharge: 'ค่าบริการ (10%)',
    discount: 'ส่วนลดโปรโมชั่น',
    netTotal: 'ยอดสุทธิที่ต้องชำระ',
    baht: 'บาท',
    points: 'คะแนน',
    plates: 'จาน',
    roleAdmin: 'ผู้ดูแลระบบ',
    roleStaff: 'พนักงาน',
    roleUser: 'ลูกค้าสมาชิก',
    navHome: 'หน้าหลัก',
    navMenu: 'เมนูอาหาร',
    navBill: 'บิลปัจจุบัน',
    navRewards: 'คะแนนและรางวัล',
    navHistory: 'ประวัติคำสั่งซื้อ',
    navProfile: 'โปรไฟล์',
    navStaffDesk: 'แดชบอร์ดพนักงาน',
    navTables: 'จัดการโต๊ะ',
    navPlateCounter: 'นับจานคิดเงิน',
    navAdminDesk: 'ภาพรวมผู้บริหาร',
    navMenuAdmin: 'จัดการเมนู',
    navPrices: 'ตั้งค่าราคาจาน',
    navStaffAdmin: 'จัดการผู้ใช้และพนักงาน',
    navPromos: 'จัดการโปรโมชั่น',
    navReports: 'รายงานยอดขาย',
    navSettings: 'ตั้งค่าร้านอาหาร',
  },
  en: {
    appName: 'SUSHI HOUSE',
    tagline: 'A Taste of Japanese Elegance',
    enterApp: 'Enter Dining Suite',
    login: 'Sign In',
    register: 'Create Account',
    forgotPassword: 'Forgot Password',
    logout: 'Sign Out',
    email: 'Email Address',
    password: 'Password',
    fullName: 'Full Name',
    phone: 'Phone Number',
    confirm: 'Confirm',
    cancel: 'Cancel',
    save: 'Save Changes',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    back: 'Back',
    loading: 'Loading...',
    foodSubtotal: 'Food Subtotal',
    serviceCharge: 'Service Charge (10%)',
    discount: 'Promotion Discount',
    netTotal: 'Net Total Due',
    baht: 'THB',
    points: 'pts',
    plates: 'plates',
    roleAdmin: 'Administrator',
    roleStaff: 'Staff',
    roleUser: 'Member',
    navHome: 'Home',
    navMenu: 'Menu',
    navBill: 'Current Bill',
    navRewards: 'Rewards',
    navHistory: 'History',
    navProfile: 'Profile',
    navStaffDesk: 'Staff Desk',
    navTables: 'Tables',
    navPlateCounter: 'Plate Counter',
    navAdminDesk: 'Admin Overview',
    navMenuAdmin: 'Menu Studio',
    navPrices: 'Plate Pricing',
    navStaffAdmin: 'Staff & Users',
    navPromos: 'Promotions',
    navReports: 'Sales Reports',
    navSettings: 'Settings',
  },
  jp: {
    appName: 'SUSHI HOUSE',
    tagline: 'A Taste of Japanese Elegance',
    enterApp: '入店する',
    login: 'ログイン',
    register: '新規会員登録',
    forgotPassword: 'パスワード再設定',
    logout: 'ログアウト',
    email: 'メールアドレス',
    password: 'パスワード',
    fullName: 'お名前',
    phone: '電話番号',
    confirm: '確定',
    cancel: 'キャンセル',
    save: '保存する',
    delete: '削除',
    edit: '編集',
    add: '追加',
    back: '戻る',
    loading: '読み込み中...',
    foodSubtotal: 'お料理小計',
    serviceCharge: 'サービス料 (10%)',
    discount: 'プロモーション割引',
    netTotal: '合計金額',
    baht: 'バーツ',
    points: 'ポイント',
    plates: '皿',
    roleAdmin: '管理者',
    roleStaff: 'スタッフ',
    roleUser: '会員様',
    navHome: 'ホーム',
    navMenu: 'お品書き',
    navBill: 'お会計',
    navRewards: '特典',
    navHistory: '履歴',
    navProfile: '会員情報',
    navStaffDesk: 'スタッフ画面',
    navTables: '座席管理',
    navPlateCounter: 'お皿カウント',
    navAdminDesk: '管理概要',
    navMenuAdmin: 'メニュー管理',
    navPrices: '皿価格設定',
    navStaffAdmin: 'スタッフ管理',
    navPromos: '優待設定',
    navReports: '売上報告',
    navSettings: '店舗設定',
  },
};
