// Regras do cadastro da empresa: ler e montar o documento do banco, as contas bancárias (incluir, editar,
// encerrar), as contas padrão e o que os aplicativos leem daqui (o Extrator, os bancos da competência).
// Nada é apagado de onde já estava: enquanto a empresa não tem os bancos cadastrados, vale o que o Extrator
// usava (a lista provisória de empresas/bancos.ts e os bancos adicionados na tela dele).
import { nomeNorm } from '../../formatos';
import { BANCOS_CONHECIDOS, bancosDaEmpresa, idDaConta, rotuloDaConta, type BancoDaEmpresa } from '../bancos';
import type {
  CadastroDaEmpresa, CampoContaPadrao, ContaBancaria, ContaDoPlano, ContaPadraoDoPlano, ContasPadrao, PlanoDeContas,
  RegistroCadastro, TipoContaBancaria,
} from './tipos';

/** Quantos registros do histórico ficam guardados (os mais novos). */
export const MAX_HISTORICO = 200;
/** Os limites da regra do banco (firestore.rules do Entregas, coleção `cadastro`). */
export const MAX_BANCOS = 60;
export const MAX_CONTAS_NO_PLANO = 5000;

export const CAMPOS_CONTA_PADRAO: readonly CampoContaPadrao[] = ['banco', 'juros', 'desconto', 'histPrincipal', 'histJuros', 'histDesconto'];
export const CONTAS_PADRAO_DO_PLANO: readonly ContaPadraoDoPlano[] = ['banco', 'juros', 'desconto'];
export const TIPOS_CONTA: readonly { id: TipoContaBancaria; rotulo: string }[] = [
  { id: 'corrente', rotulo: 'Conta corrente' },
  { id: 'aplicacao', rotulo: 'Aplicação' },
  { id: 'poupanca', rotulo: 'Poupança' },
  { id: 'outra', rotulo: 'Outra' },
];

/** O banco "Outro" (não está na lista de logos). */
export const BANCO_OUTRO: BancoDaEmpresa = { id: 'outro', nome: 'Outro banco' };

const texto = (v: unknown) => (v == null ? '' : String(v).trim());
const competencia = (v: unknown) => (/^\d{4}-\d{2}$/.test(texto(v)) ? texto(v) : undefined);
const opcional = (v: unknown) => texto(v) || undefined;

export function cadastroVazio(nome: string, codigo: number | null): CadastroDaEmpresa {
  return { nome, codigo, bancos: null, contasPadrao: null, historico: [] };
}

// ─── o documento do banco ───────────────────────────────────────────────────

function contaDoDocumento(v: unknown): ContaBancaria | null {
  const o = (v || {}) as Record<string, unknown>;
  const id = texto(o.id);
  const marca = texto(o.marca) || id;
  if (!id) return null;
  const tipo = TIPOS_CONTA.some(t => t.id === o.tipo) ? (o.tipo as TipoContaBancaria) : undefined;
  const c: ContaBancaria = { id, marca, nome: texto(o.nome) || nomeDoBanco(marca) };
  const extras: Partial<ContaBancaria> = {
    agencia: opcional(o.agencia), conta: opcional(o.conta), tipo, apelido: opcional(o.apelido),
    contaContabil: opcional(o.contaContabil), desde: competencia(o.desde), ate: competencia(o.ate),
  };
  for (const [k, val] of Object.entries(extras)) if (val !== undefined) (c as unknown as Record<string, unknown>)[k] = val;
  return c;
}

function contasPadraoDoDocumento(v: unknown): ContasPadrao | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const c = (o.contas || {}) as Record<string, unknown>;
  const n = (o.nomes || {}) as Record<string, unknown>;
  const contas: ContasPadrao['contas'] = {};
  const nomes: ContasPadrao['nomes'] = {};
  for (const k of CAMPOS_CONTA_PADRAO) if (texto(c[k])) contas[k] = texto(c[k]);
  for (const k of CONTAS_PADRAO_DO_PLANO) if (texto(n[k])) nomes[k] = texto(n[k]);
  return { contas, nomes };
}

/** O documento `cadastro/{slug}` conferido (campo estranho ou vazio fica de fora). */
export function cadastroDoDocumento(nome: string, codigo: number | null, doc: Record<string, unknown> | null | undefined): CadastroDaEmpresa {
  if (!doc) return cadastroVazio(nome, codigo);
  const bancos = Array.isArray(doc.bancos) ? doc.bancos.map(contaDoDocumento).filter((c): c is ContaBancaria => !!c) : null;
  const historico = Array.isArray(doc.historico)
    ? (doc.historico as Record<string, unknown>[]).map(h => ({ ts: texto(h?.ts), por: texto(h?.por), acao: texto(h?.acao), detalhe: texto(h?.detalhe) })).filter(h => h.ts)
    : [];
  const pl = (doc.plano || null) as Record<string, unknown> | null;
  const plano = pl && typeof pl.contas === 'number' ? { contas: pl.contas, importadoEm: texto(pl.importadoEm) } : undefined;
  return {
    nome, codigo, bancos, contasPadrao: contasPadraoDoDocumento(doc.contasPadrao), historico, ...(plano ? { plano } : {}),
    ...(typeof doc.prestaServico === 'boolean' ? { prestaServico: doc.prestaServico } : {}), atualizadoEm: opcional(doc.atualizadoEm),
  };
}

/** O que vai para o banco (o que nunca foi cadastrado fica de fora, para não virar "cadastrado vazio"). */
export function documentoDoCadastro(c: CadastroDaEmpresa): Record<string, unknown> {
  return {
    nome: c.nome, codigo: c.codigo,
    ...(c.bancos ? { bancos: c.bancos } : {}),
    ...(c.contasPadrao ? { contasPadrao: c.contasPadrao } : {}),
    ...(c.plano ? { plano: c.plano } : {}),
    ...(typeof c.prestaServico === 'boolean' ? { prestaServico: c.prestaServico } : {}),
    historico: c.historico.slice(0, MAX_HISTORICO),
    atualizadoEm: c.atualizadoEm || new Date().toISOString(),
  };
}

/** O documento `cadastro/{slug}/plano/atual` conferido (null = a empresa ainda não tem plano). */
export function planoDoDocumento(doc: Record<string, unknown> | null | undefined): PlanoDeContas | null {
  if (!doc || !Array.isArray(doc.contas)) return null;
  const contas = (doc.contas as Record<string, unknown>[])
    .map((c, i): ContaDoPlano => {
      const x: ContaDoPlano = { codigo: texto(c?.codigo), nome: texto(c?.nome), ordem: typeof c?.ordem === 'number' ? c.ordem : i };
      if (texto(c?.classificacao)) x.classificacao = texto(c.classificacao);
      if (texto(c?.grupo)) x.grupo = texto(c.grupo);
      if (c?.sintetica === true) x.sintetica = true;
      return x;
    })
    .filter(c => c.codigo)
    .sort((a, b) => a.ordem - b.ordem);
  if (!contas.length) return null;
  const p: PlanoDeContas = { contas, origem: doc.origem === 'balancete' ? 'balancete' : 'arquivo', importadoEm: texto(doc.importadoEm) || '' };
  if (texto(doc.arquivo)) p.arquivo = texto(doc.arquivo);
  if (texto(doc.por)) p.por = texto(doc.por);
  return p;
}

// ─── histórico ──────────────────────────────────────────────────────────────

function registrar(c: CadastroDaEmpresa, por: string, agora: Date, acao: string, detalhe: string): CadastroDaEmpresa {
  const r: RegistroCadastro = { ts: agora.toISOString(), por: por || '—', acao, detalhe };
  return { ...c, historico: [r, ...c.historico].slice(0, MAX_HISTORICO), atualizadoEm: r.ts };
}

/** Presta serviços: sim, não, ou volta a "não informado" (null). Fica no histórico; sem mudança, devolve o mesmo. */
export function definirPrestaServico(c: CadastroDaEmpresa, sim: boolean | null, por: string, agora: Date): CadastroDaEmpresa {
  if ((c.prestaServico ?? null) === sim) return c;
  const resto: CadastroDaEmpresa = { ...c };
  delete resto.prestaServico;
  const novo = sim == null ? resto : { ...resto, prestaServico: sim };
  return registrar(novo, por, agora, 'Presta serviços', sim == null ? 'Não informado' : sim ? 'Sim' : 'Não');
}

/** Registra no histórico a troca do plano de contas (o plano mora em outro documento). */
export function registrarPlano(c: CadastroDaEmpresa, p: PlanoDeContas, por: string, agora: Date): CadastroDaEmpresa {
  const de = p.origem === 'balancete' ? 'de um balancete' : (p.arquivo ? 'de ' + p.arquivo : 'de um arquivo');
  const comResumo = { ...c, plano: { contas: p.contas.length, importadoEm: p.importadoEm } };
  return registrar(comResumo, por, agora, 'Importou o plano de contas', p.contas.length + ' contas ' + de);
}

// ─── contas bancárias ───────────────────────────────────────────────────────

export function nomeDoBanco(marca: string): string {
  return BANCOS_CONHECIDOS.find(b => b.id === marca)?.nome || (marca === 'outro' ? 'Outro banco' : marca);
}

/** "Sicoob · Ag. 3001 · C/C 12345-6" (o que tiver). */
export function descreverConta(c: Pick<ContaBancaria, 'nome' | 'agencia' | 'conta'>): string {
  const r = rotuloDaConta(c);
  return c.nome + (r ? ' · ' + r : '');
}

/** A conta vale na competência ('aaaa-mm')? */
export function contaValeNa(c: ContaBancaria, comp: string): boolean {
  return (!c.desde || c.desde <= comp) && (!c.ate || c.ate >= comp);
}

/** A conta está encerrada (hoje = a competência de referência)? */
export function contaEncerrada(c: ContaBancaria, hoje: string): boolean {
  return !!c.ate && c.ate < hoje;
}

/**
 * O ponto de partida da empresa que ainda não tem bancos cadastrados: a lista provisória (empresas/bancos.ts)
 * e os bancos que a pessoa já adicionou na tela do Extrator, com os mesmos ids (os arquivos importados
 * continuam na conta certa). A linha genérica "Banco" (empresa sem nada) não entra.
 */
export function pontoDePartida(codigo: number | null, adicionadosNoExtrator: readonly (BancoDaEmpresa & { desde?: string })[] = []): ContaBancaria[] {
  const lista: ContaBancaria[] = [];
  const todos: (BancoDaEmpresa & { desde?: string })[] = [...bancosDaEmpresa(codigo), ...adicionadosNoExtrator];
  for (const b of todos) {
    if (b.id === 'banco' || lista.some(x => x.id === b.id)) continue;
    const marca = b.marca || b.id;
    const c: ContaBancaria = { id: b.id, marca, nome: b.nome || nomeDoBanco(marca) };
    if (b.agencia) c.agencia = b.agencia;
    if (b.conta) c.conta = b.conta;
    const desde = competencia(b.desde);
    if (desde) c.desde = desde;
    lista.push(c);
  }
  return lista;
}

/** O que a pessoa preenche para incluir ou editar uma conta. */
export interface DadosDaConta {
  marca: string;
  agencia: string;
  conta: string;
  tipo?: TipoContaBancaria;
  apelido?: string;
  contaContabil?: string;
  desde?: string;
}

export interface ResultadoCadastro {
  cadastro: CadastroDaEmpresa;
  /** o motivo de não ter mudado (null = mudou) */
  erro: string | null;
}

/**
 * Inclui (id = null) ou edita uma conta. Ao editar, o id NÃO muda (os arquivos do Extrator ficam presos a ele),
 * mesmo que a agência ou a conta sejam corrigidas. Se a empresa ainda não tinha bancos, começa pelo ponto de partida.
 */
export function salvarConta(c: CadastroDaEmpresa, id: string | null, d: DadosDaConta, partida: readonly ContaBancaria[], por: string, agora: Date): ResultadoCadastro {
  const marca = texto(d.marca);
  const agencia = texto(d.agencia);
  const conta = texto(d.conta);
  if (!marca) return { cadastro: c, erro: 'Escolha o banco.' };
  if (!agencia || !conta) return { cadastro: c, erro: 'Preencha a agência e a conta.' };
  if (d.desde && !competencia(d.desde)) return { cadastro: c, erro: 'A competência de início está inválida.' };
  const bancos = c.bancos ?? [...partida];
  const antes = id ? bancos.find(b => b.id === id) : undefined;
  if (id && !antes) return { cadastro: c, erro: 'Essa conta não está mais no cadastro.' };
  const chave = idDaConta(marca, agencia, conta);
  const novoId = antes ? antes.id : chave;
  const repetida = bancos.some(b => b.id !== antes?.id && (b.id === chave || idDaConta(b.marca, b.agencia || '', b.conta || '') === chave));
  if (repetida) return { cadastro: c, erro: 'Essa conta já está cadastrada.' };
  const nova: ContaBancaria = { id: novoId, marca, nome: nomeDoBanco(marca), agencia, conta };
  if (d.tipo) nova.tipo = d.tipo;
  if (texto(d.apelido)) nova.apelido = texto(d.apelido);
  if (texto(d.contaContabil)) nova.contaContabil = texto(d.contaContabil);
  if (d.desde) nova.desde = d.desde;
  if (antes?.ate) nova.ate = antes.ate;
  const lista = antes ? bancos.map(b => (b.id === novoId ? nova : b)) : [...bancos, nova];
  if (lista.length > MAX_BANCOS) return { cadastro: c, erro: 'São no máximo ' + MAX_BANCOS + ' contas por empresa.' };
  return { cadastro: registrar({ ...c, bancos: lista }, por, agora, antes ? 'Editou conta' : 'Incluiu conta', descreverConta(nova)), erro: null };
}

/** Encerra a conta depois da competência 'ate' (ela some das competências seguintes; as anteriores ficam). */
export function encerrarConta(c: CadastroDaEmpresa, id: string, ate: string, partida: readonly ContaBancaria[], por: string, agora: Date): ResultadoCadastro {
  if (!competencia(ate)) return { cadastro: c, erro: 'Escolha a última competência da conta.' };
  const bancos = c.bancos ?? [...partida];
  const b = bancos.find(x => x.id === id);
  if (!b) return { cadastro: c, erro: 'Essa conta não está mais no cadastro.' };
  if (b.desde && ate < b.desde) return { cadastro: c, erro: 'A conta começou depois dessa competência.' };
  const lista = bancos.map(x => (x.id === id ? { ...x, ate } : x));
  return { cadastro: registrar({ ...c, bancos: lista }, por, agora, 'Encerrou conta', descreverConta(b) + ' · última competência ' + ate.slice(5) + '/' + ate.slice(0, 4)), erro: null };
}

export function reabrirConta(c: CadastroDaEmpresa, id: string, partida: readonly ContaBancaria[], por: string, agora: Date): ResultadoCadastro {
  const bancos = c.bancos ?? [...partida];
  const b = bancos.find(x => x.id === id);
  if (!b) return { cadastro: c, erro: 'Essa conta não está mais no cadastro.' };
  const lista = bancos.map(x => { if (x.id !== id) return x; const resto = { ...x }; delete resto.ate; return resto; });
  return { cadastro: registrar({ ...c, bancos: lista }, por, agora, 'Reabriu conta', descreverConta(b)), erro: null };
}

/** Tira a conta do cadastro (para conta cadastrada por engano; a que existiu e fechou se encerra). */
export function excluirConta(c: CadastroDaEmpresa, id: string, partida: readonly ContaBancaria[], por: string, agora: Date): ResultadoCadastro {
  const bancos = c.bancos ?? [...partida];
  const b = bancos.find(x => x.id === id);
  if (!b) return { cadastro: c, erro: 'Essa conta não está mais no cadastro.' };
  return { cadastro: registrar({ ...c, bancos: bancos.filter(x => x.id !== id) }, por, agora, 'Excluiu conta', descreverConta(b)), erro: null };
}

/** Grava o ponto de partida como o cadastro da empresa (a pessoa confirmou a lista que veio do Extrator). */
export function confirmarPontoDePartida(c: CadastroDaEmpresa, partida: readonly ContaBancaria[], por: string, agora: Date): CadastroDaEmpresa {
  if (c.bancos) return c;
  return registrar({ ...c, bancos: [...partida] }, por, agora, 'Confirmou os bancos', partida.length ? partida.map(descreverConta).join('; ') : 'nenhum banco');
}

// ─── o que o Extrator lê ────────────────────────────────────────────────────

const comoBancoDaEmpresa = (b: ContaBancaria): BancoDaEmpresa => {
  const r: BancoDaEmpresa = { id: b.id, nome: b.nome, marca: b.marca };
  if (b.agencia) r.agencia = b.agencia;
  if (b.conta) r.conta = b.conta;
  return r;
};

/**
 * As linhas de banco do Extrator na competência. Com os bancos cadastrados, são as contas do cadastro que
 * valem nela (nenhuma = a linha genérica "Banco"); sem cadastro, a lista provisória de antes.
 */
export function bancosDoCadastroNa(c: CadastroDaEmpresa | null, codigo: number | null, comp: string): BancoDaEmpresa[] {
  if (!c?.bancos) return bancosDaEmpresa(codigo);
  const valem = c.bancos.filter(b => contaValeNa(b, comp)).map(comoBancoDaEmpresa);
  return valem.length ? valem : bancosDaEmpresa(null);
}

/** O primeiro banco da empresa (os arquivos importados sem banco são dele), em qualquer competência. */
export function primeiroBancoDoCadastro(c: CadastroDaEmpresa | null, codigo: number | null): string {
  if (c?.bancos) return c.bancos[0]?.id ?? 'banco';
  return bancosDaEmpresa(codigo)[0].id;
}

// ─── contas padrão ──────────────────────────────────────────────────────────

export const ROTULO_CONTA_PADRAO: Record<CampoContaPadrao, string> = {
  banco: 'Conta do banco (liquidação de títulos)',
  juros: 'Juros recebidos',
  desconto: 'Descontos concedidos',
  histPrincipal: 'Histórico do principal',
  histJuros: 'Histórico dos juros',
  histDesconto: 'Histórico dos descontos',
};

/** Grava uma conta padrão (vazio = volta ao padrão do aplicativo). Se for do plano, guarda o nome dela. */
export function definirContaPadrao(c: CadastroDaEmpresa, campo: CampoContaPadrao, codigo: string, plano: PlanoDeContas | null, por: string, agora: Date): CadastroDaEmpresa {
  const v = texto(codigo);
  const atual: ContasPadrao = c.contasPadrao ?? { contas: {}, nomes: {} };
  if ((atual.contas[campo] || '') === v && c.contasPadrao) return c;
  const contas = { ...atual.contas };
  const nomes = { ...atual.nomes };
  if (v) contas[campo] = v; else delete contas[campo];
  if ((CONTAS_PADRAO_DO_PLANO as readonly string[]).includes(campo)) {
    const k = campo as ContaPadraoDoPlano;
    const noPlano = v ? contaNoPlano(plano, v) : null;
    if (noPlano) nomes[k] = noPlano.nome; else delete nomes[k];
  }
  const detalhe = ROTULO_CONTA_PADRAO[campo] + ': ' + (v || 'padrão do aplicativo');
  return registrar({ ...c, contasPadrao: { contas, nomes } }, por, agora, 'Mudou conta padrão', detalhe);
}

/**
 * Troca as contas padrão de uma vez (quem grava é outro aplicativo, como o Creditor ao confirmar as contas).
 * Nada mudou = o mesmo cadastro (não grava à toa); mudou = registra quais campos.
 */
export function comContasPadrao(c: CadastroDaEmpresa, novas: ContasPadrao, por: string, agora: Date): CadastroDaEmpresa {
  const antes = c.contasPadrao ?? { contas: {}, nomes: {} };
  const mudaram = CAMPOS_CONTA_PADRAO.filter(k => (antes.contas[k] || '') !== (novas.contas[k] || ''));
  const nomesMudaram = CONTAS_PADRAO_DO_PLANO.some(k => (antes.nomes[k] || '') !== (novas.nomes[k] || ''));
  if (c.contasPadrao && !mudaram.length && !nomesMudaram) return c;
  const contas: ContasPadrao['contas'] = {};
  const nomes: ContasPadrao['nomes'] = {};
  for (const k of CAMPOS_CONTA_PADRAO) if (texto(novas.contas[k])) contas[k] = texto(novas.contas[k]);
  for (const k of CONTAS_PADRAO_DO_PLANO) if (texto(novas.nomes[k])) nomes[k] = texto(novas.nomes[k]);
  const detalhe = mudaram.length ? mudaram.map(k => ROTULO_CONTA_PADRAO[k] + ': ' + (contas[k] || 'padrão do aplicativo')).join('; ') : 'nomes das contas conferidos';
  return registrar({ ...c, contasPadrao: { contas, nomes } }, por, agora, 'Mudou conta padrão', detalhe);
}

/** Aviso de uma conta usada no cadastro que não bate com o plano atual (null = tudo certo ou sem plano). */
export function avisoDaConta(codigo: string | undefined, plano: PlanoDeContas | null, nomeAntes?: string): string | null {
  if (!codigo || !plano) return null;
  const c = contaNoPlano(plano, codigo);
  if (!c) return 'A conta ' + codigo + ' não está no plano de contas.';
  if (c.sintetica) return 'A conta ' + codigo + ' é sintética (não recebe lançamento).';
  if (nomeAntes && nomeNorm(nomeAntes) !== nomeNorm(c.nome)) return 'Mudou de nome no plano: era "' + nomeAntes + '".';
  return null;
}

// ─── plano de contas ────────────────────────────────────────────────────────

export function contaNoPlano(plano: PlanoDeContas | null, codigo: string): ContaDoPlano | null {
  const v = texto(codigo);
  return (v && plano?.contas.find(c => c.codigo === v)) || null;
}

/** Contas do plano que batem com o texto: código ou classificação que começa com ele, ou o nome. */
export function buscarNoPlano(contas: readonly ContaDoPlano[], q: string, soAnaliticas = false): ContaDoPlano[] {
  const t = texto(q);
  const base = soAnaliticas ? contas.filter(c => !c.sintetica) : contas;
  if (!t) return [...base];
  const n = nomeNorm(t);
  const peso = (c: ContaDoPlano) => (c.codigo === t ? 0 : c.codigo.startsWith(t) ? 1 : c.classificacao?.startsWith(t) ? 2 : 3);
  return base
    .filter(c => c.codigo.startsWith(t) || !!c.classificacao?.startsWith(t) || (!!n && nomeNorm(c.nome).includes(n)))
    .sort((a, b) => peso(a) - peso(b) || a.ordem - b.ordem);
}

export interface ResumoDoPlano { total: number; analiticas: number; grupos: { grupo: string; qtd: number }[] }

export function resumoDoPlano(contas: readonly ContaDoPlano[]): ResumoDoPlano {
  const grupos = new Map<string, number>();
  for (const c of contas) if (c.grupo) grupos.set(c.grupo, (grupos.get(c.grupo) || 0) + 1);
  return { total: contas.length, analiticas: contas.filter(c => !c.sintetica).length, grupos: [...grupos].map(([grupo, qtd]) => ({ grupo, qtd })) };
}

/** O que muda ao trocar o plano: contas novas, que saem e que mudam de nome; e as usadas no cadastro que somem. */
export interface MudancaDoPlano { novas: number; saem: number; renomeadas: number; usadasQueSaem: string[] }

export function compararPlanos(antes: PlanoDeContas | null, depois: readonly ContaDoPlano[], c: CadastroDaEmpresa): MudancaDoPlano {
  const velhas = new Map((antes?.contas || []).map(x => [x.codigo, x.nome]));
  const novas = new Set(depois.map(x => x.codigo));
  const usadas = [
    ...(c.bancos || []).filter(b => b.contaContabil).map(b => ({ codigo: b.contaContabil as string, onde: descreverConta(b) })),
    ...CONTAS_PADRAO_DO_PLANO.filter(k => c.contasPadrao?.contas[k]).map(k => ({ codigo: c.contasPadrao?.contas[k] as string, onde: ROTULO_CONTA_PADRAO[k] })),
  ];
  return {
    novas: depois.filter(x => !velhas.has(x.codigo)).length,
    saem: [...velhas.keys()].filter(k => !novas.has(k)).length,
    renomeadas: depois.filter(x => velhas.has(x.codigo) && nomeNorm(velhas.get(x.codigo)) !== nomeNorm(x.nome)).length,
    usadasQueSaem: usadas.filter(u => !novas.has(u.codigo)).map(u => u.codigo + ' (' + u.onde + ')'),
  };
}
