import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
export const issueToken = (userId) => {
  const jti = crypto.randomUUID();
  const token = jwt.sign({ sub: userId, jti, scope: 'dashboard' }, process.env.JWT_SECRET, { expiresIn: '12h' });
  return { token, jti, expiresAt: new Date(Date.now() + 12 * 3600_000).toISOString() };
};
export const verifyToken = (token) => jwt.verify(token, process.env.JWT_SECRET);
export const auth = (db) => (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) throw new Error('Missing token');
    const claims = verifyToken(token);
    const session = db.prepare('SELECT id FROM sessions WHERE token_jti=? AND expires_at>?').get(claims.jti, new Date().toISOString());
    if (!session) throw new Error('Expired session');
    req.user = { id: claims.sub, jti: claims.jti }; next();
  } catch { res.status(401).json({ error: 'Authentication required' }); }
};
