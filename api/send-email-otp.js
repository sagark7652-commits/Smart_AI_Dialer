import nodemailer from "nodemailer";

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

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
    return res.status(400).json({ error: "Both email and OTP code are required." });
  }

let cachedOtpTransporter = null;
function getOtpTransporter(user, pass) {
  if (!cachedOtpTransporter) {
    cachedOtpTransporter = nodemailer.createTransport({
      pool: true,
      maxConnections: 3,
      maxMessages: 100,
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }
  return cachedOtpTransporter;
}

  const senderUser = process.env.GMAIL_USER || "tatadialer7@gmail.com";
  const appPassword = (process.env.GMAIL_APP_PASSWORD || "weyfveenhgunvyrb").replace(/\s+/g, "");
  const senderDisplayName = process.env.SMTP_FROM_NAME || "Smart AI Dialer";
  const fromAddress = `"${senderDisplayName}" <${senderUser}>`;

  try {
    const transporter = getOtpTransporter(senderUser, appPassword);

    const mailPromise = transporter.sendMail({
      from: fromAddress,
      to: email.trim(),
      replyTo: "tatadialer7@gmail.com",
      subject: `[Smart AI Dialer] Login Verification Code: ${otp}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #0c0d12; border-radius: 16px; color: #ffffff; border: 1px solid #27272a;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; padding: 8px 18px; background: #1e1b4b; border-radius: 9999px; border: 1px solid #4338ca;">
              <span style="color: #a78bfa; font-size: 13px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;">
                Smart AI Dialer &bull; Security
              </span>
            </div>
            <h2 style="color: #ffffff; font-size: 22px; font-weight: 700; margin: 16px 0 6px 0;">
              Account Verification
            </h2>
            <p style="color: #a1a1aa; font-size: 13px; margin: 0;">
              Two-Factor Authentication for <strong>${email.trim()}</strong>
            </p>
          </div>
          
          <div style="background: #18181b; border-radius: 12px; padding: 20px; border: 1px solid #27272a; margin: 20px 0;">
            <p style="color: #d4d4d8; font-size: 13px; line-height: 1.6; margin: 0 0 16px 0; text-align: center;">
              Enter this 6-digit one-time password (OTP) to authenticate your session:
            </p>

            <div style="text-align: center; margin: 16px 0;">
              <div style="display: inline-block; font-family: 'SF Mono', Consolas, Monaco, monospace; font-size: 34px; font-weight: 800; letter-spacing: 10px; color: #38bdf8; background: #090a0f; padding: 14px 28px; border-radius: 10px; border: 1px solid #38bdf8; box-shadow: 0 0 24px rgba(56, 189, 248, 0.2);">
                ${otp}
              </div>
            </div>

            <p style="color: #a1a1aa; font-size: 11px; text-align: center; margin: 12px 0 0 0;">
              ⏱ Valid for <strong>10 minutes</strong>. Never share this code with anyone.
            </p>
          </div>

          <p style="color: #71717a; font-size: 11px; line-height: 1.5; margin: 16px 0 0 0; text-align: center;">
            If you did not attempt to sign in to Smart AI Dialer, please ignore this email or contact support.
          </p>

          <hr style="border: none; border-top: 1px solid #27272a; margin: 24px 0 16px 0;" />
          <div style="text-align: center; color: #52525b; font-size: 11px; line-height: 1.6;">
            <strong>Smart AI Dialer Enterprise Platform</strong><br />
            Secure Cloud Telephony &bull; AI Agent Voice Automation
          </div>
        </div>
      `,
    }).then(() => {
      console.log(`[SMTP Mailer] Real OTP email from '${fromAddress}' successfully sent to ${email}`);
    }).catch((err) => {
      console.error("[SMTP Mailer Error]:", err);
    });

    // Wait at most 800ms so user receives fast response
    await Promise.race([mailPromise, new Promise((resolve) => setTimeout(resolve, 800))]);

    return res.status(200).json({
      success: true,
      sender: senderDisplayName,
      message: `Real verification OTP email dispatched to ${email}.`,
      recipient: email,
    });
  } catch (error) {
    console.error("[SMTP Mailer Error]:", error);
    return res.status(500).json({
      error: error.message || "Failed to send email via SMTP.",
      details: error.toString(),
    });
  }
}
