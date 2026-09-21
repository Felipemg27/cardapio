import type { User } from './types';
import { GOOGLE_CLIENT_ID } from './config';

const STORAGE_USER = 'cardapio_user_v1';
const STORAGE_TOKEN = 'cardapio_token_v1';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (el: HTMLElement, opts: any) => void;
          prompt: () => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

export class Auth {
  private user: User | null = null;
  private token: string | null = null;
  private listeners: Set<() => void> = new Set();
  private gsiReady = false;

  constructor() {
    this.load();
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private notify() { this.listeners.forEach((fn) => fn()); }

  private load() {
    try {
      const raw = localStorage.getItem(STORAGE_USER);
      const tk = localStorage.getItem(STORAGE_TOKEN);
      if (raw) this.user = JSON.parse(raw) as User;
      if (tk) this.token = tk;
    } catch {}
  }
  private save() {
    try {
      if (this.user) localStorage.setItem(STORAGE_USER, JSON.stringify(this.user));
      else localStorage.removeItem(STORAGE_USER);
      if (this.token) localStorage.setItem(STORAGE_TOKEN, this.token);
      else localStorage.removeItem(STORAGE_TOKEN);
    } catch {}
    this.notify();
  }

  getUser(): User | null { return this.user; }
  getToken(): string | null { return this.token; }
  isLogged(): boolean { return !!this.user; }

  async loginWithGoogle(idToken: string): Promise<User> {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: idToken }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ erro: res.statusText }));
      throw new Error(err.erro || 'Falha no login Google');
    }
    const data = await res.json() as { user: User; token: string };
    this.user = data.user;
    this.token = data.token;
    this.save();
    return data.user;
  }

  async loginDemo(nome: string, email: string): Promise<User> {
    const res = await fetch('/api/auth/demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, email }),
    });
    if (!res.ok) throw new Error('Falha login demo');
    const data = await res.json() as { user: User; token: string };
    this.user = data.user;
    this.token = data.token;
    this.save();
    return data.user;
  }

  logout() {
    this.user = null;
    this.token = null;
    this.save();
    try { window.google?.accounts.id.disableAutoSelect(); } catch {}
  }

  // Inicializa Google Identity Services
  initGoogle(callback: (user: User) => void, onError: (msg: string) => void): void {
    if (!GOOGLE_CLIENT_ID) {
      console.log('[auth] GOOGLE_CLIENT_ID vazio — modo demo ativo. Configure VITE_GOOGLE_CLIENT_ID para Google real.');
      return;
    }
    const tryInit = () => {
      if (!window.google?.accounts?.id) {
        // GSI ainda não carregou, tenta de novo
        setTimeout(tryInit, 500);
        return;
      }
      if (this.gsiReady) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response: { credential: string }) => {
          try {
            const user = await this.loginWithGoogle(response.credential);
            callback(user);
          } catch (e: any) {
            onError(e.message || 'Erro ao autenticar com Google');
          }
        },
        auto_select: false,
      });
      this.gsiReady = true;
      // renderiza botão onde houver div[id="g_id_signin"]
      const btnContainer = document.getElementById('g_id_signin');
      if (btnContainer) {
        window.google.accounts.id.renderButton(btnContainer, {
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'pill',
          logo_alignment: 'left',
        });
      }
    };
    tryInit();
  }

  // Carrega script GSI dinamicamente se necessário
  ensureGsiLoaded(): Promise<void> {
    if (window.google?.accounts?.id) return Promise.resolve();
    if (!GOOGLE_CLIENT_ID) return Promise.resolve(); // modo demo não precisa
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('Falha ao carregar GSI')));
        return;
      }
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Falha ao carregar GSI'));
      document.head.appendChild(s);
    });
  }
}

export const auth = new Auth();
