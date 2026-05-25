// utils/otp.js — OTP generation and SMS delivery via ThaiBulkSMS API v2
//
// Flow:
//   1. generateOTP()  — creates a 6-digit code
//   2. sendOTP()      — embeds it in the message template and POSTs to ThaiBulkSMS
//
// Dev mode: always logs the OTP to the console.
//           If THAIBULKSMS_API_KEY is missing, skips the real API call (console-only).
// Prod mode: requires THAIBULKSMS_API_KEY + THAIBULKSMS_API_SECRET in .env.

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Convert Thai mobile format (0XXXXXXXXX) → E.164 (66XXXXXXXXX)
const toE164 = (phone) => {
  if (phone.startsWith('0')) return '66' + phone.slice(1);
  if (phone.startsWith('+')) return phone.slice(1); // strip leading +
  return phone;
};

const sendOTP = async (phone, otp) => {
  const isDev = process.env.NODE_ENV !== 'production';
  const expireMinutes = parseInt(process.env.OTP_EXPIRE_MINUTES) || 5;

  // Always log in development so testing never requires real SMS credits
  if (isDev) {
    console.log('\n========================================');
    console.log(`  OTP for ${phone}: ${otp}`);
    console.log('========================================\n');
  }

  const apiKey    = process.env.THAIBULKSMS_API_KEY;
  const apiSecret = process.env.THAIBULKSMS_API_SECRET;

  // Skip real API call if credentials are not configured (local dev without SMS)
  if (!apiKey || !apiSecret) {
    if (!isDev) {
      throw new Error('THAIBULKSMS_API_KEY and THAIBULKSMS_API_SECRET must be set in production');
    }
    return true; // dev-only: console log is enough
  }

  // ── Build SMS message ────────────────────────────────────────────────────────
  const senderName = process.env.THAIBULKSMS_SENDER || 'Demo';
  const message = [
    process.env.APP_NAME || 'B-Space Tennis Club',
    `Your OTP Code is ${otp}`,
    `Valid for ${expireMinutes} minutes`,
  ].join('\n');

  // ── POST to ThaiBulkSMS API v2 ───────────────────────────────────────────────
  const msisdn      = toE164(phone);
  const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');

  const body = new URLSearchParams({
    msisdn,
    sender:  senderName,
    message,
    force:   'standard', // 'standard' | 'corporate'
  });

  let response;
  try {
    response = await fetch('https://api-v2.thaibulksms.com/sms', {
      method:  'POST',
      headers: {
        Authorization:  `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept:         'application/json',
      },
      body: body.toString(),
    });
  } catch (networkErr) {
    // Network-level failure (DNS, timeout, etc.)
    console.error('ThaiBulkSMS network error:', networkErr.message);
    throw new Error('SMS service unavailable — please try again');
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    console.error(`ThaiBulkSMS API error: HTTP ${response.status}`, errorBody);

    // Map known HTTP status codes to user-friendly messages
    if (response.status === 401) throw new Error('SMS service authentication failed — check API credentials');
    if (response.status === 402) throw new Error('SMS credit exhausted — please top up the ThaiBulkSMS account');
    if (response.status === 429) throw new Error('SMS rate limit hit — please wait a moment and try again');
    throw new Error(`SMS sending failed (HTTP ${response.status})`);
  }

  const result = await response.json().catch(() => ({}));
  if (isDev) {
    console.log('ThaiBulkSMS response:', JSON.stringify(result));
  }

  return true;
};

module.exports = { generateOTP, sendOTP };
