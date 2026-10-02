// Continuar de onde parou depois de atualizar (Vitor, 02/10/2026: "quando clicar em atualizar, não sai da tela e não perde
// nada do que digitou ou fez; não resete nada"). Ao atualizar, cada página (a de cima e as ferramentas das etapas, que são
// do mesmo endereço) guarda os campos que estão na tela — texto, número, data, seleção, caixinhas — e a rolagem, no
// sessionStorage da aba, pelo endereço dela. Ao voltar (o mesmo endereço), põe tudo de volta assim que os campos aparecem
// (o React recebe como se a pessoa tivesse digitado). Senha e arquivo não são guardados.
const FLAG = 'nads-atualizando';
const PREFIXO = 'nads-campos:';
type Campo = { k: string; v: string | boolean };
type Foto = { campos: Campo[]; rolagem: number; em: number };

const ignorar = (el: Element) => el instanceof HTMLInputElement && ['password', 'file', 'hidden', 'submit', 'button', 'image', 'reset'].includes(el.type);

/** Um nome estável para o campo: o id, o name, ou o caminho até ele (a partir do primeiro pai com id). */
function chaveDe(el: Element): string {
  if (el.id) return '#' + el.id;
  const nome = el.getAttribute('name');
  if (nome) return el.tagName + '[name="' + nome + '"]';
  const partes: string[] = [];
  let n: Element | null = el;
  while (n && n !== document.body) {
    const pai: HTMLElement | null = n.parentElement;
    if (!pai) break;
    partes.unshift(n.tagName + ':' + Array.prototype.indexOf.call(pai.children, n));
    if (pai.id) { partes.unshift('#' + pai.id); break; }
    n = pai;
  }
  return partes.join('>');
}

const camposDaTela = () => Array.from(document.querySelectorAll('input, textarea, select')).filter(el => !ignorar(el)) as (HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)[];
const chaveDaPagina = () => PREFIXO + location.pathname + location.search;

function fotografar() {
  const campos: Campo[] = camposDaTela().map(el => ({
    k: chaveDe(el),
    v: el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio') ? el.checked : el.value,
  }));
  const foto: Foto = { campos, rolagem: window.scrollY, em: Date.now() };
  try { sessionStorage.setItem(chaveDaPagina(), JSON.stringify(foto)); } catch { /* sem espaço: segue sem guardar */ }
}

/** Escreve no campo como se a pessoa tivesse digitado (o React fica sabendo). */
function devolver(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, v: string | boolean) {
  if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
    if (el.checked !== v) el.click();
    return;
  }
  if (typeof v !== 'string' || el.value === v) return;
  const proto = Object.getPrototypeOf(el) as object;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(el, v); else el.value = v;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function lerFoto(): Foto | null {
  try { const t = sessionStorage.getItem(chaveDaPagina()); return t ? JSON.parse(t) as Foto : null; } catch { return null; }
}

function restaurar() {
  const foto = lerFoto();
  if (!foto || Date.now() - foto.em > 5 * 60 * 1000) return;
  const faltam = new Map(foto.campos.map(c => [c.k, c.v]));
  const rolagem = foto.rolagem;
  let rolou = false;
  const inicio = Date.now();
  // os campos aparecem aos poucos (a tela carrega do banco): tenta de novo até uns 10 s
  const passo = () => {
    for (const el of camposDaTela()) {
      const k = chaveDe(el);
      if (!faltam.has(k)) continue;
      devolver(el, faltam.get(k) as string | boolean);
      faltam.delete(k);
    }
    if (!rolou && document.body.scrollHeight >= rolagem + window.innerHeight * 0.5) { window.scrollTo(0, rolagem); rolou = true; }
    if ((faltam.size || !rolou) && Date.now() - inicio < 10000) setTimeout(passo, 300);
    else { try { sessionStorage.removeItem(chaveDaPagina()); } catch { /* nada */ } }
  };
  setTimeout(passo, 300);
}

/** Uma vez por página (main.tsx): ao sair por uma atualização, guarda; ao voltar, devolve. */
export function iniciarContinuidade(): void {
  window.addEventListener('pagehide', () => {
    try { if (sessionStorage.getItem(FLAG)) fotografar(); } catch { /* nada */ }
  });
  let atualizando = false;
  try { atualizando = !!sessionStorage.getItem(FLAG); } catch { /* nada */ }
  if (!atualizando) return;
  restaurar();
  // a de cima apaga o aviso depois que as de dentro (as ferramentas) também já leram
  if (window.self === window.top) setTimeout(() => { try { sessionStorage.removeItem(FLAG); } catch { /* nada */ } }, 15000);
}

/** Atualiza a página guardando o que está na tela (a de cima e as ferramentas de dentro guardam ao sair). */
export function atualizarSemPerder(): void {
  try { sessionStorage.setItem(FLAG, String(Date.now())); } catch { /* nada */ }
  fotografar();
  window.location.reload();
}
