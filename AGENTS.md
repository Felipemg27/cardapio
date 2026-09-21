# Instruções para IA — Projeto Cardápio Sabor & Brasa

> Fonte canônica. Espelho em `cardapio/CLAUDE.md` (se existir).

## 1. Visão Geral
Site de **cardápio digital** com checkout via **WhatsApp** — sem backend/pagamento real. Cliente monta carrinho e é redirecionado para `https://wa.me/<numero>?text=<msg>`.

- **Idioma:** `pt-BR` (`cardapio/index.html:2`)
- **Restaurante:** Sabor & Brasa (`cardapio/src/config.ts:2`)
- **WhatsApp:** `(21) 98700-4814` → `5521987004814` (`cardapio/src/config.ts:1`, `cardapio/index.html` seção #contato)
- **Stack:** Vite 6 + TypeScript 5 + Tailwind 3 + fuse.js (igual `projeto-loja`)

## 2. Estrutura
```
projeto-cardapio/
├── package.json, vite.config.ts (root=cardapio, outDir=dist), tailwind.config.js, tsconfig.json
└── cardapio/
    ├── index.html          # navbar, hero, #cardapio (filtros+grid 14 pratos), #contato, footer, drawer, modal, toast
    ├── src/
    │   ├── style.css       # Tailwind + tokens restaurante (vermelho/laranja)
    │   ├── main.ts         # filtros fuse.js, carrinho, modal, whatsapp
    │   ├── types.ts        # Prato, CategoriaCardapio, ItemCarrinho, DadosCliente
    │   ├── cart.ts         # Cart com localStorage e subscribe
    │   ├── whatsapp.ts     # buildMensagem + getWhatsAppLink + formatPreco
    │   ├── config.ts       # WHATSAPP_NUMERO, NOME_RESTAURANTE
    │   └── data/pratos.json # 14 pratos
    └── images/             # usa picsum.photos (sem assets locais obrigatórios)
```

## 3. Design System
Tokens `:root` em `cardapio/src/style.css:5`:
`--cor-primary #c0392b`, `--cor-primary-2 #e67e22`, `--cor-secundaria #f1c40f`, `--cor-acento #ff6b35`, `--cor-fundo #fff8f0`.
Padrões: gradiente navbar/hero, `.prato-card` 280px min, `.qtd-stepper`, drawer 420px, modal 560px, toast.

## 4. Fluxo WhatsApp
`cart.ts:Cart` → `whatsapp.ts:buildMensagem` → `getWhatsAppLink` → `window.open`. Carrinho persiste `localStorage: cardapio_cart_v1`. Form coleta nome, telefone, tipo (entrega/retirada), endereço condicional, pagamento (PIX/Cartão/Dinheiro+troco), obs.

## 5. Como Rodar
```powershell
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc + vite build → dist/
npm run preview
```
Validar: filtros categoria+busca, stepper qtd, carrinho add/remove/qtd, total, limpar, checkout validações, redirect encode correto, responsivo 375/768/1200, mobile menu e scroll spy.

## 6. Convenções
Preservar IDs: `#filtro-categoria`, `#busca`, `#catalogo-grid`, `.prato-card`, `data-categoria/data-id/data-preco`, `#cart-btn/#cart-drawer/#checkout-modal`. Nunca hardcode cores fora de `:root`. Edits cirúrgicos via Edit.

## 7. Git
Nunca `git push` sem autorização explícita.
