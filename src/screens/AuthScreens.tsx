import { useState } from 'react';
import { ArrowRight, KeyRound, Lock, Mail, Phone, ShieldCheck, User, UtensilsCrossed } from 'lucide-react';
import { api, setAuthToken } from '../api';
import { UI_TEXT } from '../i18n';
import type { LanguageCode, ScreenId, UserProfile } from '../types';

interface AuthScreensProps {
  screen: 'splash' | 'login' | 'register' | 'forgot_password';
  lang: LanguageCode;
  onChangeLang: (lang: LanguageCode) => void;
  needsAdminSetup: boolean;
  hasEnvPasscode: boolean;
  onNavigate: (screen: ScreenId) => void;
  onAuthenticated: (user: UserProfile, token: string) => void;
  onAdminClaimed: () => void;
}

export function AuthScreens({
  screen,
  lang,
  onChangeLang,
  needsAdminSetup,
  hasEnvPasscode,
  onNavigate,
  onAuthenticated,
  onAdminClaimed,
}: AuthScreensProps) {
  const t = UI_TEXT[lang];

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // First-run Admin Claim state
  const [claimName, setClaimName] = useState('');
  const [claimEmail, setClaimEmail] = useState('');
  const [claimPhone, setClaimPhone] = useState('');
  const [claimPassword, setClaimPassword] = useState('');
  const [claimPasscode, setClaimPasscode] = useState('');
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  // Register state (User role only)
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  // Forgot Password state
  const [fpEmail, setFpEmail] = useState('');
  const [fpCode, setFpCode] = useState('');
  const [fpNewPassword, setFpNewPassword] = useState('');
  const [fpStep, setFpStep] = useState<'request' | 'verify'>('request');
  const [fpPreviewCode, setFpPreviewCode] = useState<string | null>(null);
  const [fpMessage, setFpMessage] = useState<string | null>(null);
  const [fpError, setFpError] = useState<string | null>(null);
  const [fpLoading, setFpLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    try {
      const res = await api.login({ email: loginEmail, password: loginPassword });
      setAuthToken(res.token);
      onAuthenticated(res.user, res.token);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'เข้าสู่ระบบไม่สำเร็จ');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleClaimAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setClaimError(null);
    setClaimLoading(true);
    try {
      const res = await api.claimAdmin({
        name: claimName,
        email: claimEmail,
        phone: claimPhone,
        password: claimPassword,
        passcode: hasEnvPasscode ? claimPasscode : undefined,
      });
      setAuthToken(res.token);
      onAdminClaimed();
      onAuthenticated(res.user, res.token);
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : 'ตั้งค่าผู้ดูแลระบบไม่สำเร็จ');
    } finally {
      setClaimLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    setRegLoading(true);
    try {
      const res = await api.register({
        name: regName,
        email: regEmail,
        phone: regPhone,
        password: regPassword,
      });
      setAuthToken(res.token);
      onAuthenticated(res.user, res.token);
    } catch (err) {
      setRegError(err instanceof Error ? err.message : 'สมัครสมาชิกไม่สำเร็จ');
    } finally {
      setRegLoading(false);
    }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setFpError(null);
    setFpMessage(null);
    setFpLoading(true);
    try {
      const res = await api.forgotPassword(fpEmail);
      setFpMessage(res.message);
      if (res.previewVerificationCode) {
        setFpPreviewCode(res.previewVerificationCode);
      }
      setFpStep('verify');
    } catch (err) {
      setFpError(err instanceof Error ? err.message : 'ไม่สามารถส่งคำขอรีเซ็ตได้');
    } finally {
      setFpLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFpError(null);
    setFpLoading(true);
    try {
      await api.resetPassword({ email: fpEmail, code: fpCode, newPassword: fpNewPassword });
      setFpMessage('รีเซ็ตรหัสผ่านสำเร็จแล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่');
      setTimeout(() => {
        setFpStep('request');
        setFpPreviewCode(null);
        onNavigate('login');
      }, 1200);
    } catch (err) {
      setFpError(err instanceof Error ? err.message : 'รหัสยืนยันไม่ถูกต้อง');
    } finally {
      setFpLoading(false);
    }
  };

  const LanguageSwitch = () => (
    <div className="inline-flex items-center gap-1 rounded-lg border border-[#C6A56B]/30 bg-[#FFFFFF] p-1">
      {(['th', 'en', 'jp'] as LanguageCode[]).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => onChangeLang(code)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
            lang === code ? 'bg-[#171717] text-[#F5F0E6]' : 'text-[#77716A] hover:text-[#171717]'
          }`}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );

  if (screen === 'splash') {
    return (
      <div className="min-h-screen bg-[#171717] text-[#F5F0E6] flex flex-col justify-between">
        <header className="flex items-center justify-between px-6 py-5 lg:px-12">
          <span className="font-display text-xl tracking-widest text-[#C6A56B] whitespace-nowrap shrink-0">
            SUSHI HOUSE
          </span>
          <LanguageSwitch />
        </header>

        <main className="mx-auto grid w-full max-w-6xl grid-cols-1 items-stretch gap-8 px-6 py-8 lg:grid-cols-12 lg:px-12">
          <div className="flex flex-col justify-center lg:col-span-6">
            <p className="text-xs tracking-[0.22em] text-[#C6A56B] uppercase">
              Omakase &amp; Kaiten Experience
            </p>
            <h1 className="mt-4 font-display text-4xl font-semibold leading-tight text-[#F5F0E6] sm:text-5xl lg:text-6xl">
              {t.appName}
            </h1>
            <p className="mt-3 font-display text-xl italic text-[#C6A56B] sm:text-2xl">
              {t.tagline}
            </p>
            <p className="mt-6 max-w-lg text-sm leading-relaxed text-[#F5F0E6]/75 sm:text-base">
              สัมผัสศิลปะแห่งซูชิเอโดะมาเอะในบรรยากาศญี่ปุ่นร่วมสมัย พร้อมระบบสั่งอาหาร ตรวจสอบบิลตามสีจาน
              แบ่งบิลกับเพื่อน ชำระเงินผ่าน PPQR และสะสมคะแนนแลกของรางวัลระดับพรีเมียม
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => onNavigate('login')}
                className="inline-flex items-center gap-2 rounded-lg bg-[#C6A56B] px-6 py-3 text-sm font-semibold text-[#171717] transition-colors hover:bg-[#D5B883] whitespace-nowrap shrink-0"
              >
                <span>{t.enterApp}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('register')}
                className="inline-flex items-center gap-2 rounded-lg border border-[#F5F0E6]/25 px-6 py-3 text-sm font-medium text-[#F5F0E6] transition-colors hover:border-[#C6A56B] hover:text-[#C6A56B] whitespace-nowrap shrink-0"
              >
                <span>{t.register}</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="relative h-full min-h-[320px] overflow-hidden rounded-xl border border-[#C6A56B]/25">
              <img
                src="/src/assets/images/hero_omakase_counter_1795331466265.jpg"
                alt="SUSHI HOUSE Omakase Counter"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#171717]/80 via-[#171717]/20 to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between text-xs text-[#F5F0E6]/90">
                <span>Thonglor Flagship Sanctuary</span>
                <span className="font-mono tabular-nums text-[#C6A56B]">11:30 – 22:30</span>
              </div>
            </div>
          </div>
        </main>

        <footer className="border-t border-[#F5F0E6]/10 px-6 py-5 text-center text-xs text-[#77716A] lg:px-12">
          <span>SUSHI HOUSE · {t.tagline}</span>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F0E6] text-[#171717] flex flex-col">
      <header className="flex items-center justify-between border-b border-[#171717]/10 bg-[#FFFFFF] px-6 py-4 lg:px-12">
        <button
          type="button"
          onClick={() => onNavigate('splash')}
          className="flex items-center gap-3 text-left whitespace-nowrap shrink-0"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#171717] text-[#C6A56B]">
            <UtensilsCrossed className="h-4 w-4" />
          </span>
          <span className="font-display text-xl font-semibold tracking-wider text-[#171717]">
            SUSHI HOUSE
          </span>
        </button>

        <LanguageSwitch />
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="grid w-full grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left brand panel */}
          <div className="hidden overflow-hidden rounded-xl border border-[#171717]/10 bg-[#171717] text-[#F5F0E6] lg:col-span-5 lg:flex lg:flex-col lg:justify-between">
            <div className="relative h-64 w-full">
              <img
                src="/src/assets/images/sushi_otoro_nigiri_1795331466966.jpg"
                alt="Signature Otoro Nigiri"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#171717] via-[#171717]/30 to-transparent" />
            </div>
            <div className="p-8">
              <p className="text-xs tracking-widest text-[#C6A56B] uppercase">Member &amp; Staff Portal</p>
              <h2 className="mt-2 font-display text-3xl font-semibold text-[#F5F0E6]">
                {t.tagline}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[#F5F0E6]/75">
                ระบบยืนยันตัวตนและแยกสิทธิ์การใช้งานอย่างปลอดภัยสำหรับลูกค้า พนักงานบริการ และผู้ดูแลระบบร้าน SUSHI HOUSE
              </p>
              <div className="mt-6 border-t border-[#F5F0E6]/10 pt-4 text-xs text-[#C6A56B]">
                White 30฿ · Red 40฿ · Silver 60฿ · Gold 80฿ · Black 120฿
              </div>
            </div>
          </div>

          {/* Right auth card */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            {screen === 'login' && (
              <>
                {needsAdminSetup && (
                  <div className="rounded-xl border border-[#C6A56B] bg-[#FFFFFF] p-6">
                    <div className="flex items-center gap-2 text-[#7B252B]">
                      <ShieldCheck className="h-5 w-5" />
                      <h3 className="text-base font-semibold text-[#171717]">
                        ตั้งค่าผู้ดูแลระบบคนแรก (First-Run Admin Setup)
                      </h3>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-[#77716A]">
                      ยังไม่มีบัญชี Admin ในระบบ กรุณาสร้างบัญชีผู้ดูแลระบบเริ่มต้นเพื่อจัดการพนักงาน เมนู และราคาจาน
                    </p>
                    <form onSubmit={handleClaimAdmin} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <input
                        type="text"
                        required
                        placeholder="ชื่อผู้ดูแลระบบ"
                        value={claimName}
                        onChange={(e) => setClaimName(e.target.value)}
                        className="rounded-lg border border-[#171717]/15 bg-[#F5F0E6]/40 px-3.5 py-2.5 text-sm outline-none focus:border-[#C6A56B]"
                      />
                      <input
                        type="email"
                        required
                        placeholder="อีเมล Admin"
                        value={claimEmail}
                        onChange={(e) => setClaimEmail(e.target.value)}
                        className="rounded-lg border border-[#171717]/15 bg-[#F5F0E6]/40 px-3.5 py-2.5 text-sm outline-none focus:border-[#C6A56B]"
                      />
                      <input
                        type="tel"
                        placeholder="เบอร์โทรศัพท์ (ถ้ามี)"
                        value={claimPhone}
                        onChange={(e) => setClaimPhone(e.target.value)}
                        className="rounded-lg border border-[#171717]/15 bg-[#F5F0E6]/40 px-3.5 py-2.5 text-sm outline-none focus:border-[#C6A56B]"
                      />
                      <input
                        type="password"
                        required
                        minLength={6}
                        placeholder="รหัสผ่าน (อย่างน้อย 6 ตัวอักษร)"
                        value={claimPassword}
                        onChange={(e) => setClaimPassword(e.target.value)}
                        className="rounded-lg border border-[#171717]/15 bg-[#F5F0E6]/40 px-3.5 py-2.5 text-sm outline-none focus:border-[#C6A56B]"
                      />
                      {hasEnvPasscode && (
                        <input
                          type="password"
                          required
                          placeholder="ADMIN_PASSCODE จาก Environment"
                          value={claimPasscode}
                          onChange={(e) => setClaimPasscode(e.target.value)}
                          className="sm:col-span-2 rounded-lg border border-[#171717]/15 bg-[#F5F0E6]/40 px-3.5 py-2.5 text-sm outline-none focus:border-[#C6A56B]"
                        />
                      )}
                      {claimError && (
                        <p className="sm:col-span-2 text-xs font-medium text-[#7B252B]">{claimError}</p>
                      )}
                      <button
                        type="submit"
                        disabled={claimLoading}
                        className="sm:col-span-2 rounded-lg bg-[#7B252B] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#5E1B20] disabled:opacity-60"
                      >
                        {claimLoading ? 'กำลังสร้างบัญชี Admin...' : 'สร้างบัญชีผู้ดูแลระบบเริ่มต้น'}
                      </button>
                    </form>
                  </div>
                )}

                <div className="rounded-xl border border-[#171717]/10 bg-[#FFFFFF] p-7 sm:p-8">
                  <h1 className="font-display text-3xl font-semibold text-[#171717]">{t.login}</h1>
                  <p className="mt-1 text-sm text-[#77716A]">
                    ระบบจะนำท่านไปยังหน้าจอหลักตามสิทธิ์ของบัญชีโดยอัตโนมัติ (Admin / Staff / User)
                  </p>

                  <form onSubmit={handleLogin} className="mt-6 space-y-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[#171717]">{t.email}</label>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-[#77716A]" />
                        <input
                          type="email"
                          required
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          placeholder="name@sushihouse.com"
                          className="w-full rounded-lg border border-[#171717]/15 bg-[#FFFFFF] py-2.5 pl-10 pr-4 text-sm outline-none focus:border-[#C6A56B]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[#171717]">{t.password}</label>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-[#77716A]" />
                        <input
                          type="password"
                          required
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full rounded-lg border border-[#171717]/15 bg-[#FFFFFF] py-2.5 pl-10 pr-4 text-sm outline-none focus:border-[#C6A56B]"
                        />
                      </div>
                    </div>

                    {loginError && (
                      <div className="rounded-lg border border-[#7B252B]/25 bg-[#7B252B]/5 px-3.5 py-2.5 text-xs font-medium text-[#7B252B]">
                        {loginError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loginLoading}
                      className="w-full rounded-lg bg-[#171717] px-5 py-3 text-sm font-medium text-[#F5F0E6] transition-colors hover:bg-[#2E2A27] disabled:opacity-60"
                    >
                      {loginLoading ? t.loading : t.login}
                    </button>
                  </form>

                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#171717]/10 pt-5 text-sm">
                    <button
                      type="button"
                      onClick={() => onNavigate('forgot_password')}
                      className="text-xs font-medium text-[#77716A] underline-offset-4 hover:text-[#171717] hover:underline"
                    >
                      {t.forgotPassword}?
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate('register')}
                      className="text-xs font-semibold text-[#7B252B] underline-offset-4 hover:underline"
                    >
                      {t.register} (สำหรับลูกค้าใหม่)
                    </button>
                  </div>
                </div>
              </>
            )}

            {screen === 'register' && (
              <div className="rounded-xl border border-[#171717]/10 bg-[#FFFFFF] p-7 sm:p-8">
                <h1 className="font-display text-3xl font-semibold text-[#171717]">{t.register}</h1>
                <p className="mt-1 text-sm text-[#77716A]">
                  สมาชิกที่สมัครผ่านหน้านี้จะได้รับสิทธิ์ลูกค้า (User) เท่านั้น เพื่อสะสมคะแนนและชำระบิล
                </p>

                <form onSubmit={handleRegister} className="mt-6 space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#171717]">{t.fullName}</label>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-[#77716A]" />
                      <input
                        type="text"
                        required
                        minLength={2}
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="เช่น ณัฐพงศ์ วัฒนกุล"
                        className="w-full rounded-lg border border-[#171717]/15 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-[#C6A56B]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[#171717]">{t.email}</label>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-[#77716A]" />
                        <input
                          type="email"
                          required
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          placeholder="customer@email.com"
                          className="w-full rounded-lg border border-[#171717]/15 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-[#C6A56B]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[#171717]">{t.phone}</label>
                      <div className="relative">
                        <Phone className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-[#77716A]" />
                        <input
                          type="tel"
                          value={regPhone}
                          onChange={(e) => setRegPhone(e.target.value)}
                          placeholder="081-234-5678"
                          className="w-full rounded-lg border border-[#171717]/15 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-[#C6A56B]"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#171717]">{t.password}</label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-[#77716A]" />
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="อย่างน้อย 6 ตัวอักษร"
                        className="w-full rounded-lg border border-[#171717]/15 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-[#C6A56B]"
                      />
                    </div>
                  </div>

                  {regError && (
                    <div className="rounded-lg border border-[#7B252B]/25 bg-[#7B252B]/5 px-3.5 py-2.5 text-xs font-medium text-[#7B252B]">
                      {regError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={regLoading}
                    className="w-full rounded-lg bg-[#7B252B] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-[#5E1B20] disabled:opacity-60"
                  >
                    {regLoading ? t.loading : t.register}
                  </button>
                </form>

                <div className="mt-6 border-t border-[#171717]/10 pt-5 text-center">
                  <button
                    type="button"
                    onClick={() => onNavigate('login')}
                    className="text-xs font-medium text-[#77716A] underline-offset-4 hover:text-[#171717] hover:underline"
                  >
                    มีบัญชีอยู่แล้ว? กลับไปหน้า{t.login}
                  </button>
                </div>
              </div>
            )}

            {screen === 'forgot_password' && (
              <div className="rounded-xl border border-[#171717]/10 bg-[#FFFFFF] p-7 sm:p-8">
                <h1 className="font-display text-3xl font-semibold text-[#171717]">{t.forgotPassword}</h1>
                <p className="mt-1 text-sm text-[#77716A]">
                  กรอกอีเมลที่ลงทะเบียนไว้เพื่อรับรหัสยืนยันสำหรับตั้งรหัสผ่านใหม่
                </p>

                {fpStep === 'request' ? (
                  <form onSubmit={handleRequestReset} className="mt-6 space-y-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[#171717]">{t.email}</label>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-[#77716A]" />
                        <input
                          type="email"
                          required
                          value={fpEmail}
                          onChange={(e) => setFpEmail(e.target.value)}
                          placeholder="name@sushihouse.com"
                          className="w-full rounded-lg border border-[#171717]/15 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-[#C6A56B]"
                        />
                      </div>
                    </div>

                    {fpError && (
                      <div className="rounded-lg border border-[#7B252B]/25 bg-[#7B252B]/5 px-3.5 py-2.5 text-xs font-medium text-[#7B252B]">
                        {fpError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={fpLoading}
                      className="w-full rounded-lg bg-[#171717] px-5 py-3 text-sm font-medium text-[#F5F0E6] transition-colors hover:bg-[#2E2A27] disabled:opacity-60"
                    >
                      {fpLoading ? t.loading : 'ส่งรหัสยืนยันการรีเซ็ต'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleResetPassword} className="mt-6 space-y-4">
                    {fpMessage && (
                      <div className="rounded-lg border border-[#C6A56B]/50 bg-[#F5F0E6] px-4 py-3 text-xs text-[#171717]">
                        <p>{fpMessage}</p>
                        {fpPreviewCode && (
                          <p className="mt-1 font-mono font-semibold text-[#7B252B]">
                            รหัสยืนยัน (Preview): {fpPreviewCode}
                          </p>
                        )}
                      </div>
                    )}

                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[#171717]">รหัสยืนยัน 6 หลัก</label>
                      <div className="relative">
                        <KeyRound className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-[#77716A]" />
                        <input
                          type="text"
                          required
                          value={fpCode}
                          onChange={(e) => setFpCode(e.target.value)}
                          placeholder="123456"
                          className="w-full rounded-lg border border-[#171717]/15 py-2.5 pl-10 pr-4 font-mono text-sm outline-none focus:border-[#C6A56B]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[#171717]">รหัสผ่านใหม่</label>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-[#77716A]" />
                        <input
                          type="password"
                          required
                          minLength={6}
                          value={fpNewPassword}
                          onChange={(e) => setFpNewPassword(e.target.value)}
                          placeholder="อย่างน้อย 6 ตัวอักษร"
                          className="w-full rounded-lg border border-[#171717]/15 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-[#C6A56B]"
                        />
                      </div>
                    </div>

                    {fpError && (
                      <div className="rounded-lg border border-[#7B252B]/25 bg-[#7B252B]/5 px-3.5 py-2.5 text-xs font-medium text-[#7B252B]">
                        {fpError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={fpLoading}
                      className="w-full rounded-lg bg-[#7B252B] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-[#5E1B20] disabled:opacity-60"
                    >
                      {fpLoading ? t.loading : 'ยืนยันการเปลี่ยนรหัสผ่าน'}
                    </button>
                  </form>
                )}

                <div className="mt-6 border-t border-[#171717]/10 pt-5 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setFpStep('request');
                      setFpError(null);
                      onNavigate('login');
                    }}
                    className="text-xs font-medium text-[#77716A] underline-offset-4 hover:text-[#171717] hover:underline"
                  >
                    กลับไปหน้า{t.login}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
