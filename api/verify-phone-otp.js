export default async function handler(req, res) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Credentials", true);
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

  const { phone, countryCode, otp, expectedOtp } = body || {};
  if (!phone || !otp) {
    return res.status(400).json({ error: "Phone number and OTP code are required." });
  }

  const cleanPhone = String(phone).replace(/\D/g, "");
  const dialCode = (countryCode || "+91").replace(/\+/g, "");
  const fullPhone = `${dialCode}${cleanPhone}`;
  const trimmedOtp = String(otp).trim();

  // 1. Verify with OTP.dev Gateway
  const otpDevKey = (process.env.OTP_DEV_KEY || "b76ad11ef66e89dc6482b7078ac1bce3").trim();
  if (otpDevKey) {
    try {
      const oRes = await fetch(`https://api.otp.dev/v1/verifications?phone=${fullPhone}&code=${trimmedOtp}`, {
        method: "GET",
        headers: {
          "X-OTP-Key": otpDevKey,
          accept: "application/json",
        },
      });
      const oJson = await oRes.json().catch(() => null);
      if (oRes.ok && oJson?.data && Array.isArray(oJson.data) && oJson.data.length > 0) {
        return res.status(200).json({
          success: true,
          verifiedBy: "OTP.dev Verified SMS",
          phone: fullPhone,
        });
      }
    } catch (err) {
      console.error("[OTP.dev Verification Error]:", err);
    }
  }

  // 2. Verify with expected internal OTP (for cellular SIM routes like Fast2SMS/Twilio)
  if (expectedOtp && trimmedOtp === String(expectedOtp).trim()) {
    return res.status(200).json({
      success: true,
      verifiedBy: "Cellular SMS Verified",
      phone: fullPhone,
    });
  }

  return res.status(400).json({
    success: false,
    error: "Invalid OTP code. Please enter the correct code received on your phone.",
  });
}
