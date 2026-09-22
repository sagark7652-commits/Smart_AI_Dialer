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

  const { phone, countryCode, otp } = body || {};
  if (!phone || !otp) {
    return res.status(400).json({ error: "Phone number and OTP code are required." });
  }

  const cleanPhone = String(phone).replace(/\D/g, "");
  let liveDispatched = false;
  let provider = "None";

  // 1. Fast2SMS (India Direct SIM Cellular Dispatch - No DLT needed for OTP route)
  const fast2smsKey = (process.env.FAST2SMS_API_KEY || "").trim();
  if (fast2smsKey) {
    try {
      const fRes = await fetch("https://www.fast2sms.com/dev/bulkV2", {
        method: "POST",
        headers: {
          authorization: fast2smsKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          route: "otp",
          variables_values: String(otp),
          numbers: cleanPhone,
        }),
      });
      const fJson = await fRes.json();
      console.log("[Fast2SMS Delivery Response]:", fJson);
      if (fJson && (fJson.return === true || fJson.status_code === 200)) {
        liveDispatched = true;
        provider = "Fast2SMS India Cellular Gateway";
      }
    } catch (err) {
      console.error("[Fast2SMS Error]:", err);
    }
  }

  // 2. Twilio Global SMS Gateway
  if (!liveDispatched && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
    try {
      const auth = "Basic " + Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
      const bodyParams = new URLSearchParams();
      bodyParams.append("To", `${countryCode || "+91"}${cleanPhone}`);
      bodyParams.append("From", process.env.TWILIO_PHONE_NUMBER);
      bodyParams.append("Body", `Your Smart AI Dialer login verification code is ${otp}. Valid for 10 minutes.`);

      const twRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: auth,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: bodyParams.toString(),
        }
      );
      const twJson = await twRes.json();
      if (twJson && twJson.sid) {
        liveDispatched = true;
        provider = "Twilio Global Carrier";
      }
    } catch (err) {
      console.error("[Twilio Error]:", err);
    }
  }

  return res.status(200).json({
    success: true,
    liveDispatched,
    provider,
    otp,
    phone: cleanPhone,
    message: liveDispatched
      ? `Real SMS dispatched via ${provider} to ${cleanPhone}.`
      : `SMS gateway key not configured in Vercel. For testing, your verification code is: ${otp}`,
  });
}
