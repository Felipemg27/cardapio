import { Router } from 'express';
import { readJson, writeJson, paths } from '../store.js';
import type { Prato } from '../types.js';

const router = Router();

function loadPratos(): Prato[] {
  return readJson<Prato[]>(paths.PRATOS_FILE, []);
}

function savePratos(pratos: Prato[]) {
  writeJson(paths.PRATOS_FILE, pratos);
}

function validarPrato(body: any, isUpdate = false): string | null {
  if (!isUpdate && (!body.id || typeof body.id !== 'string')) return 'id obrigatório (slug único)';
  if (!body.nome || typeof body.nome !== 'string') return 'nome obrigatório';
  if (!body.categoria || !['entrada', 'principal', 'lanche', 'bebida', 'sobremesa'].includes(body.categoria)) return 'categoria inválida';
  if (typeof body.preco !== 'number' || body.preco < 0) return 'preco deve ser number >= 0';
  if (!body.descricao || typeof body.descricao !== 'string') return 'descricao obrigatória';
  return null;
}

// GET /api/pratos
router.get('/', (req, res) => {
  let pratos = loadPratos();
  const { categoria, q, busca } = req.query;
  const termo = (q || busca || '') as string;

  if (categoria && categoria !== 'todos') {
    pratos = pratos.filter((p) => p.categoria === categoria);
  }
  if (termo) {
    const t = termo.toLowerCase();
    pratos = pratos.filter((p) => `${p.nome} ${p.descricao} ${p.categoria}`.toLowerCase().includes(t));
  }
  res.json(pratos);
});

// GET /api/pratos/:id
router.get('/:id', (req, res) => {
  const pratos = loadPratos();
  const prato = pratos.find((p) => p.id === req.params.id);
  if (!prato) return res.status(404).json({ erro: 'Prato não encontrado' });
  res.json(prato);
});

// POST /api/pratos
router.post('/', (req, res) => {
  const err = validarPrato(req.body);
  if (err) return res.status(400).json({ erro: err });
  const pratos = loadPratos();
  if (pratos.find((p) => p.id === req.body.id)) {
    return res.status(409).json({ erro: 'id já existe' });
  }
  const novo: Prato = {
    id: req.body.id,
    categoria: req.body.categoria,
    nome: req.body.nome,
    descricao: req.body.descricao,
    preco: req.body.preco,
    precoAntigo: req.body.precoAntigo,
    badge: req.body.badge,
    imagem: req.body.imagem || `https://picsum.photos/seed/${req.body.id}/600/400`,
    alt: req.body.alt || req.body.nome,
  };
  pratos.push(novo);
  savePratos(pratos);
  res.status(201).json(novo);
});

// PUT /api/pratos/:id
router.put('/:id', (req, res) => {
  const pratos = loadPratos();
  const idx = pratos.findIndex((p) => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ erro: 'Prato não encontrado' });
  const err = validarPrato({ ...pratos[idx], ...req.body, id: pratos[idx].id }, true);
  if (err) return res.status(400).json({ erro: err });
  const atualizado = { ...pratos[idx], ...req.body, id: pratos[idx].id };
  pratos[idx] = atualizado;
  savePratos(pratos);
  res.json(atualizado);
});

// DELETE /api/pratos/:id
router.delete('/:id', (req, res) => {
  const pratos = loadPratos();
  const idx = pratos.findIndex((p) => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ erro: 'Prato não encontrado' });
  pratos.splice(idx, 1);
  savePratos(pratos);
  res.status(204).end();
});

export default router;
