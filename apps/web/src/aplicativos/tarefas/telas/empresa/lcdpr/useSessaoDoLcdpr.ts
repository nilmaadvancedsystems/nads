// A sessão do LCDPR: os meses abertos e o que é só da tela (a seleção, a busca e o filtro). Desde 11/11/2026 ("precisa que
// tenha um controle mes a mes de cada um das coisas importadas") os lançamentos e os arquivos lidos são de cada MÊS,
// guardados no banco (lcdprEmpresas/{empresa}/meses/{AAAA-MM}); e dá para abrir vários meses ao mesmo tempo ("quero
// poder mexer em mais de um mes ao mesmo tempo"): a lista junta os meses abertos, e cada mudança vai para o mês do
// lançamento (o id diz o mês: lcdpr.mesDoId). A etapa diz quais meses estão abertos (abrirMeses).
import { lcdpr } from '@nads/core';
import { useSyncExternalStore } from 'react';
import { repoDoLcdpr } from '../../../dados/fonte';
import { useLcdpr } from '../../../dados/repo';

/** Um arquivo lido (ou um "Puxar do SIEG"), com o mês em que ficou. */
export type ImportacaoDoLcdpr = lcdpr.ImportacaoDoMes & { mes: string };

interface Tela {
  empresa: number | null;
  /** o nome da empresa (a chave do Cadastro: o plano de contas do Alterdata) */
  nome: string;
  /** os meses abertos (aaaa-mm), do mais antigo ao mais novo */
  meses: readonly string[];
  selecionados: ReadonlySet<number>;
  busca: string;
  soRevisar: boolean;
}

export interface SessaoDoLcdpr extends Tela {
  carregado: boolean;
  /** alguma mudança ainda não chegou ao banco */
  salvando: boolean;
  erro: string;
  /** cada mês aberto, como está no banco */
  porMes: readonly lcdpr.MesDoLcdpr[];
  /** o primeiro mês aberto (o "padrão" do que não tem data) */
  competencia: string;
  /** os lançamentos de todos os meses abertos */
  lancamentos: readonly lcdpr.Lancamento[];
  importacoes: readonly ImportacaoDoLcdpr[];
}

let tela: Tela = { empresa: null, nome: '', meses: [], selecionados: new Set(), busca: '', soRevisar: false };
let versaoDaTela = 0;
const ouvintes = new Set<() => void>();
const avisar = () => { versaoDaTela++; for (const o of ouvintes) o(); };

/** Os meses abertos pela etapa (trocar a empresa limpa a seleção). */
export function abrirMeses(empresa: number | null, meses: readonly string[], nome = ''): void {
  const ordenados = [...new Set(meses)].filter(Boolean).sort();
  if (tela.empresa === empresa && tela.nome === nome && ordenados.join() === tela.meses.join()) return;
  const mesmaEmpresa = tela.empresa === empresa;
  tela = {
    ...tela, empresa, nome, meses: ordenados,
    // só ficam marcados os lançamentos dos meses que continuam abertos
    selecionados: mesmaEmpresa ? new Set([...tela.selecionados].filter(id => ordenados.includes(lcdpr.mesDoId(id)))) : new Set(),
  };
  avisar();
}

/** A sessão agora (fora do desenho: depois de uma pergunta, o mês do desenho pode ter ficado velho). */
export function lerSessao(): SessaoDoLcdpr {
  const repo = repoDoLcdpr();
  const doBanco = tela.empresa != null ? tela.meses.map(m => repo.mes(tela.empresa as number, m)) : [];
  const porMes = doBanco.map(x => x.mes);
  return {
    ...tela,
    carregado: doBanco.every(x => x.carregado),
    salvando: doBanco.some(x => x.salvando),
    erro: doBanco.find(x => x.erro)?.erro || '',
    porMes,
    competencia: tela.meses[0] || '',
    lancamentos: porMes.flatMap(m => m.lancamentos),
    importacoes: porMes.flatMap(m => m.importacoes.map(i => ({ ...i, mes: m.competencia }))).sort((a, b) => b.em.localeCompare(a.em)),
  };
}

/** Muda o que é só da tela (a seleção, a busca, o filtro). */
export function mudarTela(f: (t: Tela) => Tela): void {
  tela = f(tela);
  avisar();
}

/**
 * Muda um dos meses abertos e grava. Mudou algum lançamento: a planilha baixada antes deixa de valer (o mês volta a
 * "pronto para baixar"). O erro da gravação chega em aoFalhar.
 */
export function mudarMes(competencia: string, f: (m: lcdpr.MesDoLcdpr) => lcdpr.MesDoLcdpr, aoFalhar: (msg: string) => void): void {
  if (tela.empresa == null || !tela.meses.includes(competencia)) return;
  const atual = repoDoLcdpr().mes(tela.empresa, competencia).mes;
  const novo = f(atual);
  if (novo === atual) return;
  const mudouLancamento = novo.lancamentos !== atual.lancamentos;
  repoDoLcdpr().salvarMes(mudouLancamento ? { ...novo, baixadaEm: '', baixadaPor: '' } : novo, aoFalhar);
}

/** Muda todos os meses abertos (a mesma conta em cada um). */
export function mudarCadaMes(f: (m: lcdpr.MesDoLcdpr) => lcdpr.MesDoLcdpr, aoFalhar: (msg: string) => void): void {
  for (const m of tela.meses) mudarMes(m, f, aoFalhar);
}

/** O mês de um lançamento (pelo id; o que não tem o mês no id fica no primeiro mês aberto). */
export const mesDoLancamento = (id: number): string => lcdpr.mesDoId(id) || tela.meses[0] || '';

/** Troca estes lançamentos (pelo id), cada um no mês dele. */
export function trocarLancamentos(novos: readonly lcdpr.Lancamento[], aoFalhar: (msg: string) => void): void {
  const porMes = new Map<string, Map<number, lcdpr.Lancamento>>();
  for (const l of novos) {
    const m = mesDoLancamento(l.id);
    porMes.set(m, (porMes.get(m) || new Map()).set(l.id, l));
  }
  for (const [mes, porId] of porMes) mudarMes(mes, x => ({ ...x, lancamentos: x.lancamentos.map(l => porId.get(l.id) ?? l) }), aoFalhar);
}

/** Tira estes lançamentos dos meses deles. */
export function tirarLancamentos(ids: readonly number[], aoFalhar: (msg: string) => void): void {
  const fora = new Set(ids);
  for (const mes of new Set(ids.map(mesDoLancamento))) mudarMes(mes, x => ({ ...x, lancamentos: x.lancamentos.filter(l => !fora.has(l.id)) }), aoFalhar);
  mudarTela(x => ({ ...x, selecionados: new Set([...x.selecionados].filter(i => !fora.has(i))) }));
}

/** A conta de pagamento lembrada de cada fornecedor da empresa aberta. */
export function contasLembradas(): lcdpr.ContasDosFornecedores {
  return tela.empresa != null ? repoDoLcdpr().contas(tela.empresa).contas : {};
}

/** Depois de escolher a conta nestes lançamentos: o fornecedor fica com ela (a padrão esquece). */
export async function lembrarContasDe(lancs: readonly lcdpr.Lancamento[], padrao: string): Promise<void> {
  if (tela.empresa == null) return;
  const atuais = contasLembradas();
  const novas = lcdpr.lembrarContas(atuais, lancs, padrao);
  if (novas !== atuais) await repoDoLcdpr().salvarContas(tela.empresa, novas);
}

const assinar = (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; };
const lerVersao = () => versaoDaTela;

/** A sessão, ao vivo (os meses do banco e a tela). */
export function useSessaoDoLcdpr(): SessaoDoLcdpr {
  const repo = useLcdpr();
  useSyncExternalStore(assinar, lerVersao, lerVersao);
  // a conta lembrada dos fornecedores já começa a ouvir com a empresa aberta (o "Puxar do SIEG" e a importação usam)
  if (tela.empresa != null) repo.contas(tela.empresa);
  return lerSessao();
}
