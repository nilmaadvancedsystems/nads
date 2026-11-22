// ViewModel de Fiscal › Tabelas da Reforma (22/11/2026): as tabelas oficiais da calculadora da Receita (o cClassTrib, o
// CST e as alíquotas de referência), com a busca e o filtro por CST. As tabelas vêm do core (packages/core/src/reforma/
// tabelas.json, gerado por scripts/tabelas-rtc.mjs); esta página carrega sob demanda, então o JSON só vem quando ela abre.
import { reforma } from '@nads/core';
import tabelasJson from '@nads/core/reforma-tabelas';
import { useMemo, useState } from 'react';

const TABELAS = tabelasJson as unknown as reforma.TabelasRtc;
export type AbaDaReforma = 'cclasstrib' | 'cst';
const hoje = () => new Date().toISOString().slice(0, 10);

export function useTabelasDaReforma() {
  const [busca, setBusca] = useState('');
  const [cst, setCst] = useState('');
  const [aba, setAba] = useState<AbaDaReforma>('cclasstrib');
  const data = hoje();
  const csts = useMemo(() => reforma.cstsVigentes(TABELAS, data), [data]);
  const classificacoes = useMemo(() => reforma.buscarClassificacoes(TABELAS, busca, data, cst), [busca, data, cst]);
  const descricaoDoCst = useMemo(() => new Map(csts.map(c => [c.codigo, c.descricao])), [csts]);
  return {
    fonte: TABELAS.fonte,
    descricaoDoBanco: TABELAS.descricaoDoBanco,
    /** as alíquotas de referência de hoje (CBS, IBSUF, IBSMun); null a partir de 2027 (vão na nota) */
    aliquotas: reforma.aliquotasDeReferencia(TABELAS, data),
    aba, setAba,
    busca, setBusca,
    cst, setCst,
    csts,
    descricaoDoCst,
    classificacoes,
    total: TABELAS.cClassTrib.filter(c => reforma.vigente(c, data)).length,
    textoDaReducao: reforma.textoDaReducao,
    textoDoCredito: reforma.textoDoCredito,
  };
}
export type VmTabelasDaReforma = ReturnType<typeof useTabelasDaReforma>;
