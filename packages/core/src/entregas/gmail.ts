// A caixa do robô do Gmail do escritório (nilmacontabilidade@gmail.com), como o robô do Entregas deixa no banco.
// O navegador nunca fala com o Gmail: lê o que o robô projeta em robo/estado e põe pedidos na fila dele
// (solicitacoesEmail: verificar, salvar no Drive, responder, cancelar; leiturasGmail: o texto inteiro de um e-mail).

export const CAIXA_DO_ESCRITORIO = 'nilmacontabilidade@gmail.com';

/** Um e-mail que o robô viu (robo/estado.caixa, naoReconhecidos, spam). */
export interface EmailDaCaixa {
  mensagemId: string;
  /** ISO */
  em: string;
  remetente: string;
  nome: string;
  assunto: string;
  trecho: string;
  /** os nomes dos anexos */
  arquivos: string[];
  /** de qual cliente (null = o robô não soube) */
  clienteId: string | null;
  clienteNome?: string;
  /** e-mail ambíguo: os nomes dos clientes possíveis */
  candidatos?: string[];
}

export interface ExecucaoDoRobo {
  em: string;
  dias: number;
  emails: number;
  marcados: number;
  baixados: number;
  naoReconhecidos: number;
  conversas: number;
  erros: number;
  duracaoMs: number;
}

export interface AndamentoDoRobo {
  ativo: boolean;
  tipo: string;
  motivo: string;
  fase: string;
  feito: number;
  total: number;
  recentes: { em: string; texto: string; destaque: boolean }[];
}

export interface SalvoNoDrive { em: string; pasta: string; arquivos: number }

export interface EstadoDoRobo {
  carregado: boolean;
  /** o robô deu sinal nos últimos 3 minutos */
  online: boolean;
  vistoEm: string;
  /** 'lendo' | 'ok' | 'erro' */
  status: string;
  statusMsg: string;
  andamento: AndamentoDoRobo | null;
  /** pedidos esperando na fila */
  naFila: number;
  caixa: EmailDaCaixa[];
  naoReconhecidos: EmailDaCaixa[];
  spam: EmailDaCaixa[];
  execucoes: ExecucaoDoRobo[];
  salvos: Record<string, SalvoNoDrive>;
  ultimaExecucao: string;
  erro?: string;
}

export const ESTADO_VAZIO: EstadoDoRobo = {
  carregado: false, online: false, vistoEm: '', status: '', statusMsg: '', andamento: null, naFila: 0,
  caixa: [], naoReconhecidos: [], spam: [], execucoes: [], salvos: {}, ultimaExecucao: '',
};

const texto = (v: unknown) => (v == null ? '' : String(v));
const numero = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : 0);
const lista = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);

function emailDaLista(x: Record<string, unknown>): EmailDaCaixa | null {
  const id = texto(x?.mensagemId);
  if (!id) return null;
  const e: EmailDaCaixa = {
    mensagemId: id, em: texto(x.em), remetente: texto(x.remetente).toLowerCase(), nome: texto(x.nome),
    assunto: texto(x.assunto), trecho: texto(x.trecho),
    arquivos: (Array.isArray(x.arquivos) ? x.arquivos : Array.isArray(x.anexos) ? x.anexos : []).map(texto).filter(Boolean),
    clienteId: x.clienteId ? texto(x.clienteId) : null,
  };
  if (x.clienteNome) e.clienteNome = texto(x.clienteNome);
  if (Array.isArray(x.candidatos) && x.candidatos.length) e.candidatos = x.candidatos.map(texto);
  return e;
}

const maisNovos = (a: EmailDaCaixa, b: EmailDaCaixa) => b.em.localeCompare(a.em);

/** O documento robo/estado conferido. `agora` decide se o robô está online (sinal nos últimos 3 min). */
export function estadoDoRobo(doc: Record<string, unknown> | null | undefined, agora = Date.now()): EstadoDoRobo {
  if (!doc) return { ...ESTADO_VAZIO, carregado: true };
  const vigia = (doc.vigia || {}) as Record<string, unknown>;
  const vistoEm = texto(vigia.em);
  const online = !!vistoEm && !vigia.desligadoEm && agora - Date.parse(vistoEm) < 3 * 60 * 1000;
  const a = (doc.andamento || null) as Record<string, unknown> | null;
  const fila = (doc.filaAndamento || {}) as Record<string, unknown>;
  const salvos: Record<string, SalvoNoDrive> = {};
  for (const [id, s] of Object.entries((doc.salvos || {}) as Record<string, Record<string, unknown>>)) {
    salvos[id] = { em: texto(s?.em), pasta: texto(s?.pasta), arquivos: Array.isArray(s?.arquivos) ? s.arquivos.length : numero(s?.arquivos) };
  }
  return {
    carregado: true, online, vistoEm,
    status: texto(doc.status), statusMsg: texto(doc.statusMsg),
    andamento: a && a.ativo ? {
      ativo: true, tipo: texto(a.tipo), motivo: texto(a.motivo), fase: texto(a.fase), feito: numero(a.feito), total: numero(a.total),
      recentes: lista(a.recentes).slice(-8).map(r => ({ em: texto(r?.em), texto: texto(r?.texto), destaque: !!r?.destaque })),
    } : null,
    naFila: fila.ativo ? numero(fila.restantes) : 0,
    caixa: lista(doc.caixa).map(emailDaLista).filter((e): e is EmailDaCaixa => !!e).sort(maisNovos),
    naoReconhecidos: lista(doc.naoReconhecidos).map(emailDaLista).filter((e): e is EmailDaCaixa => !!e).sort(maisNovos),
    spam: lista(doc.spam).map(emailDaLista).filter((e): e is EmailDaCaixa => !!e).sort(maisNovos),
    execucoes: lista(doc.execucoes).map(x => ({
      em: texto(x?.em), dias: numero(x?.dias), emails: numero(x?.emails), marcados: numero(x?.marcados), baixados: numero(x?.baixados),
      naoReconhecidos: numero(x?.naoReconhecidos), conversas: numero(x?.conversas), erros: numero(x?.erros), duracaoMs: numero(x?.duracaoMs),
    })).sort((x, y) => y.em.localeCompare(x.em)),
    salvos,
    ultimaExecucao: texto(doc.ultimaExecucao),
  };
}

/** Um cliente do Entregas, do jeito que a caixa precisa (para ligar remetente e escolher o dono do e-mail). */
export interface ClienteDoEntregas {
  id: string;
  nome: string;
  /** o código do ERP */
  codigo: string;
  email: string;
  emails: string[];
}

/** Os clientes do Entregas (os ativos), com os e-mails em minúsculas. */
export function clientesDoEntregas(docs: readonly { id: string; dados: Record<string, unknown> }[]): ClienteDoEntregas[] {
  return docs
    .filter(d => d.dados.ativo !== false)
    .map(d => ({
      id: d.id, nome: texto(d.dados.nome), codigo: texto(d.dados.codigoOrigem).trim(),
      email: texto(d.dados.email).trim().toLowerCase(),
      emails: (Array.isArray(d.dados.emails) ? d.dados.emails : []).map(e => texto(e).trim().toLowerCase()).filter(Boolean),
    }))
    .sort((a, b) => (Number(a.codigo) || 1e9) - (Number(b.codigo) || 1e9) || a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** Os e-mails que o robô não ligou a cliente, sem os já cadastrados em algum cliente e sem os ignorados. */
export function semCliente(e: EstadoDoRobo, clientes: readonly ClienteDoEntregas[], ignorados: readonly string[]): EmailDaCaixa[] {
  const conhecidos = new Set(clientes.flatMap(c => [c.email, ...c.emails]).filter(Boolean));
  const fora = new Set(ignorados.map(x => x.toLowerCase()));
  return e.naoReconhecidos.filter(x => !conhecidos.has(x.remetente) && !fora.has(x.remetente));
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const PALAVRAS_FRACAS = new Set(['ltda', 'me', 'epp', 'eireli', 'sa', 's', 'a', 'de', 'da', 'do', 'dos', 'das', 'e', 'comercio', 'industria', 'servicos', 'filial']);
const palavras = (s: string) => semAcento(s).split(/[^a-z0-9]+/).filter(p => p.length > 2 && !PALAVRAS_FRACAS.has(p));

/** O cliente que parece ser o do remetente (pelo nome dele, pelo domínio do e-mail); null se não há um só. */
export function clienteParecido(email: Pick<EmailDaCaixa, 'nome' | 'remetente'>, clientes: readonly ClienteDoEntregas[]): ClienteDoEntregas | null {
  const dominio = email.remetente.split('@')[1] || '';
  const doDominio = dominio && !/^(gmail|hotmail|outlook|yahoo|live|icloud|uol|bol|terra)\./.test(dominio)
    ? clientes.filter(c => [c.email, ...c.emails].some(x => x.endsWith('@' + dominio))) : [];
  if (doDominio.length === 1) return doDominio[0];
  const minhas = new Set([...palavras(email.nome), ...palavras(email.remetente.split('@')[0])]);
  if (!minhas.size) return null;
  const pontos = clientes.map(c => ({ c, n: palavras(c.nome).filter(p => minhas.has(p)).length })).filter(x => x.n > 0).sort((a, b) => b.n - a.n);
  return pontos.length && (pontos.length === 1 || pontos[0].n > pontos[1].n) ? pontos[0].c : null;
}

/** Abre o e-mail no Gmail do escritório. */
export const linkDoGmail = (mensagemId: string) => 'https://mail.google.com/mail/u/0/#all/' + encodeURIComponent(mensagemId);

/** O e-mail inteiro, que o robô devolve num pedido de leitura (leiturasGmail). */
export interface EmailLido {
  texto: string;
  truncado: boolean;
  de: string;
  para: string;
  cc: string;
  assunto: string;
  em: string;
  anexos: { nome: string; tamanho: number }[];
}

export function emailLidoDoDocumento(d: Record<string, unknown>): EmailLido {
  return {
    texto: texto(d.texto), truncado: !!d.truncado, de: texto(d.de), para: texto(d.para), cc: texto(d.cc),
    assunto: texto(d.assunto), em: texto(d.em),
    anexos: lista(d.anexos).map(a => ({ nome: texto(a?.nome), tamanho: numero(a?.tamanho) })),
  };
}

/** Uma resposta já pedida ao robô para um e-mail (solicitacoesEmail tipo 'responder'). */
export interface RespostaPedida {
  id: string;
  status: string;
  corpo: string;
  por: string;
  em: string;
  erro?: string;
}

export function respostaDoDocumento(id: string, d: Record<string, unknown>): RespostaPedida {
  const r: RespostaPedida = { id, status: texto(d.status), corpo: texto(d.corpo), por: texto(d.criadoPor), em: texto(d.enviadoEm || d.criadoEm) };
  if (d.erro) r.erro = texto(d.erro);
  return r;
}

/** O id do Gmail que a leitura aceita (a regra do banco). */
export const mensagemIdValido = (id: string) => /^[0-9a-fA-F]{10,32}$/.test(id);

// ---------- as caixas do Gmail por setor (01/10/2026) ----------
// O robô lê três caixas: a da Nilma Contabilidade (robo/estado) e as dos setores (robo/caixa-contabil e
// robo/caixa-fiscal: as mesmas listas — caixa, sem cliente, spam, execuções). O "online", a fila e o andamento são
// do robô (robo/estado). Cada pessoa vê a da Nilma e a do próprio setor (o do Cadastro); o admin vê todas.

export type CaixaDoGmail = 'robo' | 'contabil' | 'fiscal';

export const NOMES_DAS_CAIXAS: Record<CaixaDoGmail, string> = { robo: 'Nilma Contabilidade', contabil: 'Setor contábil', fiscal: 'Setor fiscal' };

/** As caixas que a pessoa vê, na ordem das abas. */
export function caixasDaPessoa(p: { admin: boolean; departamento: string | null | undefined }): CaixaDoGmail[] {
  if (p.admin) return ['robo', 'contabil', 'fiscal'];
  if (p.departamento === 'contabil') return ['robo', 'contabil'];
  if (p.departamento === 'fiscal') return ['robo', 'fiscal'];
  return [];
}

const CAMPOS_DA_CAIXA = ['caixa', 'naoReconhecidos', 'spam', 'execucoes', 'salvos', 'ultimaExecucao', 'ultimaExecucaoResumo'];

/** O documento que a tela lê para uma caixa de setor: o do robô (online, fila, andamento) com as listas da caixa. */
export function docDaCaixa(docDoRobo: Record<string, unknown> | null, docDaCaixaDoSetor: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!docDoRobo) return null;
  const junto: Record<string, unknown> = { ...docDoRobo };
  for (const k of CAMPOS_DA_CAIXA) junto[k] = docDaCaixaDoSetor ? docDaCaixaDoSetor[k] : undefined;
  return junto;
}

// ---------- de qual Gmail sai um pedido (01/10/2026) ----------
// A mesma regra do robô (vigia-robo.js departamentoDoPedido + caixaDoDepartamento): o setor de quem pede é o
// departamento do Cadastro (usuarios.departamento) ou, sem ele, o papel (fiscal sem o contábil = fiscal; o resto,
// contábil). O contábil sai pela caixa do contábil (ou a do robô, enquanto ela não estiver autorizada); o fiscal, só
// pela caixa do fiscal. Os endereços vêm de robo/estado.caixas, que o robô mantém.

export interface RemetenteDoPedido {
  setor: 'contabil' | 'fiscal';
  /** '' = não dá para enviar (o Gmail do fiscal ainda não foi autorizado) */
  email: string;
  /** a caixa de onde sai (o contábil cai na do robô enquanto a dele não for autorizada) */
  caixa: CaixaDoGmail;
}

export function setorDoUsuario(u: { departamento?: unknown; roles?: unknown } | null | undefined): 'contabil' | 'fiscal' {
  if (u && (u.departamento === 'fiscal' || u.departamento === 'contabil')) return u.departamento;
  const papeis = u && Array.isArray(u.roles) ? u.roles.map(String) : [];
  return papeis.includes('fiscal') && !papeis.includes('contabil') ? 'fiscal' : 'contabil';
}

export function remetenteDoPedido(usuario: { departamento?: unknown; roles?: unknown } | null | undefined, caixas: unknown): RemetenteDoPedido {
  const setor = setorDoUsuario(usuario);
  const cx = (caixas && typeof caixas === 'object' ? caixas : {}) as Record<string, { autorizada?: unknown; email?: unknown } | undefined>;
  const endereco = (c: string) => (cx[c] && cx[c]!.autorizada && cx[c]!.email ? String(cx[c]!.email) : '');
  if (setor === 'fiscal') return { setor, caixa: 'fiscal', email: endereco('fiscal') };
  if (endereco('contabil')) return { setor, caixa: 'contabil', email: endereco('contabil') };
  return { setor, caixa: 'robo', email: endereco('robo') || 'nilmacontabilidade@gmail.com' };
}
