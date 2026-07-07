import { getCurrentUser } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const user = await getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'auth_required' });
      return;
    }
    res.status(200).json(user);
    return;
  }

  res.status(405).json({ error: 'method_not_allowed' });
}
