// As ações da REINF (Fiscal › REINF; Vitor, 05/10/2026), numa peça só para as duas telas que transmitem: a REINF e o
// Relatório geral (28/10/2026: "coloca uma coluna de reinf, e duplica as funções do app reinf"). O estado de cada empresa
// começa pelo Notion do Heverton e fica guardado neste navegador (por enquanto, sem o banco).
// Transmitir também marca a REINF do mês no DP (a aba REINF do Painel do DP) e avisa no celular o responsável do DP
// daquele cliente (Vitor, 07/10/2026); Desfazer tira a marca, se foi o Fiscal que pôs.
import { tarefas as t } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { useOperador, type Operador } from '../../../casca/operador';
import { useExecucoes, useRepo } from '../../../dados/repo';
import { useClientesDoDp } from '../../dp/useClientesDoDp';

const CHAVE = 'nads-reinf';

/** O estado da REINF de cada empresa: o do Notion com o que foi mudado neste navegador (também o protocolo da REINF lê). */
export function estadosDaReinf(): Record<number, t.EstadoReinf> {
  const base = Object.fromEntries(t.estadosIniciaisReinf().map(e => [e.codigo, e]));
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) || '{}') as Record<number, t.EstadoReinf>;
    return { ...base, ...v };
  } catch { return base; }
}

export const quandoDaReinf = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
export const mmaaaa = (c: string) => c.slice(5) + '/' + c.slice(0, 4);
/** O nome do responsável como a tela mostra (a planilha do DP vem em maiúsculas: HEVERTON → Heverton, GUSTAVO.P → Gustavo.P). */
const nomeDaPessoa = (s: string) => s.toLowerCase().replace(/(^|[\s.])(\p{L})/gu, (_m, a: string, b: string) => a + b.toUpperCase());

/** O estado de cada empresa da REINF na competência e as ações (Transmitir, Desfazer, Retificar). */
export function useAcoesDaReinf(competencia: string) {
  const repo = useRepo();
  const op = useOperador().operador as Operador;
  const { aviso } = useRetorno();
  const [estados, setEstados] = useState(estadosDaReinf);
  // a REINF do DP do mesmo mês (a aba REINF do Painel do DP lê a etapa dp-reinf da execução do DP)
  const dp = useExecucoes(competencia, 'dp');
  const doDp = useClientesDoDp(competencia);
  function marcarNoDp(codigo: number, desfazer: boolean): string {
    const c = doDp.clientes.find(x => x.codigo === codigo);
    if (!c || !dp.carregada) return '';
    const ex = dp.execucoes.find(e => e.empresa === c.nomeNaTela) || t.execucaoNova(c.nomeNaTela, codigo, competencia, 'dp');
    if (desfazer) {
      const r = t.reinfDesfeitaPeloFiscal(ex, op.nome, new Date());
      if (r) repo.gravar(r.execucao, r.evento);
      return '';
    }
    const resp = nomeDaPessoa(c.responsavel || '');
    if (t.estadoDa(ex, 'dp-reinf')?.situacao === 'feita') return resp;
    const r = t.reinfPeloFiscal(ex, op.nome, resp, new Date());
    repo.gravar(r.execucao, r.evento);
    return resp;
  }
  function mudar(codigo: number, f: (e: t.EstadoReinf) => t.EstadoReinf) {
    setEstados(v => {
      const novo = { ...v, [codigo]: f(v[codigo] || { codigo, retificadas: [] }) };
      try { localStorage.setItem(CHAVE, JSON.stringify(novo)); } catch { /* sem armazenamento: só nesta tela */ }
      return novo;
    });
  }
  return {
    estados,
    /** a empresa tem a REINF no Fiscal (está na lista do Notion) */
    temReinf: (codigo: number) => !!estados[codigo],
    transmitir: (codigo: number) => {
      mudar(codigo, e => t.transmitirReinf(e, competencia, op.nome, new Date()));
      const resp = marcarNoDp(codigo, false);
      aviso({ tom: 'ok', titulo: 'REINF transmitida', texto: codigo + ' · ' + mmaaaa(competencia) + (resp ? ' · no DP, ' + resp + ' é avisado' : '') });
    },
    desfazer: (codigo: number) => { mudar(codigo, e => t.desfazerReinf(e, competencia)); marcarNoDp(codigo, true); },
    retificar: (codigo: number) => mudar(codigo, e => t.alternarRetificada(e, competencia, op.nome, new Date())),
  };
}
