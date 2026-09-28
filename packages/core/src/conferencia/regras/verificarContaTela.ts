// Verificar por conta: o que a tela mostra em volta do cruzamento (resumo do modo serviços,
// contas do plano que dá pra conferir, composição da diferença, nome do CSV).
// Origem: conferencia.html vcCarregarContas (~L3858), vcMontarCfopSelect (~L3944, #vcServInfo),
// vcComposicao (~L4110), vcBtCsv (~L4243: 'verificar-conta-'+slug).
import { nomeNorm } from '../../formatos';
import { SV } from '../tabelas/servicos';
import type { Conta, Empresa, TipoServico } from '../tipos';
import { slugArquivoLegado } from './consultaCsv';
import { ordemPlano } from './empresa';
import { notasServicoDaConta, totaisVerificacao, type ResultadoVerificacao } from './verificarConta';

const ZERO_VC = 0.005;

/** Contas analíticas do plano, na ordem do balancete (o vc.contas do original). */
export function contasVerificaveis(e: Empresa): Conta[] {
  return ordemPlano(e.contas.filter(a => !a.sintetica));
}

/** Modo serviços: quantas notas, de quantos participantes e quanto somam. */
export function resumoServicoVerificar(e: Empresa, t: TipoServico, codigos: string[]) {
  const ns = notasServicoDaConta(e, t, codigos);
  const ps: Record<string, 1> = {};
  const soma = ns.reduce((s, n) => { ps[nomeNorm(n.nome)] = 1; return s + n.valor; }, 0);
  const q = Object.keys(ps).length;
  const cfg = SV[t];
  return { rotulo: cfg.rotulo, qtdNotas: ns.length, qtdParticipantes: q, rotParticipantes: q === 1 ? cfg.part : cfg.parts, soma };
}

export interface ItemComposicao { rotulo: string; valor: number; zero: boolean }

/** "O que explica a diferença": Faltando − Duplicadas − A mais − ICMS (e o que sobrar, à parte). */
export function composicaoDiferenca(r: ResultadoVerificacao): ItemComposicao[] {
  const t = totaisVerificacao(r);
  const it = (rotulo: string, valor: number): ItemComposicao => ({ rotulo, valor, zero: Math.abs(valor) < ZERO_VC });
  const l = [it('Faltando na conta', t.faltando), it('Duplicadas na conta', t.duplicadas), it('A mais na conta', t.aMais), it('ICMS', t.icms)];
  if (Math.abs(t.semExplicacao) >= ZERO_VC) l.push(it('Sem explicação', t.semExplicacao));
  return l;
}

/** Diferença zerada (abaixo de meio centavo). */
export function diferencaZerada(v: number): boolean {
  return Math.abs(v) < ZERO_VC;
}

/** "verificar-conta-nome-da-empresa.csv" */
export function nomeCsvVerificacao(empresa: string): string {
  return 'verificar-conta-' + slugArquivoLegado(empresa) + '.csv';
}
