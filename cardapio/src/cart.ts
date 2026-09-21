import type { ItemCarrinho, Prato } from './types';

const STORAGE_KEY = 'cardapio_cart_v1';

export class Cart {
  private itens: Map<string, ItemCarrinho> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.load();
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    this.save();
    this.listeners.forEach((fn) => fn());
  }

  private save(): void {
    try {
      const arr = Array.from(this.itens.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    } catch {
      // ignore quota errors
    }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const arr: ItemCarrinho[] = JSON.parse(raw);
      if (!Array.isArray(arr)) return;
      arr.forEach((it) => {
        if (!it?.id || !it?.prato) return;
        // normaliza qtd e preco caso venham como string (localStorage corrompido/antigo)
        const qtdNum = Number((it as any).qtd);
        if (!Number.isFinite(qtdNum) || qtdNum <= 0) return;
        it.qtd = Math.floor(qtdNum);
        const precoNum = Number((it.prato as any).preco);
        if (Number.isNaN(precoNum)) return;
        (it.prato as any).preco = precoNum;
        if (it.qtd <= 0) return;
        this.itens.set(it.id, it);
      });
    } catch (e) {
      console.warn('[cart] falha ao carregar localStorage, limpando', e);
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
    }
  }

  add(prato: Prato, qtd: number = 1): void {
    if (qtd <= 0) return;
    const existente = this.itens.get(prato.id);
    if (existente) {
      existente.qtd += qtd;
    } else {
      this.itens.set(prato.id, { id: prato.id, prato, qtd });
    }
    this.notify();
  }

  setQtd(id: string, qtd: number): void {
    if (qtd <= 0) {
      this.itens.delete(id);
    } else {
      const it = this.itens.get(id);
      if (it) it.qtd = qtd;
    }
    this.notify();
  }

  remove(id: string): void {
    this.itens.delete(id);
    this.notify();
  }

  clear(): void {
    this.itens.clear();
    this.notify();
  }

  getItens(): ItemCarrinho[] {
    return Array.from(this.itens.values());
  }

  getCount(): number {
    let c = 0;
    this.itens.forEach((it) => (c += it.qtd));
    return c;
  }

  getTotal(): number {
    let t = 0;
    this.itens.forEach((it) => (t += it.prato.preco * it.qtd));
    return t;
  }

  isEmpty(): boolean {
    return this.itens.size === 0;
  }
}
