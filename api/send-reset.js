export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const BREVO_KEY  = process.env.BREVO_API_KEY;
  const SUPA_URL   = process.env.SUPA_URL;
  const SUPA_KEY   = process.env.SUPA_SERVICE_KEY; // service role key — set in Vercel env vars
  const SITE_URL   = process.env.SITE_URL || 'https://blackridgecapital.vercel.app';
  const FROM_EMAIL = process.env.BREVO_SENDER || 'noreply@blackridgecapital.com';

  try {
    // Step 1: Generate reset link via Supabase Admin API
    const genRes = await fetch(`${SUPA_URL}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPA_KEY,
        'Authorization': `Bearer ${SUPA_KEY}`
      },
      body: JSON.stringify({
        type: 'recovery',
        email: email,
        options: { redirectTo: SITE_URL }
      })
    });

    if (!genRes.ok) {
      const err = await genRes.json();
      return res.status(500).json({ error: err.message || 'Failed to generate reset link' });
    }

    const genData = await genRes.json();
    const resetLink = genData.action_link || genData.link;

    if (!resetLink) {
      return res.status(500).json({ error: 'No reset link returned' });
    }

    // Step 2: Send branded email via Brevo
    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': BREVO_KEY
      },
      body: JSON.stringify({
        sender: { name: 'Black Ridge Capital', email: FROM_EMAIL },
        to: [{ email }],
        subject: 'Reset Your Black Ridge Capital Password',
        htmlContent: `
          <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:560px;margin:0 auto;background:#0D1E35;color:#fff;border-radius:12px;overflow:hidden;">
            <div style="background:linear-gradient(135deg,#0B2340,#0D1E35);padding:32px 36px;border-bottom:1px solid rgba(212,169,75,.3);">
              <div style="font-size:1.5rem;font-weight:700;color:#D4A94B;letter-spacing:.04em;">BLACK RIDGE CAPITAL</div>
            </div>
            <div style="padding:36px;">
              <h2 style="margin:0 0 12px;font-size:1.4rem;color:#fff;">Password Reset Request</h2>
              <p style="color:#aab4c4;line-height:1.7;margin:0 0 24px;">We received a request to reset the password for your Black Ridge Capital account. Click the button below to set a new password.</p>
              <a href="${resetLink}" style="display:inline-block;background:linear-gradient(135deg,#D4A94B,#B8922E);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:1rem;margin-bottom:24px;">Reset My Password</a>
              <p style="color:#6b7a8d;font-size:.82rem;line-height:1.7;margin:0;">This link expires in <strong style="color:#aab4c4;">1 hour</strong>. If you didn't request a password reset, you can safely ignore this email — your account remains secure.</p>
            </div>
            <div style="padding:20px 36px;border-top:1px solid rgba(255,255,255,.06);text-align:center;">
              <p style="color:#4a5568;font-size:.75rem;margin:0;">© Black Ridge Capital. All rights reserved.</p>
            </div>
          </div>
        `
      })
    });

    if (!brevoRes.ok) {
      const brevoErr = await brevoRes.json();
      return res.status(500).json({ error: brevoErr.message || 'Failed to send email' });
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
