// A sessão do LCDPR: o mês aberto e o que é só da tela (a seleção, a busca e o filtro). Desde 11/11/2026 ("precisa que
// tenha um controle mes a mes de cada um das coisas importadas") os lançamentos e os arquivos lidos são do MÊS, guardados
// no banco (lcdprEmpresas/{empresa}/meses/{AAAA-MM}): recarregar a página não perde mais nada. A etapa diz qual mês está
// aberto (abrirMes); as telas do LCDPR (Lançamentos, a janela do lançamento, a Configuração) leem e mudam o mês por aqui.
import { lcdpr } from '@nads/core';
import { useSyncExternalStore } from 'react';
import { repoDoLcdpr } from '../../../dados/fonte';
import { useLcdpr } from '../../../dados/repo';

/** Um arquivo lido (ou um "Puxar do SIEG"): o nome, quando, quantos entraram, o que deu errado e quais lançamentos vieram dele (o Desfazer). */
export type ImportacaoDoLcdpr = lcdpr.ImportacaoDoMes;

interface Tela {
  empresa: number | null;
  /** o nome da empresa (a chave do Cadastro: o plano de contas do Alterdata) */
  nome: string;
  competencia: string;
  selecionados: ReadonlySet<number>;
  busca: string;
  soRevisar: boolean;
}

export interface SessaoDoLcdpr extends Omit<Tela, 'empresa'> {
  /** a empresa do mês aberto (null = nenhum mês aberto) */
  empresa: number | null;
  carregado: boolean;
  /** a última mudança ainda não chegou ao banco */
  salvando: boolean;
  erro: string;
  mes: lcdpr.MesDoLcdpr;
  lancamentos: readonly lcdpr.Lancamento[];
  importacoes: readonly ImportacaoDoLcdpr[];
}

let tela: Tela = { empresa: null, nome: '', competencia: '', selecionados: new Set(), busca: '', soRevisar: false };
let versaoDaTela = 0;
const ouvintes = new Set<() => void>();
const avisar = () => { versaoDaTela++; for (const o of ouvintes) o(); };

/** O mês aberto pela etapa (trocar de mês limpa a seleção). */
export function abrirMes(empresa: number | null, competencia: string, nome = ''): void {
  if (tela.empresa === empresa && tela.competencia === competencia && tela.nome === nome) return;
  tela = { ...tela, empresa, nome, competencia, selecionados: tela.empresa === empresa && tela.competencia === competencia ? tela.selecionados : new Set() };
  avisar();
}

/** A sessão agora (fora do desenho: depois de uma pergunta, o mês do desenho pode ter ficado velho). */
export function lerSessao(): SessaoDoLcdpr {
  const vazio = lcdpr.mesVazio(tela.empresa ?? 0, tela.competencia);
  const m = tela.empresa != null && tela.competencia ? repoDoLcdpr().mes(tela.empresa, tela.competencia) : { carregado: true, mes: vazio, salvando: false, erro: '' };
  return { ...tela, carregado: m.carregado, salvando: m.salvando, erro: m.erro, mes: m.mes, lancamentos: m.mes.lancamentos, importacoes: m.mes.importacoes };
}

/** Muda o que é só da tela (a seleção, a busca, o filtro). */
export function mudarTela(f: (t: Tela) => Tela): void {
  tela = f(tela);
  avisar();
}

/**
 * Muda o mês aberto e grava. Mudou algum lançamento: a planilha baixada antes deixa de valer (o mês volta a "pronto para
 * baixar"). O erro da gravação chega em aoFalhar.
 */
export function mudarMes(f: (m: lcdpr.MesDoLcdpr) => lcdpr.MesDoLcdpr, aoFalhar: (msg: string) => void): void {
  const s = lerSessao();
  if (s.empresa == null || !s.competencia) return;
  const novo = f(s.mes);
  if (novo === s.mes) return;
  const mudouLancamento = novo.lancamentos !== s.mes.lancamentos;
  repoDoLcdpr().salvarMes(mudouLancamento ? { ...novo, baixadaEm: '', baixadaPor: '' } : novo, aoFalhar);
}

/** Troca estes lançamentos do mês (pelo id). */
export function trocarLancamentos(novos: readonly lcdpr.Lancamento[], aoFalhar: (msg: string) => void): void {
  if (!novos.length) return;
  const porId = new Map(novos.map(l => [l.id, l]));
  mudarMes(m => ({ ...m, lancamentos: m.lancamentos.map(l => porId.get(l.id) ?? l) }), aoFalhar);
}

/** A conta de pagamento lembrada de cada fornecedor da empresa do mês aberto. */
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

/** A sessão, ao vivo (o mês do banco e a tela). */
export function useSessaoDoLcdpr(): SessaoDoLcdpr {
  const repo = useLcdpr();
  useSyncExternalStore(assinar, lerVersao, lerVersao);
  // a conta lembrada dos fornecedores já começa a ouvir com o mês aberto (o "Puxar do SIEG" e a importação usam)
  if (tela.empresa != null) repo.contas(tela.empresa);
  return lerSessao();
}
