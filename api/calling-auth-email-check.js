import nodemailer from "nodemailer";
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

  const { email, password, name, isReset } = body || {};
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({ error: "Please enter a valid corporate email address." });
  }
  if (!password || typeof password !== "string" || password.trim().length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters long." });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const enteredPassword = password.trim();
  const trimmedName = typeof name === "string" && name.trim().length > 0 ? name.trim() : "";

  // Check existing credentials if already stored in this session
  const existing = userCredStore.get(normalizedEmail);
  if (existing && !isReset) {
    if (existing.password !== enteredPassword) {
      return res.status(401).json({
        success: false,
        error: "Incorrect password! The password you entered does not match this email account.",
      });
    }
    userCredStore.set(normalizedEmail, {
      password: enteredPassword,
      name: trimmedName || existing.name,
    });
  } else {
    userCredStore.set(normalizedEmail, {
      password: enteredPassword,
      name: trimmedName || existing?.name || "",
    });
  }

  // Generate 6-digit OTP code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  // Store in memory
  otpStore.set(normalizedEmail, {
    code,
    expiresAt,
    name: trimmedName,
  });

  // Also compute HMAC signature for stateless cookie fallback
  const hmacPayload = `${normalizedEmail}:${code}:${expiresAt}`;
  const hmacSig = crypto.createHmac("sha256", JWT_SECRET).update(hmacPayload).digest("hex");
  const token = `${Buffer.from(hmacPayload).toString("base64")}.${hmacSig}`;

  // Send real email via Gmail SMTP
  const senderUser = process.env.GMAIL_USER || "tatadialer7@gmail.com";
  const appPassword = (process.env.GMAIL_APP_PASSWORD || "weyfveenhgunvyrb").replace(/\s+/g, "");
  const senderDisplayName = process.env.SMTP_FROM_NAME || "Smart AI Dialer";
  const fromAddress = `"${senderDisplayName}" <${senderUser}>`;

  let sentReal = false;
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: senderUser,
        pass: appPassword,
      },
    });

    await transporter.sendMail({
      from: fromAddress,
      to: normalizedEmail,
      replyTo: "tatadialer7@gmail.com",
      subject: `[Smart AI Dialer] Your Login Verification Code: ${code}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 28px; background: #0c0d12; border-radius: 16px; color: #ffffff; border: 1px solid #27272a;">
          <h2 style="color: #a78bfa; margin: 0 0 16px 0; font-size: 20px;">Smart AI Dialer</h2>
          <p style="color: #d4d4d8; font-size: 14px; line-height: 1.6;">Hello,</p>
          <p style="color: #a1a1aa; font-size: 13px; line-height: 1.6;">Your workspace password was verified for <strong>${normalizedEmail}</strong>. Your 6-digit login verification OTP is:</p>
          <div style="text-align: center; margin: 24px 0;">
            <span style="font-family: monospace; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #38bdf8; background: #1e1b4b; padding: 12px 28px; border-radius: 10px; border: 1px solid #4338ca; display: inline-block;">
              ${code}
            </span>
          </div>
          <p style="color: #71717a; font-size: 12px;">This code is valid for 10 minutes. Please enter it to complete your login.</p>
        </div>
      `,
    });
    sentReal = true;
    console.log(`[SMTP Mailer] Real OTP email sent to ${normalizedEmail}`);
  } catch (err) {
    console.error("[SMTP Mailer Error]:", err);
  }

  // Set stateless OTP cookie so verification works across serverless lambdas
  res.setHeader("Set-Cookie", `__dialer_otp=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`);

  return res.status(200).json({
    success: true,
    message: sentReal
      ? `Password verified! Security OTP sent to your email inbox: ${normalizedEmail}`
      : `Password verified! Security OTP generated for ${normalizedEmail}.`,
    email: normalizedEmail,
    sentReal,
  });
}
