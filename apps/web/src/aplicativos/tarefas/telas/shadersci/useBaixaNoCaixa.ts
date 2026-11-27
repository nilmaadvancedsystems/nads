// ViewModel da Baixa no caixa (26/11/2026: "Quero fazer a baixa no caixa conta 5 e contra partida 16 ... Historico numero 477 /
// Complemento: [numero da nota] - [Nome do cliente]"; "The user import the file and you give me the output to import in SCI"): a
// "Impressão de campos da consulta" do SCI entra, as vendas a prazo viram as baixas (D Caixa × C Clientes, com o cliente a crédito) e
// sai a planilha do gerador do SCI. O caixa e o histórico vêm do padrão do plano e podem ser trocados. A consulta fica guardada por
// empresa, só neste navegador: nada vai para o banco.
import { sci } from '@nads/core';
import { baixarBytes, useRetorno } from '@nads/ui';
import { useMemo, useState } from 'react';
import { loteParaAPlanilha } from './loteDaPlanilha';
import type { VmShadersCi } from './useShadersCi';

interface Guardado {
  arquivo: string;
  importadoEm: string;
  lancamentos: sci.LancamentoDaConsulta[];
  /** '' = o padrão do plano */
  caixa: string;
  historico: string;
}
const PREFIXO = 'nads-minimum-baixa-v1|';
function lerGuardado(codigo: number | null): Guardado | null {
  if (codigo == null) return null;
  try { const g = JSON.parse(localStorage.getItem(PREFIXO + codigo) || 'null') as Guardado | null; return g && Array.isArray(g.lancamentos) ? { ...g, caixa: g.caixa || '', historico: g.historico || '' } : null; } catch { return null; }
}
function gravarGuardado(codigo: number, g: Guardado | null) {
  try { if (g) localStorage.setItem(PREFIXO + codigo, JSON.stringify(g)); else localStorage.removeItem(PREFIXO + codigo); } catch { /* sem espaço: fica só na tela */ }
}

/** A consulta fictícia do Dados de teste (modo desenvolvedor): vendas no mês passado, uma já baixada, a provisão e a folha. */
function consultaDeExemplo(): sci.LancamentoDaConsulta[] {
  const mes = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 7);
  const l = (dia: string, c: Partial<sci.LancamentoDaConsulta>): sci.LancamentoDaConsulta => ({
    data: mes + '-' + dia, debito: '', credito: '', valor: 0, historico: '', complemento: '', documento: '', tipo: 'Lançamento on-line fiscal',
    participanteD: '', participanteC: '', lancadoEm: '', alteradoEm: '', ...c,
  });
  const venda = (dia: string, nota: string, cliente: string, nome: string, valor: number) =>
    l(dia, { debito: '16', credito: '265', valor, historico: '29', complemento: nota + ' - ' + nome, documento: nota, participanteD: cliente });
  return [
    venda('05', '101', '900', 'MERCADO FICTICIO LTDA', 250000),
    venda('05', '102', '901', 'PADARIA EXEMPLO ME', 130000),
    venda('13', '103', '900', 'MERCADO FICTICIO LTDA', 180000),
    venda('20', '104', '902', 'PREFEITURA DE TESTE', 220000),
    venda('21', '105', '901', 'PADARIA EXEMPLO ME', 50000),
    // a 102 já foi baixada no SCI: fica fora
    l('06', { debito: '5', credito: '16', valor: 130000, historico: '477', complemento: '102 - PADARIA EXEMPLO ME', documento: '102', participanteC: '901', tipo: '' }),
    l('28', { debito: '284', credito: '200', valor: 270000, complemento: 'Provisão de impostos' }),
    l('28', { credito: '169', valor: 140000, complemento: 'Líquido da folha', tipo: 'Lançamento on-line folha' }),
  ];
}

export function useBaixaNoCaixa(min: VmShadersCi) {
  const codigo = min.empresa?.codigo ?? null;
  const { aviso } = useRetorno();
  const [guardado, setGuardado] = useState<Guardado | null>(() => lerGuardado(codigo));
  const [lendo, setLendo] = useState(false);
  const guardar = (g: Guardado | null) => { if (codigo != null) gravarGuardado(codigo, g); setGuardado(g); };

  // o plano em que as contas da consulta existem (pode ser outro que o da empresa), como no Visualizar lançamentos
  const idDoPlano = useMemo(() => sci.planoDaConsulta(guardado?.lancamentos || [], min.plano), [guardado, min.plano]);
  const plano = useMemo(() => sci.planoDoSci(idDoPlano), [idDoPlano]);
  const padrao = useMemo(() => sci.baixaPadrao(plano), [plano]);
  const op = useMemo<sci.OpcoesDaBaixa>(() => ({ caixa: guardado?.caixa || padrao.caixa, historico: guardado?.historico || padrao.historico }), [guardado, padrao]);
  const r = useMemo(() => sci.baixasDaConsulta(guardado?.lancamentos || [], plano, op), [guardado, plano, op]);
  const mes = sci.mesPrincipal(r.baixas);
  const lote = sci.loteDaOrigem('baixa', mes);
  const lancamentos = useMemo(() => sci.lancamentosDoShaderParaOSci(r.baixas, plano, min.cnpj).map(l => ({ ...l, lote, origem: 'baixa no caixa' })),
    [r, plano, min.cnpj, lote]);
  const prontos = lancamentos.filter(l => !l.problemas.length);

  async function importar(arquivo: File | undefined) {
    if (!arquivo || codigo == null) return;
    setLendo(true);
    const lidos = await arquivo.arrayBuffer().then(b => sci.lerConsultaDoSci(b)).catch(() => null);
    setLendo(false);
    if (!lidos) {
      aviso({ tom: 'info', titulo: 'Não é a consulta do SCI', texto: 'Use a "Impressão de campos da consulta" dos lançamentos, exportada para o Excel, com Data, Débito, Crédito e Valor.' });
      return;
    }
    guardar({ arquivo: arquivo.name, importadoEm: new Date().toISOString(), lancamentos: lidos, caixa: guardado?.caixa || '', historico: guardado?.historico || '' });
  }

  return {
    dev: min.dev,
    voltar: () => min.abrirApp(min.dev ? null : 'lancamentos'),
    arquivo: guardado?.arquivo || '',
    temConsulta: !!guardado,
    lendo,
    importar,
    plano: idDoPlano,
    /** o caixa e o histórico que valem, com o nome; o que a pessoa digitou ('' = o padrão) */
    caixa: op.caixa,
    nomeDoCaixa: sci.contaDoPlano(plano, op.caixa)?.nome || '',
    historico: op.historico,
    nomeDoHistorico: sci.historicoDoSci(op.historico)?.nome || '',
    padrao,
    mudarCaixa: (v: string) => guardado && guardar({ ...guardado, caixa: v.trim() === padrao.caixa ? '' : v }),
    mudarHistorico: (v: string) => guardado && guardar({ ...guardado, historico: v.trim() === padrao.historico ? '' : v }),
    lancamentos,
    prontos: prontos.length,
    comProblema: lancamentos.length - prontos.length,
    /** o total de todas as baixas (as prontas e as com problema) */
    total: lancamentos.reduce((s, l) => s + l.valor, 0),
    jaBaixadas: r.jaBaixadas,
    outras: r.outras,
    lote,
    baixar: () => { void (async () => {
      if (!prontos.length) { aviso({ tom: 'info', titulo: 'Nenhuma baixa pronta', texto: 'Passe o mouse na linha para ver o que falta: o caixa e o histórico precisam estar no plano.' }); return; }
      // o lote da planilha, controlado pelo nads: empresa + lote + ano (27/11/2026)
      const loteDaPlanilha = await loteParaAPlanilha({ codigo, empresa: min.empresa?.nome || '', lancamentos, origem: 'baixa no caixa', aviso });
      if (loteDaPlanilha == null) return;
      let bytes: Uint8Array;
      try { bytes = sci.planilhaDoSci(lancamentos, loteDaPlanilha); } catch (e) { aviso({ tom: 'info', titulo: 'Planilha grande demais para um lote', texto: e instanceof Error ? e.message : String(e) }); return; }
      baixarBytes(bytes, sci.nomeDaPlanilhaSci(min.cnpj, mes, 'baixa no caixa', loteDaPlanilha), sci.TIPO_XLSX_SCI);
      if (loteDaPlanilha) aviso({ tom: 'ok', titulo: (prontos.length === 1 ? '1 baixa' : prontos.length + ' baixas') + ' na planilha do SCI', texto: 'Lote ' + loteDaPlanilha + '.' });
    })(); },
    carregarExemplo: () => guardar({ arquivo: 'Consulta de exemplo (fictícia).xls', importadoEm: new Date().toISOString(), lancamentos: consultaDeExemplo(), caixa: '', historico: '' }),
    limpar: () => guardar(null),
  };
}
export type VmBaixaNoCaixa = ReturnType<typeof useBaixaNoCaixa>;
