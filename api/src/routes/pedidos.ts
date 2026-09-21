import { Router } from 'express';
import { randomUUID } from 'crypto';
import { readJson, writeJson, paths } from '../store.js';
import type { Pedido, Prato, DadosCliente, ItemPedido } from '../types.js';
import { buildMensagem, getWhatsAppLink } from '../whatsapp.js';

const router = Router();

function loadPedidos(): Pedido[] {
  return readJson<Pedido[]>(paths.PEDIDOS_FILE, []);
}
function savePedidos(pedidos: Pedido[]) {
  writeJson(paths.PEDIDOS_FILE, pedidos);
}
function loadPratos(): Prato[] {
  return readJson<Prato[]>(paths.PRATOS_FILE, []);
}

function validarCliente(c: any): string | null {
  if (!c?.nome?.trim()) return 'nome obrigatório';
  if (!c?.telefone?.trim() || c.telefone.trim().length < 8) return 'telefone inválido';
  if (!['entrega', 'retirada'].includes(c.tipo)) return 'tipo deve ser entrega ou retirada';
  if (c.tipo === 'entrega' && !c.endereco?.trim()) return 'endereço obrigatório para entrega';
  if (!c.pagamento) return 'pagamento obrigatório';
  return null;
}

// GET /api/pedidos
router.get('/', (_req, res) => {
  const pedidos = loadPedidos();
  // mais recentes primeiro
  pedidos.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  res.json(pedidos);
});

// GET /api/pedidos/:id
router.get('/:id', (req, res) => {
  const pedidos = loadPedidos();
  const p = pedidos.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ erro: 'Pedido não encontrado' });
  res.json(p);
});

// POST /api/pedidos
router.post('/', (req, res) => {
  const { itens, cliente } = req.body as { itens: ItemPedido[]; cliente: DadosCliente };

  if (!Array.isArray(itens) || itens.length === 0) return res.status(400).json({ erro: 'itens é obrigatório e não pode ser vazio' });
  const cliErr = validarCliente(cliente);
  if (cliErr) return res.status(400).json({ erro: cliErr });

  const pratos = loadPratos();
  const pratoMap = new Map(pratos.map((p) => [p.id, p]));

  let total = 0;
  const itensEnriquecidos: (ItemPedido & { prato: Prato })[] = [];

  for (const it of itens) {
    if (!it.id || typeof it.qtd !== 'number' || it.qtd <= 0) {
      return res.status(400).json({ erro: `item inválido: ${JSON.stringify(it)}` });
    }
    const prato = pratoMap.get(it.id);
    if (!prato) return res.status(400).json({ erro: `prato não encontrado: ${it.id}` });
    const subtotal = prato.preco * it.qtd;
    total += subtotal;
    itensEnriquecidos.push({
      id: prato.id,
      qtd: it.qtd,
      prato,
      precoUnitario: prato.preco,
      subtotal,
    });
  }

  const mensagem = buildMensagem(itensEnriquecidos, total, cliente);
  const whatsappLink = getWhatsAppLink(mensagem);

  const pedido: Pedido = {
    id: randomUUID(),
    itens: itensEnriquecidos,
    total,
    cliente,
    status: 'pendente',
    whatsappLink,
    mensagem,
    criadoEm: new Date().toISOString(),
  };

  const pedidos = loadPedidos();
  pedidos.push(pedido);
  savePedidos(pedidos);

  // se ?redirect=true, faz redirect 302 direto para WhatsApp (fluxo server-side)
  if (req.query.redirect === 'true' || req.query.redirect === '1') {
    return res.redirect(302, whatsappLink);
  }

  res.status(201).json(pedido);
});

// GET /api/pedidos/:id/whatsapp -> redireciona 302 para wa.me com mensagem do pedido
router.get('/:id/whatsapp', (req, res) => {
  const pedidos = loadPedidos();
  const p = pedidos.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ erro: 'Pedido não encontrado' });
  // regen link se necessário (garante encode correto)
  const link = p.whatsappLink || getWhatsAppLink(p.mensagem);
  return res.redirect(302, link);
});

// PATCH /api/pedidos/:id/status
router.patch('/:id/status', (req, res) => {
  const { status } = req.body;
  const valid = ['pendente', 'confirmado', 'preparando', 'saiu_entrega', 'entregue', 'cancelado'];
  if (!valid.includes(status)) return res.status(400).json({ erro: `status inválido. Use: ${valid.join(', ')}` });
  const pedidos = loadPedidos();
  const p = pedidos.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ erro: 'Pedido não encontrado' });
  p.status = status;
  savePedidos(pedidos);
  res.json(p);
});

export default router;
