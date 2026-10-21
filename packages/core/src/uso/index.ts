// O mapa de uso do sistema (Gustavo, 20/10/2026: "um mapa quente que trackei o que tá sendo usado no sistema, botões e
// funcionalidades para sabermos o que está 'inútil'"). As regras, sem tela e sem banco:
//   - a tela (a rota normalizada: app/página, sem o código da empresa);
//   - o rótulo do controle, limpo (sem números, e-mails e nomes de empresa);
//   - a célula do clique numa grade fixa de 50×50 (2% da tela);
//   - o acumulador (o que se junta na memória e vai ao banco a cada 5 minutos, num documento por dia, uso/{AAAA-MM-DD});
//   - a soma dos dias para a tela "Uso do sistema" (as mais e as menos visitadas, as nunca visitadas, os controles sem
//     clique e o "possivelmente inútil").
// Nunca entra texto digitado, valor de campo, dado de cliente nem nada do cofre: só a tela, o rótulo do controle e a célula.

/** a grade do mapa quente: 50 × 50 células (cada uma, 2% da largura e da altura da tela) */
export const GRADE = 50;
/** no máximo tantos controles por tela num dia (os que passam disso ficam de fora) */
export const MAX_CONTROLES_POR_TELA = 300;
/** de quanto em quanto tempo o que se juntou vai ao banco */
export const INTERVALO_DE_GRAVAR_MS = 5 * 60 * 1000;
/** o tamanho máximo do rótulo de um controle */
export const MAX_ROTULO = 48;

/** o uso de uma tela num dia (as chaves curtas economizam o documento) */
export interface UsoDaTela {
  /** visitas */
  v: number;
  /** cliques por controle (0 = o controle apareceu na tela e ninguém clicou) */
  c: Record<string, number>;
  /** cliques por célula da grade ("x_y", de 0 a 49) */
  p: Record<string, number>;
  /** visitas e cliques por departamento */
  q: Record<string, number>;
}

/** o documento do dia: uso/{AAAA-MM-DD} */
export interface UsoDoDia {
  dia: string;
  telas: Record<string, UsoDaTela>;
  /** visitas e cliques por pessoa (o nome da equipe) */
  pessoas: Record<string, number>;
}

/** o dia (AAAA-MM-DD) na hora local */
export function diaDe(d: Date): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/**
 * A tela de um caminho do app Tarefas: "app/página" (/tarefas/fiscal/painel → fiscal/painel). A janela da empresa no
 * Cadastro vira "cadastro/empresas/<aba>" (sem a empresa); o executor e a empresa aberta ficam sem a empresa e a
 * competência. Fora da Tarefas, null.
 */
export function telaDoCaminho(caminho: string): string | null {
  const limpo = caminho.split(/[?#]/)[0].replace(/\/+$/, '');
  if (limpo !== '/tarefas' && !limpo.startsWith('/tarefas/')) return null;
  const partes = limpo.split('/').slice(2).filter(Boolean).map(p => decodeURIComponent(p));
  if (!partes.length) return 'inicio';
  const [app, pagina, , aba] = partes;
  if (app === 'executar') return 'executar';
  if (app === 'minhas-empresas' && pagina === 'empresa') return 'minhas-empresas/empresa';
  if (app === 'cadastro' && pagina === 'empresas' && partes.length >= 3) return 'cadastro/empresas/' + (aba || 'empresa');
  return pagina ? app + '/' + pagina : app;
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
/** o nome comparável (maiúsculo, sem acento, só letras e números) */
export const nomeComparavel = (s: string) => semAcento(s).toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();

/**
 * O rótulo do controle, limpo para guardar: sem e-mail, sem número (vira #), sem nome de empresa (o rótulo inteiro
 * vira "empresa da lista"), sem sequência de palavras em maiúsculas (os nomes do cadastro), até 48 letras. Vazio, null.
 * nomesDeEmpresa: os nomes já comparáveis (nomeComparavel), para achar o nome de uma empresa no rótulo.
 */
export function rotuloLimpo(texto: string, nomesDeEmpresa: readonly string[] = []): string | null {
  let s = String(texto || '').replace(/\s+/g, ' ').trim();
  if (!s) return null;
  const comparavel = nomeComparavel(s);
  if (comparavel.length >= 5 && nomesDeEmpresa.some(n => n.length >= 5 && comparavel.includes(n.slice(0, 14)))) return 'empresa da lista';
  s = s.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '@')
    // duas ou mais palavras seguidas em maiúsculas (de 3 letras ou mais; o E, DE, DA no meio): é nome de empresa ou de pessoa no cadastro
    .replace(/\b[A-ZÀ-Ý]{3,}(?:[\s&.,-]+(?:[A-ZÀ-Ý]{1,2}[\s&.,-]+)*[A-ZÀ-Ý]{3,})+\b/g, '…')
    .replace(/\d+([.,/-]\d+)*/g, '#')
    // o contador no fim do botão ("Enviados 2", "Competência 09/2026") sai
    .replace(/[\s#]*#\s*$/, '')
    .replace(/\s+/g, ' ').trim();
  if (!s || /^[#….,\s-]+$/.test(s)) return null;
  return s.length > MAX_ROTULO ? s.slice(0, MAX_ROTULO - 1).trimEnd() + '…' : s;
}

/** a célula do clique na grade (x e y em pixels dentro de uma área de largura × altura): "x_y", de 0 a 49 */
export function celula(x: number, y: number, largura: number, altura: number): string | null {
  if (!(largura > 0) || !(altura > 0) || x < 0 || y < 0 || x > largura || y > altura) return null;
  const cx = Math.min(GRADE - 1, Math.floor((x / largura) * GRADE));
  const cy = Math.min(GRADE - 1, Math.floor((y / altura) * GRADE));
  return cx + '_' + cy;
}

/**
 * O acumulador da memória: junta as visitas, os cliques e os controles vistos (com 0) até a próxima gravação. Os limites
 * (300 controles por tela no dia) valem para o que este navegador já mandou no dia.
 */
export function criarAcumulador() {
  let dia = '';
  let pendente: UsoDoDia | null = null;
  /** os controles que este navegador já mandou hoje, por tela (para o limite) */
  let mandados = new Map<string, Set<string>>();
  /** as telas cujos controles já foram vistos nesta sessão (vê uma vez por tela) */
  const vistas = new Set<string>();
  function doDia(agora: Date): UsoDoDia {
    const d = diaDe(agora);
    if (d !== dia) { dia = d; mandados = new Map(); }
    if (!pendente || pendente.dia !== d) pendente = { dia: d, telas: {}, pessoas: {} };
    return pendente;
  }
  function daTela(u: UsoDoDia, tela: string): UsoDaTela {
    return u.telas[tela] || (u.telas[tela] = { v: 0, c: {}, p: {}, q: {} });
  }
  function cabe(tela: string, controle: string, t: UsoDaTela): boolean {
    if (controle in t.c) return true;
    const ja = mandados.get(tela);
    const quantos = new Set([...(ja || []), ...Object.keys(t.c)]).size;
    return (ja?.has(controle)) || quantos < MAX_CONTROLES_POR_TELA;
  }
  const somar = (m: Record<string, number>, k: string, n = 1) => { m[k] = (m[k] || 0) + n; };
  return {
    visita(tela: string, departamento: string, pessoa: string, agora = new Date()) {
      const u = doDia(agora);
      const t = daTela(u, tela);
      t.v++;
      if (departamento) somar(t.q, departamento);
      if (pessoa) somar(u.pessoas, pessoa);
    },
    clique(tela: string, controle: string | null, cel: string | null, departamento: string, pessoa: string, agora = new Date()) {
      const u = doDia(agora);
      const t = daTela(u, tela);
      if (controle && cabe(tela, controle, t)) somar(t.c, controle);
      if (cel) somar(t.p, cel);
      if (departamento) somar(t.q, departamento);
      if (pessoa) somar(u.pessoas, pessoa);
    },
    /**
     * os controles que apareceram na tela (entram com 0): é assim que se sabe dos sem clique. Pode vir mais de uma vez
     * (a tela que ainda carregava); com final, a tela fica vista nesta sessão e não se olha mais
     */
    vistos(tela: string, controles: readonly string[], final = true, agora = new Date()) {
      if (vistas.has(tela)) return;
      if (final) vistas.add(tela);
      const u = doDia(agora);
      const t = daTela(u, tela);
      for (const c of controles) if (!(c in t.c) && cabe(tela, c, t)) t.c[c] = 0;
    },
    /** já viu os controles desta tela nesta sessão? */
    jaViu: (tela: string) => vistas.has(tela),
    /** tira o que está pendente para gravar (null = nada) */
    tirar(): UsoDoDia | null {
      const u = pendente;
      pendente = null;
      if (!u || !Object.keys(u.telas).length) return null;
      for (const [tela, t] of Object.entries(u.telas)) {
        const ja = mandados.get(tela) || new Set<string>();
        for (const c of Object.keys(t.c)) ja.add(c);
        mandados.set(tela, ja);
      }
      return u;
    },
    /** a gravação falhou: o que foi tirado volta (somado ao que chegou depois) */
    devolver(u: UsoDoDia) {
      const atual = doDia(new Date());
      if (atual.dia !== u.dia) return;
      for (const [tela, t] of Object.entries(u.telas)) {
        const a = daTela(atual, tela);
        a.v += t.v;
        for (const [k, n] of Object.entries(t.c)) somar(a.c, k, n);
        for (const [k, n] of Object.entries(t.p)) somar(a.p, k, n);
        for (const [k, n] of Object.entries(t.q)) somar(a.q, k, n);
      }
      for (const [k, n] of Object.entries(u.pessoas)) somar(atual.pessoas, k, n);
    },
  };
}
export type Acumulador = ReturnType<typeof criarAcumulador>;

/** uma tela da navegação (para as nunca visitadas) */
export interface TelaDaNavegacao { tela: string; rotulo: string; app: string }

export interface ControleSomado { controle: string; cliques: number }
export interface TelaSomada {
  tela: string;
  rotulo: string;
  visitas: number;
  cliques: number;
  controles: ControleSomado[];
  /** os controles que apareceram e ninguém clicou no período */
  semClique: string[];
  /** a grade: cliques por célula ("x_y") e o maior (para a cor) */
  grade: Record<string, number>;
  maiorCelula: number;
  departamentos: { nome: string; total: number }[];
}
export interface UsoSomado {
  dias: number;
  visitas: number;
  cliques: number;
  telas: TelaSomada[];
  /** as telas da navegação que ninguém abriu no período */
  nuncaVisitadas: TelaDaNavegacao[];
  pessoas: { nome: string; total: number }[];
  /** o "possivelmente inútil": as telas sem visita e os controles sem clique */
  possivelmenteInutil: { telas: TelaDaNavegacao[]; controles: { tela: string; rotulo: string; controle: string }[] };
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const mapa = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {});

/** o documento do banco no formato do dia (o que não for número fica de fora) */
export function usoDoDocumento(id: string, dados: unknown): UsoDoDia {
  const d = mapa(dados);
  const telas: Record<string, UsoDaTela> = {};
  for (const [tela, bruto] of Object.entries(mapa(d.telas))) {
    const t = mapa(bruto);
    const nums = (m: unknown) => Object.fromEntries(Object.entries(mapa(m)).map(([k, v]) => [k, num(v)]));
    telas[tela] = { v: num(t.v), c: nums(t.c), p: nums(t.p), q: nums(t.q) };
  }
  return { dia: typeof d.dia === 'string' ? d.dia : id, telas, pessoas: Object.fromEntries(Object.entries(mapa(d.pessoas)).map(([k, v]) => [k, num(v)])) };
}

/** soma os dias do período (os rótulos das telas vêm da navegação; a tela sem rótulo mostra o caminho) */
export function somarUso(dias: readonly UsoDoDia[], navegacao: readonly TelaDaNavegacao[]): UsoSomado {
  const rotuloDe = new Map(navegacao.map(n => [n.tela, n.rotulo]));
  const porTela = new Map<string, { v: number; c: Map<string, number>; p: Map<string, number>; q: Map<string, number> }>();
  const pessoas = new Map<string, number>();
  const somar = (m: Map<string, number>, k: string, n: number) => m.set(k, (m.get(k) || 0) + n);
  for (const d of dias) {
    for (const [tela, t] of Object.entries(d.telas)) {
      const a = porTela.get(tela) || { v: 0, c: new Map(), p: new Map(), q: new Map() };
      a.v += t.v;
      for (const [k, n] of Object.entries(t.c)) somar(a.c, k, n);
      for (const [k, n] of Object.entries(t.p)) somar(a.p, k, n);
      for (const [k, n] of Object.entries(t.q)) somar(a.q, k, n);
      porTela.set(tela, a);
    }
    for (const [k, n] of Object.entries(d.pessoas)) somar(pessoas, k, n);
  }
  const telas: TelaSomada[] = [...porTela.entries()].map(([tela, a]) => {
    const controles = [...a.c.entries()].filter(([, n]) => n > 0).map(([controle, cliques]) => ({ controle, cliques }))
      .sort((x, y) => y.cliques - x.cliques || x.controle.localeCompare(y.controle, 'pt-BR'));
    const grade = Object.fromEntries(a.p);
    return {
      tela, rotulo: rotuloDe.get(tela) || tela, visitas: a.v,
      cliques: controles.reduce((s, c) => s + c.cliques, 0),
      controles,
      semClique: [...a.c.entries()].filter(([, n]) => n === 0).map(([k]) => k).sort((x, y) => x.localeCompare(y, 'pt-BR')),
      grade, maiorCelula: Math.max(0, ...a.p.values()),
      departamentos: [...a.q.entries()].map(([nome, total]) => ({ nome, total })).sort((x, y) => y.total - x.total),
    };
  }).sort((x, y) => y.visitas - x.visitas || y.cliques - x.cliques || x.rotulo.localeCompare(y.rotulo, 'pt-BR'));
  const visitadas = new Set(telas.filter(t => t.visitas > 0).map(t => t.tela));
  const nuncaVisitadas = navegacao.filter(n => !visitadas.has(n.tela));
  return {
    dias: dias.length,
    visitas: telas.reduce((s, t) => s + t.visitas, 0),
    cliques: telas.reduce((s, t) => s + t.cliques, 0),
    telas,
    nuncaVisitadas,
    pessoas: [...pessoas.entries()].map(([nome, total]) => ({ nome, total })).sort((x, y) => y.total - x.total),
    possivelmenteInutil: {
      telas: nuncaVisitadas,
      controles: telas.flatMap(t => t.semClique.map(controle => ({ tela: t.tela, rotulo: t.rotulo, controle }))),
    },
  };
}

/** os dias do período (os últimos n, até hoje), do mais antigo para o mais novo */
export function diasDoPeriodo(n: number, hoje: Date): string[] {
  return Array.from({ length: n }, (_, i) => diaDe(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - (n - 1 - i))));
}

/**
 * A estimativa de gravações por dia (para o relatório e a tela): cada pessoa grava no máximo uma vez a cada 5 minutos
 * enquanto usa (e mais uma quando esconde ou fecha a aba).
 */
export function gravacoesPorDia(pessoas: number, horasDeUso = 8, saidasPorDia = 20): number {
  return pessoas * (Math.ceil((horasDeUso * 60 * 60 * 1000) / INTERVALO_DE_GRAVAR_MS) + saidasPorDia);
}
