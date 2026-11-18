// ViewModel do Lançatudo aberto numa empresa: as linhas do extrato do mês (o que o Extrator já leu) com a contrapartida,
// as regras da empresa e a saída para o Alterdata. As regras do negócio são do core (lancatudo); aqui só junta os dados
// (Extrator, Cadastro e o próprio Lançatudo no banco), guarda o que a pessoa faz e prepara o que a View mostra.
import { creditor, extrator, formatos, lancatudo as lt } from '@nads/core';
import { baixarBytes, useRetorno } from '@nads/ui';
import { useMemo, useState } from 'react';
import { nomeDoLote } from '../../../../comum/importarNoAlterdata';
import { useOperador } from '../../casca/operador';
import { repoDoExtrator, useExtratorDaEmpresa } from '../../dados/extrator';
import { useCadastro, useRepoLancatudo } from '../../dados/repo';
import type { EmpresaDoLancatudo } from './useLancatudo';

export type FiltroDasLinhas = 'todas' | 'revisar' | 'conciliadas' | 'fora';

export const ROTULO_SITUACAO: Record<lt.SituacaoDaLinha, string> = {
  conciliada: 'Conciliada', sugerida: 'Sugerida', pendente: 'Sem conta', ignorada: 'Fora', 'no-razao': 'No razão',
};
export const ROTULO_ORIGEM: Record<lt.OrigemDaConta, string> = {
  pessoa: 'Escolhida na linha', regra: 'Pela regra', lembrada: 'Aprendida do favorecido', razao: 'Sugerida pelo razão (confirme)',
  lancada: 'Já está no razão do mês (o mesmo valor no mesmo dia)',
};
export const ROTULO_SENTIDO: Record<lt.SentidoDaRegra, string> = { entrada: 'Entrou no banco', saida: 'Saiu do banco', ambos: 'Entrou ou saiu' };
export const ROTULO_TIPO: Record<lt.TipoDaRegra, string> = { historico: 'Texto do histórico', favorecido: 'Favorecido (nome ou CPF/CNPJ)' };

/** A regra no formulário (id null = nova). */
export interface RegraNoFormulario extends lt.DadosDaRegra { id: string | null }

const regraVazia = (): RegraNoFormulario => ({ id: null, tipo: 'historico', expressao: '', sentido: 'saida', conta: '', comHistoricoDoExtrato: true, historico: '', codHistorico: '', descricao: '', banco: '' });

/** O nome do banco sem o "C/ MOVIMENTO" (ou "CONTA MOVIMENTO") do fim. */
const nomeCurtoDoBanco = (doPlano: string, doCadastro: string) => (doPlano.replace(/\s*[-–]?\s*(C\/\s*|CONTA\s+)MOVIMENTO\s*$/i, '').trim() || doCadastro);

const dataBR = (iso: string) => iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const rotuloDoMes = (c: string) => MESES[Number(c.slice(5, 7)) - 1] + ' de ' + c.slice(0, 4);

export function useRegistroDoLancatudo(empresa: EmpresaDoLancatudo, competencia: string, bancoEscolhido: string | null) {
  const { operador } = useOperador();
  const quem = operador?.nome || '';
  const { aviso } = useRetorno();
  const nome = empresa.nome;

  const e = useExtratorDaEmpresa(nome);
  const extratorChegou = repoDoExtrator().carregada(nome);
  const cad = useCadastro(nome, empresa.codigo);
  const repo = useRepoLancatudo();
  const cfg = repo.config(nome);
  const mesNoBanco = repo.mes(nome, competencia);

  const { bancos, primeiro } = useMemo(() => extrator.bancosDaEmpresaNa(e, cad.carregada ? cad.cadastro : null, empresa.codigo, competencia),
    [e, cad.carregada, cad.cadastro, empresa.codigo, competencia]);
  const banco = bancos.find(b => b.id === bancoEscolhido) || bancos[0];
  const contaDoBanco = cad.cadastro.bancos?.find(b => b.id === banco.id)?.contaContabil || '';
  const plano = useMemo(() => cad.plano?.contas.length ? cad.plano.contas : null, [cad.plano]);
  const contasDoPlano = useMemo((): { codigo: string; nome: string }[] => (plano || []).filter(c => !c.sintetica).map(c => ({ codigo: c.codigo, nome: c.nome })), [plano]);
  const nomeDaConta = (codigo: string) => plano?.find(c => c.codigo === codigo)?.nome || '';

  const dados = useMemo(() => lt.dadosDoBanco(e, banco.id, primeiro, competencia), [e, banco.id, primeiro, competencia]);
  const decisoes = mesNoBanco.mes.decisoes[banco.id];
  // os meses com extrato deste banco (a tela vazia oferece, quando o mês escolhido não tem; os 6 mais novos)
  const mesesComExtrato = useMemo(() => lt.mesesComExtrato(e, banco.id, primeiro).filter(m => m !== competencia).slice(0, 6)
    .map(m => ({ valor: m, rotulo: rotuloDoMes(m) })), [e, banco.id, primeiro, competencia]);
  const linhas = useMemo(() => lt.montarRegistro({ dados, banco: banco.id, contaDoBanco, config: cfg.config, decisoes: decisoes || {}, plano }),
    [dados, banco.id, contaDoBanco, cfg.config, decisoes, plano]);
  const totais = useMemo(() => lt.totaisDoRegistro(linhas), [linhas]);

  // ---- filtro, busca e seleção
  // como no LCDPR: Todos, Só REVISAR (sem conta ou sugerida) e Fora (no razão ou tirada da exportação)
  const [filtro, setFiltro] = useState<FiltroDasLinhas>('todas');
  const [busca, setBusca] = useState('');
  const [selecionadas, setSelecionadas] = useState<ReadonlySet<string>>(new Set());
  const visiveis = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return linhas.filter(l => {
      const passa = filtro === 'todas' || (filtro === 'revisar' ? l.situacao === 'pendente' || l.situacao === 'sugerida'
        : filtro === 'conciliadas' ? l.situacao === 'conciliada' : l.situacao === 'ignorada' || l.situacao === 'no-razao');
      if (!passa) return false;
      if (!b) return true;
      return l.historicoDoBanco.toLowerCase().includes(b) || l.historico.toLowerCase().includes(b) || (l.conta || '').includes(b)
        || l.nomeDaConta.toLowerCase().includes(b) || extrator.valorBR(Math.abs(l.valor)).includes(b);
    });
  }, [linhas, filtro, busca]);
  const marcar = (chave: string) => setSelecionadas(s => { const n = new Set(s); if (n.has(chave)) n.delete(chave); else n.add(chave); return n; });
  const todasMarcadas = visiveis.length > 0 && visiveis.every(l => selecionadas.has(l.chave));
  const marcarVisiveis = (sim: boolean) => setSelecionadas(sim ? new Set(visiveis.map(l => l.chave)) : new Set());
  const marcarRevisar = () => setSelecionadas(new Set(linhas.filter(l => l.situacao === 'pendente' || l.situacao === 'sugerida').map(l => l.chave)));

  // ---- a linha aberta na janela
  const [aberta, setAberta] = useState<string | null>(null);
  const linhaAberta = aberta ? linhas.find(l => l.chave === aberta) || null : null;

  // ---- gravar
  const pronto = extratorChegou && cad.carregada && cfg.carregada && mesNoBanco.carregado;
  const falhou = (err: unknown) => aviso({ tom: 'erro', titulo: 'Não deu para salvar', texto: (err as Error).message });
  const salvarMes = (m: lt.MesDoLancatudo) => { repo.salvarMes(nome, m).catch(falhou); };
  const salvarConfig = (c: lt.ConfigDoLancatudo) => { repo.salvarConfig(nome, c).catch(falhou); };
  const agora = () => new Date();

  /** O código digitado ou escolhido ("10503" ou "10503 — Banco Sicoob") e o que está errado nele. */
  function contaValida(texto: string): { conta: string; problema: string | null } {
    const conta = (texto.match(/^\s*(\d+)/) || [])[1] || '';
    if (!conta) return { conta: '', problema: 'Informe o código reduzido da conta (só números).' };
    return { conta, problema: lt.problemaDaConta(conta, plano) };
  }

  function escolherConta(chaves: readonly string[], texto: string): boolean {
    if (!pronto) return false;
    const { conta, problema } = contaValida(texto);
    if (problema) { aviso({ tom: 'erro', titulo: 'Conta não aceita', texto: problema }); return false; }
    const alvo = linhas.filter(l => chaves.includes(l.chave));
    if (!alvo.length) return false;
    const r = lt.escolherConta(mesNoBanco.mes, cfg.config, banco.id, alvo, conta, agora(), quem);
    salvarMes(r.mes);
    salvarConfig(r.config);
    setSelecionadas(new Set());
    return true;
  }

  /** Confirma as sugeridas (as marcadas, ou todas): cada uma com a conta que o razão sugeriu, e o nads aprende. */
  function confirmarSugeridas() {
    if (!pronto) return;
    const alvo = linhas.filter(l => l.situacao === 'sugerida' && (!selecionadas.size || selecionadas.has(l.chave)));
    if (!alvo.length) return;
    let mes = mesNoBanco.mes, config = cfg.config;
    for (const l of alvo) {
      const r = lt.escolherConta(mes, config, banco.id, [l], l.conta as string, agora(), quem);
      mes = r.mes; config = r.config;
    }
    salvarMes(mes);
    salvarConfig(config);
    setSelecionadas(new Set());
    aviso({ tom: 'ok', titulo: alvo.length + (alvo.length === 1 ? ' linha confirmada' : ' linhas confirmadas') });
  }

  /** O OK da linha (o do Xero): a sugerida vira escolhida (e o nads aprende); sem conta, abre o plano. */
  function confirmar(l: lt.LinhaDoRegistro) {
    if (!l.conta || l.problema) { abrirPlano([l.chave]); return; }
    escolherConta([l.chave], l.conta);
  }

  const mudarLinha = (f: (m: lt.MesDoLancatudo) => lt.MesDoLancatudo) => { if (pronto) salvarMes(f(mesNoBanco.mes)); };
  const removerConta = (chave: string) => mudarLinha(m => lt.removerConta(m, banco.id, chave, agora(), quem));
  const voltarAoAutomatico = (chave: string) => mudarLinha(m => lt.voltarAoAutomatico(m, banco.id, chave));
  const editarHistorico = (chave: string, h: string) => mudarLinha(m => lt.editarHistorico(m, banco.id, chave, h, agora(), quem));
  const ignorar = (chaves: readonly string[], sim: boolean) => {
    mudarLinha(m => chaves.reduce((x, k) => lt.ignorarLinha(x, banco.id, k, sim, agora(), quem), m));
    setSelecionadas(new Set());
  };

  // ---- regras
  const [regra, setRegra] = useState<RegraNoFormulario | null>(null);
  const problemaDaRegra = regra ? lt.problemaDaRegra(regra) || lt.problemaDaConta(regra.conta.trim(), plano) : null;
  const linhasDaRegra = useMemo(() => {
    const n: Record<string, number> = {};
    for (const l of linhas) if (l.regra) n[l.regra] = (n[l.regra] || 0) + 1;
    return n;
  }, [linhas]);
  /** As linhas do mês que a regra do formulário pega (para a pessoa ver antes de gravar). */
  /** As linhas deste mês que a regra do formulário pega (a janela mostra as primeiras, para ver o efeito antes de gravar). */
  const linhasQueCasam = useMemo(() => (regra && regra.expressao.trim()
    ? linhas.filter(l => lt.regraCasa({ ...regra, id: '', criadaEm: '', por: '', conta: regra.conta || '0' }, { historico: l.historicoDoBanco, valor: l.valor }, banco.id))
    : []), [regra, linhas, banco.id]);
  const casamDaRegra = linhasQueCasam.length;
  const exemplosDaRegra = linhasQueCasam.slice(0, 5).map(l => ({ chave: l.chave, data: dataBR(l.data).slice(0, 5), historico: l.historicoDoBanco, valor: extrator.valorBR(Math.abs(l.valor)), entrada: l.valor > 0 }));

  function novaRegra(linha?: lt.LinhaDoRegistro) {
    // as regras são por banco (18/11/2026: "as regras são por banco", como no Mister): a nova já vem da conta bancária aberta
    const base = { ...regraVazia(), banco: banco.id };
    if (!linha) { setRegra(base); return; }
    setRegra({ ...base, ...lt.regraSugerida({ historico: linha.historicoDoBanco, valor: linha.valor }), conta: linha.conta || '' });
  }
  function editarRegra(id: string) {
    const r = cfg.config.regras.find(x => x.id === id);
    if (r) setRegra({ ...regraVazia(), ...r, id: r.id, historico: r.historico || '', codHistorico: r.codHistorico || '', descricao: r.descricao || '', banco: r.banco || '' });
  }
  function salvarRegra() {
    if (!regra || problemaDaRegra || !pronto) return;
    const { id, ...dadosDaRegra } = regra;
    const c = id ? lt.editarRegra(cfg.config, id, dadosDaRegra, quem, agora()) : lt.criarRegra(cfg.config, dadosDaRegra, agora(), quem);
    salvarConfig(c);
    setRegra(null);
    aviso({ tom: 'ok', titulo: id ? 'Regra alterada' : 'Regra criada', texto: casamDaRegra ? casamDaRegra + (casamDaRegra === 1 ? ' linha deste mês' : ' linhas deste mês') + ' com ela' : undefined });
  }
  function excluirRegra(id: string) {
    if (!pronto) return;
    salvarConfig(lt.excluirRegras(cfg.config, [id]));
    if (regra?.id === id) setRegra(null);
  }
  const esquecer = (chave: string) => { if (pronto) salvarConfig(lt.esquecerLembrada(cfg.config, chave)); };
  const lembradas = useMemo(() => Object.entries(cfg.config.lembradas).map(([chave, l]) => ({ chave, ...l, nome: nomeDaConta(l.conta), sentido: chave.startsWith('e:') ? 'Entrou' : 'Saiu' }))
    .sort((a, b) => b.em.localeCompare(a.em)), [cfg.config.lembradas, plano]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- o plano de contas em árvore (como no eContador): quem abre diz o que fazer com a conta escolhida
  const linhasDoPlano = useMemo(() => lt.linhasDoPlano(plano || []), [plano]);
  const [escolhendo, setEscolhendo] = useState<{ conta: string | null; quantas: number; aoEscolher: (codigo: string) => void } | null>(null);
  /** Para as linhas (uma ou as marcadas): a conta escolhida vai direto para elas. */
  const abrirPlano = (chaves: readonly string[]) => {
    const uma = chaves.length === 1 ? linhas.find(l => l.chave === chaves[0]) : null;
    const alvo = [...chaves];
    setEscolhendo({ conta: uma?.conta || null, quantas: alvo.length, aoEscolher: c => escolherConta(alvo, c) });
  };
  const abrirPlanoDaRegra = () => setEscolhendo({ conta: regra?.conta || null, quantas: 0, aoEscolher: c => setRegra(r => (r ? { ...r, conta: c } : r)) });
  const escolherNoPlano = (codigo: string) => { const alvo = escolhendo; setEscolhendo(null); alvo?.aoEscolher(codigo); };

  /** O Gravar da janela da linha (a conta, o histórico e o histórico padrão de uma vez). */
  /**
   * O Gravar da janela da linha: a linha e, se pedido, a regra para os próximos meses (18/11/2026: "quando eu clicar em uma opção
   * de gravar uma regra quando não bater, para que não ocorra mais"), num salvamento só (as regras e o que foi aprendido estão no
   * mesmo documento).
   */
  function gravarLinha(l: lt.LinhaDoRegistro, r: lt.RascunhoDaLinha, regraNova?: lt.DadosDaRegra): boolean {
    if (!pronto) return false;
    const conta = r.conta.trim();
    const problema = conta ? lt.problemaDaConta(conta, plano) : null;
    if (problema) { aviso({ tom: 'erro', titulo: 'Conta não aceita', texto: problema }); return false; }
    if (regraNova) {
      const p = lt.problemaDaRegra(regraNova);
      if (p) { aviso({ tom: 'erro', titulo: 'A regra não foi criada', texto: p }); return false; }
    }
    const x = lt.gravarLinha(mesNoBanco.mes, cfg.config, banco.id, l, r, agora(), quem);
    const config = regraNova ? lt.criarRegra(x.config, { ...regraNova, banco: banco.id }, agora(), quem) : x.config;
    if (x.mes !== mesNoBanco.mes) salvarMes(x.mes);
    if (config !== cfg.config) salvarConfig(config);
    if (regraNova) aviso({ tom: 'ok', titulo: 'Regra criada', texto: 'Nos próximos meses, "' + regraNova.expressao + '" vai para a conta ' + regraNova.conta + '.' });
    return true;
  }

  // ---- saída
  const [comSugeridas, setComSugeridas] = useState(false);
  const paraExportar = useMemo(() => lt.lancamentosParaImportar(linhas, comSugeridas), [linhas, comSugeridas]);
  const motivoSemExportar = !contaDoBanco ? 'Falta o código contábil da conta ' + banco.nome + ' em Configurações › Empresas › Contas bancárias.'
    : !paraExportar.length ? 'Nenhuma linha conciliada para exportar.' : '';
  const registrar = (destino: lt.ExportacaoFeita['destino'], quantidade: number) =>
    salvarMes(lt.registrarExportacao(mesNoBanco.mes, { em: new Date().toISOString(), por: quem, banco: banco.id, quantidade, destino }));

  function baixarArquivo() {
    if (motivoSemExportar) { aviso({ tom: 'erro', titulo: 'Nada para exportar', texto: motivoSemExportar }); return; }
    const arquivo = lt.nomeDoArquivoDoLancatudo(empresa.codigo, banco.nome, competencia);
    baixarBytes(creditor.planilhaDeImportacao(paraExportar), arquivo, creditor.TIPO_XLS);
    registrar('arquivo', paraExportar.length);
    aviso({ tom: 'ok', titulo: paraExportar.length + (paraExportar.length === 1 ? ' lançamento' : ' lançamentos'), texto: arquivo });
  }
  function baixarConferencia() {
    if (motivoSemExportar) { aviso({ tom: 'erro', titulo: 'Nada para conferir', texto: motivoSemExportar }); return; }
    baixarBytes(lt.planilhaDaConferencia(linhas, plano, comSugeridas), lt.nomeDoArquivoDoLancatudo(empresa.codigo, banco.nome, competencia, true), lt.TIPO_XLSX);
    registrar('conferencia', paraExportar.length);
  }
  const planilhaParaOAlterdata = () => (motivoSemExportar ? null : { bytes: creditor.planilhaDeImportacao(paraExportar), linhas: paraExportar.length });
  const lote = nomeDoLote('Lançatudo ' + banco.nome, paraExportar.map(l => l.data));
  const exportacoes = mesNoBanco.mes.exportacoes.filter(x => x.banco === banco.id);
  const ultima = exportacoes[0];
  const ultimaExportacao = ultima ? 'Exportado em ' + new Date(ultima.em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) + (ultima.por ? ' por ' + ultima.por : '')
    + ' · ' + ultima.quantidade + (ultima.quantidade === 1 ? ' lançamento' : ' lançamentos') + (ultima.destino === 'conferencia' ? ' (Simples Conferência)' : '') : '';
  const prontas = totais.conciliadas + totais.ignoradas + totais.noRazao;
  const revisar = totais.pendentes + totais.sugeridas;
  const situacao = !totais.linhas ? { classe: 'nao-iniciada', texto: 'Sem linhas' }
    : revisar ? { classe: 'parada', texto: (revisar === 1 ? 'Falta 1' : 'Faltam ' + revisar) + ' para revisar antes de exportar' }
    : { classe: 'concluida', texto: 'Tudo com conta: pode baixar a planilha' };

  return {
    empresa, competencia, pronto, quem,
    bancos, banco, contaDoBanco, semPlano: cad.carregada && !plano, contasDoPlano, nomeDaConta,
    semExtrato: extratorChegou && !dados.extrato.length, razaoDoMes: dados.razaoDoMes.length > 0, mesesComExtrato, rotuloDoMes: rotuloDoMes(competencia),
    linhas, visiveis, totais, percentual: lt.percentualConciliado(totais),
    filtro, setFiltro, busca, setBusca, selecionadas, marcar, todasMarcadas, marcarVisiveis, marcarRevisar, limparSelecao: () => setSelecionadas(new Set()),
    linhaAberta, abrirLinha: setAberta, fecharLinha: () => setAberta(null), prontas, situacao, ultimaExportacao, confirmar,
    linhasDoPlano, escolhendo, abrirPlano, abrirPlanoDaRegra, escolherNoPlano, fecharPlano: () => setEscolhendo(null), gravarLinha,
    escolherConta, confirmarSugeridas, removerConta, voltarAoAutomatico, editarHistorico, ignorar,
    // as regras do banco aberto (e as que valem para todos), as da conta bancária primeiro
    regras: cfg.config.regras.filter(r => !r.banco || r.banco === banco.id).sort((a, b) => Number(!a.banco) - Number(!b.banco)), linhasDaRegra,
    /** o nome do banco no plano sem o "C/ MOVIMENTO" (18/11/2026: "tira o C/ movimento"); sem plano, o do cadastro */
    nomeDoBanco: nomeCurtoDoBanco(nomeDaConta(contaDoBanco), banco.nome), regra, setRegra, problemaDaRegra, casamDaRegra, exemplosDaRegra, novaRegra, editarRegra, salvarRegra, excluirRegra,
    lembradas, esquecer,
    comSugeridas, setComSugeridas, paraExportar: paraExportar.length, motivoSemExportar, baixarArquivo, baixarConferencia, planilhaParaOAlterdata, lote, exportacoes,
    dataBR, valor: (c: number) => extrator.valorBR(Math.abs(c)),
    /** a classificação da conta no plano (1.1.1.03), como o Registro Contábil do Mister mostra */
    classificacao: (codigo: string | null) => (codigo ? linhasDoPlano.find(x => x.codigo === codigo)?.classificacao || '' : ''),
    /** o CPF/CNPJ que aparece no histórico do banco, com a máscara */
    documentoDaLinha: (l: lt.LinhaDoRegistro) => { const d = lt.documentoNoHistorico(l.historicoDoBanco); return d ? formatos.mascaraDocumento(d) : ''; },
    erro: cfg.erro || mesNoBanco.erro,
  };
}
