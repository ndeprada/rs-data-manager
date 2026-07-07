import { query } from '../../_lib/db.js';
import { signToken, setAuthCookie } from '../../_lib/auth.js';

function getBaseUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

export default async function handler(req, res) {
  const { code, error } = req.query;
  const baseUrl = getBaseUrl(req);

  if (error || !code) {
    res.writeHead(302, { Location: `${baseUrl}/?auth_error=google` });
    res.end();
    return;
  }

  try {
    const redirectUri = `${baseUrl}/api/auth/google/callback`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      console.error('Google token exchange failed', tokenData);
      res.writeHead(302, { Location: `${baseUrl}/?auth_error=google` });
      res.end();
      return;
    }

    const profileRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();
    const { sub: googleId, email, name } = profile;

    if (!email) {
      res.writeHead(302, { Location: `${baseUrl}/?auth_error=google` });
      res.end();
      return;
    }

    // ¿Ya existe por google_id o por email?
    const { rows: existing } = await query(
      `select id from auth_users where google_id = $1 or email = $2`,
      [googleId, email.toLowerCase().trim()]
    );

    let userId;
    if (existing[0]) {
      userId = existing[0].id;
      await query(`update auth_users set google_id = $2 where id = $1`, [userId, googleId]);
    } else {
      const { rows: countRows } = await query(
        `select count(*)::int as n from entities where entity_type = 'User'`
      );
      const isFirstUser = countRows[0].n === 0;

      const { rows: authRows } = await query(
        `insert into auth_users (email, google_id, provider, password_hash)
         values ($1, $2, 'google', null) returning id`,
        [email.toLowerCase().trim(), googleId]
      );
      userId = authRows[0].id;

      const profileData = {
        full_name: name || '',
        role: isFirstUser ? 'admin' : 'user',
        app_role: isFirstUser ? 'coordinador_general' : undefined,
        access_status: isFirstUser ? 'approved' : 'pending',
      };
      Object.keys(profileData).forEach((k) => profileData[k] === undefined && delete profileData[k]);

      await query(`insert into entities (id, entity_type, data) values ($1, 'User', $2::jsonb)`, [
        userId,
        JSON.stringify(profileData),
      ]);
    }

    const token = signToken(userId);
    setAuthCookie(res, token);
    res.writeHead(302, { Location: `${baseUrl}/` });
    res.end();
  } catch (err) {
    console.error(err);
    res.writeHead(302, { Location: `${baseUrl}/?auth_error=google` });
    res.end();
  }
}
