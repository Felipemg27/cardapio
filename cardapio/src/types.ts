export type CategoriaCardapio = 'entrada' | 'principal' | 'lanche' | 'bebida' | 'sobremesa';

export interface Prato {
  id: string;
  categoria: CategoriaCardapio;
  nome: string;
  descricao: string;
  preco: number;
  precoAntigo?: number;
  badge?: { tipo: 'new' | 'promocao' | 'mais-pedido'; label: string };
  imagem: string;
  alt: string;
}

export interface ItemCarrinho {
  id: string;
  prato: Prato;
  qtd: number;
}

export interface DadosCliente {
  nome: string;
  telefone: string;
  tipo: 'entrega' | 'retirada';
  endereco: string;
  pagamento: string;
  troco?: string;
  obs: string;
}

export interface User {
  id: string;
  nome: string;
  email: string;
  avatar?: string;
  provider: 'google' | 'demo';
}
