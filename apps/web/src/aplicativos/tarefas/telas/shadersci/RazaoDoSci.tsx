// O Razão do SCI (25/11/2026: "To querendo adicionar uma funcao de visualizar esses lancamentos, tem como colocar isso no minimum?
// Um olhinho, que joga pra outra tela, importa esse razao para exergar melhor"; "Um botao de um olho, do lado do +"): a "Impressão de
// campos da consulta" que o SCI exporta (.xls), lida e mostrada na tabela do minimum, com o nome das contas e dos históricos. Só para
// ver: nada volta para o SCI nem para os Lançamentos. O arquivo fica guardado por empresa, só neste navegador.
import { sci } from '@nads/core';
import { BotaoAcao, CampoDataComCalendario, Icone, LogoSci, useRetorno } from '@nads/ui';
import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { createPortal } from 'react-dom';
import { AcoesDoTopo } from '../../../../comum/topo';
import { BalaoDeGuia } from './BalaoDeGuia';
import { ContaNaTabela, HistoricoNaTabela } from './CelulasDaTabela';
import { Paleta, type ItemDaPaleta } from './Paleta';
import { useExcluirNoSci, type ExcluirNoSci } from './useExcluirNoSci';
import { rotuloDaCompetenciaDoSci, useLancamentosDoSciPeloRobo, type RoboDoSci } from './useLancamentosDoSciPeloRobo';
import type { VmShadersCi } from './useShadersCi';

interface Guardado { arquivo: string; importadoEm: string; lancamentos: sci.LancamentoDaConsulta[] }
const PREFIXO = 'nads-minimum-razao-v1|';
// a Contabilização (27/11/2026) guarda o que o robô puxou à parte do Visualizar lançamentos
const PREFIXO_DA_CONTABILIZACAO = 'nads-minimum-contabilizacao-v1|';
function lerGuardado(codigo: number | null, prefixo = PREFIXO): Guardado | null {
  if (codigo == null) return null;
  try { const g = JSON.parse(localStorage.getItem(prefixo + codigo) || 'null') as Guardado | null; return g && Array.isArray(g.lancamentos) ? g : null; } catch { return null; }
}
/** os lançamentos do SCI que a Contabilização puxou para a empresa (o balancete abre cada conta com eles; 27/11/2026) */
export const lancamentosDaContabilizacao = (codigo: number | null): sci.LancamentoDaConsulta[] => lerGuardado(codigo, PREFIXO_DA_CONTABILIZACAO)?.lancamentos || [];
/** a empresa já tem a consulta do SCI importada neste navegador (os Lançamentos escondem o "Quero visualizar lançamentos") */
export const temConsultaDoSci = (codigo: number | null) => !!lerGuardado(codigo);
function gravarGuardado(codigo: number, g: Guardado | null, prefixo = PREFIXO) {
  try { if (g) localStorage.setItem(prefixo + codigo, JSON.stringify(g)); else localStorage.removeItem(prefixo + codigo); } catch { /* sem espaço: fica só na tela */ }
}

/** "Lançamento on-line fiscal" → "Fiscal" */
const nomeDoTipo = (t: string) => { const n = t.replace(/^lan[cç]amento\s+(on-?line\s+)?/i, '').trim() || t || 'Sem tipo'; return n.charAt(0).toUpperCase() + n.slice(1); };
/**
 * A cor do tipo, no lugar da coluna Tipo (25/11/2026: "ao inves de usar a coluna tipo folha/fiscal, deixa diferente de alguma
 * maneira"): a faixa na borda esquerda da linha e a bolinha no botão do tipo; o resto (o digitado) sem cor
 */
// só a integração on-line tem cor (e fica apagada); o lançado à mão ou por planilha fica normal, sem cor (25/11/2026:
// "lancamentos na mao/planilha diferentes de integracao online, pode deixar so sem ofuscar, sem cor")
const corDoTipo = (t: string): 'fiscal' | 'folha' | null => (!/on-?line/i.test(t) ? null : /fiscal/i.test(t) ? 'fiscal' : /folha/i.test(t) ? 'folha' : null);

type LinhaDoRazao = sci.LancamentoDaConsulta & { chave: string; nomeD: string; nomeC: string; nomeH: string; nomePD: string; nomePC: string };

type ColunaDoRazao = 'data' | 'debito' | 'credito' | 'valor' | 'historico' | 'documento' | 'participanteD' | 'participanteC' | 'tipo' | 'lote';
/** o que ordena cada coluna: a data, o valor em número, a conta e o participante pelo nome (sem nome, o código) */
function chaveDoRazao(l: LinhaDoRazao, c: ColunaDoRazao): string | number {
  switch (c) {
    case 'valor': return l.valor;
    case 'debito': return l.nomeD || l.debito;
    case 'credito': return l.nomeC || l.credito;
    case 'historico': return [l.nomeH, l.complemento].filter(Boolean).join(' ') || l.historico;
    case 'participanteD': return l.nomePD || l.participanteD;
    case 'participanteC': return l.nomePC || l.participanteC;
    case 'lote': return l.lote || '';
    default: return l[c];
  }
}

/** o valor com o lado: positivo é devedor (D), negativo é credor (C) */
const saldoTexto = (v: number) => sci.valorParaTexto(Math.abs(v)) + (v ? (v > 0 ? ' D' : ' C') : '');

/**
 * modo: 'razao' é o Visualizar lançamentos (o arquivo trazido à mão); 'contabilizacao' é a Contabilização (27/11/2026: "pega o layout
 * completo de lancamentos, e cria um botao chamado vitor com o icone da sci"): a mesma tela, com o botão Vitor do SCI, que pede ao
 * robô do PC os lançamentos da competência e mostra a planilha quando ela volta.
 */
export function RazaoDoSci({ vm, modo = 'razao' }: { vm: VmShadersCi; modo?: 'razao' | 'contabilizacao' }) {
  const codigo = vm.empresa?.codigo ?? null;
  const contabilizacao = modo === 'contabilizacao';
  const prefixo = contabilizacao ? PREFIXO_DA_CONTABILIZACAO : PREFIXO;
  const { aviso, modal } = useRetorno();
  const [guardado, setGuardado] = useState<Guardado | null>(() => lerGuardado(codigo, prefixo));
  const robo = useLancamentosDoSciPeloRobo({ codigo: contabilizacao ? codigo : null, empresa: vm.empresa?.nome || '', chegou: (f, c) => importar(f, c) });
  // excluir no SCI (27/11/2026): quando o robô termina, o que saiu do SCI sai da tela (e do guardado)
  const exclusao = useExcluirNoSci({ codigo: contabilizacao ? codigo : null, empresa: vm.empresa?.nome || '', saiu: p => tirarDaTela(p) });
  // o lote é da empresa num ano (27/11/2026: "Vai ser, empresa, lote, ano os parametros"): o mesmo número em outro ano é outro lote
  const doLote = (l: sci.LancamentoDaConsulta, lote: string, ano: string) => !!l.lote && l.lote.startsWith(lote) && (!ano || l.data.startsWith(ano));
  function tirarDaTela({ lote, chave, ano }: { lote: string; chave: string; ano: string }) {
    if (codigo == null) return;
    const g = lerGuardado(codigo, prefixo);
    const sai = (l: sci.LancamentoDaConsulta) => (chave ? l.lote === chave && (!ano || l.data.startsWith(ano)) : doLote(l, lote, ano));
    const n = g ? g.lancamentos.filter(sai).length : 0;
    if (g && n) {
      const novo = { ...g, lancamentos: g.lancamentos.filter(l => !sai(l)) };
      gravarGuardado(codigo, novo, prefixo);
      setGuardado(novo); setAberto(null);
    }
    aviso({ tom: 'ok', titulo: chave ? 'Lançamento excluído do SCI' : 'Lote excluído do SCI', texto: (chave || lote) + (n ? ' · ' + (n === 1 ? '1 lançamento saiu da tela' : n + ' lançamentos saíram da tela') : '') });
  }
  /** a lixeira da linha: um lançamento (pela chave) ou o lote inteiro */
  async function perguntarExclusao(l: LinhaDoRazao) {
    if (codigo == null) return;
    const x = sci.exclusaoPeloLote(l.lote || '', codigo);
    if (!x) return;
    const ano = l.data.slice(0, 4);
    const n = (guardado?.lancamentos || []).filter(o => doLote(o, x.lote, ano)).length;
    const qtd = n === 1 ? '1 lançamento' : n + ' lançamentos';
    const qual = sci.dataParaTexto(l.data) + ' · R$ ' + sci.valorParaTexto(l.valor);
    const r = await modal<'um' | 'lote' | null>({
      icone: 'alert', titulo: 'Excluir no SCI?',
      html: (x.chave ? 'Lançamento de <b>' + qual + '</b>, chave <b>' + x.chave + '</b>.' : 'Lançamento de <b>' + qual + '</b>, sem chave própria: só dá para excluir o lote.') +
        '<br>O lote <b>' + x.lote + '</b>' + (ano ? ' de ' + ano : '') + ' tem ' + qtd + ' nesta tela.<br><br>O robô do PC de ' + exclusao.rotulo + ' exclui no SCI. No lote inteiro, o SCI pede a ' +
        '<b>senha de segurança</b> no PC: digite lá.',
      botoes: [
        ...(x.chave ? [{ rotulo: 'Excluir este lançamento', valor: 'um' as const, variante: 'btn-danger' as const }] : []),
        { rotulo: 'Excluir o lote inteiro (' + qtd + ')', valor: 'lote' as const, variante: 'btn-danger' as const },
        { rotulo: 'Cancelar', valor: null, variante: 'btn-outline' as const },
      ],
    });
    if (r === 'um' && x.chave) void exclusao.excluir(x.lote, x.chave, ano);
    else if (r === 'lote') void exclusao.excluir(x.lote, '', ano);
  }
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState('');
  const [ordem, setOrdem] = useState<{ coluna: ColunaDoRazao; desc: boolean } | null>(null);
  // até tal data: o que está no campo e o que vale (o do último Pesquisar), em 'aaaa-mm-dd'
  const [deTexto, setDeTexto] = useState('');
  const [ateTexto, setAteTexto] = useState('');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const iso = (t: string) => (t.trim() ? sci.dataDoTexto(t, new Date().getFullYear()) : '');
  // De depois do Até: troca os dois, para o período não ficar vazio por engano
  const pesquisar = () => { const [a, b] = [iso(deTexto), iso(ateTexto)]; if (a && b && a > b) { setDe(b); setAte(a); } else { setDe(a); setAte(b); } };
  // a conta (25/11/2026: "a organizacao dos elementos assim", a Consulta de Movimentos do SCI): o código digitado ou escolhido na
  // lista e o que vale (o do último Consultar); com ela, a tela é o razão da conta, com o saldo anterior e o atual
  // a conta sai da paleta (25/11/2026: "Melhora isso do codigo, coloca uma popup mais premium, embacando o fundo") e vale na hora
  const [conta, setConta] = useState('');
  const [paletaDaConta, setPaletaDaConta] = useState(false);
  const consultar = pesquisar;
  // o lançamento clicado: os dados dele no rodapé, com a última alteração (25/11/2026: "De a opcao de eu clicar no lancamento e
  // aparecer nessa parte os dados do lancamento e ultima alteracao")
  const [aberto, setAberto] = useState<string | null>(null);
  useEffect(() => {
    if (!aberto) return;
    const esc = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') setAberto(null); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [aberto]);
  const campo = useRef<HTMLInputElement>(null);
  // o plano em que as contas do arquivo existem (o arquivo pode ser de uma empresa noutro plano padrão; 25/11/2026: "Coloca o nome
  // logo relacionado ao plano de contas") e o nome dos participantes, tirado do complemento do fiscal ("participante tbm")
  const idDoPlano = useMemo(() => sci.planoDaConsulta(guardado?.lancamentos || [], vm.plano), [guardado, vm.plano]);
  const plano = useMemo(() => sci.planoDoSci(idDoPlano), [idDoPlano]);
  const participantes = useMemo(() => sci.nomesDosParticipantes(guardado?.lancamentos || []), [guardado]);

  /**
   * competencia: a do pedido ao robô (Contabilização). Na Contabilização a consulta se junta à que a tela tem (27/11/2026: "Puxa tudo
   * de inicio e ao longo do tempo vai colocando so os lancamentos novos. Se a pessoa pedir um mes em especifico, ai vc puxa"): tudo
   * (e o arquivo trazido à mão) acrescenta só os novos; o mês ou o ano troca só aquele período. No Visualizar, o arquivo substitui.
   */
  async function importar(arquivo: File | undefined, competencia = '00/0000') {
    if (!arquivo || codigo == null) return;
    const lidos = await arquivo.arrayBuffer().then(b => sci.lerConsultaDoSci(b)).catch(() => null);
    if (!lidos) {
      aviso({ tom: 'info', titulo: 'Não é a consulta do SCI', texto: 'Use a "Impressão de campos da consulta" dos lançamentos, exportada para o Excel, com Data, Débito, Crédito e Valor.' });
      return;
    }
    const antes = contabilizacao ? lerGuardado(codigo, prefixo)?.lancamentos || [] : [];
    const junto = contabilizacao ? sci.juntarConsultas(antes, lidos, competencia) : { lancamentos: lidos, novos: lidos.length, periodo: null };
    const g: Guardado = { arquivo: arquivo.name, importadoEm: new Date().toISOString(), lancamentos: junto.lancamentos };
    gravarGuardado(codigo, g, prefixo);
    setGuardado(g); setTipo(''); setBusca(''); setAberto(null); setJanela(false);
    const qtd = (n: number) => (n === 1 ? '1 lançamento' : n + ' lançamentos');
    const titulo = !contabilizacao || !antes.length ? qtd(junto.lancamentos.length) + ' do SCI'
      : junto.periodo ? rotuloDaCompetenciaDoSci(competencia) + ': ' + qtd(junto.novos)
        : junto.novos ? (junto.novos === 1 ? '1 lançamento novo' : junto.novos + ' lançamentos novos') : 'Nenhum lançamento novo';
    aviso({ tom: 'ok', titulo, texto: arquivo.name });
  }
  const escolher = () => campo.current?.click();
  // sem consulta importada, a janela de trazer o arquivo já abre (25/11/2026: "Que na outra tela ja aparece uma popup para upar os
  // lancamentos a serem visualizados"); fechada, fica o Importar a consulta pulsando em cima
  // na Contabilização, sem janela: o botão Vitor fica no meio da tela vazia
  const [janela, setJanela] = useState(() => !contabilizacao && !lerGuardado(codigo, prefixo));
  const [arrastando, setArrastando] = useState(false);
  useEffect(() => {
    if (!janela) return;
    const esc = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') setJanela(false); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [janela]);
  const soltar = (e: DragEvent) => { e.preventDefault(); setArrastando(false); void importar(e.dataTransfer.files[0]); };

  const linhas = useMemo(() => (guardado?.lancamentos || []).map((l, i) => ({
    ...l, chave: String(i),
    nomeD: sci.contaDoPlano(plano, l.debito)?.nome || '', nomeC: sci.contaDoPlano(plano, l.credito)?.nome || '', nomeH: sci.historicoDoSci(l.historico)?.nome || '',
    nomePD: participantes.get(l.participanteD) || '', nomePC: participantes.get(l.participanteC) || '',
  })), [guardado, plano, participantes]);
  // a coluna Lote e a lixeira só na Contabilização, com o que o minimum importou (a chave na coluna Lote do SCI)
  const comLote = contabilizacao && linhas.some(l => !!l.lote);
  const podeExcluir = comLote && exclusao.disponivel && codigo != null && linhas.some(l => !!sci.exclusaoPeloLote(l.lote || '', codigo));
  const tipos = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of linhas) m.set(l.tipo, (m.get(l.tipo) || 0) + 1);
    return [...m.entries()].map(([t, n]) => ({ t, n }));
  }, [linhas]);
  const q = sci.semAcento(busca.trim());
  const filtradas = linhas.filter(l => (!tipo || l.tipo === tipo) && (!conta || l.debito === conta || l.credito === conta) && (!ate || (!!l.data && l.data <= ate)) && (!de || (!!l.data && l.data >= de)) && (!q || [sci.dataParaTexto(l.data), l.debito, l.credito, l.nomeD, l.nomeC, sci.valorParaTexto(l.valor), l.historico, l.nomeH, l.complemento, l.documento, l.participanteD, l.participanteC, l.lote || '']
    .some(v => sci.semAcento(v).includes(q))));
  // a ordem pelo clique no cabeçalho (25/11/2026: "Ao clicar na coluna do cabecalho ele organiza em ordem crescente ou decrescente"):
  // o primeiro clique, crescente; o segundo, decrescente; o empate fica na ordem do arquivo
  const visiveis = ordem ? filtradas.map((l, i) => ({ l, i, k: chaveDoRazao(l, ordem.coluna) })).sort((a, b) => {
    const d = typeof a.k === 'number' && typeof b.k === 'number' ? a.k - b.k : String(a.k).localeCompare(String(b.k), 'pt-BR', { numeric: true, sensitivity: 'base' });
    return (ordem.desc ? -d : d) || a.i - b.i;
  }).map(x => x.l) : filtradas;
  const ordenar = (coluna: ColunaDoRazao) => setOrdem(o => (o?.coluna === coluna ? { coluna, desc: !o.desc } : { coluna, desc: false }));
  const cabeca = (coluna: ColunaDoRazao, rotulo: string, extra?: { numero?: boolean; dica?: string }) => {
    const sentido = ordem?.coluna === coluna ? (ordem.desc ? 'desc' : 'asc') : null;
    return (
      <th className={extra?.numero ? 'num' : undefined} title={extra?.dica} aria-sort={sentido === 'asc' ? 'ascending' : sentido === 'desc' ? 'descending' : undefined}>
        <button type="button" className={'sci-th' + (sentido ? ' sci-th-ativa' : '')} onClick={() => ordenar(coluna)} title={'Ordenar por ' + rotulo.toLowerCase()}>
          {rotulo}{sentido && <Icone nome={sentido === 'asc' ? 'arrowUp' : 'arrowDown'} />}
        </button>
      </th>
    );
  };
  const selecionado = aberto ? linhas.find(l => l.chave === aberto) || null : null;
  const debitos = visiveis.filter(l => (conta ? l.debito === conta : !!l.debito)).reduce((t, l) => t + l.valor, 0);
  const creditos = visiveis.filter(l => (conta ? l.credito === conta : !!l.credito)).reduce((t, l) => t + l.valor, 0);
  // as contas do arquivo, para a paleta: o nome, a classificação no plano e quantos lançamentos cada uma tem; "Todas" em primeiro
  const itensDaPaleta = useMemo((): ItemDaPaleta[] => {
    const n = new Map<string, number>();
    for (const l of linhas) for (const c of new Set([l.debito, l.credito])) if (c) n.set(c, (n.get(c) || 0) + 1);
    const contas = [...n.keys()].map(c => ({ c, conta: sci.contaDoPlano(plano, c) }))
      .sort((x, y) => (x.conta?.classificacao || x.c).localeCompare(y.conta?.classificacao || y.c, 'pt-BR', { numeric: true }));
    const qtd = (k: number) => (k === 1 ? '1 lançamento' : k + ' lançamentos');
    return [
      { chave: 'todas', codigo: '', nome: 'Todas as contas', dica: qtd(linhas.length) },
      ...contas.map(({ c, conta: p }) => ({ chave: c, codigo: c, nome: p?.nome || 'conta fora do plano', dica: [p?.classificacao, qtd(n.get(c) || 0)].filter(Boolean).join(' · ') })),
    ];
  }, [linhas, plano]);
  const nomeDaConta = conta ? sci.contaDoPlano(plano, conta)?.nome || 'conta fora do plano' : '';
  // o saldo da conta: o anterior (antes do período) e o atual (até o fim do período), de tudo o que o arquivo tem dela
  const mov = (l: LinhaDoRazao) => (l.debito === conta ? l.valor : 0) - (l.credito === conta ? l.valor : 0);
  const daConta = conta ? linhas.filter(l => l.debito === conta || l.credito === conta) : [];
  const saldoAnterior = conta && de ? daConta.filter(l => l.data && l.data < de).reduce((t, l) => t + mov(l), 0) : 0;
  const saldoAtual = conta ? daConta.filter(l => !ate || (l.data && l.data <= ate)).reduce((t, l) => t + mov(l), 0) : 0;

  const info = selecionado ? ([
    ['Data', sci.dataParaTexto(selecionado.data) || '—'],
    ['Débito', selecionado.debito ? (selecionado.nomeD ? selecionado.nomeD + ' (' + selecionado.debito + ')' : selecionado.debito) : '—'],
    ['Crédito', selecionado.credito ? (selecionado.nomeC ? selecionado.nomeC + ' (' + selecionado.credito + ')' : selecionado.credito) : '—'],
    ['Valor', 'R$ ' + sci.valorParaTexto(selecionado.valor)],
    ['Participante a débito', selecionado.participanteD ? (selecionado.nomePD ? selecionado.nomePD + ' (' + selecionado.participanteD + ')' : selecionado.participanteD) : '—'],
    ['Participante a crédito', selecionado.participanteC ? (selecionado.nomePC ? selecionado.nomePC + ' (' + selecionado.participanteC + ')' : selecionado.participanteC) : '—'],
    ['Tipo', selecionado.tipo || '—'],
    ...(selecionado.lote ? [['Lote', selecionado.lote] as const] : []),
    ['Lançado em', sci.dataParaTexto(selecionado.lancadoEm) || '—'],
    ['Última alteração', sci.dataParaTexto(selecionado.alteradoEm) || 'sem alteração'],
  ] as const) : null;

  return (
    <>
      {contabilizacao ? (
        <AcoesDoTopo>
          <button type="button" className="btn btn-outline sci-btn-icone" onClick={() => vm.abrirApp(null)} title="Voltar aos apps" aria-label="Voltar aos apps"><Icone nome="chevronLeft" /></button>
          {guardado && robo.disponivel && <PuxarDoSci robo={robo} temLancamentos />}
          {/* trazer a consulta à mão também (quem não tem o robô, ou o arquivo já exportado) */}
          <button type="button" className="btn btn-outline sci-btn-icone" onClick={escolher} title="Importar a consulta do SCI à mão (.xls, .xlsx ou .csv)" aria-label="Importar a consulta do SCI à mão"><Icone nome="upload" /></button>
        </AcoesDoTopo>
      ) : (
      <AcoesDoTopo>
        <button type="button" className="btn btn-outline sci-btn-icone" onClick={() => vm.abrirApp('lancamentos')} title="Voltar aos Lançamentos" aria-label="Voltar aos Lançamentos"><Icone nome="chevronLeft" /></button>
        {/* sem consulta importada, o Importar pulsa em destaque para guiar (25/11/2026: "Essa tela tbm, deixar piscando") */}
        {guardado
          ? <button type="button" className="btn btn-outline" onClick={escolher}><Icone nome="upload" />Importar outro</button>
          // com o balão de guia (25/11/2026: "Coloca um balaozinho de guia, Importe os lancamentos do SCI em (formato que vc aceita)")
          : (
            <BalaoDeGuia lado="direita" texto={<>Importe os lançamentos do SCI em <b>.xls</b>, <b>.xlsx</b> ou <b>.csv</b> (a "Impressão de campos da consulta")</>}>
              <button type="button" className="btn btn-primary sci-btn-pulsa" onClick={escolher}><Icone nome="upload" />Importar a consulta</button>
            </BalaoDeGuia>
          )}
      </AcoesDoTopo>
      )}
      {contabilizacao && <SituacaoDoRobo robo={robo} />}
      {contabilizacao && <SituacaoDaExclusao exclusao={exclusao} />}
      <input ref={campo} type="file" accept=".xls,.xlsx,.csv" hidden onChange={e => { void importar(e.target.files?.[0]); e.target.value = ''; }} />
      {janela && createPortal(
        <div className="sci-paleta-fundo" onMouseDown={e => { if (e.target === e.currentTarget) setJanela(false); }}>
          <div className={'sci-upload' + (arrastando ? ' arrastando' : '')} role="dialog" aria-modal="true" aria-label="Visualizar lançamentos do SCI"
            onDragOver={e => { e.preventDefault(); setArrastando(true); }} onDragLeave={e => { if (e.currentTarget === e.target) setArrastando(false); }} onDrop={soltar}>
            <button type="button" className="icon-btn sci-upload-fechar" onClick={() => setJanela(false)} title="Fechar (Esc)" aria-label="Fechar"><Icone nome="x" /></button>
            <span className="sci-upload-icone" aria-hidden="true"><Icone nome="olho" /></span>
            <h3>Visualizar lançamentos do SCI</h3>
            <p>Traga a <b>Impressão de campos da consulta</b> dos lançamentos, exportada do SCI em <b>.xls</b>, <b>.xlsx</b> ou <b>.csv</b>.</p>
            <div className="sci-upload-area">
              <Icone nome="upload" />
              <span>Arraste o arquivo para cá</span>
              <span className="hint">ou</span>
              <button type="button" className="btn btn-primary" onClick={escolher}>Escolher o arquivo</button>
            </div>
            <p className="hint sci-upload-pe">Fica guardado só neste navegador, nesta empresa. Nada volta para o SCI.</p>
          </div>
        </div>,
        document.body,
      )}

      {/* sem consulta importada, nada (25/11/2026: "Remove isso", a caixa de trazer o arquivo): o Importar a consulta fica em cima */}
      {!guardado ? (contabilizacao ? (
        // a Contabilização vazia no padrão da tela inicial do minimum (27/11/2026: "tenta seguir o padrao da tela inicial do minimum"):
        // a marca no meio (a logo do SCI e o título), e embaixo a barra larga do "Selecionar empresa", com o período e o botão Vitor
        <div className="sci-inicio sci-contab-inicio">
          <span className="sci-inicio-marca">
            <span className="sci-contab-logo" aria-hidden="true"><LogoSci altura={52} /></span>
            <h1 className="sci-contab-titulo">Qual período vamos fazer?</h1>
          </span>
          <div className="sci-inicio-corpo sci-contab-corpo">
            {robo.disponivel ? (
              <PuxarDoSci robo={robo} grande />
            ) : (
              <button type="button" className="sci-escolher" onClick={escolher}><Icone nome="upload" /><span className="sci-escolher-rotulo">Importar a consulta do SCI</span></button>
            )}
          </div>
        </div>
      ) : null) : (
        <>
          {/* os filtros, no jeito da Consulta de Movimentos do SCI (25/11/2026: "Nesse layout"; "tirando a organizacao das colunas, mas
              queria a organizacao dos elementos assim"): o rótulo em cima de cada um, o tipo, a conta com o nome, o período e o Consultar.
              A conta e o período só valem no Consultar (ou no Enter); o tipo, na hora */}
          <div className="sci-razao-filtros">
            {tipos.length > 1 && (
              <div className="sci-razao-filtro">
                <span className="sci-razao-rotulo">Tipo</span>
                <span className="sci-razao-tipos" role="group" aria-label="O tipo do lançamento">
                  <button type="button" className={'sci-razao-tipo' + (!tipo ? ' ativo' : '')} onClick={() => setTipo('')}>Todos <span>{linhas.length}</span></button>
                  {tipos.map(x => <button key={x.t} type="button" className={'sci-razao-tipo' + (tipo === x.t ? ' ativo' : '')} onClick={() => setTipo(tipo === x.t ? '' : x.t)}>{corDoTipo(x.t) && <i className={'sci-razao-ponto ' + corDoTipo(x.t)} aria-hidden="true" />}{nomeDoTipo(x.t)} <span>{x.n}</span></button>)}
                </span>
              </div>
            )}
            <div className="sci-razao-filtro">
              <label className="sci-razao-rotulo" htmlFor="sci-razao-conta">Conta</label>
              <span className="sci-razao-conta">
                <button id="sci-razao-conta" type="button" className={'sci-razao-conta-botao' + (conta ? ' escolhida' : '')} onClick={() => setPaletaDaConta(true)} aria-haspopup="dialog"
                  title={conta ? nomeDaConta + ' (' + conta + ')' : 'Escolher a conta'}>
                  <span className="sci-razao-conta-cod">{conta || 'Todas'}</span>
                  <span className="sci-razao-conta-nome">{conta ? nomeDaConta : 'todas as contas'}</span>
                  <Icone nome="chevronDown" width={16} height={16} />
                </button>
                {paletaDaConta && (
                  <Paleta itens={itensDaPaleta} rotulo="Escolher a conta" placeholder="Buscar a conta pelo código ou pelo nome" unidade={['conta', 'contas']}
                    fechar={() => setPaletaDaConta(false)} escolher={c => { setConta(c === 'todas' ? '' : c); setPaletaDaConta(false); setAberto(null); }} />
                )}
              </span>
            </div>
            <div className="sci-razao-filtro">
              <span className="sci-razao-rotulo">Período</span>
              <span className="sci-razao-ate">
                <CampoDataComCalendario id="sci-razao-de" rotulo="Período: de" valor={deTexto} onMudar={setDeTexto} onEnter={consultar} />
                <span className="sci-razao-periodo-a">a</span>
                <CampoDataComCalendario id="sci-razao-ate" rotulo="Período: até" valor={ateTexto} onMudar={setAteTexto} onEnter={consultar} />
              </span>
            </div>
            {/* a busca na linha dos filtros, esticando no que sobra dela (25/11/2026: "Aproveita a linha ate o final"; foi para cima e
                voltou: "volta o pesquisa pro anterior", "tava melhor") */}
            <div className="sci-razao-filtro sci-razao-filtro-busca">
              <label className="sci-razao-rotulo" htmlFor="sci-razao-busca">Pesquisa</label>
              <label className="busca-curta">
                <Icone nome="search" />
                <input id="sci-razao-busca" type="text" placeholder="Digite sua pesquisa aqui..." value={busca} onChange={e => setBusca(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') setBusca(''); }} />
              </label>
            </div>
            {/* o Consultar por último (25/11/2026: "botao consultar por ultimo"), com o Limpar */}
            <div className="sci-razao-filtro sci-razao-filtro-acoes">
              {(de || ate || conta) && <button type="button" className="btn btn-ghost" title="Tirar a conta e o período"
                onClick={() => { setDeTexto(''); setAteTexto(''); setDe(''); setAte(''); setConta(''); }}>Limpar</button>}
              <button type="button" className="btn btn-primary" onClick={consultar}><Icone nome="search" />Consultar</button>
            </div>
          </div>

          {/* o saldo anterior à direita, em cima da tabela (com a conta escolhida) */}
          {conta && <p className="sci-razao-saldo">Saldo anterior: <b className="num">{saldoTexto(saldoAnterior)}</b></p>}

          <section className="card ini-grupo sci-tabela-card">
            <div className="table-wrap sci-tabela-caixa">
              <table className="table-compact ini-delegadas sci-tabela">
                <thead>
                  <tr>
                    {cabeca('data', 'Data')}{cabeca('debito', 'Débito')}{cabeca('credito', 'Crédito')}{cabeca('valor', 'Valor', { numero: true })}
                    {cabeca('historico', 'Histórico')}{cabeca('documento', 'Doc.')}
                    {cabeca('participanteD', 'Part. D', { dica: 'O participante a débito (código no SCI)' })}{cabeca('participanteC', 'Part. C', { dica: 'O participante a crédito (código no SCI)' })}
                    {comLote && cabeca('lote', 'Lote', { dica: 'O lote e a chave do lançamento no SCI (o que o minimum importou)' })}
                    {podeExcluir && <th aria-label="Excluir no SCI" />}
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((l, i) => (
                    // o on-line do fiscal e da folha levemente apagados (25/11/2026: "Lancamentos online fiscal, devem ficar levemente
                    // ofuscados"; "Lançamento on-line folha, tbm, ofuscado"), com a faixa da cor do tipo
                    <tr key={l.chave} className={'ini-tr sci-razao-linha' + (i % 2 ? ' sci-zebra' : '') + (aberto === l.chave ? ' sci-marcada' : '') + (/on-?line\s+(fiscal|folha)/i.test(l.tipo) ? ' sci-razao-apagada' : '') + (corDoTipo(l.tipo) ? ' sci-razao-' + corDoTipo(l.tipo) : '')}
                      title={nomeDoTipo(l.tipo)}
                      onClick={() => setAberto(a => (a === l.chave ? null : l.chave))} aria-selected={aberto === l.chave}>
                      <td className="ini-delegadas-curta">{sci.dataParaTexto(l.data) || '—'}</td>
                      <td><ContaNaTabela codigo={l.debito} nome={l.nomeD} lado="debito" /></td>
                      <td><ContaNaTabela codigo={l.credito} nome={l.nomeC} lado="credito" /></td>
                      <td className="num sci-valor">{sci.valorParaTexto(l.valor)}</td>
                      <td className="sci-hist"><HistoricoNaTabela codigo={l.historico} nome={l.nomeH} complemento={l.complemento} /></td>
                      <td className="ini-delegadas-curta">{l.documento}</td>
                      <td className="ini-delegadas-curta" title={l.nomePD || undefined}>{l.participanteD}</td>
                      <td className="ini-delegadas-curta" title={l.nomePC || undefined}>{l.participanteC}</td>
                      {comLote && <td className="ini-delegadas-curta sci-razao-lote">{l.lote}</td>}
                      {podeExcluir && (
                        <td className="sci-razao-excluir">
                          {codigo != null && sci.exclusaoPeloLote(l.lote || '', codigo) && (
                            <button type="button" className="icon-btn" disabled={exclusao.andando} title="Excluir no SCI (este lançamento ou o lote)" aria-label="Excluir no SCI"
                              onClick={e => { e.stopPropagation(); void perguntarExclusao(l); }}><Icone nome="lixeira" width={16} height={16} /></button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                  {!visiveis.length && <tr><td colSpan={8 + (comLote ? 1 : 0) + (podeExcluir ? 1 : 0)} className="hint sci-razao-nada">Nada com esses filtros.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
          <p className="sci-razao-registros">Registros: <b>{visiveis.length}</b></p>

          {/* embaixo, como no SCI: o histórico do lançamento clicado e o documento, as informações dele e os saldos */}
          <div className="sci-razao-painel">
            <section className="sci-razao-historico">
              <span className="sci-razao-aba">Histórico</span>
              <div className="sci-razao-historico-texto">
                {selecionado
                  ? <>{selecionado.nomeH && <b>{selecionado.nomeH}{selecionado.historico && ' (' + selecionado.historico + ')'} </b>}{selecionado.complemento}</>
                  : <span className="hint">Clique num lançamento para ver o histórico.</span>}
              </div>
              <p className="sci-razao-documento">Documento: <b>{selecionado?.documento || ''}</b></p>
            </section>
            <section className="sci-razao-info" aria-label="Informações do lançamento">
              <span className="sci-razao-info-titulo">Informações do lançamento</span>
              {info
                ? <dl>{info.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
                : <p className="hint">Nenhum lançamento escolhido.</p>}
            </section>
            <section className="sci-razao-saldos">
              {conta ? <>
                <span>Movimento do período: <b className="num">{saldoTexto(debitos - creditos)}</b></span>
                <span>Saldo atual: <b className="num">{saldoTexto(saldoAtual)}</b></span>
              </> : <>
                <span>Débitos: <b className="num">{sci.valorParaTexto(debitos)}</b></span>
                <span>Créditos: <b className="num">{sci.valorParaTexto(creditos)}</b></span>
              </>}
            </section>
          </div>
          {/* só a última importação: o arquivo, a data e a hora (25/11/2026: "Coloca, ultima importacao nome do arquivo, data e hora, apenas") */}
          <p className="hint sci-razao-pe">Última importação: {guardado.arquivo} · {new Date(guardado.importadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</p>
        </>
      )}
    </>
  );
}

// ------------------------------------------------------------------------------------------------- o botão Vitor do SCI
const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MESES_LONGOS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/**
 * A competência do SCI e o botão Vitor (27/11/2026: "cria um botao chamado vitor com o icone da sci, ao inves do alterdata"). O
 * seletor (27/11/2026: "Muda a forma de apresentacao pra algo mais premium"): a pílula com o período e, aberta, o ano com as
 * setas, os 12 meses em grade e os atalhos do ano inteiro (o 00 do SCI) e de tudo (00/0000). O clique no Vitor pede ao robô do PC
 * e a planilha entra na tela quando volta.
 */
export function PuxarDoSci({ robo, temLancamentos = false, grande = false, semTudo = false }: {
  robo: RoboDoSci; temLancamentos?: boolean; /** a barra larga da tela vazia */ grande?: boolean; /** sem o "Tudo" (00/0000): o balancete é de um período */ semTudo?: boolean;
}) {
  // o que foi pedido por último fica escolhido (27/11/2026: voltava para o "Ano todo" quando a planilha chegava); sem pedido, tudo
  // (no balancete, o ano de hoje inteiro)
  const [competencia, setCompetencia] = useState(() => (/^\d{2}\/\d{4}$/.test(robo.competencia) && !(semTudo && robo.competencia.endsWith('/0000'))
    ? robo.competencia : semTudo ? '00/' + new Date().getFullYear() : '00/0000'));
  const [aberto, setAberto] = useState(false);
  const [anoDaGrade, setAnoDaGrade] = useState(() => (competencia.endsWith('/0000') ? new Date().getFullYear() : Number(competencia.slice(3))));
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false); };
    const esc = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') setAberto(false); };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc); };
  }, [aberto]);
  const tudo = competencia === '00/0000';
  const mes = Number(competencia.slice(0, 2));
  const ano = Number(competencia.slice(3));
  // com lançamentos na tela, o "tudo" acrescenta só os novos
  const rotuloDoTudo = temLancamentos ? 'Só os novos' : 'Tudo';
  const rotulo = tudo ? rotuloDoTudo : mes ? MESES_LONGOS[mes - 1] + ' de ' + ano : ano + ' inteiro';
  const escolher = (c: string) => { setCompetencia(c); setAberto(false); };
  const dica = tudo ? (temLancamentos ? 'Puxar do SCI e acrescentar só os lançamentos novos' : 'Puxar todos os lançamentos do SCI')
    : 'Puxar os lançamentos de ' + rotuloDaCompetenciaDoSci(competencia) + ' do SCI (troca esse período na tela)';
  const hoje = new Date();
  return (
    <span className={'sci-puxar' + (grande ? ' sci-barra' + (aberto ? ' aberta' : '') : '')} ref={ref}>
      <button type="button" className={'sci-comp' + (aberto ? ' aberto' : '')} onClick={() => setAberto(a => !a)} aria-haspopup="dialog" aria-expanded={aberto} title="O que puxar do SCI">
        <Icone nome="calendar" width={16} height={16} />
        <span className="sci-comp-rotulo">{rotulo}</span>
        <Icone nome="chevronDown" width={14} height={14} />
      </button>
      {aberto && (
        <div className="sci-comp-painel" role="dialog" aria-label="O que puxar do SCI">
          <div className="sci-comp-ano">
            <button type="button" className="sci-comp-seta" onClick={() => setAnoDaGrade(a => a - 1)} aria-label="Ano anterior"><Icone nome="chevronLeft" width={16} height={16} /></button>
            <b>{anoDaGrade}</b>
            <button type="button" className="sci-comp-seta" onClick={() => setAnoDaGrade(a => a + 1)} disabled={anoDaGrade >= hoje.getFullYear()} aria-label="Próximo ano"><Icone nome="chevronRight" width={16} height={16} /></button>
          </div>
          <div className="sci-comp-meses">
            {MESES_CURTOS.map((m, k) => {
              const c = String(k + 1).padStart(2, '0') + '/' + anoDaGrade;
              const futuro = anoDaGrade > hoje.getFullYear() || (anoDaGrade === hoje.getFullYear() && k > hoje.getMonth());
              return (
                <button key={m} type="button" className={'sci-comp-mes' + (c === competencia ? ' escolhido' : '') + (anoDaGrade === hoje.getFullYear() && k === hoje.getMonth() ? ' hoje' : '')}
                  disabled={futuro} onClick={() => escolher(c)} title={MESES_LONGOS[k] + ' de ' + anoDaGrade}>{m}</button>
              );
            })}
          </div>
          <div className={'sci-comp-atalhos' + (semTudo ? ' so-um' : '')}>
            <button type="button" className={'sci-comp-atalho' + (competencia === '00/' + anoDaGrade ? ' escolhido' : '')} onClick={() => escolher('00/' + anoDaGrade)}>{anoDaGrade} inteiro</button>
            {!semTudo && <button type="button" className={'sci-comp-atalho' + (tudo ? ' escolhido' : '')} onClick={() => escolher('00/0000')}>{rotuloDoTudo}</button>}
          </div>
        </div>
      )}
      <BotaoAcao className="btn btn-primary btn-icone-alterdata sci-puxar-botao" carregando={robo.andando} textoCarregando={robo.rotulo}
        onClick={() => { setAberto(false); void robo.pedir(competencia); }} title={dica + ', pelo robô do PC de ' + robo.rotulo}
        aria-label={'Puxar os lançamentos do SCI pelo robô de ' + robo.rotulo}>
        <LogoSci altura={14} />{robo.rotulo}
      </BotaoAcao>
    </span>
  );
}

/** O andamento do robô do SCI: a barra, o passo do roteiro e o Cancelar; o erro, quando não deu. */
export function SituacaoDoRobo({ robo }: { robo: RoboDoSci }) {
  const barra = robo.andando || robo.lendo;
  const texto = robo.erro || (robo.lendo ? 'A planilha chegou: lendo os lançamentos…'
    : robo.andando ? (robo.conectando ? 'Chamando o robô do PC de ' + robo.rotulo + '…' : 'Puxando ' + rotuloDaCompetenciaDoSci(robo.competencia) + ' do SCI' + (robo.etapa ? ' · ' + robo.etapa : '')) : '');
  if (!barra && !texto) return null;
  return (
    <div className={'imp-robo-fiscal sci-contab-robo' + (robo.erro ? ' ext-neg' : '')} role="status" aria-label={barra ? 'Puxando do SCI' : undefined}>
      {barra && <div className={'imp-robo-barra' + (robo.conectando && !robo.lendo ? ' conectando' : '')}><span style={robo.conectando && !robo.lendo ? undefined : { width: (robo.lendo ? 100 : Math.max(4, robo.pct)) + '%' }} /></div>}
      {texto && <span>{texto}</span>}
      {robo.andando && !robo.conectando && <button type="button" className="btn btn-ghost btn-sm imp-robo-cancelar" onClick={robo.cancelar} title="O robô para e fecha as janelas do SCI">Cancelar</button>}
    </div>
  );
}

/** O andamento da exclusão no SCI: a barra, o passo e o Cancelar; no lote, o lembrete da senha de segurança no PC. */
function SituacaoDaExclusao({ exclusao }: { exclusao: ExcluirNoSci }) {
  const senha = exclusao.andando && exclusao.doLote && /senha/i.test(exclusao.etapa);
  const texto = exclusao.erro || (exclusao.andando ? (exclusao.conectando ? 'Chamando o robô do PC de ' + exclusao.rotulo + '…'
    : senha ? 'O SCI pediu a senha de segurança: digite no PC de ' + exclusao.rotulo + ' para excluir ' + exclusao.alvo
      : 'Excluindo ' + exclusao.alvo + ' no SCI' + (exclusao.etapa ? ' · ' + exclusao.etapa : '')) : '');
  if (!exclusao.andando && !texto) return null;
  return (
    <div className={'imp-robo-fiscal sci-contab-robo' + (exclusao.erro ? ' ext-neg' : '')} role="status" aria-label={exclusao.andando ? 'Excluindo no SCI' : undefined}>
      {exclusao.andando && <div className={'imp-robo-barra' + (exclusao.conectando ? ' conectando' : '')}><span style={exclusao.conectando ? undefined : { width: Math.max(4, exclusao.pct) + '%' }} /></div>}
      {texto && <span>{texto}</span>}
      {exclusao.andando && !exclusao.conectando && <button type="button" className="btn btn-ghost btn-sm imp-robo-cancelar" onClick={exclusao.cancelar} title="O robô para (as janelas do SCI ficam como estão)">Cancelar</button>}
    </div>
  );
}
