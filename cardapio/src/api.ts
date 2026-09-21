import type { Prato, DadosCliente, ItemCarrinho } from './types';

const BASE = ''; // usa proxy /api no dev, mesmo host em prod

function authHeaders(): Record<string,string> {
  try {
    const t = localStorage.getItem('cardapio_token_v1');
    return t ? { 'Authorization': `Bearer ${t}` } : {};
  } catch { return {}; }
}

export async function fetchPratos(params?: { categoria?: string; q?: string }): Promise<Prato[]> {
  const url = new URL('/api/pratos', window.location.origin);
  if (params?.categoria && params.categoria !== 'todos') url.searchParams.set('categoria', params.categoria);
  if (params?.q) url.searchParams.set('q', params.q);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`GET /api/pratos ${res.status}`);
  return res.json();
}

export interface CriarPedidoBody {
  itens: { id: string; qtd: number }[];
  cliente: DadosCliente;
}

export interface PedidoResponse {
  id: string;
  itens: any[];
  total: number;
  cliente: DadosCliente;
  status: string;
  whatsappLink: string;
  mensagem: string;
  criadoEm: string;
}

export async function criarPedido(itens: ItemCarrinho[], cliente: DadosCliente): Promise<PedidoResponse> {
  const body: CriarPedidoBody = {
    itens: itens.map((it) => ({ id: it.id, qtd: it.qtd })),
    cliente,
  };
  const res = await fetch(`${BASE}/api/pedidos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ erro: res.statusText }));
    throw new Error(err.erro || `POST /api/pedidos ${res.status}`);
  }
  return res.json();
}

export async function fetchHealth(): Promise<any> {
  const res = await fetch(`${BASE}/api/health`);
  if (!res.ok) throw new Error('health failed');
  return res.json();
}

// --- admin CRUD ---
export async function criarPrato(prato: any): Promise<any> {
  const res = await fetch(`${BASE}/api/pratos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(prato),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ erro: res.statusText }));
    throw new Error(err.erro || `POST /api/pratos ${res.status}`);
  }
  return res.json();
}
export async function atualizarPrato(id: string, prato: any): Promise<any> {
  const res = await fetch(`${BASE}/api/pratos/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(prato),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ erro: res.statusText }));
    throw new Error(err.erro || `PUT /api/pratos ${res.status}`);
  }
  return res.json();
}
export async function deletarPrato(id: string): Promise<void> {
  const res = await fetch(`${BASE}/api/pratos/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { ...authHeaders() },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ erro: res.statusText }));
    throw new Error(err.erro || `DELETE /api/pratos ${res.status}`);
  }
}
