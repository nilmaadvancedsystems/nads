// O arquivo físico do escritório (19/11/2026: "preciso montar no nads um controle do arquivo físico … os documentos ficam em
// caixas, e dentro de cada caixa há envelopes"). As decisões do dono, no mesmo dia:
//   - a caixa é de uma empresa, de um ano e de um departamento, numerada dentro deles (a planilha "Etiquetas Caixa Box":
//     o código do cliente, o tipo PJ-F, a data do arquivamento, o ano, o código da caixa 001, a localização e observações);
//   - o envelope é de um mês (a etiqueta do mês do Cadastro: MOVIMENTO MM/AAAA, o código, o nome, PJ-F e o departamento);
//   - todo o escritório cadastra e retira; descartar é só do admin;
//   - a retirada simples: quem levou, quando, para quê e quando voltou;
//   - o descarte pelo prazo de guarda do departamento (prazos comuns, que o escritório ajusta).
// No banco, uma caixa é um documento (arquivoFisico/{id}) com os envelopes dentro: abrir a lista lê as caixas uma vez.
// Tudo puro: a tela e o banco ficam em apps/web.
import { DEPARTAMENTOS_DO_ENVELOPE, type DepartamentoDoEnvelope } from '../tarefas/regras/etiquetasDoEnvelope';

export type Departamento = DepartamentoDoEnvelope;
export const DEPARTAMENTOS: readonly Departamento[] = DEPARTAMENTOS_DO_ENVELOPE;

/** Uma retirada (da caixa inteira ou de um envelope). Aberta enquanto `devolvidaEm` está vazio. */
export interface Retirada {
  id: string;
  quem: string;
  motivo: string;
  /** ISO */
  em: string;
  devolvidaEm: string;
  devolvidaPor: string;
}

export interface Envelope {
  id: string;
  /** 'AAAA-MM' (o mês do movimento) ou 'AAAA' (o ano todo, como a DEFIS) */
  competencia: string;
  departamento: Departamento;
  observacao: string;
  retiradas: Retirada[];
}

export interface Caixa {
  /** '565-2026-F-001' (idDaCaixa) */
  id: string;
  /** a empresa do Cadastro: o código e o nome */
  codigo: number;
  nome: string;
  /** o tipo como sai na etiqueta: 'PJ-F', 'PF-P'… */
  tipo: string;
  departamento: Departamento;
  ano: number;
  /** o código da caixa dentro da empresa, do ano e do departamento (1 → '001') */
  numero: number;
  /** 'AAAA-MM-DD' */
  arquivadaEm: string;
  /** onde ela está: sala, estante, prateleira (texto livre) */
  local: string;
  observacoes: string;
  envelopes: Envelope[];
  retiradas: Retirada[];
  /** 'AAAA-MM-DD' quando foi descartada (ela fica na lista, marcada) */
  descartadaEm: string;
  descartadaPor: string;
  atualizadaEm: string;
  atualizadaPor: string;
}

const pad = (n: number, t = 2) => String(n).padStart(t, '0');
const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** A letra do departamento (a mesma do PJ-F da etiqueta). */
export const letraDoDepartamento = (d: Departamento) => (d === 'Contábil' ? 'C' : d === 'Pessoal' ? 'P' : 'F');

/** O código da caixa como se escreve na etiqueta: 1 → '001'. */
export const codigoDaCaixa = (numero: number) => pad(Math.max(0, Math.floor(numero)), 3);

/** O id da caixa no banco: o código da empresa, o ano, a letra do departamento e o código da caixa ('565-2026-F-001'). */
export function idDaCaixa(c: Pick<Caixa, 'codigo' | 'ano' | 'departamento' | 'numero'>): string {
  return c.codigo + '-' + c.ano + '-' + letraDoDepartamento(c.departamento) + '-' + codigoDaCaixa(c.numero);
}

/** Como a caixa aparece numa linha: '565 · 2026 · PJ-F · caixa 001'. */
export const rotuloDaCaixa = (c: Pick<Caixa, 'codigo' | 'ano' | 'tipo' | 'numero'>) => c.codigo + ' · ' + c.ano + ' · ' + c.tipo + ' · caixa ' + codigoDaCaixa(c.numero);

/** O próximo código de caixa da empresa naquele ano e departamento (a maior + 1; a primeira é 1). */
export function proximoNumero(caixas: readonly Caixa[], codigo: number, ano: number, departamento: Departamento): number {
  return caixas.filter(c => c.codigo === codigo && c.ano === ano && c.departamento === departamento).reduce((m, c) => Math.max(m, c.numero), 0) + 1;
}

const COMPETENCIA = /^(\d{4})(?:-(0[1-9]|1[0-2]))?$/;
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** '2026-03' → '03/2026'; '2026' → '2026 (ano todo)'. */
export function rotuloDaCompetencia(c: string): string {
  const m = COMPETENCIA.exec(c);
  if (!m) return c;
  return m[2] ? m[2] + '/' + m[1] : m[1] + ' (ano todo)';
}

/** Os envelopes em ordem: o ano todo antes dos meses, os meses em ordem, depois a observação. */
export function ordenarEnvelopes(envs: readonly Envelope[]): Envelope[] {
  return [...envs].sort((a, b) => a.competencia.localeCompare(b.competencia) || a.departamento.localeCompare(b.departamento) || a.observacao.localeCompare(b.observacao, 'pt-BR'));
}

/** Os meses da caixa, curtos: 'jan–dez' quando são seguidos, 'jan, mar, jul' quando não; vazio sem envelope de mês. */
export function mesesDaCaixa(c: Pick<Caixa, 'envelopes' | 'ano'>): string {
  const meses = [...new Set(c.envelopes.map(e => COMPETENCIA.exec(e.competencia)).filter(m => m && m[2] && Number(m[1]) === c.ano).map(m => Number((m as RegExpExecArray)[2])))].sort((a, b) => a - b);
  if (!meses.length) return '';
  const seguidos = meses.every((m, i) => i === 0 || m === meses[i - 1] + 1);
  if (seguidos && meses.length > 2) return MESES_CURTOS[meses[0] - 1] + '–' + MESES_CURTOS[meses[meses.length - 1] - 1];
  return meses.map(m => MESES_CURTOS[m - 1]).join(', ');
}

// ---------------------------------------------------------------------------------------------------------------------
// cadastrar
// ---------------------------------------------------------------------------------------------------------------------

/** O que a tela manda para criar ou mudar uma caixa (os envelopes e as retiradas ficam como estão). */
export interface RascunhoDaCaixa {
  codigo: number | null;
  nome: string;
  tipo: string;
  departamento: Departamento;
  ano: number | null;
  numero: number | null;
  arquivadaEm: string;
  local: string;
  observacoes: string;
}

/** O que falta ou está errado no rascunho ('' quando dá para salvar). `idAtual`: a caixa que está sendo mudada. */
export function problemaDaCaixa(r: RascunhoDaCaixa, caixas: readonly Caixa[], idAtual: string | null, anoDeHoje: number): string {
  if (r.codigo == null || !r.nome.trim()) return 'Escolha a empresa.';
  if (r.ano == null || !Number.isInteger(r.ano) || r.ano < 1950 || r.ano > anoDeHoje + 1) return 'O ano da caixa não vale.';
  if (r.numero == null || !Number.isInteger(r.numero) || r.numero < 1 || r.numero > 999) return 'O código da caixa vai de 001 a 999.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.arquivadaEm)) return 'A data do arquivamento não vale.';
  const id = idDaCaixa({ codigo: r.codigo, ano: r.ano, departamento: r.departamento, numero: r.numero });
  if (id !== idAtual && caixas.some(c => c.id === id)) return 'Já existe a caixa ' + codigoDaCaixa(r.numero) + ' de ' + r.codigo + ' em ' + r.ano + ' (' + r.departamento + ').';
  return '';
}

/** A caixa nova, sem envelopes (ou a mudada, com os envelopes e as retiradas dela). */
export function montarCaixa(r: RascunhoDaCaixa, quem: string, agora: string, antes: Caixa | null = null): Caixa {
  const base = { codigo: r.codigo as number, ano: r.ano as number, departamento: r.departamento, numero: r.numero as number };
  return {
    id: idDaCaixa(base), ...base, nome: r.nome.trim(), tipo: r.tipo.trim(), arquivadaEm: r.arquivadaEm, local: r.local.trim(), observacoes: r.observacoes.trim(),
    envelopes: antes ? antes.envelopes : [], retiradas: antes ? antes.retiradas : [],
    descartadaEm: antes?.descartadaEm || '', descartadaPor: antes?.descartadaPor || '',
    atualizadaEm: agora, atualizadaPor: quem,
  };
}

/** O próximo id numa lista ('e1', 'e2'… ou 'r1', 'r2'…), sem repetir um que já existe. */
function proximoId(prefixo: string, ids: readonly string[]): string {
  const n = ids.reduce((m, id) => { const x = new RegExp('^' + prefixo + '(\\d+)$').exec(id); return x ? Math.max(m, Number(x[1])) : m; }, 0);
  return prefixo + (n + 1);
}

/**
 * Põe envelopes na caixa: um por competência (o cadastro rápido marca os meses de uma vez). Um envelope igual (a mesma
 * competência, departamento e observação) não entra duas vezes: volta em `repetidos`.
 */
export function adicionarEnvelopes(c: Caixa, competencias: readonly string[], departamento: Departamento, observacao: string, quem: string, agora: string): { caixa: Caixa; novos: number; repetidos: string[] } {
  const obs = observacao.trim();
  const envelopes = [...c.envelopes];
  const repetidos: string[] = [];
  let novos = 0;
  for (const comp of [...new Set(competencias)]) {
    if (!COMPETENCIA.test(comp)) continue;
    if (envelopes.some(e => e.competencia === comp && e.departamento === departamento && semAcento(e.observacao) === semAcento(obs))) { repetidos.push(comp); continue; }
    envelopes.push({ id: proximoId('e', envelopes.map(e => e.id)), competencia: comp, departamento, observacao: obs, retiradas: [] });
    novos++;
  }
  return { caixa: novos ? { ...c, envelopes: ordenarEnvelopes(envelopes), atualizadaEm: agora, atualizadaPor: quem } : c, novos, repetidos };
}

/** Muda a observação (ou a competência) de um envelope. */
export function mudarEnvelope(c: Caixa, id: string, campos: Partial<Pick<Envelope, 'competencia' | 'observacao' | 'departamento'>>, quem: string, agora: string): Caixa {
  return { ...c, envelopes: ordenarEnvelopes(c.envelopes.map(e => (e.id === id ? { ...e, ...campos, observacao: (campos.observacao ?? e.observacao).trim() } : e))), atualizadaEm: agora, atualizadaPor: quem };
}

/** Tira o envelope da caixa (o que está retirado não sai: precisa voltar antes). */
export function removerEnvelope(c: Caixa, id: string, quem: string, agora: string): { caixa: Caixa; problema: string } {
  const e = c.envelopes.find(x => x.id === id);
  if (!e) return { caixa: c, problema: 'Esse envelope não está nesta caixa.' };
  if (retiradaAberta(e.retiradas)) return { caixa: c, problema: 'O envelope está retirado: registre a devolução antes.' };
  return { caixa: { ...c, envelopes: c.envelopes.filter(x => x.id !== id), atualizadaEm: agora, atualizadaPor: quem }, problema: '' };
}

// ---------------------------------------------------------------------------------------------------------------------
// retirar e devolver
// ---------------------------------------------------------------------------------------------------------------------

/** A retirada que ainda não voltou (ou null). */
export const retiradaAberta = (rs: readonly Retirada[]) => rs.find(r => !r.devolvidaEm) || null;

/** De quem é a retirada: a caixa inteira (envelope null) ou um envelope dela. */
export interface Alvo { envelope: string | null }

/** Registra que alguém levou a caixa (ou um envelope). Não deixa retirar o que já está fora, nem a caixa descartada. */
export function retirar(c: Caixa, alvo: Alvo, quem: string, motivo: string, agora: string): { caixa: Caixa; problema: string } {
  if (c.descartadaEm) return { caixa: c, problema: 'A caixa foi descartada.' };
  if (!quem.trim()) return { caixa: c, problema: 'Diga quem está levando.' };
  if (retiradaAberta(c.retiradas)) return { caixa: c, problema: 'A caixa inteira já está retirada.' };
  const nova = (rs: readonly Retirada[]): Retirada[] => [...rs, { id: proximoId('r', rs.map(r => r.id)), quem: quem.trim(), motivo: motivo.trim(), em: agora, devolvidaEm: '', devolvidaPor: '' }];
  if (alvo.envelope == null) return { caixa: { ...c, retiradas: nova(c.retiradas), atualizadaEm: agora, atualizadaPor: quem.trim() }, problema: '' };
  const e = c.envelopes.find(x => x.id === alvo.envelope);
  if (!e) return { caixa: c, problema: 'Esse envelope não está nesta caixa.' };
  if (retiradaAberta(e.retiradas)) return { caixa: c, problema: 'O envelope já está retirado.' };
  return { caixa: { ...c, envelopes: c.envelopes.map(x => (x.id === e.id ? { ...x, retiradas: nova(x.retiradas) } : x)), atualizadaEm: agora, atualizadaPor: quem.trim() }, problema: '' };
}

/** Registra a volta da caixa (ou do envelope). */
export function devolver(c: Caixa, alvo: Alvo, quem: string, agora: string): { caixa: Caixa; problema: string } {
  const fecha = (rs: readonly Retirada[]) => rs.map(r => (r.devolvidaEm ? r : { ...r, devolvidaEm: agora, devolvidaPor: quem }));
  if (alvo.envelope == null) {
    if (!retiradaAberta(c.retiradas)) return { caixa: c, problema: 'A caixa não está retirada.' };
    return { caixa: { ...c, retiradas: fecha(c.retiradas), atualizadaEm: agora, atualizadaPor: quem }, problema: '' };
  }
  const e = c.envelopes.find(x => x.id === alvo.envelope);
  if (!e || !retiradaAberta(e.retiradas)) return { caixa: c, problema: 'O envelope não está retirado.' };
  return { caixa: { ...c, envelopes: c.envelopes.map(x => (x.id === e.id ? { ...x, retiradas: fecha(x.retiradas) } : x)), atualizadaEm: agora, atualizadaPor: quem }, problema: '' };
}

export type SituacaoDaCaixa = 'no-lugar' | 'envelope-fora' | 'retirada' | 'descartada';
export const ROTULO_DA_SITUACAO: Record<SituacaoDaCaixa, string> = { 'no-lugar': 'No lugar', 'envelope-fora': 'Envelope fora', retirada: 'Retirada', descartada: 'Descartada' };

export function situacaoDaCaixa(c: Caixa): SituacaoDaCaixa {
  if (c.descartadaEm) return 'descartada';
  if (retiradaAberta(c.retiradas)) return 'retirada';
  if (c.envelopes.some(e => retiradaAberta(e.retiradas))) return 'envelope-fora';
  return 'no-lugar';
}

/** O que está fora agora: a caixa (envelope null) ou o envelope, com a retirada e há quantos dias. O mais antigo primeiro. */
export interface Emprestimo { caixa: Caixa; envelope: Envelope | null; retirada: Retirada; dias: number }
export function emprestados(caixas: readonly Caixa[], agora: Date): Emprestimo[] {
  const dias = (iso: string) => Math.max(0, Math.floor((agora.getTime() - new Date(iso).getTime()) / 86_400_000));
  const fora: Emprestimo[] = [];
  for (const c of caixas) {
    const r = retiradaAberta(c.retiradas);
    if (r) fora.push({ caixa: c, envelope: null, retirada: r, dias: dias(r.em) });
    for (const e of c.envelopes) { const re = retiradaAberta(e.retiradas); if (re) fora.push({ caixa: c, envelope: e, retirada: re, dias: dias(re.em) }); }
  }
  return fora.sort((a, b) => a.retirada.em.localeCompare(b.retirada.em));
}

// ---------------------------------------------------------------------------------------------------------------------
// achar
// ---------------------------------------------------------------------------------------------------------------------

export interface FiltroDoArquivo {
  /** o código da empresa (só números: o código exato), o nome, o local ou a observação */
  texto: string;
  departamento: Departamento | '';
  ano: number | null;
  /** 1 a 12: só as caixas com o envelope desse mês (e, na resposta, só esses envelopes) */
  mes: number | null;
  situacao: SituacaoDaCaixa | '' | 'ativas';
  /** o lugar exato (a etiqueta da fileira abre a lista com ele): 'Prateleira 1 · Fileira 3'; vazio, todos */
  local?: string;
}
export const FILTRO_VAZIO: FiltroDoArquivo = { texto: '', departamento: '', ano: null, mes: null, situacao: 'ativas' };

/** Uma caixa achada e os envelopes dela que batem (todos, quando o filtro não fala de envelope). */
export interface Achado { caixa: Caixa; envelopes: Envelope[]; situacao: SituacaoDaCaixa }

/**
 * A busca rápida: empresa, departamento, ano e mês. O texto em números é o código da empresa (exato); em letras procura no
 * nome, no local e nas observações da caixa e dos envelopes (os envelopes que batem pelo texto vêm marcados). Por padrão
 * ('ativas') as descartadas ficam de fora. A ordem: código, ano (o mais novo primeiro), departamento, código da caixa.
 */
export function buscar(caixas: readonly Caixa[], f: FiltroDoArquivo): Achado[] {
  const q = semAcento(f.texto.trim());
  const soCodigo = /^\d+$/.test(q);
  const achados: Achado[] = [];
  for (const c of caixas) {
    const sit = situacaoDaCaixa(c);
    if (f.situacao === 'ativas' ? sit === 'descartada' : f.situacao && sit !== f.situacao) continue;
    if (f.departamento && c.departamento !== f.departamento) continue;
    if (f.ano != null && c.ano !== f.ano) continue;
    if (f.local && semAcento(c.local.trim()) !== semAcento(f.local.trim())) continue;
    let envs = c.envelopes;
    if (f.mes != null) {
      const comp = (f.ano ?? c.ano) + '-' + pad(f.mes);
      envs = envs.filter(e => e.competencia === comp);
      if (!envs.length) continue;
    }
    if (q) {
      if (soCodigo) { if (String(c.codigo) !== q) continue; }
      else {
        const naCaixa = semAcento(c.nome + ' ' + c.local + ' ' + c.observacoes).includes(q);
        const nosEnvelopes = envs.filter(e => semAcento(e.observacao).includes(q));
        if (!naCaixa && !nosEnvelopes.length) continue;
        if (!naCaixa) envs = nosEnvelopes;
      }
    }
    achados.push({ caixa: c, envelopes: ordenarEnvelopes(envs), situacao: sit });
  }
  return achados.sort((a, b) => a.caixa.codigo - b.caixa.codigo || b.caixa.ano - a.caixa.ano || a.caixa.departamento.localeCompare(b.caixa.departamento) || a.caixa.numero - b.caixa.numero);
}

/** Os anos que têm caixa (o filtro de ano), do mais novo para o mais velho. */
export const anosDasCaixas = (caixas: readonly Caixa[]) => [...new Set(caixas.map(c => c.ano))].sort((a, b) => b - a);

// ---------------------------------------------------------------------------------------------------------------------
// descarte
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Os prazos de guarda, em anos, contados do 1º de janeiro do ano seguinte ao da caixa (como a decadência dos tributos). Os
 * comuns nos escritórios: os papéis fiscais 5 anos; os contábeis (livros, balancetes) 10; os do pessoal (folha, FGTS,
 * INSS) 10. O escritório confere e ajusta (decisão de 19/11/2026: "com prazos comuns").
 */
export type PrazosDeGuarda = Record<Departamento, number>;
export const PRAZOS_PADRAO: PrazosDeGuarda = { Fiscal: 5, 'Contábil': 10, Pessoal: 10 };

/** Desde quando a caixa pode ser descartada ('AAAA-MM-DD'): 1º de janeiro de (ano + 1 + prazo). */
export const descarteLiberadoEm = (c: Pick<Caixa, 'ano' | 'departamento'>, prazos: PrazosDeGuarda = PRAZOS_PADRAO) => (c.ano + 1 + prazos[c.departamento]) + '-01-01';

/** As caixas que já passaram do prazo e ainda não foram descartadas (as mais velhas primeiro). `hoje`: 'AAAA-MM-DD'. */
export function paraDescartar(caixas: readonly Caixa[], hoje: string, prazos: PrazosDeGuarda = PRAZOS_PADRAO): Caixa[] {
  return caixas.filter(c => !c.descartadaEm && descarteLiberadoEm(c, prazos) <= hoje)
    .sort((a, b) => a.ano - b.ano || a.codigo - b.codigo || a.numero - b.numero);
}

/** Marca a caixa como descartada (só o admin chega aqui). Não descarta o que está fora nem o que ainda está no prazo. */
export function descartar(c: Caixa, quem: string, hoje: string, prazos: PrazosDeGuarda = PRAZOS_PADRAO): { caixa: Caixa; problema: string } {
  if (c.descartadaEm) return { caixa: c, problema: 'A caixa já foi descartada.' };
  if (situacaoDaCaixa(c) !== 'no-lugar') return { caixa: c, problema: 'Há coisa retirada desta caixa: registre a devolução antes.' };
  const desde = descarteLiberadoEm(c, prazos);
  if (desde > hoje) return { caixa: c, problema: 'Ainda no prazo de guarda: pode descartar a partir de ' + desde.split('-').reverse().join('/') + '.' };
  return { caixa: { ...c, descartadaEm: hoje, descartadaPor: quem, atualizadaEm: hoje, atualizadaPor: quem }, problema: '' };
}

// ---------------------------------------------------------------------------------------------------------------------
// o banco
// ---------------------------------------------------------------------------------------------------------------------

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
const txt = (v: unknown) => (typeof v === 'string' ? v : '');
const lista = (v: unknown): Obj[] => (Array.isArray(v) ? v.map(obj) : []);
const departamento = (v: unknown): Departamento => (DEPARTAMENTOS.includes(v as Departamento) ? (v as Departamento) : 'Fiscal');
const lerRetiradas = (v: unknown): Retirada[] => lista(v).map(r => ({ id: txt(r.id), quem: txt(r.quem), motivo: txt(r.motivo), em: txt(r.em), devolvidaEm: txt(r.devolvidaEm), devolvidaPor: txt(r.devolvidaPor) })).filter(r => r.id && r.em);

/** A caixa como veio do banco (o que faltar vira vazio); null quando não dá para ser uma caixa. */
export function lerCaixa(id: string, d: unknown): Caixa | null {
  const x = obj(d);
  const codigo = Number(x.codigo), ano = Number(x.ano), numero = Number(x.numero);
  if (!Number.isInteger(codigo) || !Number.isInteger(ano) || !Number.isInteger(numero) || codigo <= 0) return null;
  return {
    id, codigo, nome: txt(x.nome), tipo: txt(x.tipo), departamento: departamento(x.departamento), ano, numero,
    arquivadaEm: txt(x.arquivadaEm), local: txt(x.local), observacoes: txt(x.observacoes),
    envelopes: ordenarEnvelopes(lista(x.envelopes).map(e => ({ id: txt(e.id), competencia: txt(e.competencia), departamento: departamento(e.departamento), observacao: txt(e.observacao), retiradas: lerRetiradas(e.retiradas) })).filter(e => e.id && COMPETENCIA.test(e.competencia))),
    retiradas: lerRetiradas(x.retiradas),
    descartadaEm: txt(x.descartadaEm), descartadaPor: txt(x.descartadaPor), atualizadaEm: txt(x.atualizadaEm), atualizadaPor: txt(x.atualizadaPor),
  };
}

/** O documento que vai para o banco (sem o id, que é o nome do documento). */
export function paraOBanco(c: Caixa): Obj {
  const resto: Obj = { ...c };
  delete resto.id;
  return resto;
}

/** O endereço que o QR da etiqueta abre: a caixa no nads (e o envelope, quando é a etiqueta do envelope). */
export function linkDaCaixa(origem: string, id: string, envelope?: string): string {
  return origem.replace(/\/+$/, '') + '/tarefas/arquivo-fisico/caixas?caixa=' + encodeURIComponent(id) + (envelope ? '&envelope=' + encodeURIComponent(envelope) : '');
}
