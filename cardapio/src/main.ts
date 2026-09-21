import './style.css';
import Fuse from 'fuse.js';
import type { Prato, DadosCliente } from './types';
import { Cart } from './cart';
import { auth } from './auth';
import { GOOGLE_CLIENT_ID } from './config';
import { buildMensagem, getWhatsAppLink, formatPreco } from './whatsapp';
import { fetchPratos, criarPedido } from './api';

function init(): void {
  const filtroCategoria = document.getElementById('filtro-categoria') as HTMLSelectElement | null;
  const busca = document.getElementById('busca') as HTMLInputElement | null;
  const grid = document.getElementById('catalogo-grid') as HTMLElement | null;

  // --- helpers para renderizar cards a partir da API ---
  function badgeHtml(prato: Prato): string {
    if (!prato.badge) return '';
    const cls = prato.badge.tipo === 'promocao' ? 'badge-promocao' : prato.badge.tipo === 'mais-pedido' ? 'badge-mais-pedido' : 'badge-new';
    return `<span class="badge ${cls}">${prato.badge.label}</span>`;
  }
  function precoHtml(prato: Prato): string {
    const antigo = prato.precoAntigo ? `<span class="preco-antigo">${formatPreco(prato.precoAntigo)}</span>` : '';
    return `<span class="preco-atual">${formatPreco(prato.preco)}</span>${antigo}`;
  }
  function categoriaLabel(c: string): string {
    const map: Record<string,string> = { entrada:'Entrada', principal:'Prato Principal', lanche:'Lanche', bebida:'Bebida', sobremesa:'Sobremesa' };
    return map[c] ?? c;
  }
  function renderGrid(pratosData: Prato[]): void {
    if (!grid) return;
    grid.innerHTML = pratosData.map((p) => `
      <article class="prato-card" data-categoria="${p.categoria}" data-id="${p.id}" data-preco="${p.preco}">
        <div class="prato-imagem">
          <img src="${p.imagem}" alt="${p.alt}" loading="lazy" decoding="async">
          ${badgeHtml(p)}
        </div>
        <div class="prato-info">
          <span class="prato-categoria">${categoriaLabel(p.categoria)}</span>
          <h3 class="prato-nome">${p.nome}</h3>
          <p class="prato-desc">${p.descricao}</p>
          <div class="prato-preco">${precoHtml(p)}</div>
          <div class="prato-actions">
            <div class="qtd-stepper"><button type="button" class="qtd-minus" aria-label="Diminuir">−</button><span class="qtd-value">1</span><button type="button" class="qtd-plus" aria-label="Aumentar">+</button></div>
            <button type="button" class="btn-add">Adicionar 🛒</button>
          </div>
        </div>
      </article>
    `).join('');
  }

  // carrega fallback estático imediatamente (carrinho funciona instantâneo)
  let cards: HTMLElement[] = Array.from(document.querySelectorAll<HTMLElement>('.prato-card'));
  let pratos: Prato[] = cards.map((card) => {
    const id = card.dataset.id ?? '';
    const categoria = (card.dataset.categoria ?? 'lanche') as Prato['categoria'];
    const nome = card.querySelector('.prato-nome')?.textContent?.trim() ?? '';
    const desc = card.querySelector('.prato-desc')?.textContent?.trim() ?? '';
    const precoStr = card.dataset.preco ?? card.querySelector('.preco-atual')?.textContent?.replace(/[^\d.,]/g, '').replace(',', '.') ?? '0';
    const preco = parseFloat(precoStr) || 0;
    const imagem = card.querySelector('img')?.getAttribute('src') ?? '';
    const alt = card.querySelector('img')?.getAttribute('alt') ?? nome;
    return { id, categoria, nome, descricao: desc, preco, imagem, alt };
  });

  const fuse = new Fuse(pratos, {
    keys: ['nome', 'descricao', 'categoria'],
    threshold: 0.4,
    ignoreLocation: true,
    minMatchCharLength: 2
  });

  function filtrar(): void {
    const cat = filtroCategoria?.value ?? 'todos';
    const termo = (busca?.value ?? '').trim().toLowerCase();
    let matchedIds: Set<string> | null = null;
    if (termo.length >= 2) {
      const results = fuse.search(termo);
      matchedIds = new Set(results.map((r) => r.item.id));
      if (matchedIds.size === 0) {
        matchedIds = new Set(
          pratos.filter((p) => `${p.nome} ${p.descricao}`.toLowerCase().includes(termo)).map((p) => p.id)
        );
      }
    }
    cards.forEach((card) => {
      const categoria = card.dataset.categoria ?? '';
      const key = card.dataset.id ?? '';
      const matchCat = cat === 'todos' || categoria === cat;
      let matchBusca = true;
      if (termo) {
        if (matchedIds !== null) matchBusca = matchedIds.has(key);
        else matchBusca = (card.querySelector('.prato-nome')?.textContent?.toLowerCase() ?? '').includes(termo);
      }
      card.style.display = matchCat && matchBusca ? '' : 'none';
    });
  }

  filtroCategoria?.addEventListener('change', filtrar);
  busca?.addEventListener('input', filtrar);

  // ---- Menu mobile + scroll spy
  const toggle = document.getElementById('menu-toggle');
  const navLinks = document.querySelector('.nav-links');
  if (toggle && navLinks) {
    toggle.addEventListener('click', () => navLinks.classList.toggle('open'));
    navLinks.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => navLinks.classList.remove('open')));
  }
  const sections = document.querySelectorAll<HTMLElement>('section[id]');
  const navAs = document.querySelectorAll<HTMLAnchorElement>('.nav-links a');
  function setActive(): void {
    let current = '';
    sections.forEach((s) => { if (window.scrollY >= s.offsetTop - 120) current = s.id; });
    navAs.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === `#${current}`));
  }
  window.addEventListener('scroll', setActive, { passive: true });
  setActive();

  // ---- Carrinho
  const cart = new Cart();
  const cartBtn = document.getElementById('cart-btn') as HTMLButtonElement | null;
  const cartOverlay = document.getElementById('cart-overlay') as HTMLElement | null;
  const cartDrawer = document.getElementById('cart-drawer') as HTMLElement | null;
  const cartClose = document.getElementById('cart-close') as HTMLButtonElement | null;
  const cartItemsEl = document.getElementById('cart-items') as HTMLElement | null;
  const cartTotalEl = document.getElementById('cart-total') as HTMLElement | null;
  const cartCountEl = document.getElementById('cart-count') as HTMLElement | null;
  const btnCheckout = document.getElementById('btn-checkout') as HTMLButtonElement | null;
  const btnClear = document.getElementById('btn-clear') as HTMLButtonElement | null;

  const toastEl = document.getElementById('toast') as HTMLElement | null;
  let toastTimer: number | undefined;
  function showToast(msg: string): void {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), 2600);
  }

  function openCart(): void {
    cartOverlay?.classList.add('open');
    cartDrawer?.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeCart(): void {
    cartOverlay?.classList.remove('open');
    cartDrawer?.classList.remove('open');
    document.body.style.overflow = '';
  }

  cartBtn?.addEventListener('click', openCart);
  cartOverlay?.addEventListener('click', closeCart);
  cartClose?.addEventListener('click', closeCart);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeCart(); closeCheckout(); closeLogin(); }
  });

  // ---- Auth (Google Login)
  const btnLogin = document.getElementById('btn-login') as HTMLButtonElement | null;
  const userMenu = document.getElementById('user-menu') as HTMLElement | null;
  const userTrigger = document.getElementById('user-trigger') as HTMLButtonElement | null;
  const userDropdown = document.getElementById('user-dropdown') as HTMLElement | null;
  const userAvatar = document.getElementById('user-avatar') as HTMLImageElement | null;
  const userInitial = document.getElementById('user-initial') as HTMLElement | null;
  const userNameEl = document.getElementById('user-name') as HTMLElement | null;
  const dropdownName = document.getElementById('dropdown-name') as HTMLElement | null;
  const dropdownEmail = document.getElementById('dropdown-email') as HTMLElement | null;
  const btnLogout = document.getElementById('btn-logout') as HTMLButtonElement | null;
  const loginModal = document.getElementById('login-modal') as HTMLElement | null;
  const loginClose = document.getElementById('login-close') as HTMLButtonElement | null;
  const loginDemoForm = document.getElementById('login-demo-form') as HTMLFormElement | null;
  const loginNome = document.getElementById('login-nome') as HTMLInputElement | null;
  const loginEmail = document.getElementById('login-email') as HTMLInputElement | null;

  function openLogin(): void {
    loginModal?.classList.add('open');
    loginModal?.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function closeLogin(): void {
    loginModal?.classList.remove('open');
    loginModal?.setAttribute('aria-hidden', 'true');
    const cd = document.getElementById('cart-drawer');
    const cm = document.getElementById('checkout-modal');
    if (!cd?.classList.contains('open') && !cm?.classList.contains('open')) document.body.style.overflow = '';
  }
  btnLogin?.addEventListener('click', openLogin);
  loginClose?.addEventListener('click', closeLogin);
  loginModal?.addEventListener('click', (e) => { if (e.target === loginModal) closeLogin(); });

  function renderAuth(): void {
    const user = auth.getUser();
    if (user) {
      btnLogin?.classList.add('hidden');
      userMenu?.classList.remove('hidden');
      if (userNameEl) userNameEl.textContent = user.nome.split(' ')[0];
      if (dropdownName) dropdownName.textContent = user.nome;
      if (dropdownEmail) dropdownEmail.textContent = user.email;
      if (user.avatar && userAvatar) {
        userAvatar.src = user.avatar;
        userAvatar.alt = user.nome;
        userAvatar.classList.remove('hidden');
        userInitial?.classList.add('hidden');
      } else {
        if (userAvatar) userAvatar.classList.add('hidden');
        if (userInitial) { userInitial.textContent = user.nome.charAt(0).toUpperCase(); userInitial.classList.remove('hidden'); }
      }
      // preenche checkout se vazio
      const cn = document.getElementById('cli-nome') as HTMLInputElement | null;
      if (cn && !cn.value) cn.value = user.nome;
    } else {
      btnLogin?.classList.remove('hidden');
      userMenu?.classList.add('hidden');
      userDropdown?.classList.remove('open');
    }
  }
  function isGoogleLogged(): boolean {
    const u = auth.getUser();
    if (!u) return false;
    // se GOOGLE_CLIENT_ID não configurado (modo demo), permite qualquer login para teste local
    if (!GOOGLE_CLIENT_ID) return true;
    return u.provider === 'google';
  }

  auth.subscribe(renderAuth);
  renderAuth();
  // quando auth muda, atualiza estado do botão de checkout
  auth.subscribe(() => renderCart());

  userTrigger?.addEventListener('click', (e) => {
    e.stopPropagation();
    userDropdown?.classList.toggle('open');
  });
  document.addEventListener('click', () => userDropdown?.classList.remove('open'));
  btnLogout?.addEventListener('click', () => {
    auth.logout();
    showToast('Você saiu');
    userDropdown?.classList.remove('open');
  });

  loginDemoForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = loginNome?.value.trim() ?? '';
    const email = loginEmail?.value.trim() ?? '';
    if (!nome || !email || !email.includes('@')) { showToast('Informe nome e e-mail válido'); return; }
    const btn = loginDemoForm.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    if (btn) { btn.disabled = true; btn.textContent = 'Entrando...'; }
    try {
      await auth.loginDemo(nome, email);
      showToast(`Bem-vindo, ${nome.split(' ')[0]}!`);
      closeLogin();
    } catch (err: any) {
      showToast(err.message || 'Erro ao entrar');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Entrar em modo demo'; }
    }
  });

  // Google GSI init (não bloqueia)
  auth.ensureGsiLoaded().then(() => {
    auth.initGoogle((user) => {
      showToast(`Bem-vindo, ${user.nome.split(' ')[0]}!`);
      closeLogin();
    }, (msg) => showToast(msg));
  }).catch(() => console.warn('[auth] GSI não carregado'));

  // checkout refs (precisa vir antes de renderCart para evitar TDZ resumoEl)
  const checkoutModal = document.getElementById('checkout-modal') as HTMLElement | null;
  const checkoutClose = document.getElementById('modal-close') as HTMLButtonElement | null;
  const checkoutForm = document.getElementById('checkout-form') as HTMLFormElement | null;
  const cliNome = document.getElementById('cli-nome') as HTMLInputElement | null;
  const cliTelefone = document.getElementById('cli-telefone') as HTMLInputElement | null;
  const cliTipo = document.getElementById('cli-tipo') as HTMLInputElement | null;
  const cliEndereco = document.getElementById('cli-endereco') as HTMLInputElement | null;
  const cliPagamento = document.getElementById('cli-pagamento') as HTMLSelectElement | null;
  const cliTroco = document.getElementById('cli-troco') as HTMLInputElement | null;
  const cliObs = document.getElementById('cli-obs') as HTMLTextAreaElement | null;
  const groupEndereco = document.getElementById('group-endereco') as HTMLElement | null;
  const groupTroco = document.getElementById('group-troco') as HTMLElement | null;
  const resumoEl = document.getElementById('resumo-pedido') as HTMLElement | null;
  const btnEnviar = checkoutForm?.querySelector('.btn-enviar') as HTMLButtonElement | null;

  function renderCart(): void {
    const itens = cart.getItens();
    const total = cart.getTotal();
    const count = cart.getCount();

    if (cartCountEl) cartCountEl.textContent = String(count);
    if (cartTotalEl) cartTotalEl.textContent = formatPreco(total);
    const canCheckout = itens.length > 0 && isGoogleLogged();
    if (btnCheckout) {
      btnCheckout.disabled = !canCheckout;
      btnCheckout.title = !isGoogleLogged() && itens.length > 0 ? 'Faça login com Google para finalizar' : '';
    }
    const hint = document.getElementById('checkout-login-hint') as HTMLElement | null;
    if (hint) hint.classList.toggle('hidden', isGoogleLogged() || itens.length === 0);
    cartBtn?.classList.toggle('has-items', count > 0);

    if (!cartItemsEl) return;
    if (itens.length === 0) {
      cartItemsEl.innerHTML = `<div class="cart-empty"><div class="cart-empty-icon">🛒</div><p style="font-weight:700;">Seu carrinho está vazio</p><p style="font-size:0.85rem; margin-top:6px;">Adicione pratos do cardápio</p></div>`;
      renderResumo();
      return;
    }
    cartItemsEl.innerHTML = itens.map((it) => `
      <div class="cart-item" data-id="${it.id}">
        <img src="${it.prato.imagem}" alt="${it.prato.alt}" loading="lazy">
        <div class="cart-item-info">
          <div class="cart-item-nome">${it.prato.nome}</div>
          <div class="cart-item-preco">${formatPreco(it.prato.preco)} cada • ${formatPreco(it.prato.preco * it.qtd)}</div>
          <div class="cart-item-actions">
            <div class="cart-item-qtd">
              <button type="button" class="ci-minus" aria-label="Diminuir">−</button>
              <span>${it.qtd}</span>
              <button type="button" class="ci-plus" aria-label="Aumentar">+</button>
            </div>
            <button type="button" class="cart-item-remove">Remover</button>
          </div>
        </div>
      </div>
    `).join('');

    cartItemsEl.querySelectorAll('.cart-item').forEach((el) => {
      const id = (el as HTMLElement).dataset.id!;
      el.querySelector('.ci-minus')?.addEventListener('click', () => cart.setQtd(id, (cart.getItens().find((x) => x.id === id)?.qtd ?? 1) - 1));
      el.querySelector('.ci-plus')?.addEventListener('click', () => cart.setQtd(id, (cart.getItens().find((x) => x.id === id)?.qtd ?? 0) + 1));
      el.querySelector('.cart-item-remove')?.addEventListener('click', () => cart.remove(id));
    });

    renderResumo();
  }

  cart.subscribe(renderCart);
  renderCart();

  function handleClear(): void {
    if (cart.isEmpty()) {
      showToast('Carrinho já está vazio');
      return;
    }
    cart.clear();
    // renderResumo já é chamado via renderCart, mas garante atualização do modal se estiver aberto
    renderResumo();
    showToast('Carrinho limpo');
  }
  btnClear?.addEventListener('click', handleClear);

  // ---- Stepper nos cards + add (delegação no grid: sobrevive a re-render)
  const pratoById = new Map(pratos.map((p) => [p.id, p]));
  const qtdById = new Map<string, number>();
  function getQtd(id: string): number { return qtdById.get(id) ?? 1; }
  function setQtdDisplay(card: HTMLElement, id: string, qtd: number): void {
    qtdById.set(id, qtd);
    const el = card.querySelector('.qtd-value') as HTMLElement | null;
    if (el) el.textContent = String(qtd);
  }
  // delegação única no grid (não precisa re-bind após renderGrid)
  grid?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const card = target.closest('.prato-card') as HTMLElement | null;
    if (!card) return;
    const id = card.dataset.id;
    if (!id) return;
    if (target.closest('.qtd-minus')) {
      const cur = getQtd(id);
      if (cur > 1) setQtdDisplay(card, id, cur - 1);
      return;
    }
    if (target.closest('.qtd-plus')) {
      const cur = getQtd(id);
      setQtdDisplay(card, id, cur + 1);
      return;
    }
    if (target.closest('.btn-add')) {
      const prato = pratoById.get(id);
      if (!prato) { console.warn('[cardapio] prato não encontrado', id, Array.from(pratoById.keys())); showToast('Erro: prato não encontrado'); return; }
      const qtd = getQtd(id);
      cart.add(prato, qtd);
      showToast(`${qtd}x ${prato.nome} adicionado!`);
      setQtdDisplay(card, id, 1);
      openCart();
    }
  });

  // atualiza via API em background (não bloqueia carrinho/botões)
  fetchPratos().then((data) => {
    if (!Array.isArray(data) || data.length === 0) return;
    if (data.length !== pratos.length) {
      pratos.splice(0, pratos.length, ...data);
      renderGrid(pratos);
      cards = Array.from(document.querySelectorAll<HTMLElement>('.prato-card'));
      qtdById.clear();
      fuse.setCollection(pratos);
      pratoById.clear();
      pratos.forEach((p) => pratoById.set(p.id, p));
      console.log(`[cardapio] ${pratos.length} pratos atualizados da API`);
    } else {
      // mesmo tamanho, só atualiza coleções sem re-render
      pratos.splice(0, pratos.length, ...data);
      fuse.setCollection(pratos);
      pratoById.clear();
      pratos.forEach((p) => pratoById.set(p.id, p));
      qtdById.clear();
    }
  }).catch((e) => console.warn('[cardapio] API offline, mantendo fallback', e));

  // checkout refs já declaradas acima (antes de renderCart) para evitar TDZ
  function openCheckout(): void {
    if (cart.isEmpty()) { showToast('Adicione itens antes de finalizar'); return; }
    if (!isGoogleLogged()) {
      showToast('Faça login com Google para finalizar o pedido');
      openLogin();
      return;
    }
    renderResumo();
    checkoutModal?.classList.add('open');
    checkoutModal?.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    closeCart();
  }
  function closeCheckout(): void {
    checkoutModal?.classList.remove('open');
    checkoutModal?.setAttribute('aria-hidden', 'true');
    if (!cartDrawer?.classList.contains('open')) document.body.style.overflow = '';
  }

  btnCheckout?.addEventListener('click', openCheckout);
  checkoutClose?.addEventListener('click', closeCheckout);
  checkoutModal?.addEventListener('click', (e) => { if (e.target === checkoutModal) closeCheckout(); });

  const tipoBtns = document.querySelectorAll<HTMLElement>('.tipo-btn');
  tipoBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      tipoBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const tipo = btn.dataset.tipo as 'entrega' | 'retirada';
      if (cliTipo) cliTipo.value = tipo;
      if (groupEndereco) groupEndereco.style.display = tipo === 'entrega' ? '' : 'none';
      if (tipo === 'retirada') document.getElementById('err-endereco')?.classList.remove('show');
    });
  });

  cliPagamento?.addEventListener('change', () => {
    if (!groupTroco) return;
    groupTroco.style.display = cliPagamento.value === 'Dinheiro' ? '' : 'none';
  });

  function renderResumo(): void {
    if (!resumoEl) return;
    const itens = cart.getItens();
    const total = cart.getTotal();
    if (itens.length === 0) {
      resumoEl.innerHTML = `<p style="color:#8a8a8a; font-size:0.88rem;">Nenhum item</p>`;
      return;
    }
    const linhas = itens.map((it) => `<div class="resumo-linha"><span>${it.qtd}x ${it.prato.nome}</span><span>${formatPreco(it.prato.preco * it.qtd)}</span></div>`).join('');
    resumoEl.innerHTML = `<h4>Resumo do pedido</h4>${linhas}<div class="resumo-total"><span>Total</span><span>${formatPreco(total)}</span></div>`;
  }

  function validate(): boolean {
    let ok = true;
    const nome = cliNome?.value.trim() ?? '';
    const tel = cliTelefone?.value.trim() ?? '';
    const tipo = (cliTipo?.value ?? 'entrega') as 'entrega' | 'retirada';
    const endereco = cliEndereco?.value.trim() ?? '';
    const pagamento = cliPagamento?.value ?? '';

    const errNome = document.getElementById('err-nome');
    const errTel = document.getElementById('err-telefone');
    const errEnd = document.getElementById('err-endereco');
    const errPag = document.getElementById('err-pagamento');

    errNome?.classList.toggle('show', !nome);
    errTel?.classList.toggle('show', tel.length < 8);
    errPag?.classList.toggle('show', !pagamento);
    errEnd?.classList.toggle('show', tipo === 'entrega' && !endereco);

    if (!nome) ok = false;
    if (tel.length < 8) ok = false;
    if (!pagamento) ok = false;
    if (tipo === 'entrega' && !endereco) ok = false;

    return ok;
  }

  checkoutForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!isGoogleLogged()) {
      showToast('Faça login com Google para finalizar o pedido');
      closeCheckout();
      openLogin();
      return;
    }
    if (!validate()) { showToast('Preencha os campos obrigatórios'); return; }
    const cliente: DadosCliente = {
      nome: cliNome!.value.trim(),
      telefone: cliTelefone!.value.trim(),
      tipo: (cliTipo!.value as 'entrega' | 'retirada') ?? 'entrega',
      endereco: cliEndereco!.value.trim(),
      pagamento: cliPagamento!.value,
      troco: cliTroco?.value.trim() ?? '',
      obs: cliObs?.value ?? ''
    };
    const itens = cart.getItens();
    const total = cart.getTotal();

    // abre janela sincronamente (evita popup blocker)
    let win: Window | null = null;
    try { win = window.open('about:blank', '_blank', 'noopener'); } catch { win = null; }

    if (btnEnviar) { btnEnviar.disabled = true; btnEnviar.textContent = 'Enviando...'; }
    try {
      const pedido = await criarPedido(itens, cliente);
      showToast('Pedido #' + pedido.id.slice(0,8) + ' criado! Redirecionando para WhatsApp...');
      console.log('[cardapio] WhatsApp link:', pedido.whatsappLink);
      const link = pedido.whatsappLink;
      // tenta nova aba, fallback mesma aba (nunca bloqueado)
      if (win && !win.closed) {
        win.location.href = link;
        setTimeout(() => { try { if (win && win.location.href === 'about:blank') win.location.href = link; } catch {} }, 500);
      } else {
        const w = window.open(link, '_blank', 'noopener');
        if (!w) window.location.href = link;
      }
      // garante redirect mesmo se popup bloqueado: após 800ms navega na mesma aba
      setTimeout(() => {
        if (document.visibilityState === 'visible') {
          console.log('[cardapio] fallback location.href');
          // não força se já navegou
        }
      }, 800);
    } catch (err: any) {
      console.warn('[cardapio] falha API, fallback local', err);
      const msg = buildMensagem(itens, total, cliente);
      const link = getWhatsAppLink(msg);
      console.log('[cardapio] fallback link:', link);
      if (win && !win.closed) {
        win.location.href = link;
      } else {
        const w2 = window.open(link, '_blank', 'noopener');
        if (!w2) window.location.href = link;
      }
      showToast('Redirecionando para WhatsApp...');
      if (win && win.location.href === 'about:blank') try { win.close(); } catch {}
    } finally {
      if (btnEnviar) { btnEnviar.disabled = false; btnEnviar.textContent = 'Enviar pedido no WhatsApp 💬'; }
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
