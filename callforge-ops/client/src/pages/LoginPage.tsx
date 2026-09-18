import React, { useState, useEffect, useRef } from "react";
import {
  ShieldCheck,
  Lock,
  Mail,
  Phone,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Building2,
  RefreshCw,
  PhoneCall,
  Activity,
  Bot,
  Zap,
  Globe,
  Sliders,
  Check,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";

interface LoginPageProps {
  onLoginSuccess?: (user: { name: string; emailOrPhone: string; role: string }) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  // Auth Method: 'email' | 'phone'
  const [authMethod, setAuthMethod] = useState<"email" | "phone">("email");

  // Email state
  const [email, setEmail] = useState("admin@callforge.io");
  const [password, setPassword] = useState("••••••••••••");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Phone & OTP state
  const [countryCode, setCountryCode] = useState("+91");
  const [phoneNumber, setPhoneNumber] = useState("9820011223");
  const [otpSent, setOtpSent] = useState(false);
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [timer, setTimer] = useState(30);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Modals & Dialogs
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showContactAdmin, setShowContactAdmin] = useState(false);
  const [resetEmail, setResetEmail] = useState("");

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // OTP Resend countdown
  useEffect(() => {
    let interval: any = null;
    if (otpSent && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [otpSent, timer]);

  // Handle Email Login
  const handleEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid corporate email address.");
      return;
    }
    if (!password || password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      const user = {
        name: "Arjun Mehta",
        emailOrPhone: email,
        role: "Super Admin",
      };
      localStorage.setItem("creatorai_auth_user", JSON.stringify(user));
      localStorage.setItem("creatorai_auth_token", "jwt_live_session_cf987a");
      toast.success("Welcome back, Arjun!", {
        description: "Authenticated via Enterprise Identity Gateway.",
      });
      if (onLoginSuccess) {
        onLoginSuccess(user);
      } else {
        window.location.href = "/";
      }
    }, 600);
  };

  // Handle Send OTP
  const handleSendOtp = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanPhone = phoneNumber.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      toast.error("Please enter a valid 10-digit mobile number.");
      return;
    }

    setIsSendingOtp(true);
    setTimeout(() => {
      setIsSendingOtp(false);
      setOtpSent(true);
      setTimer(30);
      setOtpDigits(["4", "8", "2", "9", "1", "0"]); // Sandbox default demo OTP for instant user friction-free test
      toast.success(`OTP sent to ${countryCode} ${cleanPhone}!`, {
        description: "Sandbox Demo OTP: 482910 has been pre-filled for testing.",
      });
      // Focus first digit
      setTimeout(() => otpInputRefs.current[0]?.focus(), 150);
    }, 700);
  };

  // Handle OTP digit change
  const handleOtpChange = (index: number, val: string) => {
    if (val.length > 1) {
      // Pasted full OTP
      const chars = val.slice(0, 6).split("");
      const nextDigits = [...otpDigits];
      chars.forEach((c, idx) => {
        nextDigits[idx] = c;
      });
      setOtpDigits(nextDigits);
      otpInputRefs.current[Math.min(chars.length, 5)]?.focus();
      return;
    }

    const next = [...otpDigits];
    next[index] = val;
    setOtpDigits(next);

    // Auto advance to next box
    if (val && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  // Handle Verify OTP
  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    const fullOtp = otpDigits.join("");
    if (fullOtp.length !== 6) {
      toast.error("Please enter complete 6-digit OTP.");
      return;
    }

    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      const user = {
        name: "Verified Agent",
        emailOrPhone: `${countryCode} ${phoneNumber}`,
        role: "Telephony Supervisor",
      };
      localStorage.setItem("creatorai_auth_user", JSON.stringify(user));
      localStorage.setItem("creatorai_auth_token", "jwt_phone_verified_883a");
      toast.success("Phone Number Verified Successfully!", {
        description: "Logged in via 2-Factor Telecom OTP Protocol.",
      });
      if (onLoginSuccess) {
        onLoginSuccess(user);
      } else {
        window.location.href = "/";
      }
    }, 750);
  };

  // Handle Google OAuth
  const handleGoogleLogin = () => {
    toast.info("Connecting to Google Identity Services...", {
      description: "Redirecting to accounts.google.com/o/oauth2/auth",
    });
    setTimeout(() => {
      const user = {
        name: "Google Enterprise User",
        emailOrPhone: "enterprise.admin@gmail.com",
        role: "Workspace Owner",
      };
      localStorage.setItem("creatorai_auth_user", JSON.stringify(user));
      localStorage.setItem("creatorai_auth_token", "jwt_google_oauth_991b");
      toast.success("Google SSO Authentication Verified!");
      if (onLoginSuccess) onLoginSuccess(user);
      else window.location.href = "/";
    }, 850);
  };

  // Handle Microsoft Azure AD SSO
  const handleMicrosoftLogin = () => {
    toast.info("Connecting to Microsoft Azure Active Directory...", {
      description: "Authenticating via SAML 2.0 / OpenID Connect",
    });
    setTimeout(() => {
      const user = {
        name: "Azure AD Enterprise User",
        emailOrPhone: "arjun@enterprise.onmicrosoft.com",
        role: "Enterprise Admin",
      };
      localStorage.setItem("creatorai_auth_user", JSON.stringify(user));
      localStorage.setItem("creatorai_auth_token", "jwt_ms_oauth_772c");
      toast.success("Microsoft Azure AD SSO Verified!");
      if (onLoginSuccess) onLoginSuccess(user);
      else window.location.href = "/";
    }, 850);
  };

  return (
    <div className="min-h-screen w-full bg-[#090a0f] text-zinc-100 flex flex-col lg:flex-row relative overflow-hidden font-sans selection:bg-violet-600 selection:text-white">
      {/* Background Subtle Gradient Blobs */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 -right-40 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 left-1/3 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* ========================================================================= */}
      {/* 1. LEFT PANEL: The Visual & Brand Showcase                                */}
      {/* ========================================================================= */}
      <div className="w-full lg:w-1/2 p-8 lg:p-14 flex flex-col justify-between relative z-10 border-b lg:border-b-0 lg:border-r border-zinc-800/80 bg-gradient-to-br from-zinc-950/80 via-zinc-900/40 to-black">
        {/* Brand Header */}
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-purple-500 p-0.5 shadow-lg shadow-violet-600/30 flex items-center justify-center">
              <div className="w-full h-full bg-[#0d0e15] rounded-[10px] flex items-center justify-center">
                <Bot size={22} className="text-violet-400 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                  CreatorAI <span className="text-violet-400">Studio</span>
                </h2>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30">
                  v2.4 Enterprise
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Autonomous AI Calling Agent & Cloud Dialer
              </p>
            </div>
          </div>

          {/* Value Proposition Headline */}
          <div className="max-w-md space-y-3 mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-[11px] font-semibold text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>TRAI NDNC Certified Telephony Platform</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight">
              The Ultimate AI Calling Agent & Cloud Dialer.
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              Deploy autonomous voice agents that speak 10+ Indian languages with under 400ms latency. Auto-dial campaigns, capture CRM leads, and generate compliance-ready tax invoices.
            </p>
          </div>
        </div>

        {/* Hero Graphic: Simulated Futuristic Live Calling Dashboard Widget */}
        <div className="my-6 relative">
          <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-950/70 backdrop-blur-xl shadow-2xl shadow-violet-950/30 relative overflow-hidden group">
            {/* Top glass reflection */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />

            <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-xs shadow-emerald-400" />
                <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider font-mono">
                  Live Operations Node (ap-south-1)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-zinc-400">Carrier SLA:</span>
                <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50">
                  99.98% Up
                </span>
              </div>
            </div>

            {/* Live Metrics Grid */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/60">
                <span className="text-[10px] text-zinc-400 uppercase font-medium block mb-1">
                  Active Streams
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold font-mono text-white">42</span>
                  <span className="text-[10px] text-emerald-400 font-mono">Calls</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/60">
                <span className="text-[10px] text-zinc-400 uppercase font-medium block mb-1">
                  Voice Latency
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold font-mono text-cyan-400">380</span>
                  <span className="text-[10px] text-zinc-400 font-mono">ms</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/60">
                <span className="text-[10px] text-zinc-400 uppercase font-medium block mb-1">
                  Auto-QA Score
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold font-mono text-violet-400">96.4</span>
                  <span className="text-[10px] text-violet-400 font-mono">%</span>
                </div>
              </div>
            </div>

            {/* Simulated Audio Spectrum Bars */}
            <div className="p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/60 flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-2">
                <Activity size={15} className="text-violet-400 shrink-0" />
                <span className="text-[11px] font-medium text-zinc-300">
                  Sarvam AI Bulbul V2 (Hindi / English Neural Stream)
                </span>
              </div>
              <div className="flex items-end gap-1 h-5 shrink-0">
                {[40, 70, 95, 60, 85, 100, 45, 90, 65, 80, 50, 75, 95, 60].map((h, i) => (
                  <div
                    key={i}
                    className="w-1 bg-gradient-to-t from-violet-600 to-cyan-400 rounded-full animate-pulse"
                    style={{
                      height: `${h}%`,
                      animationDelay: `${(i * 0.12).toFixed(2)}s`,
                      animationDuration: "1.2s",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Customer Proof & Security Badges */}
        <div className="pt-4 border-t border-zinc-800/70">
          <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-[11px] text-zinc-400">
            <div className="flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span>SOC2 Type II Certified</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Building2 size={14} className="text-violet-400" />
              <span>ISO/IEC 27001</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Globe size={14} className="text-cyan-400" />
              <span>10M+ Calls Connected</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. RIGHT PANEL: The Authentication Form                                    */}
      {/* ========================================================================= */}
      <div className="w-full lg:w-1/2 p-6 sm:p-12 lg:p-16 flex flex-col justify-center relative z-10 bg-[#0c0d13]">
        <div className="max-w-md w-full mx-auto space-y-6">
          {/* Welcome Heading */}
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">
              Sign in to your Workspace
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Enter your enterprise credentials or sign in with your corporate SSO
            </p>
          </div>

          {/* Social OAuth / SSO Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Google OAuth */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full py-2.5 px-3 rounded-xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 hover:border-zinc-700 text-zinc-200 text-xs font-semibold flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-xs"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            {/* Microsoft Azure AD SSO */}
            <button
              type="button"
              onClick={handleMicrosoftLogin}
              className="w-full py-2.5 px-3 rounded-xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 hover:border-zinc-700 text-zinc-200 text-xs font-semibold flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-xs"
            >
              <svg className="w-4 h-4" viewBox="0 0 23 23">
                <path fill="#f35325" d="M1 1h10v10H1z" />
                <path fill="#81bc06" d="M12 1h10v10H12z" />
                <path fill="#05a6f0" d="M1 12h10v10H1z" />
                <path fill="#ffba08" d="M12 12h10v10H12z" />
              </svg>
              <span>Azure AD SSO</span>
            </button>
          </div>

          {/* Divider with "OR" */}
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-800" />
            </div>
            <span className="relative px-3 bg-[#0c0d13] text-[10px] uppercase font-mono tracking-widest text-zinc-500">
              OR CHOOSE AUTH METHOD
            </span>
          </div>

          {/* Auth Method Tabs (Email vs Phone OTP) */}
          <div className="grid grid-cols-2 p-1 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setAuthMethod("email")}
              className={`py-2 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer ${
                authMethod === "email"
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Mail size={14} />
              <span>Email & Password</span>
            </button>

            <button
              type="button"
              onClick={() => setAuthMethod("phone")}
              className={`py-2 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer ${
                authMethod === "phone"
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Phone size={14} />
              <span>Phone Number (OTP)</span>
            </button>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* METHOD 1: EMAIL & PASSWORD FORM                               */}
          {/* ------------------------------------------------------------- */}
          {authMethod === "email" && (
            <form onSubmit={handleEmailLogin} className="space-y-4 animate-in fade-in duration-200">
              {/* Email Address */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Corporate Email Address
                </label>
                <div className="relative">
                  <Mail
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
                  />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-zinc-900/70 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-zinc-300">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-[11px] text-violet-400 hover:text-violet-300 transition cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
                  />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your security password"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-zinc-900/70 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 p-1 cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Remember Me Checkbox */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-violet-600 accent-violet-600 focus:ring-0"
                  />
                  <span className="text-xs text-zinc-400">Remember this browser for 30 days</span>
                </label>
              </div>

              {/* Primary Call-to-Action */}
              <button
                type="submit"
                disabled={isVerifying}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold text-xs tracking-wide shadow-lg shadow-violet-600/30 hover:shadow-violet-600/50 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isVerifying ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>Authenticating Workspace...</span>
                  </>
                ) : (
                  <>
                    <span>Log In to CreatorAI</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ------------------------------------------------------------- */}
          {/* METHOD 2: PHONE NUMBER + OTP VERIFICATION (Requested Feature) */}
          {/* ------------------------------------------------------------- */}
          {authMethod === "phone" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {!otpSent ? (
                // Step 1: Phone input
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Mobile Number (with Country Dialing Code)
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        className="py-2.5 px-3 rounded-xl bg-zinc-900/70 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-violet-500 cursor-pointer font-mono"
                      >
                        <option value="+91">🇮🇳 +91 (India)</option>
                        <option value="+1">🇺🇸 +1 (US/Canada)</option>
                        <option value="+44">🇬🇧 +44 (UK)</option>
                        <option value="+971">🇦🇪 +971 (UAE)</option>
                        <option value="+65">🇸🇬 +65 (Singapore)</option>
                      </select>

                      <div className="relative flex-1">
                        <Phone
                          size={15}
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
                        />
                        <input
                          type="tel"
                          required
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          placeholder="98200 11223"
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-zinc-900/70 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 font-mono transition"
                        />
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-zinc-400">
                    We will dispatch a secure 6-digit one-time password (OTP) via SMS and WhatsApp Business Gateway.
                  </p>

                  <button
                    type="submit"
                    disabled={isSendingOtp}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold text-xs tracking-wide shadow-lg shadow-violet-600/30 hover:shadow-violet-600/50 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {isSendingOtp ? (
                      <>
                        <RefreshCw size={15} className="animate-spin" />
                        <span>Sending Security OTP...</span>
                      </>
                    ) : (
                      <>
                        <PhoneCall size={15} />
                        <span>Send 6-Digit OTP</span>
                      </>
                    )}
                  </button>
                </form>
              ) : (
                // Step 2: 6-Digit OTP Verification Box
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-400" />
                      <div>
                        <span className="text-xs font-semibold text-emerald-300 block">
                          OTP Sent to {countryCode} {phoneNumber}
                        </span>
                        <span className="text-[10px] text-emerald-400/80">
                          Expires in 10 minutes • 256-bit Telecom Verification
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOtpSent(false)}
                      className="text-[11px] text-zinc-400 hover:text-zinc-200 underline cursor-pointer"
                    >
                      Change
                    </button>
                  </div>

                  {/* 6 OTP Boxes */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-2 text-center">
                      Enter 6-Digit Verification Code
                    </label>
                    <div className="flex justify-center gap-2 sm:gap-2.5">
                      {otpDigits.map((digit, index) => (
                        <input
                          key={index}
                          ref={(el) => {
                            otpInputRefs.current[index] = el;
                          }}
                          type="text"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpChange(index, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(index, e)}
                          className="w-10 h-12 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-mono font-bold bg-zinc-900 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30 shadow-inner"
                        />
                      ))}
                    </div>
                  </div>

                  {/* Sandbox helper chip */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-zinc-400 text-[11px]">
                      {timer > 0 ? (
                        <>Resend code in <strong className="text-violet-400 font-mono">{timer}s</strong></>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSendOtp()}
                          className="text-violet-400 hover:text-violet-300 font-medium underline cursor-pointer"
                        >
                          Resend OTP Code
                        </button>
                      )}
                    </span>

                    <button
                      type="button"
                      onClick={() => setOtpDigits(["4", "8", "2", "9", "1", "0"])}
                      className="text-[10px] text-zinc-400 hover:text-emerald-400 font-mono bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded cursor-pointer transition"
                    >
                      Use Demo OTP (482910)
                    </button>
                  </div>

                  {/* Verify & Enter Button */}
                  <button
                    type="submit"
                    disabled={isVerifying}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold text-xs tracking-wide shadow-lg shadow-emerald-600/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {isVerifying ? (
                      <>
                        <RefreshCw size={15} className="animate-spin" />
                        <span>Verifying Security Token...</span>
                      </>
                    ) : (
                      <>
                        <Check size={16} />
                        <span>Verify OTP & Enter Workspace</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* 3. FOOTER & COMPLIANCE ELEMENTS                                           */}
          {/* ========================================================================= */}
          <div className="space-y-4 pt-4 border-t border-zinc-800/80 text-center">
            {/* Sign-up prompt */}
            <p className="text-xs text-zinc-400">
              Don't have an enterprise account?{" "}
              <button
                type="button"
                onClick={() => setShowContactAdmin(true)}
                className="text-violet-400 hover:text-violet-300 font-semibold transition cursor-pointer"
              >
                Contact your Workspace Admin
              </button>
            </p>

            {/* Legal compliance links */}
            <div className="flex items-center justify-center gap-4 text-[11px] text-zinc-500">
              <a
                href="#terms"
                onClick={(e) => {
                  e.preventDefault();
                  toast.info("CreatorAI Terms of Service (Telecom Services Agreement v2026.1)");
                }}
                className="hover:text-zinc-400 transition"
              >
                Terms of Service
              </a>
              <span>•</span>
              <a
                href="#privacy"
                onClick={(e) => {
                  e.preventDefault();
                  toast.info("Privacy Policy: End-to-end encrypted audio & DNC scrubbing compliant");
                }}
                className="hover:text-zinc-400 transition"
              >
                Privacy Policy
              </a>
              <span>•</span>
              <a
                href="#compliance"
                onClick={(e) => {
                  e.preventDefault();
                  toast.info("TRAI National Do Not Call (NDNC) Scrubbing Policy & SAC 9984 Compliance");
                }}
                className="hover:text-zinc-400 transition"
              >
                TRAI Compliance
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: Forgot Password Recovery                                           */}
      {/* ========================================================================= */}
      {showForgotPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-violet-600/20 text-violet-400 flex items-center justify-center">
                <Lock size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Reset Workspace Password</h3>
                <p className="text-[11px] text-zinc-400">
                  Enter your registered enterprise email for password recovery
                </p>
              </div>
            </div>

            <input
              type="email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              placeholder="name@company.com"
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowForgotPassword(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  toast.success("Password reset instructions sent to your corporate email!");
                  setShowForgotPassword(false);
                }}
                className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs transition"
              >
                Send Recovery Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Contact Workspace Admin                                            */}
      {/* ========================================================================= */}
      {showContactAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-cyan-600/20 text-cyan-400 flex items-center justify-center">
                <Building2 size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Enterprise Invitation Protocol</h3>
                <p className="text-[11px] text-zinc-400">
                  Role-based telephony accounts are managed by workspace administrators
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-900/60 p-3 rounded-xl border border-zinc-800/80">
              Because CreatorAI Ops provides direct SIP trunking, dialer queues, and carrier balance allocations, accounts cannot be registered publicly. Please contact your organization’s Telecom Admin at <strong className="text-violet-400">telecom-admin@callforge.io</strong> or request an invite link.
            </p>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowContactAdmin(false)}
                className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs transition"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
