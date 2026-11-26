// Os ViewModels da Carteira (12/11/2026): o que cada tela mostra e faz, a partir do repositório (as telas não falam com
// ele). A lógica de conta é do core (carteira); aqui fica o estado da tela e as ações com o aviso de erro.
import { carteira, empresas, formatos, tarefas as tf, usuarios, type financeiro } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useMemo, useState } from 'react';
import type { Decisao } from '../../dados/carteira';
import { empresasNovas } from '../../dados/fonte';
import { useModoDesenvolvedor } from '../../../../comum/modoDesenvolvedor';
import { useNovidade } from '../../../../comum/novidades';
import { useOperador } from '../../casca/operador';
import { useAcesso, useCarteira, useInsumos as useRepoDosInsumos, useTesteDaCarteira, useTodosOsCadastros } from '../../dados/repo';
import { dataBr, hoje, isoDaData, valorDigitado, valorNoCampo } from '../financeiro/formatosDaNota';
import { abrirBytes, baixarDaCarteira, mensagem, useMes } from './comum';


/** as contas ligadas à pessoa (a consulta já é só dela) como os pagamentos da Carteira */
const pagamentosDe = (contas: readonly financeiro.ContaAPagar[]) => carteira.pagamentosDaCarteira(contas, contas[0]?.funcionario?.uid ?? '');

/** As comissões da pessoa, pelo mês do serviço (a data; 19/11/2026), que abre no mês de hoje; o pagamento é no mês seguinte. */
/** mesDeFora: o mês que a tela da Carteira escolhe uma vez só, para as comissões e os holerites (19/11/2026: "repetindo referencia") */
export function useMinhasComissoes(mesDeFora?: ReturnType<typeof useMes>) {
  const repo = useCarteira();
  const proprio = useMes('comecar');
  const m = mesDeFora ?? proprio;
  const [aberta, setAberta] = useState<carteira.Comissao | null | 'nova'>(null);
  const todas = repo.minhasComissoes();
  // pelo mês do serviço (Vitor, 19/11/2026: "nao ta upando as comissoes na tabela"): a registrada em novembro aparece em novembro, a
  // receber, e é paga no mês seguinte (a competência do pagamento continua a do mês seguinte)
  const lista = todas.lista.filter(c => c.data.startsWith(m.mes));
  // a escondida conta como comissão, mas o valor dela não entra no total (16/11/2026: "não deixe essa informação visualizável")
  const totais = { ...carteira.totaisDasComissoes(carteira.comValorParaAPessoa(lista)), quantas: lista.filter(c => c.situacao !== 'recusada').length };
  // o total do mês é só das comissões (Vitor, 19/11/2026: o salário só aparece quando o DP gera a folha; "Só comissões"): o holerite e o
  // pagamento ficam nos lançamentos e no gráfico
  const docs = repo.meusDocumentos(), contas = repo.minhasContas();
  // os lançamentos do mês numa lista só (Vitor, 19/11/2026: "Essas boxes da pra unificar em uma unica box de lancamentos"): as comissões,
  // os holerites e comprovantes do mês e os pagamentos do escritório que vencem ou foram pagos no mês
  const { toast, modal } = useRetorno();
  const docsDoMes = docs.lista.filter(d => d.competencia === m.mes);
  const pagsDoMes = pagamentosDe(contas.lista).filter(p => p.vencimento.startsWith(m.mes) || (p.pagoEm || '').startsWith(m.mes));
  // os materiais (os insumos) que a pessoa registrou no mês, na mesma tabela (19/11/2026: "tipo: Comissao, salario, materiais")
  const repoInsumos = useRepoDosInsumos();
  const insumos = repoInsumos.meusInsumos();
  const tiposDeInsumo = repoInsumos.tipos();
  const materiaisDoMes = insumos.lista.filter(x => x.competencia === m.mes).map(x => ({
    id: x.id, data: x.data, cliente: x.cliente, codigo: x.codigo, nome: carteira.rotuloDoInsumo(x, tiposDeInsumo.lista), quantidade: x.quantidade, valor: carteira.valorDoInsumo(x),
  }));
  return {
    m, exemplos: repo.exemplos, carregada: todas.carregada && docs.carregada && contas.carregada, erro: todas.erro || docs.erro || contas.erro, lista, totais, aberta, setAberta,
    /** a linha dos últimos 6 meses (o total das comissões de cada mês, pela data; no topo, como num app de banco; 19/11/2026) */
    serie: (() => {
      const [a, mm] = m.mes.split('-').map(Number);
      const meses = Array.from({ length: 6 }, (_, i) => { const d = new Date(a, mm - 6 + i, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); });
      const validas = carteira.comValorParaAPessoa(todas.lista).filter(c => c.situacao !== 'recusada');
      return meses.map(x => ({ mes: x, valor: validas.filter(c => c.data.startsWith(x)).reduce((t, c) => t + c.valor, 0) }));
    })(),
    totalDoMes: totais.total,
    docsDoMes, pagsDoMes, materiaisDoMes,
    /** a tabela dos lançamentos em planilha (Vitor, 19/11/2026: "Coloca a opcao excel, para exportar em planilha"): as mesmas colunas da
     *  tela; os materiais sem o valor (que fica no Financeiro) */
    exportar() {
      const br = (d: string) => d.slice(0, 10).split('-').reverse().join('/');
      const semCnpj = (n: string) => n.replace(/^[\d./-]{6,}\s+/, '').trim() || n;
      const linhas: { data: string; l: (string | number)[] }[] = [
        ...lista.map(c => ({ data: c.data, l: [br(c.data), semCnpj(c.cliente), c.porte || '', 'Comissão · ' + c.descricao, c.oculta ? '' : c.valor,
          c.situacao === 'paga' ? 'Paga' + (c.pagoEm ? ' em ' + br(c.pagoEm) : '') : c.situacao === 'recusada' ? 'Recusada' + (c.motivo ? ': ' + c.motivo : '') : 'A receber'] })),
        ...docsDoMes.map(d => ({ data: d.enviadoEm.slice(0, 10), l: [br(d.enviadoEm), '', '', d.tipo === 'holerite' ? 'Salário · holerite' : carteira.rotuloDoDocumento(d.tipo), d.valor ?? '', 'Anexo: ' + d.arquivo] })),
        ...pagsDoMes.map(p => ({ data: p.pago && p.pagoEm ? p.pagoEm : p.vencimento, l: [br(p.pago && p.pagoEm ? p.pagoEm : p.vencimento), '', '', p.rotulo, p.pago ? p.valorPago ?? p.valor : p.valor, p.pago ? 'Pago' : 'A receber'] })),
        ...materiaisDoMes.map(x => ({ data: x.data, l: [br(x.data), x.cliente, '', 'Materiais · ' + x.nome + ' × ' + x.quantidade, '', 'Registrado'] })),
      ].sort((a, b) => a.data.localeCompare(b.data));
      const nome = 'Lançamentos ' + carteira.mesPorExtenso(m.mes) + '.xlsx';
      return { bytes: tf.planilhaXlsx('Lançamentos', ['Data', 'Cliente', 'Porte', 'Tipo', 'Valor', 'Status'], linhas.map(x => x.l)), nome };
    },
    /** o Extrato de comissões do mês em planilha (a caixa dos anexos; 19/11/2026) */
    extratoDeComissoes() {
      const br = (d: string) => d.slice(0, 10).split('-').reverse().join('/');
      const semCnpj = (n: string) => n.replace(/^[\d./-]{6,}\s+/, '').trim() || n;
      const linhas = [...lista].sort((a, b) => a.data.localeCompare(b.data)).map(c => [br(c.data), semCnpj(c.cliente), c.porte || '', c.descricao, c.oculta ? '' : c.valor,
        c.situacao === 'paga' ? 'Paga' + (c.pagoEm ? ' em ' + br(c.pagoEm) : '') : c.situacao === 'recusada' ? 'Recusada' : 'A receber']);
      return { bytes: tf.planilhaXlsx('Comissões', ['Data', 'Cliente', 'Porte', 'Serviço', 'Comissão', 'Status'], linhas), nome: 'Extrato de comissões ' + carteira.mesPorExtenso(m.mes) + '.xlsx' };
    },
    /** os ⋯ da tabela (19/11/2026: "coloca a opcao de editar e excluir, um 3 pontinhos"): só a comissão ainda lançada muda ou sai */
    podeMexer: (c: carteira.Comissao) => carteira.pessoaPodeMexer(c, new Date()),
    async excluir(c: carteira.Comissao) {
      const ok = await modal<boolean>({ icone: 'alert', titulo: 'Excluir a comissão?', texto: c.cliente + ' · ' + (c.oculta ? c.descricao : formatos.reais(c.valor)),
        botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Excluir', valor: true, variante: 'btn-danger' }] });
      if (!ok) return;
      try { await repo.apagarComissao(c.id); toast('Comissão excluída.'); } catch (e) { toast(mensagem(e, 'Não consegui excluir.')); }
    },
    abrirDocumento: (d: carteira.DocumentoDaCarteira) => void abrirBytes(() => repo.bytesDoDocumento(d.id), d.arquivo, toast),
    baixarDocumento: (d: carteira.DocumentoDaCarteira) => void baixarDaCarteira(() => repo.bytesDoDocumento(d.id), d.arquivo, toast),
    abrirComprovante: (contaId: string, c: { id: string; nome: string }) => void abrirBytes(() => repo.bytesDoComprovante(contaId, c.id), c.nome, toast),
  };
}

/** O cliente do cadastro no menu da comissão (pelo código do ERP). */
export interface ClienteDaLista { codigo: number; nome: string; regime: string }

/** Os clientes do escritório para o menu da comissão: a lista do escritório e as empresas cadastradas pelo nads (com código). */
/** As empresas do Cadastro ainda sem o código do ERP (o MEI registrado pelo cartão CNPJ; 19/11/2026: "ja ta no sistema, ok, porque
 *  nao consigo selecionar?"): entram na comissão como avulsas, com o nome e o porte (o MEI pelo regime). */
export interface ClienteSemCodigo { nome: string; porte: carteira.Porte | null }

function useClientesSemCodigo(): ClienteSemCodigo[] {
  const cadastros = useTodosOsCadastros();
  return useMemo(() => {
    const nomes = new Map<string, ClienteSemCodigo>();
    for (const e of empresasNovas()) if (e.codigo == null && e.nome.trim() && !nomes.has(e.nome.trim())) nomes.set(e.nome.trim(), { nome: e.nome.trim(), porte: e.regime === 'MEI' ? 'MEI' : null });
    return [...nomes.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cadastros]);
}

function useClientesDoEscritorio(): ClienteDaLista[] {
  const cadastros = useTodosOsCadastros();
  return useMemo(() => {
    const porCodigo = new Map<number, { nome: string; regime: string }>();
    for (const e of [...empresas.EMPRESAS_COM_DP, ...empresasNovas()]) if (e.codigo != null && !porCodigo.has(e.codigo)) porCodigo.set(e.codigo, { nome: e.nome, regime: e.regime });
    return [...porCodigo].map(([codigo, x]) => ({ codigo, ...x })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    // as empresas novas vêm do cadastro: refaz quando ele muda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cadastros]);
}

/**
 * A janela de registrar a comissão. Pela Carteira, o mês do pagamento é sempre o seguinte ao atual (Vitor, 12/11/2026);
 * pelo Financeiro (doFinanceiro), escolhe a pessoa e qualquer mês (a retroativa), e a comissão já entra aprovada.
 */
export function useJanelaDaComissao(comissao: carteira.Comissao | null, fechar: () => void, doFinanceiro = false) {
  const repo = useCarteira();
  const { toast, modal } = useRetorno();
  const equipe = useAcesso().equipe();
  const clientes = useClientesDoEscritorio();
  const clientesSemCodigo = useClientesSemCodigo();
  const servicos = repo.servicos();
  // a comissão escondida (16/11/2026): quem tem a % própria registra sem ver a comissão; o robô da nuvem calcula. Pelo
  // Financeiro, como sempre (a % do serviço)
  const marca = repo.minhaComissaoOculta();
  const novidade = useNovidade('comissao-oculta');
  const oculta = comissao ? !!comissao.oculta : !doFinanceiro && novidade && marca.ligada;
  const agora = new Date();
  const [competencia, setCompetencia] = useState(comissao?.competencia ?? (doFinanceiro ? carteira.competenciaDe(agora) : carteira.mesDoPagamento(agora)));
  const [para, setPara] = useState<{ uid: string; nome: string } | null>(null);
  const [data, setData] = useState(dataBr(comissao?.data ?? hoje()));
  // a comissão de antes (sem o código do cliente) abre como avulsa
  const [avulso, setAvulso] = useState(!!comissao && comissao.clienteCodigo == null);
  const [clienteCodigo, setClienteCodigo] = useState<number | null>(comissao?.clienteCodigo ?? null);
  const [nomeAvulso, setNomeAvulso] = useState(comissao && comissao.clienteCodigo == null ? comissao.cliente : '');
  const [porte, setPorte] = useState<carteira.Porte | null>(comissao?.porte ?? null);
  const [servico, setServico] = useState(comissao?.servico ?? '');
  // a quantidade e o valor do serviço que o Financeiro definiu (23/11/2026; a novidade 'comissao-quantidade'): o campo do valor passa
  // a ser o de uma unidade, e o gravado é o total (unidade × quantidade)
  const comQuantidade = useNovidade('comissao-quantidade');
  const qtdInicial = comissao && comQuantidade ? carteira.quantidadeDaComissao(comissao) : 1;
  const [quantidade, setQuantidade] = useState(String(qtdInicial));
  const [valorServico, setValorServico] = useState(valorNoCampo((comissao?.valorServico ?? 0) / qtdInicial));
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  // a escondida não muda depois de registrada (o valor do serviço sai do banco quando o robô calcula): só apaga, enquanto lançada
  // virou o mês, a da pessoa trava (19/11/2026); o Financeiro continua mexendo
  const travada = !!comissao && (!carteira.podeEditar(comissao) || oculta || (!doFinanceiro && !carteira.pessoaPodeMexer(comissao, agora)));
  // a %: a que ficou gravada na comissão já decidida; senão, a de hoje do serviço (a escondida vai sem)
  // o Diretor define a % no lançamento (Vitor, 19/11/2026: "O diretor, pode definir a comissao diretamente dessa tela, abaixo do
  // valor, APENAS DIRETORES podem definir a porcentagem de comissao no lancamento"): pelo nível da conta (Diretor e Dono); vazio, a do serviço
  const diretor = usuarios.nivelDeDiretor(useOperador().operador?.nivel);
  const [pctDoDiretor, setPctDoDiretor] = useState(comissao?.percentual != null && comissao.percentual !== carteira.percentualDoServico(servicos.lista, comissao.servico ?? '') ? String(comissao.percentual).replace('.', ',') : '');
  const pctDigitado = diretor && pctDoDiretor.trim() ? Number(pctDoDiretor.replace(',', '.')) : NaN;
  const percentual = travada ? comissao!.percentual ?? 0 : oculta ? 0 : Number.isFinite(pctDigitado) ? Math.min(100, Math.max(0, pctDigitado)) : carteira.percentualDoServico(servicos.lista, servico);
  const qtd = comQuantidade ? Math.min(carteira.QUANTIDADE_MAXIMA, Math.max(1, parseInt(quantidade, 10) || 1)) : 1;
  // com o valor do Financeiro, a pessoa não digita (a já decidida fica com o que foi gravado)
  const valorFixo = comQuantidade && !travada ? carteira.valorDoServico(servicos.lista, servico) : 0;
  const unidade = valorFixo > 0 ? valorFixo : valorDigitado(valorServico);
  const vs = Math.round(unidade * qtd * 100) / 100;
  const cliente = avulso ? nomeAvulso : clientes.find(c => c.codigo === clienteCodigo)?.nome ?? comissao?.cliente ?? '';
  const pessoas = equipe.lista.filter(u => u.ativo).map(u => ({ uid: u.uid, nome: u.nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return {
    doFinanceiro, travada, salvando, erros,
    competencia, setCompetencia, mesesDoFinanceiro: [carteira.mesDoPagamento(agora), ...carteira.ultimosMeses(agora, 12)],
    pessoas, para, setPara,
    data, setData,
    clientes, avulso, clienteCodigo, cliente, nomeAvulso, setNomeAvulso, porte, setPorte,
    escolherCliente: (codigo: number) => { setAvulso(false); setClienteCodigo(codigo); },
    marcarAvulso: () => { setAvulso(true); setClienteCodigo(null); },
    clientesSemCodigo,
    /** a empresa do Cadastro sem código (ou a do cartão CNPJ do MEI): avulsa, com o nome e o porte dela */
    escolherSemCodigo: (nome: string, porteDela: carteira.Porte | null) => { setAvulso(true); setClienteCodigo(null); setNomeAvulso(porteDela === 'MEI' ? nome.replace(/^[\d./-]+\s+/, '').trim() || nome : nome); if (porteDela) setPorte(porteDela); },
    servicos: servicos.lista, servico, setServico, percentual, oculta,
    /** só o Diretor e o Dono definem a % no lançamento; o texto digitado ('' = a do serviço) e a do serviço, para o lugar vazio */
    podeDefinirPercentual: diretor && !oculta, pctDoDiretor, setPctDoDiretor: (v: string) => setPctDoDiretor(v.replace(/[^\d,.]/g, '').slice(0, 6)),
    percentualDoServico: carteira.percentualDoServico(servicos.lista, servico),
    /** apagar: a própria pessoa, enquanto está lançada (a escondida também) */
    podeApagar: !!comissao && (doFinanceiro ? carteira.podeEditar(comissao) : carteira.pessoaPodeMexer(comissao, agora)),
    valorServico, setValorServico,
    /** a quantidade (23/11/2026): o texto do campo, o número que vale e o − e o + ; o valor que o Financeiro definiu (0 = a pessoa digita) e o total */
    comQuantidade, quantidade, qtd, valorFixo, unidade, total: vs,
    setQuantidade: (v: string) => setQuantidade(v.replace(/\D/g, '').slice(0, 3)),
    mudarQuantidade: (d: number) => setQuantidade(String(Math.min(carteira.QUANTIDADE_MAXIMA, Math.max(1, qtd + d)))),
    /** a comissão que vai sair (valor do serviço × %) */
    valor: travada ? comissao!.valor : vs > 0 && percentual > 0 ? carteira.valorDaComissao(vs, percentual) : 0,
    async salvar() {
      if (travada) return;
      const c: carteira.ComissaoParaSalvar = {
        competencia, data: isoDaData(data), cliente: cliente.trim(), clienteCodigo: avulso ? null : clienteCodigo, porte: avulso ? porte : null,
        servico, valorServico: vs, percentual, ...(oculta ? { oculta: true } : {}), ...(qtd > 1 ? { quantidade: qtd } : {}),
      };
      const retroativa = doFinanceiro ? '' : carteira.conferirDataDaPessoa(c.data, new Date());
      const problemas = [...(doFinanceiro && !para ? ['Escolha a pessoa.'] : []), ...(retroativa ? [retroativa] : []), ...carteira.conferirComissao(c)];
      setErros(problemas);
      if (problemas.length) return;
      setSalvando(true);
      try {
        if (doFinanceiro) { await repo.registrarComissaoDe(para!, c); toast('Comissão registrada para ' + para!.nome + '.'); }
        else { await repo.salvarComissao(c, comissao?.id); toast(comissao ? 'Comissão alterada.' : 'Comissão registrada.'); }
        fechar();
      } catch (e) { setErros([mensagem(e, 'Não consegui gravar.')]); }
      finally { setSalvando(false); }
    },
    async apagar() {
      if (!comissao) return;
      const ok = await modal<boolean>({ icone: 'alert', titulo: 'Apagar a comissão?', texto: comissao.cliente + ' · ' + (comissao.oculta ? comissao.descricao : 'R$ ' + comissao.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })),
        botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Apagar', valor: true, variante: 'btn-danger' }] });
      if (!ok) return;
      try { await repo.apagarComissao(comissao.id); toast('Comissão apagada.'); fechar(); } catch (e) { toast(mensagem(e, 'Não consegui apagar.')); }
    },
  };
}

export type ColunaDosServicos = 'nome' | 'valor' | 'percentual';
const posicao = (ids: readonly string[], id: string) => { const i = ids.indexOf(id); return i < 0 ? ids.length : i; };
/** pelo nome (a ordem do português) ou pelo número; o vazio vai sempre para o fim */
function ordenarServicos<T extends { nome: string; valor: string; percentual: string }>(l: readonly T[], coluna: ColunaDosServicos, dir: 'asc' | 'desc'): T[] {
  const sinal = dir === 'asc' ? 1 : -1;
  return [...l].sort((a, b) => {
    if (coluna === 'nome') return sinal * a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });
    const va = a[coluna].trim() ? valorDigitado(a[coluna]) : null, vb = b[coluna].trim() ? valorDigitado(b[coluna]) : null;
    if (va == null || vb == null) return va == null && vb == null ? 0 : va == null ? 1 : -1;
    return sinal * (va - vb);
  });
}

/** A janela dos serviços comissionados (o Financeiro): os serviços, a % de cada um, acrescentar e tirar. */
export function useJanelaDosServicos(fechar: () => void) {
  const repo = useCarteira();
  const { toast } = useRetorno();
  const salvos = repo.servicos();
  const [lista, setLista] = useState<{ id: string; nome: string; percentual: string; valor: string }[] | null>(null);
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  // o valor do serviço (23/11/2026, a novidade 'comissao-quantidade'): a coluna só aparece com a novidade, mas o valor gravado
  // passa junto mesmo sem ela, para não se perder
  const comValor = useNovidade('comissao-quantidade');
  // a lista que está na tela: a do banco até a pessoa mexer
  const atual = lista ?? salvos.lista.map(s => ({ id: s.id, nome: s.nome, percentual: s.percentual ? valorNoCampo(s.percentual) : '', valor: s.valor ? valorNoCampo(s.valor) : '' }));
  const comoServicos = () => atual.map(s => ({ id: s.id, nome: s.nome, percentual: s.percentual.trim() ? valorDigitado(s.percentual) : 0, ...(s.valor.trim() && valorDigitado(s.valor) > 0 ? { valor: valorDigitado(s.valor) } : {}) }));
  // ordenar pelo título da coluna (Vitor, 26/11/2026: "nomeacao crecente ou descrescente quando clica no cabeçalho"): a ordem é
  // tirada no clique (digitar não faz a linha pular); o serviço novo entra no fim. Só a tela: a lista grava na ordem de sempre
  const [ordem, setOrdem] = useState<{ coluna: ColunaDosServicos; dir: 'asc' | 'desc'; ids: string[] } | null>(null);
  const naTela = ordem ? [...atual].sort((a, b) => posicao(ordem.ids, a.id) - posicao(ordem.ids, b.id)) : atual;
  return {
    carregada: salvos.carregada, erro: salvos.erro, lista: naTela, erros, salvando, comValor,
    ordem: ordem ? { coluna: ordem.coluna, dir: ordem.dir } : null,
    ordenar(coluna: ColunaDosServicos) {
      const dir = ordem?.coluna === coluna && ordem.dir === 'asc' ? 'desc' : 'asc';
      setOrdem({ coluna, dir, ids: ordenarServicos(atual, coluna, dir).map(s => s.id) });
    },
    mudar: (id: string, campo: 'nome' | 'percentual' | 'valor', v: string) => setLista(atual.map(s => (s.id === id ? { ...s, [campo]: v } : s))),
    tirar: (id: string) => setLista(atual.filter(s => s.id !== id)),
    /** a linha nova, vazia, no fim (26/11/2026: "um botao de adicionar abaixo"): o id dela, para a tela pôr o cursor no nome */
    adicionar() {
      const s = carteira.novoServico(comoServicos(), 'servico');
      setLista([...atual, { id: s.id, nome: '', percentual: '', valor: '' }]);
      return s.id;
    },
    async salvar() {
      const l = comoServicos();
      const problemas = carteira.conferirServicos(l);
      setErros(problemas);
      if (problemas.length) return;
      setSalvando(true);
      try { await repo.salvarServicos(l); toast('Serviços gravados.'); fechar(); }
      catch (e) { setErros([mensagem(e, 'Não consegui gravar.')]); }
      finally { setSalvando(false); }
    },
  };
}

/** Holerites e pagamentos (12/11/2026: os valores da Visão geral vieram para cá): o mês, os números e os últimos 6 meses. */
export function useHoleritesEPagamentos(mesDeFora?: ReturnType<typeof useMes>) {
  const repo = useCarteira();
  const { toast } = useRetorno();
  const proprio = useMes();
  const m = mesDeFora ?? proprio;
  const comissoes = repo.minhasComissoes(), docs = repo.meusDocumentos(), contas = repo.minhasContas();
  const pags = pagamentosDe(contas.lista);
  // a escondida fica fora dos valores da pessoa (16/11/2026)
  const comValor = carteira.comValorParaAPessoa(comissoes.lista);
  const hist = carteira.historico(m.meses.slice(0, 6), comValor, [], docs.lista);
  return {
    m, exemplos: repo.exemplos, carregando: !comissoes.carregada || !docs.carregada || !contas.carregada, erro: comissoes.erro || docs.erro || contas.erro,
    salario: carteira.salarioDoMes(docs.lista, m.mes),
    recebido: carteira.recebidoNoMes(pags, m.mes),
    totais: carteira.totaisDasComissoes(comValor.filter(c => c.competencia === m.mes)),
    hist, maior: Math.max(1, ...hist.map(h => h.salario + h.comissoes)),
    docs: docs.lista, docsCarregados: docs.carregada, pags, contasCarregadas: contas.carregada,
    abrirDocumento: (d: carteira.DocumentoDaCarteira) => void abrirBytes(() => repo.bytesDoDocumento(d.id), d.arquivo, toast),
    baixarDocumento: (d: carteira.DocumentoDaCarteira) => void baixarDaCarteira(() => repo.bytesDoDocumento(d.id), d.arquivo, toast),
    abrirComprovante: (contaId: string, c: { id: string; nome: string }) => void abrirBytes(() => repo.bytesDoComprovante(contaId, c.id), c.nome, toast),
  };
}

export function useComissoesDaEquipe() {
  const repo = useCarteira();
  const { toast, modal } = useRetorno();
  const m = useMes('incluir');
  const [aberta, setAberta] = useState('');
  const [fazendo, setFazendo] = useState('');
  // as janelas do Financeiro: registrar a comissão de alguém (a retroativa) e os serviços comissionados com a %
  const [janela, setJanela] = useState<'' | 'registrar' | 'servicos'>('');
  const doMes = repo.comissoesDoMes(m.mes);
  const [dev] = useModoDesenvolvedor();
  // o que não bate (o valor, a %, o valor do serviço) aparece na linha antes do Marcar como pago (auditoria, 24/11/2026)
  const servicos = repo.servicos();
  return {
    m, exemplos: repo.exemplos, dev, teste: useTesteDaCarteira(), carregada: doMes.carregada, erro: doMes.erro, todas: doMes.lista,
    avisos: (c: carteira.Comissao) => (servicos.carregada ? carteira.avisosDaComissao(c, servicos.lista) : []),
    resumo: carteira.resumoParaPagar(doMes.lista), totais: carteira.totaisDasComissoes(doMes.lista),
    aberta, alternar: (uid: string) => setAberta(a => (a === uid ? '' : uid)), fazendo, janela, setJanela,
    /** aprovar, recusar (com o motivo), marcar como pago (confirma antes) ou voltar para lançada */
    async decidir(chave: string, ids: string[], situacao: Decisao, ok: string, pedirMotivo?: (guardar: (t: string) => void) => unknown) {
      if (!ids.length || fazendo) return;
      let motivo: string | undefined;
      if (situacao === 'recusada') {
        let digitado = '';
        const sim = await modal<boolean>({ icone: 'alert', titulo: 'Recusar a comissão?', texto: 'A pessoa vê o motivo na Carteira dela.',
          corpo: pedirMotivo?.(t => { digitado = t; }) as never,
          botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Recusar', valor: true, variante: 'btn-danger' }] });
        if (!sim) return;
        motivo = digitado;
      }
      if (situacao === 'paga') {
        const sim = await modal<boolean>({ icone: 'dinheiro', titulo: 'Marcar como pago?', texto: ids.length + (ids.length === 1 ? ' comissão passa' : ' comissões passam') + ' para Paga. A pessoa vê na Carteira.',
          botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Marcar como pago', valor: true, variante: 'btn-primary' }] });
        if (!sim) return;
      }
      setFazendo(chave);
      try { await repo.decidirComissoes(ids, situacao, motivo); toast(ok); } catch (e) { toast(mensagem(e, 'Não consegui gravar.')); } finally { setFazendo(''); }
    },
  };
}

export function useEnviarHolerites() {
  const repo = useCarteira();
  const equipe = useAcesso().equipe();
  const { toast, modal } = useRetorno();
  const m = useMes();
  const [enviando, setEnviando] = useState<{ uid: string; nome: string; tipo: carteira.TipoDeDocumento } | null>(null);
  const docs = repo.documentosDoMes(m.mes);
  const pessoas = equipe.lista.filter(u => u.ativo || docs.lista.some(d => d.uid === u.uid)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return {
    m, exemplos: repo.exemplos, carregando: !docs.carregada || !equipe.carregada, erro: docs.erro, pessoas,
    comHolerite: pessoas.filter(u => docs.lista.some(d => d.uid === u.uid && d.tipo === 'holerite')).length,
    docsDe: (uid: string, tipo: carteira.TipoDeDocumento) => docs.lista.filter(d => d.uid === uid && d.tipo === tipo),
    enviando, setEnviando,
    abrir: (d: carteira.DocumentoDaCarteira) => void abrirBytes(() => repo.bytesDoDocumento(d.id), d.arquivo, toast),
    async tirar(d: carteira.DocumentoDaCarteira) {
      const ok = await modal<boolean>({ icone: 'alert', titulo: 'Tirar este documento?', texto: d.arquivo + ' sai da Carteira de ' + d.nome + '.',
        botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Tirar', valor: true, variante: 'btn-danger' }] });
      if (!ok) return;
      try { await repo.apagarDocumento(d.id); toast('Documento tirado.'); } catch (e) { toast(mensagem(e, 'Não consegui tirar.')); }
    },
  };
}

export function useJanelaDoDocumento(para: { uid: string; nome: string; tipo: carteira.TipoDeDocumento }, competencia: string, fechar: () => void) {
  const repo = useCarteira();
  const { toast } = useRetorno();
  const [arquivo, setArquivo] = useState<{ nome: string; bytes: Uint8Array } | null>(null);
  const [valor, setValor] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  return {
    arquivo, tirarArquivo: () => setArquivo(null), valor, setValor, erro, enviando,
    async escolher(f: File | undefined) {
      if (!f) return;
      if (!f.size) { setErro('O arquivo está vazio.'); return; }
      if (f.size > carteira.LIMITE_DO_DOCUMENTO) { setErro('O arquivo passa de 10 MB.'); return; }
      setErro('');
      setArquivo({ nome: f.name, bytes: new Uint8Array(await f.arrayBuffer()) });
    },
    async enviar() {
      if (!arquivo) { setErro('Escolha o arquivo.'); return; }
      const v = valor.trim() ? valorDigitado(valor) : null;
      if (v != null && !(v > 0)) { setErro('Confira o valor (ou deixe em branco).'); return; }
      setEnviando(true);
      try { await repo.enviarDocumento({ ...para, competencia, valor: v }, arquivo); toast(carteira.rotuloDoDocumento(para.tipo) + ' enviado para ' + para.nome + '.'); fechar(); }
      catch (e) { setErro(mensagem(e, 'Não consegui enviar.')); }
      finally { setEnviando(false); }
    },
  };
}

/** O ⚡ da Carteira (13/11/2026): no modo desenvolvedor, o que está ligado dos exemplos e como ligar. */
export function useDadosDeTesteDaCarteira() {
  const [dev] = useModoDesenvolvedor();
  return { dev, t: useTesteDaCarteira() };
}
