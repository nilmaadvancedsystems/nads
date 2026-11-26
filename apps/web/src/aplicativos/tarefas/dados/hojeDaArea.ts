// O "Hoje" da Área do Cliente refeita (26/11/2026; escolhidas as "5 seções", com a Hoje: "O que preciso fazer agora?"):
// os números que levam a cada seção já filtrada e as últimas coisas que chegaram. Funções puras, testadas em
// hojeDaArea.test.ts.
import { areaCliente as ac } from '@nads/core';
import type { ChamadoNaEquipe, LinkDaEmpresa, PessoaComSenha, RecebidoDoCliente } from './areaCliente';

export interface ResumoDoHoje {
  /** solicitações abertas ou em andamento */
  pendentes: number;
  /** delas, as que ninguém respondeu ainda (situação aberto) */
  semResposta: number;
  /** arquivos dos últimos 7 dias, sem recusa */
  arquivosNovos: number;
  /** comunicados no ar hoje */
  comunicadosNoAr: number;
  /** empresas com link */
  comAcesso: number;
  /** pessoas cujo login o robô não conseguiu criar */
  acessosComErro: number;
  nota: { media: number; total: number };
}

const SETE_DIAS = 7 * 24 * 36e5;

/** Está no ar hoje ('AAAA-MM-DD'): já começou e não acabou. */
export const comunicadoNoAr = (c: Pick<ac.Comunicado, 'publicarEm' | 'ate'>, hoje: string) => (!c.publicarEm || c.publicarEm <= hoje) && (!c.ate || c.ate >= hoje);

export function resumoDoHoje(d: {
  chamados: readonly ChamadoNaEquipe[]; recebidos: readonly RecebidoDoCliente[]; comunicados: readonly ac.Comunicado[];
  links: readonly LinkDaEmpresa[]; pessoas: readonly PessoaComSenha[]; agora: Date;
}): ResumoDoHoje {
  // o dia de hoje no horário daqui (não em UTC: depois das 21h o UTC já é amanhã)
  const a = d.agora, hoje = a.getFullYear() + '-' + String(a.getMonth() + 1).padStart(2, '0') + '-' + String(a.getDate()).padStart(2, '0');
  const pend = d.chamados.filter(c => c.situacao === 'aberto' || c.situacao === 'em andamento');
  return {
    pendentes: pend.length,
    semResposta: pend.filter(c => c.situacao === 'aberto').length,
    arquivosNovos: d.recebidos.filter(r => !r.recusa && d.agora.getTime() - Date.parse(r.recebidoEm) <= SETE_DIAS).length,
    comunicadosNoAr: d.comunicados.filter(c => comunicadoNoAr(c, hoje)).length,
    comAcesso: new Set(d.links.map(l => l.codigo)).size,
    acessosComErro: d.pessoas.filter(p => p.ativo && p.situacao === 'erro').length,
    nota: ac.mediaDasAvaliacoes(d.chamados.flatMap(c => (c.avaliacao ? [c.avaliacao] : [])), hoje.slice(0, 7)),
  };
}

/** As solicitações que esperam a equipe, a mais antiga sem resposta primeiro (quem espera há mais tempo). */
export function solicitacoesQueEsperam(chamados: readonly ChamadoNaEquipe[], limite = 5): ChamadoNaEquipe[] {
  const peso = (c: ChamadoNaEquipe) => (c.situacao === 'aberto' ? 0 : 1);
  return chamados.filter(c => c.situacao === 'aberto' || c.situacao === 'em andamento')
    .slice().sort((a, b) => peso(a) - peso(b) || a.atualizadoEm.localeCompare(b.atualizadoEm)).slice(0, limite);
}

/** Os últimos arquivos que chegaram (sem os recusados). */
export function ultimosRecebidos(recebidos: readonly RecebidoDoCliente[], limite = 5): RecebidoDoCliente[] {
  return recebidos.filter(r => !r.recusa).slice().sort((a, b) => b.recebidoEm.localeCompare(a.recebidoEm)).slice(0, limite);
}
