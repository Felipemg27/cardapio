import { Router } from 'express';
import { randomUUID } from 'crypto';
import { readJson, writeJson, paths } from '../store.js';
import type { User } from '../types.js';

const router = Router();

function loadUsers(): User[] {
  return readJson<User[]>(paths.USERS_FILE, []);
}
function saveUsers(users: User[]) {
  writeJson(paths.USERS_FILE, users);
}

// decodifica payload JWT sem verificar assinatura (verificação real via tokeninfo)
function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(b64, 'base64').toString('utf-8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function verifyGoogleToken(idToken: string): Promise<{ sub: string; name: string; email: string; picture?: string } | null> {
  // 1) tenta verificar via Google tokeninfo (requer internet + token real)
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (res.ok) {
      const data: any = await res.json();
      // valida audience se GOOGLE_CLIENT_ID configurado
      const expected = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
      if (expected && data.aud !== expected) {
        console.warn('[auth] aud mismatch', data.aud, expected);
        return null;
      }
      if (!data.sub || !data.email) return null;
      return { sub: data.sub, name: data.name || data.email, email: data.email, picture: data.picture };
    }
  } catch (e) {
    console.warn('[auth] tokeninfo falhou, fallback decode', e);
  }
  // 2) fallback: decode sem verificação (útil em dev/demo; NÃO usar em produção sem tokeninfo)
  const payload = decodeJwtPayload(idToken);
  if (payload && payload.sub && payload.email) {
    // se GOOGLE_CLIENT_ID definido, valida aud mesmo no fallback
    const expected = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
    if (expected && payload.aud && payload.aud !== expected) return null;
    // valida exp
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return { sub: payload.sub, name: payload.name || payload.email, email: payload.email, picture: payload.picture };
  }
  return null;
}

// POST /api/auth/google { id_token: string }
router.post('/google', async (req, res) => {
  const { id_token, credential } = req.body as { id_token?: string; credential?: string };
  const token = id_token || credential;
  if (!token) return res.status(400).json({ erro: 'id_token obrigatório' });

  const googleUser = await verifyGoogleToken(token);
  if (!googleUser) return res.status(401).json({ erro: 'Token Google inválido ou expirado' });

  const users = loadUsers();
  let user = users.find((u) => u.googleId === googleUser.sub || u.email === googleUser.email);

  if (!user) {
    user = {
      id: randomUUID(),
      googleId: googleUser.sub,
      nome: googleUser.name,
      email: googleUser.email,
      avatar: googleUser.picture,
      provider: 'google',
      criadoEm: new Date().toISOString(),
    };
    users.push(user);
    saveUsers(users);
  } else {
    // atualiza dados
    let changed = false;
    if (googleUser.name && user.nome !== googleUser.name) { user.nome = googleUser.name; changed = true; }
    if (googleUser.picture && user.avatar !== googleUser.picture) { user.avatar = googleUser.picture; changed = true; }
    if (!user.googleId) { user.googleId = googleUser.sub; changed = true; }
    if (changed) saveUsers(users);
  }

  // gera token simples (base64 do user id + timestamp) — em prod usar JWT assinado
  const appToken = Buffer.from(JSON.stringify({ uid: user.id, email: user.email, ts: Date.now() })).toString('base64url');

  res.json({ user, token: appToken });
});

// POST /api/auth/demo — login demo sem Google (útil quando sem Client ID)
router.post('/demo', (req, res) => {
  const { nome, email } = req.body as { nome?: string; email?: string };
  if (!nome?.trim() || !email?.trim()) return res.status(400).json({ erro: 'nome e email obrigatórios' });
  const users = loadUsers();
  let user = users.find((u) => u.email === email);
  if (!user) {
    user = {
      id: randomUUID(),
      nome: nome.trim(),
      email: email.trim().toLowerCase(),
      provider: 'demo',
      criadoEm: new Date().toISOString(),
    };
    users.push(user);
    saveUsers(users);
  }
  const appToken = Buffer.from(JSON.stringify({ uid: user.id, email: user.email, ts: Date.now() })).toString('base64url');
  res.json({ user, token: appToken });
});

// GET /api/auth/me — valida token simples
router.get('/me', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ erro: 'Token não enviado' });
  const token = auth.slice(7);
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64url').toString('utf-8'));
    const users = loadUsers();
    const user = users.find((u) => u.id === payload.uid);
    if (!user) return res.status(401).json({ erro: 'Usuário não encontrado' });
    res.json({ user });
  } catch {
    res.status(401).json({ erro: 'Token inválido' });
  }
});

// GET /api/auth/users — lista usuários (apenas dev)
router.get('/users', (_req, res) => {
  const users = loadUsers();
  res.json(users);
});

export default router;
