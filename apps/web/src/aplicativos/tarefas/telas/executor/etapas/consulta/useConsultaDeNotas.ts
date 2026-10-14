// ViewModel da Consulta de notas nas etapas Clientes, Fornecedores e Adiantamento da Tarefa (Vitor, 14/10/2026: "em
// clientes, adicione a consulta de saídas e prestados; em fornecedores, entradas e tomados — para o usuário conseguir
// consultar a nota"). As notas importadas na Conferência, nos meses da etapa: um tipo de cada vez, a busca (nome, número,
// CFOP, lançamento) e a ordem da Consulta do Concilia aí (conferencia/regras/consulta.ts). Só olhar.
import { conferencia as c, formatos } from '@nads/core';
import { useMemo, useState } from 'react';
import { useNotasDaConferencia } from '../../../../../concilia-ai/importadosNaEtapa';
import { useEtapaAberta } from '../contexto';

export type TipoConsultado = 'entradas' | 'saidas' | 'tomados' | 'prestados';

const ROTULO: Record<TipoConsultado, string> = { entradas: 'Entradas', saidas: 'Saídas', tomados: 'Tomados', prestados: 'Prestados' };

export function useConsultaDeNotas(tipos: readonly [TipoConsultado, TipoConsultado]) {
  const { nome, meses } = useEtapaAberta();
  const notas = useNotasDaConferencia(nome);
  const [tipo, setTipo] = useState<TipoConsultado>(tipos[0]);
  const [busca, setBusca] = useState('');
  const [ordem, setOrdem] = useState<Pick<c.FiltroConsulta, 'sortCol' | 'sortDir'>>({ sortCol: 'data', sortDir: 'asc' });
  const servico = tipo === 'tomados' || tipo === 'prestados';

  // as notas do tipo nos meses da etapa, no formato da Consulta do Concilia aí
  const lista = useMemo(() => {
    if (!notas) return [];
    const origem: { data: string; numero: string; nome: string; lanc: string; valor: number; comp?: string; cfop?: string; iss?: number; issRet?: number }[] =
      tipo === 'entradas' ? notas.entradas : tipo === 'saidas' ? notas.saidas : tipo === 'tomados' ? notas.tomados : notas.prestados;
    return origem.filter(n => !meses.length || meses.includes(n.comp || '')).map(n => ({
      tipo, ordemTipo: 0, data: n.data, numero: n.numero, nome: n.nome, cfop: n.cfop || '', lanc: n.lanc || '', valor: n.valor,
      iss: n.iss != null ? n.iss : n.issRet || 0,
    }));
  }, [notas, tipo, meses]);
  const achadas = useMemo(() => c.filtrarConsulta(lista, { de: '', ate: '', q: busca.trim(), ...ordem }), [lista, busca, ordem]);
  const mostradas = achadas.slice(0, c.LIMITE_LINHAS_CONSULTA);

  return {
    carregando: !notas,
    tipo, tipos: tipos.map(t => ({ valor: t, rotulo: ROTULO[t] })), escolherTipo: (t: TipoConsultado) => setTipo(t),
    titulo: 'Consultar notas · ' + tipos.map(t => ROTULO[t]).join(' e '),
    servico, rotulo: ROTULO[tipo],
    busca, buscar: setBusca,
    ordem, ordenar: (campo: c.CampoOrdem) => setOrdem(o => c.alternarOrdem({ ...c.FILTRO_CONSULTA_VAZIO, ...o }, campo)),
    total: lista.length, qtd: achadas.length,
    soma: formatos.reais(achadas.reduce((s, n) => s + n.valor, 0)),
    corte: achadas.length > mostradas.length ? mostradas.length : 0,
    linhas: mostradas.map((n, i) => ({ chave: n.numero + '|' + n.data + '|' + i, data: n.data, numero: n.numero, nome: n.nome, cfop: n.cfop, lanc: n.lanc, valor: formatos.reais(n.valor), iss: formatos.reais(n.iss) })),
  };
}
