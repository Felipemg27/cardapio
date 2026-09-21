import './style.css';
import { auth } from './auth';
import { fetchPratos, criarPrato, atualizarPrato, deletarPrato } from './api';
import type { Prato } from './types';

const toastEl = document.getElementById('toast') as HTMLElement | null;
let toastTimer: number | undefined;
function showToast(msg: string, ms = 2600) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), ms);
}

const guard = document.getElementById('admin-guard') as HTMLElement | null;
const panel = document.getElementById('admin-panel') as HTMLElement | null;
const guardMsg = document.getElementById('guard-msg') as HTMLElement | null;
const pratosLista = document.getElementById('pratos-lista') as HTMLElement | null;

const btnLogin = document.getElementById('btn-login') as HTMLButtonElement | null;
const userMenu = document.getElementById('user-menu') as HTMLElement | null;
const userTrigger = document.getElementById('user-trigger') as HTMLButtonElement | null;
const userDropdown = document.getElementById('user-dropdown') as HTMLElement | null;
const userAvatar = document.getElementById('user-avatar') as HTMLImageElement | null;
const userInitial = document.getElementById('user-initial') as HTMLElement | null;
const userNameEl = document.getElementById('user-name') as HTMLElement | null;
const dropdownName = document.getElementById('dropdown-name') as HTMLElement | null;
const dropdownEmail = document.getElementById('dropdown-email') as HTMLElement | null;
const dropdownRole = document.getElementById('dropdown-role') as HTMLElement | null;
const btnLogout = document.getElementById('btn-logout') as HTMLButtonElement | null;

// form
const form = document.getElementById('prato-form') as HTMLFormElement | null;
const formTitle = document.getElementById('form-title') as HTMLElement | null;
const fIdOrig = document.getElementById('f-id-original') as HTMLInputElement | null;
const fId = document.getElementById('f-id') as HTMLInputElement | null;
const fCategoria = document.getElementById('f-categoria') as HTMLSelectElement | null;
const fNome = document.getElementById('f-nome') as HTMLInputElement | null;
const fPreco = document.getElementById('f-preco') as HTMLInputElement | null;
const fPrecoAntigo = document.getElementById('f-precoAntigo') as HTMLInputElement | null;
const fImagem = document.getElementById('f-imagem') as HTMLInputElement | null;
const fDesc = document.getElementById('f-desc') as HTMLTextAreaElement | null;
const fBadgeTipo = document.getElementById('f-badge-tipo') as HTMLSelectElement | null;
const fBadgeLabel = document.getElementById('f-badge-label') as HTMLInputElement | null;
const btnCancel = document.getElementById('btn-cancel') as HTMLButtonElement | null;
const formMsg = document.getElementById('form-msg') as HTMLElement | null;

let pratos: Prato[] = [];
let editingId: string | null = null;

function isAdmin(): boolean {
  const u = auth.getUser();
  return !!u && u.role === 'admin';
}

function renderAuth() {
  const u = auth.getUser();
  if (u) {
    btnLogin?.classList.add('hidden');
    userMenu?.classList.remove('hidden');
    if (userNameEl) userNameEl.textContent = u.nome.split(' ')[0];
    if (dropdownName) dropdownName.textContent = u.nome;
    if (dropdownEmail) dropdownEmail.textContent = u.email;
    if (dropdownRole) dropdownRole.textContent = u.role === 'admin' ? '● Admin' : '● Usuário (sem permissão)';
    if (u.avatar && userAvatar) {
      userAvatar.src = u.avatar; userAvatar.classList.remove('hidden'); userInitial?.classList.add('hidden');
    } else {
      userAvatar?.classList.add('hidden');
      if (userInitial) { userInitial.textContent = u.nome.charAt(0).toUpperCase(); userInitial.classList.remove('hidden'); }
    }
  } else {
    btnLogin?.classList.remove('hidden');
    userMenu?.classList.add('hidden');
  }
  updateGuard();
}

function updateGuard() {
  const u = auth.getUser();
  if (!u) {
    guard?.classList.remove('hidden');
    panel?.classList.add('hidden');
    if (guardMsg) guardMsg.textContent = 'Faça login para verificar permissão';
    return;
  }
  if (u.role !== 'admin') {
    guard?.classList.remove('hidden');
    panel?.classList.add('hidden');
    if (guardMsg) guardMsg.textContent = `Acesso negado para ${u.email}. Apenas e-mails admin configurados em ADMIN_EMAILS podem editar.`;
    return;
  }
  guard?.classList.add('hidden');
  panel?.classList.remove('hidden');
  loadPratos();
}

userTrigger?.addEventListener('click', (e) => {
  e.stopPropagation();
  userDropdown?.classList.toggle('open');
});
document.addEventListener('click', () => userDropdown?.classList.remove('open'));
btnLogout?.addEventListener('click', () => { auth.logout(); showToast('Você saiu'); });

btnLogin?.addEventListener('click', () => {
  showToast('Use o botão Google acima para entrar', 3000);
  document.getElementById('g_id_signin')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

// Google GSI
auth.ensureGsiLoaded().then(() => {
  auth.initGoogle((user) => {
    showToast(`Bem-vindo, ${user.nome.split(' ')[0]}!`, 3000);
    if (user.role !== 'admin') showToast('Login ok, mas sem permissão admin', 4000);
  }, (msg) => showToast(msg, 4000));
}).catch(() => console.warn('[admin] GSI não carregado'));

auth.subscribe(renderAuth);
renderAuth();

async function loadPratos() {
  if (!pratosLista) return;
  try {
    pratos = await fetchPratos();
    renderPratos();
  } catch (e: any) {
    pratosLista.innerHTML = `<p style="color:#c0392b; text-align:center;">Erro ao carregar: ${e.message}</p>`;
  }
}

function renderPratos() {
  if (!pratosLista) return;
  if (pratos.length === 0) {
    pratosLista.innerHTML = '<p style="text-align:center; color:#8a8a8a;">Nenhum prato</p>';
    return;
  }
  pratosLista.innerHTML = pratos.map(p => `
    <div style="background:#1e1e1e; border:1.5px solid #2a2a2a; border-radius:12px; padding:14px; display:flex; gap:14px; align-items:center;">
      <img src="${p.imagem}" alt="${p.alt}" style="width:72px; height:72px; border-radius:10px; object-fit:cover; flex-shrink:0; border:1px solid #2a2a2a;">
      <div style="flex:1; min-width:0;">
        <div style="font-size:0.75rem; color:#ff6b35; font-weight:700; text-transform:uppercase;">${p.categoria} • ${p.id}</div>
        <div style="font-weight:700; color:#f0f0f0;">${p.nome} — R$ ${p.preco.toFixed(2).replace('.',',')}</div>
        <div style="font-size:0.85rem; color:#9a9a9a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.descricao}</div>
      </div>
      <div style="display:flex; gap:8px; flex-shrink:0;">
        <button data-edit="${p.id}" style="padding:8px 14px; border-radius:999px; border:1.5px solid #2a2a2a; background:#0f0f0f; color:#f0f0f0; cursor:pointer; font-weight:600;">Editar</button>
        <button data-del="${p.id}" style="padding:8px 14px; border-radius:999px; border:none; background:#c0392b; color:#fff; cursor:pointer; font-weight:600;">Excluir</button>
      </div>
    </div>
  `).join('');

  pratosLista.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.edit!;
      const p = pratos.find(x => x.id === id);
      if (p) fillForm(p);
    });
  });
  pratosLista.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = (btn as HTMLElement).dataset.del!;
      if (!confirm(`Excluir "${id}"?`)) return;
      try {
        await deletarPrato(id);
        showToast('Prato excluído');
        loadPratos();
        try { localStorage.setItem('cardapio_update', Date.now().toString()); } catch {}
      } catch (e: any) {
        showToast(e.message || 'Erro ao excluir', 4000);
      }
    });
  });
}

function fillForm(p: Prato) {
  editingId = p.id;
  if (formTitle) formTitle.textContent = `Editando: ${p.nome}`;
  if (fIdOrig) fIdOrig.value = p.id;
  if (fId) { fId.value = p.id; fId.disabled = true; }
  if (fCategoria) fCategoria.value = p.categoria;
  if (fNome) fNome.value = p.nome;
  if (fPreco) fPreco.value = String(p.preco);
  if (fPrecoAntigo) fPrecoAntigo.value = p.precoAntigo ? String(p.precoAntigo) : '';
  if (fImagem) fImagem.value = p.imagem;
  if (fDesc) fDesc.value = p.descricao;
  if (fBadgeTipo) fBadgeTipo.value = p.badge?.tipo || '';
  if (fBadgeLabel) fBadgeLabel.value = p.badge?.label || '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetForm() {
  editingId = null;
  if (formTitle) formTitle.textContent = 'Novo prato';
  if (fIdOrig) fIdOrig.value = '';
  if (fId) { fId.value = ''; fId.disabled = false; }
  form?.reset();
  if (fCategoria) fCategoria.value = 'lanche';
  if (formMsg) { formMsg.textContent = ''; formMsg.style.color = ''; }
}

btnCancel?.addEventListener('click', resetForm);

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!isAdmin()) { showToast('Sem permissão admin', 4000); return; }
  const id = fId?.value.trim() || '';
  const nome = fNome?.value.trim() || '';
  const categoria = fCategoria?.value as Prato['categoria'];
  const preco = parseFloat(fPreco?.value || '0');
  const precoAntigo = fPrecoAntigo?.value ? parseFloat(fPrecoAntigo.value) : undefined;
  const descricao = fDesc?.value.trim() || '';
  const imagem = fImagem?.value.trim() || undefined;
  const badgeTipo = fBadgeTipo?.value as any || undefined;
  const badgeLabel = fBadgeLabel?.value.trim() || undefined;

  if (!id || !nome || !categoria || !descricao || isNaN(preco)) {
    if (formMsg) { formMsg.textContent = 'Preencha id, nome, categoria, preço e descrição'; formMsg.style.color = '#c0392b'; }
    return;
  }

  const payload: any = { id, categoria, nome, descricao, preco, imagem, alt: nome };
  if (precoAntigo) payload.precoAntigo = precoAntigo;
  if (badgeTipo && badgeLabel) payload.badge = { tipo: badgeTipo, label: badgeLabel };

  if (formMsg) { formMsg.textContent = 'Salvando...'; formMsg.style.color = '#636e72'; }
  try {
    if (editingId) {
      // edição: id não muda, envia sem id
      const { id: _omit, ...rest } = payload;
      await atualizarPrato(editingId, rest);
      showToast('Prato atualizado!');
    } else {
      await criarPrato(payload);
      showToast('Prato criado!');
    }
    resetForm();
    loadPratos();
    try { localStorage.setItem('cardapio_update', Date.now().toString()); } catch {}
    if (formMsg) { formMsg.textContent = 'Salvo com sucesso!'; formMsg.style.color = '#27ae60'; }
  } catch (err: any) {
    const msg = err.message || 'Erro ao salvar';
    if (formMsg) { formMsg.textContent = msg; formMsg.style.color = '#c0392b'; }
    showToast(msg, 4000);
  }
});
