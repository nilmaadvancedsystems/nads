// Financeiro › Equipe › Por cliente (Vitor, 19/11/2026: "o agrupamento por clientes daquele mes... uma tela que eu consiga ver quais
// sao as transacoes: Insumos e [os servicos] que foram daquele mes para aquele cliente"; "Nao a comissao, o servico completo"): os
// insumos e os serviços do mês, pela data de cada um, juntos por cliente (o do Cadastro pelo código; o avulso pelo nome).
// Os serviços vêm das comissões registradas: a comissão de um serviço feito no mês entra no pagamento do mês seguinte (ou no
// mesmo, a retroativa do Financeiro), então as duas competências são lidas e fica o que tem a data no mês.
import { carteira, formatos } from '@nads/core';
import { useMemo, useState } from 'react';
import { useCarteira, useInsumos as useRepoDosInsumos } from '../../dados/repo';
import { useMes } from './comum';

const mesSeguinte = (mes: string) => {
  const [a, m] = mes.split('-').map(Number);
  return m === 12 ? (a + 1) + '-01' : a + '-' + String(m + 1).padStart(2, '0');
};
const chaveDoCliente = (codigo: number | null, nome: string) => (codigo != null ? 'c' + codigo : 'a' + formatos.normalizarTexto(nome).trim());

export interface ServicoDoCliente { id: string; data: string; servico: string; valor: number; pessoa: string }
export interface InsumoDoCliente { id: string; data: string; insumo: string; quantidade: number; valor: number; pessoa: string }
export interface ClienteDoMes { chave: string; codigo: number | null; nome: string; servicos: ServicoDoCliente[]; insumos: InsumoDoCliente[]; totalServicos: number; totalInsumos: number }

export function usePorCliente() {
  const m = useMes();
  const repo = useCarteira();
  const repoInsumos = useRepoDosInsumos();
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState('');
  const doMes = repo.comissoesDoMes(m.mes);
  const doSeguinte = repo.comissoesDoMes(mesSeguinte(m.mes));
  const insumos = repoInsumos.insumosDoMes(m.mes);
  const tipos = repoInsumos.tipos();

  const clientes = useMemo(() => {
    const porChave = new Map<string, ClienteDoMes>();
    const doCliente = (codigo: number | null, nome: string) => {
      const k = chaveDoCliente(codigo, nome);
      let c = porChave.get(k);
      if (!c) { c = { chave: k, codigo, nome: nome.trim() || '(sem nome)', servicos: [], insumos: [], totalServicos: 0, totalInsumos: 0 }; porChave.set(k, c); }
      return c;
    };
    const vistas = new Set<string>();
    for (const x of [...doMes.lista, ...doSeguinte.lista]) {
      if (vistas.has(x.id) || !x.data.startsWith(m.mes) || x.situacao === 'recusada') continue;
      vistas.add(x.id);
      const c = doCliente(x.clienteCodigo ?? null, x.cliente);
      // a escondida (23/11/2026: "NAO MOSTRA ISSO PARA O USUARIO DE MANEIRA ALGUMA"): sem o valor do serviço (o "—"), nem no total
      const valor = x.oculta ? 0 : x.valorServico ?? 0;
      c.servicos.push({ id: x.id, data: x.data, servico: x.servico || x.descricao, valor, pessoa: x.nome });
      c.totalServicos += valor;
    }
    for (const x of insumos.lista) {
      if (x.competencia !== m.mes) continue;
      const c = doCliente(x.codigo, x.cliente);
      const valor = carteira.valorDoInsumo(x);
      c.insumos.push({ id: x.id, data: x.data, insumo: carteira.rotuloDoInsumo(x, tipos.lista), quantidade: x.quantidade, valor, pessoa: x.nome });
      c.totalInsumos += valor;
    }
    for (const c of porChave.values()) {
      c.servicos.sort((a, b) => a.data.localeCompare(b.data));
      c.insumos.sort((a, b) => a.data.localeCompare(b.data));
    }
    return [...porChave.values()].sort((a, b) => (b.totalServicos + b.totalInsumos) - (a.totalServicos + a.totalInsumos) || a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [doMes.lista, doSeguinte.lista, insumos.lista, tipos.lista, m.mes]);

  const q = formatos.normalizarTexto(busca).trim();
  const lista = q ? clientes.filter(c => formatos.normalizarTexto(c.nome).includes(q) || String(c.codigo ?? '').startsWith(q)) : clientes;
  return {
    m, busca, setBusca, lista, exemplos: repo.exemplos || repoInsumos.exemplos,
    carregada: doMes.carregada && doSeguinte.carregada && insumos.carregada,
    erro: doMes.erro || doSeguinte.erro || insumos.erro,
    totais: {
      clientes: clientes.length,
      servicos: clientes.reduce((s, c) => s + c.totalServicos, 0),
      insumos: clientes.reduce((s, c) => s + c.totalInsumos, 0),
    },
    aberto, alternar: (k: string) => setAberto(a => (a === k ? '' : k)),
  };
}
