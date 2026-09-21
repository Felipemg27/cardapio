import { WHATSAPP_NUMERO, NOME_RESTAURANTE } from './config';
import type { DadosCliente, ItemCarrinho } from './types';

export function formatPreco(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

export function buildMensagem(itens: ItemCarrinho[], total: number, cliente: DadosCliente): string {
  const agora = new Date();
  const dataHora = agora.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  const qtdTotal = itens.reduce((acc, it) => acc + it.qtd, 0);
  const div = '────────────────────';
  const linhas: string[] = [];

  linhas.push(`*🍔 ${NOME_RESTAURANTE.toUpperCase()} — Novo Pedido*`);
  linhas.push(`_${dataHora}_`);
  linhas.push('');
  linhas.push(`Olá! Gostaria de fazer um pedido:`);
  linhas.push('');
  linhas.push(`*📋 ITENS DO PEDIDO*`);
  linhas.push(div);
  itens.forEach((it, idx) => {
    const sub = it.prato.preco * it.qtd;
    const unit = formatPreco(it.prato.preco);
    const subtotal = formatPreco(sub);
    linhas.push(`${idx + 1}. *${it.prato.nome}*`);
    linhas.push(`   ${it.qtd}x ${unit}  →  ${subtotal}`);
  });
  linhas.push(div);
  linhas.push(`*💰 TOTAL (${qtdTotal} ${qtdTotal === 1 ? 'item' : 'itens'}): ${formatPreco(total)}*`);
  linhas.push('');
  linhas.push(`*👤 DADOS DO CLIENTE*`);
  linhas.push(div);
  linhas.push(`• Nome: ${cliente.nome}`);
  linhas.push(`• Telefone: ${cliente.telefone}`);
  linhas.push(`• ${cliente.tipo === 'entrega' ? 'Entrega 🛵' : 'Retirada no local 🏪'}: ${cliente.tipo === 'entrega' ? cliente.endereco : 'Retirada no balcão'}`);
  linhas.push(`• Pagamento: ${cliente.pagamento}`);
  if (cliente.pagamento === 'Dinheiro' && cliente.troco?.trim()) {
    linhas.push(`• Troco para: ${cliente.troco.trim()}`);
  }
  if (cliente.obs.trim()) {
    linhas.push('');
    linhas.push(`*📝 Observações:*`);
    linhas.push(cliente.obs.trim());
  }
  linhas.push('');
  linhas.push(div);
  linhas.push(`_Pedido enviado pelo cardápio digital — ${NOME_RESTAURANTE}_`);
  return linhas.join('\n');
}

export function getWhatsAppLink(mensagem: string, numero: string = WHATSAPP_NUMERO): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}
