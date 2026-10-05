// ViewModel da REINF (Fiscal › REINF; Vitor, 05/10/2026): a competência, as empresas obrigadas com a situação de cada
// uma, a busca, o filtro (Todas / Pendentes / Transmitidas) e as ações (Transmitir, Desfazer, Retificar). O estado começa
// pelo que estava no Notion do Heverton e fica guardado neste navegador (por enquanto, sem o banco).
import { tarefas as t } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { competenciasDaTela } from '../../../casca/navegacao';
import { useOperador, type Operador } from '../../../casca/operador';
import { useRepo } from '../../../dados/repo';

const CHAVE = 'nads-reinf';
type Filtro = 'todas' | 'pendentes' | 'transmitidas';

function ler(): Record<number, t.EstadoReinf> {
  const base = Object.fromEntries(t.estadosIniciaisReinf().map(e => [e.codigo, e]));
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) || '{}') as Record<number, t.EstadoReinf>;
    return { ...base, ...v };
  } catch { return base; }
}

const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const mmaaaa = (c: string) => c.slice(5) + '/' + c.slice(0, 4);

export function useReinf() {
  const repo = useRepo();
  const op = useOperador().operador as Operador;
  const { aviso } = useRetorno();
  const [params, setParams] = useSearchParams();
  const competencias = competenciasDaTela(12);
  const competencia = competencias.includes(params.get('competencia') || '') ? (params.get('competencia') as string) : competencias[0];
  const [estados, setEstados] = useState(ler);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todas');

  const nomes = new Map(repo.listarEmpresas().map(e => [e.codigo, e.nome]));
  const lista = t.EMPRESAS_REINF.map(e => ({ ...e, nome: nomes.get(e.codigo) || e.nome, estado: estados[e.codigo] }));
  const resumo = t.resumoReinf(lista.map(l => l.estado), competencia);
  const q = busca.trim().toLowerCase();
  const linhas = lista
    .filter(l => !q || (l.codigo + ' ' + l.nome).toLowerCase().includes(q))
    .filter(l => filtro === 'todas' || (filtro === 'pendentes') === (t.situacaoReinf(l.estado, competencia) === 'pendente'))
    .map(l => {
      const sit = t.situacaoReinf(l.estado, competencia);
      return {
        codigo: l.codigo, nome: l.nome, transmitida: sit === 'transmitida',
        ate: l.estado.transmitidoAte ? mmaaaa(l.estado.transmitidoAte) : '—',
        ultima: l.estado.ultima ? quando(l.estado.ultima.em) + ' · ' + l.estado.ultima.por : '',
        retificadas: l.estado.retificadas.map(mmaaaa),
        retificadaNaCompetencia: l.estado.retificadas.includes(competencia),
      };
    });

  function mudar(codigo: number, f: (e: t.EstadoReinf) => t.EstadoReinf) {
    setEstados(v => {
      const novo = { ...v, [codigo]: f(v[codigo]) };
      try { localStorage.setItem(CHAVE, JSON.stringify(novo)); } catch { /* sem armazenamento: só nesta tela */ }
      return novo;
    });
  }

  return {
    competencia, rotuloCompetencia: t.rotuloCompetencia(competencia),
    competencias: competencias.map(c => ({ valor: c, rotulo: t.rotuloCompetencia(c) })),
    setCompetencia: (c: string) => setParams({ competencia: c }),
    resumo, linhas, busca, setBusca, filtro, setFiltro,
    transmitir: (codigo: number) => {
      mudar(codigo, e => t.transmitirReinf(e, competencia, op.nome, new Date()));
      aviso({ tom: 'ok', titulo: 'REINF transmitida', texto: codigo + ' · ' + mmaaaa(competencia) });
    },
    desfazer: (codigo: number) => mudar(codigo, e => t.desfazerReinf(e, competencia)),
    retificar: (codigo: number) => mudar(codigo, e => t.alternarRetificada(e, competencia, op.nome, new Date())),
  };
}
