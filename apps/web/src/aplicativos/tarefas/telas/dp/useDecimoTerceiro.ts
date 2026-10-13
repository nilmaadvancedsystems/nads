// ViewModel de DP › 13º salário (Vitor, 13/10/2026: "a aba de 13º salário, que começa em novembro e termina em
// dezembro: na primeira parcela (novembro) só controlo o que foi emitido (recibo, folha); na segunda (dezembro), até o
// DARF"). Os clientes com folha (o movimento Folha do DP), uma linha cada; as colunas das duas parcelas; clicar na
// bolinha marca a etapa como feita (quem e quando), clicar de novo desfaz — como nas Obrigações do mês.
// O que se marca fica numa execução própria, a "competência 13" do ano (AAAA-13), com as etapas d13-1-* (1ª parcela)
// e d13-2-* (2ª parcela): não se mistura com a folha de novembro nem com a de dezembro.
import { empresas, tarefas as t } from '@nads/core';
import { useState } from 'react';
import { useOperador, type Operador } from '../../casca/operador';
import { useExecucoes, useRepo } from '../../dados/repo';
import { useClientesDoDp } from './useClientesDoDp';

export type EstadoDoDecimo = 'a-fazer' | 'feita' | 'parada';
export type FiltroDeParcela = 'todas' | '1' | '2';

const ob = (id: string, rotulo: string, nome: string) => ({ id, rotulo, nome });
/** As parcelas e o que se controla em cada uma (a ordem é a das colunas). */
export const PARCELAS_DO_13 = [
  { id: '1', rotulo: '1ª parcela', mes: 'novembro', obrigacoes: [ob('recibos', 'Recibos', 'Recibos da 1ª parcela'), ob('folha', 'Folha', 'Folha da 1ª parcela')] },
  { id: '2', rotulo: '2ª parcela', mes: 'dezembro', obrigacoes: [
    ob('recibos', 'Recibos', 'Recibos da 2ª parcela'), ob('folha', 'Folha', 'Folha da 2ª parcela'),
    ob('s1200', 'S-1200', 'eSocial S-1200 do 13º'), ob('s1210', 'S-1210', 'eSocial S-1210 do 13º'), ob('s1299', 'S-1299', 'eSocial S-1299 (fechamento do 13º)'),
    ob('dctfweb', 'DCTFWeb', 'DCTFWeb do 13º'), ob('darf', 'DARF', 'DARF do 13º (INSS e IRRF)'),
  ] },
] as const;

const COLUNAS = PARCELAS_DO_13.flatMap(p => p.obrigacoes.map(o => ({ chave: p.id + '-' + o.id, parcela: p.id, etapa: 'd13-' + p.id + '-' + o.id, rotulo: o.rotulo, nome: o.nome })));
// o nome da planilha (em maiúsculas) como se escreve: FABIANA → Fabiana
const nomeDe = (r: string) => (r ? r.split('.').map(p => p.charAt(0) + p.slice(1).toLowerCase()).join('.') : 'Sem responsável');

/** o ano do 13º que abre: o do ano corrente (em janeiro, ainda o do ano que passou) */
function anoPadrao(hoje = new Date()): number { return hoje.getMonth() === 0 ? hoje.getFullYear() - 1 : hoje.getFullYear(); }

export function useDecimoTerceiro() {
  const repo = useRepo();
  const op = useOperador().operador as Operador;
  const [ano, setAno] = useState(anoPadrao());
  const competencia = ano + '-13';
  const { execucoes, carregada } = useExecucoes(competencia, 'dp');
  const porNome = new Map(execucoes.map(e => [e.empresa, e]));
  // os clientes como valem em dezembro (o movimento Folha: quem tem empregado tem 13º)
  const doDp = useClientesDoDp(ano + '-12');
  const [busca, setBusca] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [status, setStatus] = useState<'' | 'pendentes' | 'concluidas'>('');
  const [parcela, setParcela] = useState<FiltroDeParcela>('todas');

  const todas = doDp.clientes.filter(c => c.movimento === 'Folha').map(c => {
    const ex = porNome.get(c.nomeNaTela) || null;
    const marcas = COLUNAS.map(col => {
      const est = t.estadoDa(ex, col.etapa);
      const estado: EstadoDoDecimo = est?.situacao === 'feita' || est?.situacao === 'dispensada' ? 'feita' : est?.situacao === 'interrompida' ? 'parada' : 'a-fazer';
      return { ...col, estado, quem: est && estado === 'feita' ? est.por + ' em ' + new Date(est.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '' };
    });
    const feitaA = (p: string) => marcas.filter(m => m.parcela === p).every(m => m.estado === 'feita');
    const primeira = feitaA('1'), segunda = feitaA('2');
    const algumaFeita = marcas.some(m => m.estado === 'feita');
    return {
      codigo: c.codigo, nome: c.nomeNaTela, responsavelNome: nomeDe(c.responsavel), temResponsavel: !!c.responsavel, ex, marcas, primeira, segunda,
      concluida: primeira && segunda,
      situacao: primeira && segunda ? 'Concluído' : primeira ? '1ª parcela feita' : algumaFeita ? 'Em andamento' : 'Não iniciado',
    };
  }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  const achadas = busca.trim() ? new Set(empresas.buscarEmpresas(todas.map(c => ({ codigo: c.codigo, nome: c.nome, regime: '' })), busca).map(e => e.codigo)) : null;
  // "concluída" olhando só a parcela escolhida (ou as duas)
  const pronta = (c: (typeof todas)[number]) => (parcela === '1' ? c.primeira : parcela === '2' ? c.segunda : c.concluida);
  const linhas = todas.filter(c => (!achadas || achadas.has(c.codigo)) && (!responsavel || c.responsavelNome === responsavel)
    && (!status || (status === 'concluidas') === pronta(c)));
  const colunas = COLUNAS.filter(col => parcela === 'todas' || col.parcela === parcela);

  return {
    carregando: !carregada || !doDp.carregado,
    ano, setAno,
    anos: [anoPadrao(), anoPadrao() - 1],
    competencia,
    parcela, setParcela,
    parcelas: [{ valor: 'todas' as const, rotulo: 'As duas' }, ...PARCELAS_DO_13.map(p => ({ valor: p.id as FiltroDeParcela, rotulo: p.rotulo + ' · ' + p.mes }))],
    gruposDeColunas: PARCELAS_DO_13.filter(p => parcela === 'todas' || p.id === parcela).map(p => ({ rotulo: p.rotulo + ' · ' + p.mes, colunas: p.obrigacoes.length, primeira: p.id + '-' + p.obrigacoes[0].id })),
    primeiras: new Set(PARCELAS_DO_13.map(p => p.id + '-' + p.obrigacoes[0].id)),
    colunas,
    linhas: linhas.map(c => ({ ...c, marcas: c.marcas.filter(m => parcela === 'todas' || m.parcela === parcela) })),
    total: todas.length,
    primeiraFeitas: todas.filter(c => c.primeira).length,
    segundaFeitas: todas.filter(c => c.segunda).length,
    faltam: linhas.filter(c => !pronta(c)).length,
    filtros: {
      busca, setBusca, responsavel, setResponsavel, status, setStatus,
      responsaveis: [...new Set(todas.map(c => c.responsavelNome))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
      algum: !!(busca || responsavel || status),
      limpar: () => { setBusca(''); setResponsavel(''); setStatus(''); },
    },
    alternar(codigo: number, etapa: string) {
      if (!carregada || !doDp.carregado) return;
      const c = todas.find(x => x.codigo === codigo);
      const m = c?.marcas.find(x => x.etapa === etapa);
      if (!c || !m) return;
      const ex = c.ex || t.execucaoNova(c.nome, c.codigo, competencia, 'dp');
      const r = m.estado === 'feita' ? t.voltarPara(ex, etapa, op.nome, new Date()) : t.fazer(ex, etapa, op.nome, new Date());
      repo.gravar(r.execucao, r.evento);
    },
    /** a tabela que está na tela, em Excel */
    exportar() {
      const ROTULO: Record<EstadoDoDecimo, string> = { 'a-fazer': 'A fazer', feita: 'Feita', parada: 'Parada' };
      const cabecalho = ['Cód.', 'Cliente', 'Responsável', ...colunas.map(col => (col.parcela === '1' ? '1ª ' : '2ª ') + col.rotulo), 'Situação'];
      const dados = linhas.map(c => [c.codigo, c.nome, c.responsavelNome, ...colunas.map(col => ROTULO[c.marcas.find(m => m.chave === col.chave)?.estado || 'a-fazer']), c.situacao]);
      return { bytes: t.planilhaXlsx('13º ' + ano, cabecalho, dados), nome: 'DP 13º salário ' + ano + '.xlsx' };
    },
  };
}
