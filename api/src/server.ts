import express from 'express';
import cors from 'cors';
import { existsSync, copyFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import pratosRouter from './routes/pratos.js';
import pedidosRouter from './routes/pedidos.js';
import authRouter from './routes/auth.js';
import { paths, readJson, writeJson } from './store.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// serve front estático (dist) na mesma origem — permite /api + site juntos em prod (Render/Railway)
const distPath = resolve(__dirname, '../../dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
}

// seed pratos.json se não existir (copia do cardapio/src/data/pratos.json)
function seedIfNeeded() {
  if (!existsSync(paths.PRATOS_FILE)) {
    const seedSrc = resolve(__dirname, '../../cardapio/src/data/pratos.json');
    if (existsSync(seedSrc)) {
      copyFileSync(seedSrc, paths.PRATOS_FILE);
      console.log('[api] seed pratos.json copiado');
    } else {
      writeJson(paths.PRATOS_FILE, []);
    }
  }
  if (!existsSync(paths.PEDIDOS_FILE)) {
    writeJson(paths.PEDIDOS_FILE, []);
  }
  if (!existsSync(paths.USERS_FILE)) {
    writeJson(paths.USERS_FILE, []);
  }
}
seedIfNeeded();

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, nome: 'Sabor & Brasa API', version: '1.0.0', timestamp: new Date().toISOString() });
});

app.use('/api/pratos', pratosRouter);
app.use('/api/pedidos', pedidosRouter);
app.use('/api/auth', authRouter);

// SPA fallback: qualquer rota não-/api serve index.html (se dist existir)
app.get(/^\/(?!api).*/, (req, res, next) => {
  const indexFile = resolve(distPath, 'index.html');
  if (existsSync(indexFile)) {
    res.sendFile(indexFile);
  } else {
    next();
  }
});

// 404 apenas para /api não encontrada
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    res.status(404).json({ erro: 'Rota não encontrada', path: req.path });
    return;
  }
  res.status(404).send('Not Found');
});

// error handler
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error(err);
  res.status(500).json({ erro: 'Erro interno', detalhe: err?.message });
});

app.listen(PORT, () => {
  console.log(`[api] Sabor & Brasa API rodando em http://localhost:${PORT}`);
  console.log(`[api] Health: http://localhost:${PORT}/api/health`);
  console.log(`[api] Pratos: http://localhost:${PORT}/api/pratos`);
  console.log(`[api] Pedidos: http://localhost:${PORT}/api/pedidos`);
});
