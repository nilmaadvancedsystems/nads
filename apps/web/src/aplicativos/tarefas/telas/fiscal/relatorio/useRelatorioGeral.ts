// ViewModel de Fiscal › Relatório geral (28/10/2026: "cria um botão nesse menu lateral chamado relatório geral e monte a
// tabela nesse estilo do dp"; o modelo é a planilha "RELATORIO EMPRESA 2026"): uma linha por empresa, com as colunas
// agrupadas como as Obrigações do DP — as guias do Simples e do Lucro Presumido, o parcelamento, as conferências, a REINF e
// a entrega — e a situação do mês. Os dados são os mesmos do Controle de tributos (o que se marca aqui aparece lá) e da
// REINF, com as mesmas ações dela: clicar na bolinha transmite (de novo, desfaz) e a do lado marca a retificação.
// Os valores e a entrega se escrevem no Controle de tributos: aqui a bolinha mostra se já tem.
import { tarefas as t } from '@nads/core';
import { useSearchParams } from 'react-router';
import { competenciasDaTela } from '../../../casca/navegacao';
import { useOperador } from '../../../casca/operador';
import { useControleTributos } from '../../../dados/repo';
import { useListaDoCadastro } from '../../cadastro/escolher/useListaDoCadastro';
import { useRetorno } from '@nads/ui';
import { useRef, useState } from 'react';
import { mmaaaa, quandoDaReinf, useAcoesDaReinf } from '../reinf/useAcoesDaReinf';

/** Como cada casa está no mês: não tem, a fazer, feita (a mesma bolinha do DP). */
export type EstadoDaCasa = 'nao-tem' | 'a-fazer' | 'feita';
/** O que a casa faz ao clicar: nada (só mostra), a conferência do Controle, a REINF ou a retificação. */
export type AcaoDaCasa = 'ver' | 'marca' | 'reinf' | 'retificar';
export interface Casa { id: string; estado: EstadoDaCasa; acao: AcaoDaCasa; dica: string; /** conta na situação */ conta: boolean }
export interface ColunaDoRelatorio { id: string; rotulo: string; nome: string }
export type ParteDoRelatorio = 'sn' | 'lp' | 'parc' | 'reinf' | 'entrega';
type Agrupar = 'nenhum' | 'regime';

// os nomes curtos no título da coluna (o nome inteiro fica na dica), como o DP
const CURTO: Record<string, string> = {
  das: 'DAS', 'icms-ant': 'Antec.', 'icms-arroz': 'Arroz', 'icms-dif': 'Dif. uso', 'icms-dif-ativo': 'Dif. ativo', 'st-ent': 'ST ent.', 'st-sai': 'ST saí.',
  pis: 'PIS', cofins: 'COFINS', irpj: 'IRPJ', csll: 'CSLL', icms: 'ICMS', iss: 'ISS', parc: 'Parc.',
};
const SN = t.grupoDoControle('sn');
const LP = t.grupoDoControle('lp');
const guiasDe = (g: t.GrupoDoControle) => g.colunas.filter(c => c.id !== 'parc');
const colunasDe = (g: t.GrupoDoControle): ColunaDoRelatorio[] => [
  ...guiasDe(g).map(c => ({ id: g.id + ':' + c.id, rotulo: CURTO[c.id] || c.rotulo, nome: c.rotulo })),
  ...g.marcas.map(m => ({ id: g.id + ':mk:' + m.id, rotulo: m.rotulo, nome: m.dica })),
];
const PARTES: readonly { id: ParteDoRelatorio; rotulo: string; colunas: ColunaDoRelatorio[] }[] = [
  { id: 'sn', rotulo: 'Simples Nacional', colunas: colunasDe(SN) },
  { id: 'lp', rotulo: 'Lucro Presumido', colunas: colunasDe(LP) },
  { id: 'parc', rotulo: 'Parcel.', colunas: [{ id: 'parc', rotulo: 'Parc.', nome: 'Parcelamento' }] },
  { id: 'reinf', rotulo: 'REINF', colunas: [{ id: 'reinf', rotulo: 'REINF', nome: 'EFD-REINF transmitida' }, { id: 'retif', rotulo: 'Retif.', nome: 'REINF retificada na competência' }] },
  { id: 'entrega', rotulo: 'Entrega', colunas: [{ id: 'entregue', rotulo: 'Entregue', nome: 'Entregue ao cliente' }] },
];
const ONDE: Record<string, string> = Object.fromEntries(t.ENTREGAS_DO_CONTROLE.map(e => [e.valor, e.rotulo]));
const STATUS = [
  { valor: 'pendentes', rotulo: 'Pendentes' },
  ...(['nao-iniciada', 'em-andamento', 'concluida'] as const).map(v => ({ valor: v, rotulo: t.ROTULO_SITUACAO_GERAL[v] })),
];
const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** O valor da guia na bolinha: em branco = a fazer; "—" = não tem; o valor (ou "0") = feita. */
function casaDoValor(id: string, nome: string, v: string | undefined): Casa {
  const x = (v || '').trim();
  if (!x) return { id, estado: 'a-fazer', acao: 'ver', dica: nome + ': em branco (escreva no Controle de tributos)', conta: true };
  if (x === '—') return { id, estado: 'nao-tem', acao: 'ver', dica: nome + ': não tem no mês', conta: false };
  return { id, estado: 'feita', acao: 'ver', dica: nome + ': ' + (x === '0' ? 'zero' : 'R$ ' + x), conta: true };
}

export function useRelatorioGeral() {
  const op = useOperador().operador;
  const { toast } = useRetorno();
  // como o Controle de tributos: quem grava as conferências é o Fiscal e o admin; a REINF segue a tela da REINF
  const podeGravar = !!op && (op.admin || op.departamento === 'fiscal');
  const [params, setParams] = useSearchParams();
  const competencias = competenciasDaTela(12);
  const competencia = competencias.includes(params.get('competencia') || '') ? (params.get('competencia') as string) : competencias[0];
  const repo = useControleTributos();
  const lista = useListaDoCadastro();
  const reinf = useAcoesDaReinf(competencia);
  const mes = repo.doMes(competencia);
  const [busca, setBusca] = useState('');
  const [enquadramento, setEnquadramento] = useState('');
  const [status, setStatus] = useState('');
  const [pendenteEm, setPendenteEm] = useState('');
  const [entrega, setEntrega] = useState('');
  const [agrupar, setAgrupar] = useState<Agrupar>('nenhum');

  // as empresas: as do Simples e do Lucro Presumido (o regime do Cadastro, como o Controle) e as que têm a REINF
  const doCadastro = new Map(lista.linhas.filter(l => l.codigo != null).map(l => [l.codigo as number, l]));
  const codigos = new Set<number>();
  for (const l of doCadastro.values()) if ([...SN.regimes, ...LP.regimes].includes(l.regime)) codigos.add(l.codigo as number);
  for (const e of t.EMPRESAS_REINF) codigos.add(e.codigo);

  // o que acabou de ser gravado vale até o banco devolver (dois cliques seguidos não perdem o primeiro)
  const gravadas = useRef(new Map<number, t.LinhaDoControle>());
  const linhaDe = (codigo: number, grupo: t.GrupoDoControleId) => {
    const minha = gravadas.current.get(codigo);
    const doBanco = mes.linhas.get(codigo);
    if (minha && doBanco && JSON.stringify(minha.marcas) === JSON.stringify(doBanco.marcas)) gravadas.current.delete(codigo);
    return gravadas.current.get(codigo) || doBanco || t.linhaEmBranco(competencia, codigo, grupo);
  };

  const todas = [...codigos].map(codigo => {
    const cad = doCadastro.get(codigo);
    const nome = cad?.nome || t.EMPRESAS_REINF.find(e => e.codigo === codigo)?.nome || String(codigo);
    const regime = cad?.regime || '';
    const grupo: t.GrupoDoControleId | null = SN.regimes.includes(regime) ? 'sn' : LP.regimes.includes(regime) ? 'lp' : null;
    const l = linhaDe(codigo, grupo || 'sn');
    const casas: Casa[] = [];
    for (const g of [SN, LP]) {
      const doGrupo = grupo === g.id;
      for (const c of guiasDe(g)) {
        casas.push(doGrupo ? casaDoValor(g.id + ':' + c.id, c.rotulo, l.valores[c.id]) : { id: g.id + ':' + c.id, estado: 'nao-tem', acao: 'ver', dica: 'Não é do ' + g.rotulo, conta: false });
      }
      for (const m of g.marcas) {
        const id = g.id + ':mk:' + m.id;
        if (!doGrupo) { casas.push({ id, estado: 'nao-tem', acao: 'ver', dica: 'Não é do ' + g.rotulo, conta: false }); continue; }
        const mk = l.marcas[m.id] || '';
        casas.push({ id, estado: mk === 'ok' ? 'feita' : mk === 'na' ? 'nao-tem' : 'a-fazer', acao: 'marca', conta: mk !== 'na',
          dica: m.dica + ': ' + (mk === 'ok' ? 'conferido' : mk === 'na' ? 'não se aplica' : 'falta') + ' (clique: OK → não se aplica → em branco)' });
      }
    }
    casas.push(grupo ? casaDoValor('parc', 'Parcelamento', l.valores.parc) : { id: 'parc', estado: 'nao-tem', acao: 'ver', dica: 'Parcelamento: sem regime no Cadastro', conta: false });
    // a REINF: as mesmas ações da tela da REINF
    const est = reinf.estados[codigo];
    if (est) {
      const feita = t.situacaoReinf(est, competencia) === 'transmitida';
      const info = (est.transmitidoAte ? 'transmitido até ' + mmaaaa(est.transmitidoAte) : 'nunca transmitida') + (est.ultima ? ' · última: ' + quandoDaReinf(est.ultima.em) + ', ' + est.ultima.por : '');
      casas.push({ id: 'reinf', estado: feita ? 'feita' : 'a-fazer', acao: 'reinf', conta: true,
        dica: 'REINF ' + (feita ? 'transmitida (clique para desfazer)' : 'pendente (clique quando transmitir)') + ' · ' + info });
      const ret = est.retificadas.includes(competencia);
      casas.push({ id: 'retif', estado: ret ? 'feita' : 'a-fazer', acao: 'retificar', conta: false,
        dica: ret ? 'Retificada nesta competência (clique para tirar)' : 'Retificou esta competência? Clique para marcar' + (est.retificadas.length ? ' · retificadas: ' + est.retificadas.map(mmaaaa).join(', ') : '') });
    } else {
      casas.push({ id: 'reinf', estado: 'nao-tem', acao: 'ver', dica: 'Não tem REINF no Fiscal', conta: false });
      casas.push({ id: 'retif', estado: 'nao-tem', acao: 'ver', dica: 'Não tem REINF no Fiscal', conta: false });
    }
    // a entrega: a do Controle de tributos
    const entregue = l.entregue;
    casas.push(!grupo ? { id: 'entregue', estado: 'nao-tem', acao: 'ver', dica: 'Entrega: sem regime no Cadastro', conta: false }
      : entregue === 'nao' ? { id: 'entregue', estado: 'nao-tem', acao: 'ver', dica: 'Entrega: não se aplica', conta: false }
        : { id: 'entregue', estado: entregue ? 'feita' : 'a-fazer', acao: 'ver', conta: true,
          dica: entregue ? 'Entregue por ' + ONDE[entregue] + (l.data ? ' em ' + l.data.split('-').reverse().join('/') : '') : 'Falta entregar (escolha no Controle de tributos)' });
    // a situação: concluída quando entregou (ou não se aplica) e a REINF que tem está transmitida; começada se tem algo
    const contam = casas.filter(c => c.conta);
    const feitas = contam.filter(c => c.estado === 'feita').length;
    const reinfOk = !est || casas.find(c => c.id === 'reinf')?.estado === 'feita';
    const entregaOk = !grupo || !!entregue;
    const concluida = reinfOk && entregaOk;
    const situacao: t.SituacaoGeral = concluida ? 'concluida' : feitas > 0 || t.situacaoDaLinha(l) !== 'branco' ? 'em-andamento' : 'nao-iniciada';
    return {
      codigo, nome, regime: grupo ? (grupo === 'sn' ? SN.rotulo : LP.rotulo) : 'Sem regime', grupo, linha: l, casas,
      onde: entregue && entregue !== 'nao' ? ONDE[entregue] : '', situacao, rotuloSituacao: t.ROTULO_SITUACAO_GERAL[situacao],
    };
  });

  const q = semAcento(busca.trim());
  const pendente = PARTES.find(p => p.id === pendenteEm) || null;
  const filtradas = todas.filter(r => (!q || semAcento(r.nome).includes(q) || String(r.codigo).startsWith(q))
    && (!enquadramento || r.regime === enquadramento)
    && (!status || (status === 'pendentes' ? r.situacao !== 'concluida' : r.situacao === status))
    && (!entrega || (entrega === 'falta' ? r.grupo && !r.linha.entregue : r.linha.entregue === entrega))
    && (!pendente || r.casas.some(c => pendente.colunas.some(k => k.id === c.id) && c.conta && c.estado === 'a-fazer')))
    .sort((a, b) => a.codigo - b.codigo);

  // as partes que alguém da lista tem (sem Simples na lista, as colunas do Simples saem)
  const partes = PARTES.filter(p => (p.id !== 'sn' && p.id !== 'lp') || filtradas.some(r => r.grupo === p.id));
  const colunas = partes.flatMap(p => p.colunas);
  const visiveis = new Set(colunas.map(c => c.id));
  const linhas = filtradas.map(r => ({ ...r, casas: r.casas.filter(c => visiveis.has(c.id)) }));
  const grupos = agrupar === 'nenhum' ? [{ nome: '', linhas }]
    : [SN.rotulo, LP.rotulo, 'Sem regime'].map(nome => ({ nome, linhas: linhas.filter(r => r.regime === nome) })).filter(g => g.linhas.length);

  function virarMarca(codigo: number, casa: string) {
    if (!podeGravar) return;
    const r = todas.find(x => x.codigo === codigo);
    if (!r?.grupo) return;
    const marca = casa.split(':mk:')[1];
    const l = r.linha;
    const proxima = t.PROXIMA_MARCA[l.marcas[marca] || ''];
    const marcas = { ...l.marcas };
    if (proxima) marcas[marca] = proxima; else delete marcas[marca];
    const nova = { ...l, grupo: r.grupo, marcas, atualizadoEm: undefined, atualizadoPor: undefined };
    gravadas.current.set(codigo, nova);
    repo.salvarLinha(nova).catch(() => { gravadas.current.delete(codigo); toast('Não deu para guardar: confira a internet e tente de novo'); });
  }

  return {
    carregando: !mes.carregada || lista.carregando,
    exemplos: repo.exemplos,
    podeGravar,
    competencia,
    competencias: competencias.map(c => ({ valor: c, rotulo: t.rotuloCompetencia(c) })),
    setCompetencia: (c: string) => { const n = new URLSearchParams(params); n.set('competencia', c); setParams(n); },
    filtros: {
      busca, setBusca, enquadramento, setEnquadramento, status, setStatus, pendenteEm, setPendenteEm, entrega, setEntrega,
      enquadramentos: [SN.rotulo, LP.rotulo, 'Sem regime'], statusOpcoes: STATUS,
      partes: PARTES.map(p => ({ valor: p.id, rotulo: p.id === 'parc' ? 'Parcelamento' : p.rotulo })),
      entregas: [{ valor: 'falta', rotulo: 'Falta' }, ...t.ENTREGAS_DO_CONTROLE.filter(e => e.valor).map(e => ({ valor: e.valor, rotulo: e.rotulo }))],
      agrupar, setAgrupar,
      algum: !!(busca || enquadramento || status || pendenteEm || entrega),
      limpar: () => { setBusca(''); setEnquadramento(''); setStatus(''); setPendenteEm(''); setEntrega(''); },
    },
    partes, colunas, primeiras: new Set(partes.map(p => p.colunas[0].id)),
    grupos, quantas: linhas.length, faltam: linhas.filter(r => r.situacao !== 'concluida').length,
    clicar(codigo: number, c: Casa) {
      if (c.acao === 'marca') virarMarca(codigo, c.id);
      else if (c.acao === 'reinf') { if (c.estado === 'feita') reinf.desfazer(codigo); else reinf.transmitir(codigo); }
      else if (c.acao === 'retificar') reinf.retificar(codigo);
    },
    exportar() {
      const ROTULO: Record<EstadoDaCasa, string> = { 'nao-tem': '—', 'a-fazer': 'A fazer', feita: 'Feita' };
      const cabecalho = ['Cód.', 'Cliente', 'Regime', ...colunas.map(c => c.nome), 'Onde', 'Situação'];
      const valores = linhas.map(r => [r.codigo, r.nome, r.regime, ...r.casas.map(c => ROTULO[c.estado]), r.onde, r.rotuloSituacao]);
      return { bytes: t.planilhaXlsx('Relatório ' + competencia.slice(5, 7) + '-' + competencia.slice(0, 4), cabecalho, valores), nome: 'Fiscal relatório geral ' + competencia + '.xlsx' };
    },
  };
}
