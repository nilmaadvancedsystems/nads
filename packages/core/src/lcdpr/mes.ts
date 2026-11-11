// O LCDPR mês a mês (11/11/2026: "precisa que tenha um controle mes a mes de cada um das coisas importadas pois preciso
// poder alterar a conta que vai lancar optando pelos bancos de carlos lucas e caixa para ja lancar corretamente"): os
// lançamentos de cada competência ficam guardados (antes moravam só na tela e sumiam ao recarregar), com a categoria e a
// conta de pagamento (a Conta Credora da planilha: o Caixa ou um banco do produtor) escolhidas. A conta escolhida fica
// lembrada por fornecedor: o próximo lançamento dele já vem com ela.
import { bancosCitados, marcaDoBanco } from '../extratudo/conversor/regras/arquivo';
import { soDigitos } from './classificar';
import type { ConfigLcdpr, ContaDoPlano, Lancamento, OrigemDaRegra, OrigemDoDocumento } from './tipos';

/** Um arquivo (ou um "Puxar do SIEG") lido no mês: quantos entraram, o que deu errado e quais lançamentos vieram dele (o Desfazer). */
export interface ImportacaoDoMes {
  id: string;
  /** o nome do arquivo, ou "SIEG" */
  arquivo: string;
  bytes: number;
  em: string;
  quantos: number;
  /** os que já estavam no mês (não entram de novo) */
  repetidos: number;
  erro: string;
  ids: number[];
  /** quando foi desfeita ('' = não foi) */
  desfeita: string;
  por: string;
}

/** lcdprEmpresas/{empresa}/meses/{AAAA-MM}: os lançamentos da competência e o que foi importado nela. */
export interface MesDoLcdpr {
  empresa: number;
  competencia: string;
  lancamentos: Lancamento[];
  importacoes: ImportacaoDoMes[];
  /** quando e quem baixou a planilha depois da última mudança ('' = ainda não, ou mudou depois) */
  baixadaEm: string;
  baixadaPor: string;
  atualizadoEm: string;
  atualizadoPor: string;
}

/** Quantos arquivos lidos ficam na lista do mês. */
export const IMPORTACOES_GUARDADAS = 40;

export const mesVazio = (empresa: number, competencia: string): MesDoLcdpr => ({
  empresa, competencia, lancamentos: [], importacoes: [], baixadaEm: '', baixadaPor: '', atualizadoEm: '', atualizadoPor: '',
});

const texto = (v: unknown, max = 2000) => (typeof v === 'string' ? v.slice(0, max) : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
const numero = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const REGRAS: readonly OrigemDaRegra[] = ['NCM', 'Padrão CT-e', 'Manual', 'Nenhuma'];

/** Um lançamento guardado no banco (o que não é lançamento fica de fora). */
export function lancamentoGuardado(v: unknown): Lancamento | null {
  const o = obj(v);
  const id = numero(o.id);
  if (!id) return null;
  const origem: OrigemDoDocumento = o.origem === 'CTe' || o.origem === 'Manual' ? o.origem : 'NF';
  const origemRegra = REGRAS.includes(o.origemRegra as OrigemDaRegra) ? (o.origemRegra as OrigemDaRegra) : 'Nenhuma';
  return {
    id, origem, data: texto(o.data, 10), documento: texto(o.documento, 60), cnpj: soDigitos(o.cnpj), fornecedor: texto(o.fornecedor, 200),
    categoria: texto(o.categoria, 200), contaDeved: texto(o.contaDeved, 30), contaCred: texto(o.contaCred, 30), codHist: texto(o.codHist, 30),
    historico: texto(o.historico, 600), valor: numero(o.valor), imovel: texto(o.imovel, 30), tipoDoc: texto(o.tipoDoc, 30), tipoLanc: texto(o.tipoLanc, 30),
    produto: texto(o.produto, 600), ncm: texto(o.ncm, 300), revisar: o.revisar === true, origemRegra,
    ...(texto(o.chave, 60) ? { chave: texto(o.chave, 60) } : {}),
  };
}

/** O mês lido do banco (sem o documento, o mês vazio). */
export function mesDoDocumento(d: unknown, empresa: number, competencia: string): MesDoLcdpr {
  const o = obj(d);
  const lancamentos = (Array.isArray(o.lancamentos) ? o.lancamentos : []).map(lancamentoGuardado).filter((l): l is Lancamento => !!l);
  const importacoes = (Array.isArray(o.importacoes) ? o.importacoes : []).map(v => {
    const i = obj(v);
    return {
      id: texto(i.id, 80), arquivo: texto(i.arquivo, 200), bytes: numero(i.bytes), em: texto(i.em, 40), quantos: numero(i.quantos), repetidos: numero(i.repetidos),
      erro: texto(i.erro, 300), ids: (Array.isArray(i.ids) ? i.ids : []).map(numero).filter(Boolean), desfeita: texto(i.desfeita, 40), por: texto(i.por, 100),
    };
  }).filter(i => i.id);
  return {
    empresa, competencia, lancamentos, importacoes,
    baixadaEm: texto(o.baixadaEm, 40), baixadaPor: texto(o.baixadaPor, 100), atualizadoEm: texto(o.atualizadoEm, 40), atualizadoPor: texto(o.atualizadoPor, 100),
  };
}

/** O documento para gravar (cópias soltas; só as últimas importações). */
export function documentoDoMes(m: MesDoLcdpr): Record<string, unknown> {
  return JSON.parse(JSON.stringify({ ...m, importacoes: m.importacoes.slice(0, IMPORTACOES_GUARDADAS) })) as Record<string, unknown>;
}

/** O id do próximo lançamento do mês (não repete os que estão guardados). */
export const proximoIdDoMes = (lancs: readonly Pick<Lancamento, 'id'>[]): number => lancs.reduce((n, l) => Math.max(n, l.id), 0) + 1;

/** O mesmo documento do mesmo fornecedor (a nota do relatório e a do SIEG são a mesma). */
export const chaveDoLancamento = (l: Pick<Lancamento, 'origem' | 'documento' | 'cnpj'>) => l.origem + '|' + String(l.documento || '').trim() + '|' + soDigitos(l.cnpj);

/** Os novos que ainda não estão no mês (nem repetidos entre si); os repetidos não entram. */
export function juntarNoMes(atuais: readonly Lancamento[], novos: readonly Lancamento[]): { lancamentos: Lancamento[]; entraram: Lancamento[]; repetidos: number } {
  const tem = new Set(atuais.map(chaveDoLancamento));
  const entraram: Lancamento[] = [];
  for (const l of novos) {
    const k = chaveDoLancamento(l);
    if (tem.has(k)) continue;
    tem.add(k);
    entraram.push(l);
  }
  return { lancamentos: [...atuais, ...entraram], entraram, repetidos: novos.length - entraram.length };
}

export type SituacaoDoMes = 'vazio' | 'revisar' | 'pronto' | 'baixado';

/** Como está o mês: sem nada, com o que revisar, pronto para baixar ou com a planilha baixada depois da última mudança. */
export function situacaoDoMes(m: Pick<MesDoLcdpr, 'lancamentos' | 'baixadaEm'>): { situacao: SituacaoDoMes; rotulo: string } {
  if (!m.lancamentos.length) return { situacao: 'vazio', rotulo: 'Nada importado' };
  const revisar = m.lancamentos.filter(l => l.revisar).length;
  if (revisar) return { situacao: 'revisar', rotulo: revisar + ' para revisar' };
  if (m.baixadaEm) return { situacao: 'baixado', rotulo: 'Planilha baixada' };
  return { situacao: 'pronto', rotulo: 'Pronto para baixar' };
}

// ---------- a conta de pagamento (a Conta Credora) ----------

const semAcento = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/**
 * As contas que pagam (o Caixa e os bancos): as do plano com a classificação "Disponível" (sem as sintéticas), e a conta
 * credora padrão da Configuração mesmo que não esteja no plano.
 */
export function contasDePagamento(c: Pick<ConfigLcdpr, 'planoContas' | 'config'>): ContaDoPlano[] {
  const contas = c.planoContas.filter(p => String(p.codigo || '').trim() && semAcento(String(p.classificacao || '')).startsWith('disponi') && String(p.tipo || 'A').toUpperCase() !== 'S');
  const padrao = String(c.config.contaCredoraPadrao || '').trim();
  if (padrao && !contas.some(p => p.codigo === padrao)) contas.unshift({ codigo: padrao, nome: 'Conta padrão', classificacao: 'Disponível', tipo: 'A' });
  return contas;
}

/** A marca do banco pelo nome da conta (o logo: 'banco-do-brasil', 'bradesco', 'bnb', 'sicoob'…; '' = o Caixa ou sem logo). */
export function marcaDaConta(nome: string): string {
  // o nome no plano do Alterdata é "Banco Nordeste do Brasil SA" (sem o "do" do sinal do Conversor)
  if (/nordeste/i.test(nome)) return 'bnb';
  const citado = bancosCitados(nome)[0];
  return citado ? marcaDoBanco(citado) : '';
}

/** O nome da conta de pagamento ("35 — Caixa"; o código que não está no plano aparece como está). */
export function rotuloDaConta(contas: readonly ContaDoPlano[], codigo: string): string {
  const c = contas.find(x => x.codigo === codigo);
  return c ? c.codigo + ' — ' + c.nome : codigo;
}

/** A conta de pagamento do lançamento. */
export const aplicarContaCredora = (l: Lancamento, conta: string): Lancamento => ({ ...l, contaCred: String(conta || '').trim() });

/** A conta de cada fornecedor (o CNPJ/CPF, só os dígitos → o código da conta): lcdprEmpresas/{empresa}.contas. */
export type ContasDosFornecedores = Readonly<Record<string, string>>;

/** Os lançamentos novos com a conta lembrada do fornecedor (sem lembrança, a padrão que já vem neles). */
export function comContaDosFornecedores(lancs: readonly Lancamento[], contas: ContasDosFornecedores): Lancamento[] {
  return lancs.map(l => {
    const conta = contas[soDigitos(l.cnpj)];
    return conta && conta !== l.contaCred ? { ...l, contaCred: conta } : l;
  });
}

/**
 * A lembrança depois de escolher a conta nestes lançamentos: cada fornecedor fica com a conta escolhida; quem voltou para a
 * padrão sai da lista (a padrão já vem sozinha). Devolve a mesma lista quando nada mudou.
 */
export function lembrarContas(contas: ContasDosFornecedores, lancs: readonly Pick<Lancamento, 'cnpj' | 'contaCred'>[], padrao: string): ContasDosFornecedores {
  const novas: Record<string, string> = { ...contas };
  let mudou = false;
  for (const l of lancs) {
    const doc = soDigitos(l.cnpj);
    if (!doc) continue;
    if (!l.contaCred || l.contaCred === padrao) { if (doc in novas) { delete novas[doc]; mudou = true; } continue; }
    if (novas[doc] !== l.contaCred) { novas[doc] = l.contaCred; mudou = true; }
  }
  return mudou ? novas : contas;
}

/** A lembrança lida do banco (só texto). */
export function contasDoDocumento(d: unknown): ContasDosFornecedores {
  const o = obj(obj(d).contas);
  return Object.fromEntries(Object.entries(o).filter(([k, v]) => soDigitos(k) === k && k && typeof v === 'string' && v).map(([k, v]) => [k, String(v).slice(0, 30)]));
}

