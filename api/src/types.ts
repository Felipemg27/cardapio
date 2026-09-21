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

export interface ItemPedido {
  id: string;
  qtd: number;
  // denormalizado no response
  prato?: Prato;
  precoUnitario?: number;
  subtotal?: number;
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

export type StatusPedido = 'pendente' | 'confirmado' | 'preparando' | 'saiu_entrega' | 'entregue' | 'cancelado';

export interface Pedido {
  id: string;
  itens: ItemPedido[];
  total: number;
  cliente: DadosCliente;
  status: StatusPedido;
  whatsappLink: string;
  mensagem: string;
  criadoEm: string;
}

export interface User {
  id: string;
  googleId?: string;
  nome: string;
  email: string;
  avatar?: string;
  provider: 'google' | 'demo';
  role: 'admin' | 'user';
  criadoEm: string;
}
