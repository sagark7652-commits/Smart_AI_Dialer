import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "smart-ai-dialer-secret-key-2026";
const otpStore = globalThis.__emailOtpStore || (globalThis.__emailOtpStore = new Map());
const userCredStore = globalThis.__userCredStore || (globalThis.__userCredStore = new Map());

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed. Use POST." });

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  const { email, otp } = body || {};
  if (!email || !otp) {
    return res.status(400).json({ error: "Email and OTP are required." });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const enteredOtp = String(otp).trim();

  let isValid = false;
  let userName = "";

  // 1. Check in-memory store
  const record = otpStore.get(normalizedEmail);
  if (record && Date.now() <= record.expiresAt && record.code === enteredOtp) {
    isValid = true;
    userName = record.name || "";
    otpStore.delete(normalizedEmail);
  }

  // 2. Check signed cookie fallback
  if (!isValid && req.headers.cookie) {
    const cookies = req.headers.cookie.split(";").reduce((acc, c) => {
      const [k, v] = c.trim().split("=");
      if (k && v) acc[k] = v;
      return acc;
    }, {});

    const cookieToken = cookies["__dialer_otp"];
    if (cookieToken && cookieToken.includes(".")) {
      const [b64Payload, sig] = cookieToken.split(".");
      try {
        const payload = Buffer.from(b64Payload, "base64").toString("utf8");
        const expectedSig = crypto.createHmac("sha256", JWT_SECRET).update(payload).digest("hex");
        if (expectedSig === sig) {
          const [cEmail, cCode, cExpiresAt] = payload.split(":");
          if (cEmail === normalizedEmail && cCode === enteredOtp && Date.now() <= Number(cExpiresAt)) {
            isValid = true;
          }
        }
      } catch (e) {
        console.warn("[Cookie Verify Error]:", e);
      }
    }
  }

  if (!isValid) {
    return res.status(400).json({
      success: false,
      error: "Invalid OTP code or it has expired. Please check your email and try again.",
    });
  }

  const cred = userCredStore.get(normalizedEmail);
  const derivedName =
    userName ||
    cred?.name ||
    normalizedEmail.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  // Clear OTP cookie
  res.setHeader("Set-Cookie", `__dialer_otp=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);

  return res.status(200).json({
    success: true,
    message: "Email verification successful.",
    user: {
      email: normalizedEmail,
      name: derivedName,
      role: "Enterprise Admin",
    },
  });
}
