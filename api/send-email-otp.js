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

  const { email, otp } = req.body || {};
  if (!email || !otp) {
    return res.status(400).json({ error: "Both email and OTP code are required." });
  }

  const senderUser = process.env.GMAIL_USER || "sagarkarale@gmail.com";
  const appPassword = (process.env.GMAIL_APP_PASSWORD || "cizalcdhzohpkrxg").replace(/\s+/g, "");

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: senderUser,
        pass: appPassword,
      },
    });

    await transporter.sendMail({
      from: `"Smart AI Dialer" <${senderUser}>`,
      to: email.trim(),
      subject: `Your Login Verification Code: ${otp}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 28px; background: #0c0d12; border-radius: 16px; color: #ffffff; border: 1px solid #27272a;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; padding: 10px 16px; background: #18181b; border-radius: 12px; border: 1px solid #3f3f46;">
              <h2 style="color: #a78bfa; margin: 0; font-size: 18px; font-weight: 700; letter-spacing: 0.5px;">Smart AI Dialer</h2>
            </div>
          </div>
          
          <h3 style="color: #f4f4f5; font-size: 16px; margin: 0 0 12px 0;">Sign in to your account</h3>
          <p style="color: #a1a1aa; font-size: 13px; line-height: 1.6; margin: 0 0 20px 0;">
            We received a request to verify your account. Use the one-time code below to complete your sign-in:
          </p>

          <div style="text-align: center; margin: 28px 0;">
            <div style="display: inline-block; font-family: monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #38bdf8; background: #1e1b4b; padding: 16px 32px; border-radius: 12px; border: 1px solid #4338ca; box-shadow: 0 4px 20px rgba(67, 56, 202, 0.25);">
              ${otp}
            </div>
          </div>

          <p style="color: #a1a1aa; font-size: 12px; line-height: 1.6; margin: 0 0 8px 0;">
            ⏱ This code is valid for <strong>10 minutes</strong>.
          </p>
          <p style="color: #71717a; font-size: 11px; line-height: 1.6; margin: 0 0 24px 0;">
            If you did not request this verification code, you can safely ignore this email.
          </p>

          <hr style="border: none; border-top: 1px solid #27272a; margin: 24px 0;" />
          <p style="color: #52525b; font-size: 10px; text-align: center; margin: 0;">
            Smart AI Dialer Security System &bull; Enterprise Voice AI Platform
          </p>
        </div>
      `,
    });

    console.log(`[SMTP Mailer] Real OTP email successfully sent to ${email}`);
    return res.status(200).json({
      success: true,
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
