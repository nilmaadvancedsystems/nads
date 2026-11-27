// ViewModel do Extrato → SCI (25/11/2026: "Adapte a ferramenta nads → SCI para extratos bancários e coloque o resultado como uma
// função dentro do minimum"): o PDF do extrato, lido pelo leitor do Rotinas (extrator.lerArquivo), vira as linhas da grade com a
// conta do banco contra a contrapartida (as regras do minimum e as do Lançatudo da empresa, pelo de/para do plano do Cadastro), a
// conferência pelo saldo do banco e a planilha do gerador do SCI (o modelo "nads"). Decisões do dono (25/11/2026): um app novo, só
// no navegador; a linha sem regra fica em branco; um lote por extrato; a regra criada aqui fica só no minimum. O Lançatudo e o
// Cadastro só são lidos: nada vai para o banco. O extrato, as escolhas e as regras ficam neste navegador, por empresa.
import { extrator, lancatudo as lt, sci } from '@nads/core';
import { baixarBytes, useRetorno } from '@nads/ui';
import workerDoPdf from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ocrQueAvisa } from '../../../../comum/ocr';
import { useOperador } from '../../casca/operador';
import { useCadastro, useRepoLancatudo } from '../../dados/repo';
import type { VmShadersCi } from './useShadersCi';

extrator.definirWorkerDoPdf(workerDoPdf);
// o extrato escaneado (o PDF sem texto ou a foto) passa pelo OCR do navegador, como no Extratudo
extrator.definirOcr(ocrQueAvisa);

/** O extrato lido, com o que a pessoa decidiu nele. */
interface ExtratoGuardado {
  arquivo: string;
  importadoEm: string;
  lancamentos: extrator.Lancamento[];
  saldoAnterior?: number;
  conferenciaPeloSaldo?: extrator.ConferenciaPeloSaldo;
  ocr?: boolean;
  /** o banco pelo cabeçalho do extrato (o nome do lote quando não há conta bancária escolhida) */
  bancoNoTexto?: string;
  /** o id da conta bancária do Cadastro ('' = nenhuma escolhida) */
  banco: string;
  /** '' = o do extrato (banco + AAMM) */
  lote: string;
  decisoes: Record<string, sci.DecisaoNoExtratoSci>;
}

/** O que fica por empresa neste navegador. */
interface Guardado {
  /** as regras criadas aqui, nas contas do SCI (só no minimum) */
  regras: lt.RegraDoLancatudo[];
  /** o número do histórico padrão do SCI do que entrou e do que saiu */
  historicoPadrao: sci.HistoricosPadrao;
  /** a conta do banco no SCI digitada aqui, por conta bancária (vale mais que a do Cadastro pelo de/para) */
  contasDosBancos: Record<string, string>;
  extrato: ExtratoGuardado | null;
}
const SEM_HISTORICO: sci.HistoricosPadrao = { entrada: '', saida: '' };
const VAZIO: Guardado = { regras: [], historicoPadrao: SEM_HISTORICO, contasDosBancos: {}, extrato: null };
const PREFIXO = 'nads-minimum-extrato-sci-v1|';

function lerGuardado(codigo: number | null): Guardado {
  if (codigo == null) return VAZIO;
  try {
    const g = JSON.parse(localStorage.getItem(PREFIXO + codigo) || 'null') as Partial<Guardado> | null;
    if (!g) return VAZIO;
    return {
      regras: Array.isArray(g.regras) ? g.regras : [], historicoPadrao: { ...SEM_HISTORICO, ...(typeof g.historicoPadrao === 'object' ? g.historicoPadrao : {}) }, contasDosBancos: g.contasDosBancos || {},
      extrato: g.extrato && Array.isArray(g.extrato.lancamentos) ? { ...g.extrato, decisoes: g.extrato.decisoes || {} } : null,
    };
  } catch { return VAZIO; }
}
function gravarGuardado(codigo: number, g: Guardado) {
  try { localStorage.setItem(PREFIXO + codigo, JSON.stringify(g)); } catch { /* sem espaço: fica só na tela */ }
}

/** O filtro da grade: todas, só as em branco (sem contrapartida), só as com problema, só as prontas, só as fora. */
export type FiltroDoExtratoSci = 'todas' | 'branco' | 'problema' | 'prontas' | 'fora';

export interface ContaBancariaDoExtrato { id: string; nome: string; marca: string; rotulo: string; contaDoCadastro: string }

const ROTULO_ORIGEM: Record<sci.OrigemNoExtratoSci, string> = {
  pessoa: 'Escolhida na linha', minimum: 'Pela regra do minimum', regra: 'Pela regra do Lançatudo', aprendida: 'Aprendida do favorecido (Lançatudo)',
};

/** O extrato fictício do Dados de teste (modo desenvolvedor): o movimento do teste do Extrator, com o saldo anterior. */
function extratoDeExemplo(): ExtratoGuardado {
  const mes = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 7);
  const lido = extrator.arquivoDeTeste('banco', mes);
  return { arquivo: lido.nome, importadoEm: new Date().toISOString(), lancamentos: lido.lancamentos, saldoAnterior: 1534000, banco: '', lote: '', decisoes: {} };
}

export function useExtratoParaSci(min: VmShadersCi) {
  const { aviso, toast } = useRetorno();
  const { operador } = useOperador();
  const empresa = min.empresa;
  const codigo = empresa?.codigo ?? null;
  const nome = empresa?.nome || '';
  const cad = useCadastro(nome, codigo);
  const lancatudo = useRepoLancatudo().config(nome);

  const [guardado, setGuardado] = useState<Guardado>(() => lerGuardado(codigo));
  const [daEmpresa, setDaEmpresa] = useState(codigo);
  if (daEmpresa !== codigo) { setDaEmpresa(codigo); setGuardado(lerGuardado(codigo)); }
  const guardar = useCallback((muda: (g: Guardado) => Guardado) => {
    setGuardado(g => { const novo = muda(g); if (codigo != null) gravarGuardado(codigo, novo); return novo; });
  }, [codigo]);
  const mudarExtrato = (muda: (x: ExtratoGuardado) => ExtratoGuardado) => guardar(g => (g.extrato ? { ...g, extrato: muda(g.extrato) } : g));
  // a outra aba deste navegador mexeu na mesma empresa: relê
  useEffect(() => {
    const outra = (e: StorageEvent) => { if (codigo != null && e.key === PREFIXO + codigo) setGuardado(lerGuardado(codigo)); };
    window.addEventListener('storage', outra);
    return () => window.removeEventListener('storage', outra);
  }, [codigo]);

  const plano = useMemo(() => sci.planoDoSci(min.plano), [min.plano]);
  // o de/para automático: o plano do Cadastro (as contas do nads, as das regras do Lançatudo) casado com o plano do SCI
  const dePara = useMemo(() => (cad.plano?.contas.length ? sci.mapaDoDePara(sci.deParaPeloPlano(cad.plano.contas, plano)) : null), [cad.plano, plano]);

  // ---- a conta bancária: as do Cadastro; a do extrato pelo banco do texto dele
  const bancos = useMemo((): ContaBancariaDoExtrato[] => (cad.cadastro.bancos || []).map(b => ({
    id: b.id, nome: b.nome, marca: b.marca, contaDoCadastro: b.contaContabil || '',
    rotulo: [b.nome, b.apelido, b.conta && 'c/c ' + b.conta].filter(Boolean).join(' · '),
  })), [cad.cadastro.bancos]);
  const extrato = guardado.extrato;
  const banco = bancos.find(b => b.id === extrato?.banco) || null;
  // a conta do banco no SCI: a digitada aqui; senão a do Cadastro (ou a do Lançatudo) pelo de/para
  const contaDoNads = banco ? lt.contaDoBancoNaConfig(lancatudo.config, banco.id, banco.contaDoCadastro) : '';
  const contaPeloCadastro = contaDoNads ? sci.contaDoNadsNoSci(contaDoNads, dePara, plano) : '';
  // sem conta bancária (a empresa sem conta no Cadastro), a conta do banco no SCI fica guardada na chave ''
  const contaDigitada = guardado.contasDosBancos[banco?.id || ''] || '';
  const contaDoBanco = contaDigitada || contaPeloCadastro;
  const contaDoBancoNoPlano = contaDoBanco ? sci.contaDoPlano(plano, contaDoBanco) : null;

  // ---- as linhas da grade
  const linhas = useMemo(() => {
    if (!extrato) return [];
    const ls = sci.linhasDoExtratoSci({
      lancamentos: extrato.lancamentos, banco: extrato.banco, contaDoBanco, plano, historicoPadrao: guardado.historicoPadrao,
      regrasDoMinimum: guardado.regras, regrasDoLancatudo: lancatudo.config.regras, lembradas: lancatudo.config.lembradas, dePara, decisoes: extrato.decisoes,
    });
    return ls;
  }, [extrato, contaDoBanco, plano, guardado.historicoPadrao, guardado.regras, lancatudo.config, dePara]);
  const nomeDoBanco = banco?.nome || extrato?.bancoNoTexto || 'Banco';
  const mes = sci.mesPrincipal(linhas);
  const loteDoExtrato = sci.loteDoExtrato(nomeDoBanco, mes);
  const lote = (extrato?.lote || '').trim().toUpperCase() || loteDoExtrato;
  const lancamentos = useMemo(() => sci.lancamentosDoExtratoSci(linhas, { cnpjEmpresa: min.cnpj, lote, nomeDoBanco, plano }),
    [linhas, min.cnpj, lote, nomeDoBanco, plano]);
  // os problemas de cada linha (as ignoradas não vão para a planilha)
  const comProblemas = useMemo(() => {
    let i = 0;
    return linhas.map(l => ({
      ...l,
      problemas: l.ignorada ? [] : lancamentos[i++].problemas,
      nomeDoHistorico: sci.historicoDoSci(l.historico)?.nome || '',
      rotuloDaOrigem: l.origem ? ROTULO_ORIGEM[l.origem] + (l.regra ? ': ' + l.regra : '') : l.semPar ? 'A regra "' + l.regra + '" tem a conta ' + l.semPar + ', sem par no SCI' : 'Sem regra: escolha a conta',
    }));
  }, [linhas, lancamentos]);
  const resumo = sci.resumoDoExtratoSci(linhas);
  const prontos = lancamentos.filter(l => !l.problemas.length);
  const valorPronto = prontos.reduce((t, l) => t + l.valor, 0);
  const saldo = useMemo(() => (extrato ? sci.saldoDoExtrato(extrato) : null), [extrato]);

  // ---- filtro e busca
  const [filtro, setFiltro] = useState<FiltroDoExtratoSci>('todas');
  const [busca, setBusca] = useState('');
  const visiveis = useMemo(() => {
    const q = sci.semAcento(busca.trim());
    return comProblemas.filter(l => {
      const passa = filtro === 'todas' || (filtro === 'branco' ? !l.ignorada && !l.contrapartida
        : filtro === 'problema' ? l.problemas.length > 0 : filtro === 'prontas' ? !l.ignorada && !l.problemas.length : l.ignorada);
      if (!passa) return false;
      if (!q) return true;
      return [l.historicoDoBanco, l.complemento, l.contrapartida, l.nomeDaContrapartida, sci.valorParaTexto(Math.abs(l.valor)), sci.dataParaTexto(l.data)].some(v => sci.semAcento(v).includes(q));
    });
  }, [comProblemas, filtro, busca]);

  // ---- a paleta das contas (a contrapartida de uma linha ou a conta do banco) e a dos históricos
  const [paleta, setPaleta] = useState<{ tipo: 'linha'; chave: string } | { tipo: 'banco' } | { tipo: 'historico'; lado: keyof sci.HistoricosPadrao } | null>(null);
  const itensDasContas = useMemo(() => plano.contas.filter(c => c.analitica).map(c => ({ chave: c.codigo, codigo: c.codigo, nome: c.nome, dica: [c.apelido, c.classificacao].filter(Boolean).join(' · ') })), [plano]);
  const filtrarContas = useCallback((itens: readonly { chave: string; codigo: string; nome: string; dica?: string }[], q: string) => {
    const achadas = new Set(sci.buscarNoPlano(plano, q, 200).map(c => c.codigo));
    return itens.filter(i => achadas.has(i.chave));
  }, [plano]);
  const itensDosHistoricos = useMemo(() => sci.historicosDoSci().map(h => ({ chave: h.codigo, codigo: h.codigo, nome: h.nome, dica: h.apelido })), []);
  const filtrarHistoricos = useCallback((itens: readonly { chave: string; codigo: string; nome: string; dica?: string }[], q: string) => {
    const achados = new Set(sci.buscarHistoricos(q, 200).map(h => h.codigo));
    return itens.filter(i => achados.has(i.chave));
  }, []);

  const decidir = (chave: string, muda: (d: sci.DecisaoNoExtratoSci) => sci.DecisaoNoExtratoSci | null) => mudarExtrato(x => {
    const decisoes = { ...x.decisoes };
    const nova = muda(decisoes[chave] || {});
    if (nova && Object.keys(nova).length) decisoes[chave] = nova; else delete decisoes[chave];
    return { ...x, decisoes };
  });

  const [lendo, setLendo] = useState(false);
  /** lê o arquivo (PDF, OFX, planilha ou foto) com o leitor do Rotinas */
  async function importar(arquivo: File | undefined) {
    if (!arquivo || codigo == null) return;
    setLendo(true);
    try {
      const lido = await extrator.lerArquivo(arquivo.name, new Uint8Array(await arquivo.arrayBuffer()), 'banco');
      if (lido.erro || !lido.lancamentos.length) {
        aviso({ tom: 'info', titulo: 'Não deu para usar este arquivo', texto: lido.erro || 'Não achei lançamentos com data e valor.' });
        return;
      }
      // a conta bancária pelo banco do texto do extrato, quando só uma do Cadastro é desse banco
      const doBanco = lido.bancoNoTexto ? bancos.filter(b => b.marca === lido.bancoNoTexto) : [];
      const escolhido = doBanco.length === 1 ? doBanco[0].id : bancos.length === 1 ? bancos[0].id : '';
      guardar(g => ({
        ...g, extrato: {
          arquivo: arquivo.name, importadoEm: new Date().toISOString(), lancamentos: lido.lancamentos, banco: escolhido, lote: '', decisoes: {},
          ...(lido.saldoAnterior != null ? { saldoAnterior: lido.saldoAnterior } : {}),
          ...(lido.conferenciaPeloSaldo ? { conferenciaPeloSaldo: lido.conferenciaPeloSaldo } : {}),
          ...(lido.ocr ? { ocr: true } : {}),
          ...(lido.bancoNoTexto ? { bancoNoTexto: lido.bancoNoTexto } : {}),
        },
      }));
      setFiltro('todas'); setBusca('');
      toast((lido.lancamentos.length === 1 ? '1 linha lida de ' : lido.lancamentos.length + ' linhas lidas de ') + arquivo.name);
    } catch (e) {
      aviso({ tom: 'erro', titulo: 'Não consegui ler o arquivo', texto: (e as Error).message });
    } finally {
      setLendo(false);
    }
  }

  return {
    carregado: cad.carregada && lancatudo.carregada,
    empresa,
    plano: min.plano,
    cnpj: min.cnpj,
    cnpjOk: min.cnpjOk,
    dev: min.dev,
    voltar: () => min.abrirApp(min.dev ? null : 'lancamentos'),

    // ---- o extrato
    extrato: extrato ? { arquivo: extrato.arquivo, importadoEm: extrato.importadoEm, ocr: !!extrato.ocr } : null,
    lendo,
    importar,
    carregarExemplo: () => { guardar(g => ({ ...g, extrato: { ...extratoDeExemplo(), banco: bancos.length === 1 ? bancos[0].id : '' } })); setFiltro('todas'); },
    /** tira o extrato da tela (as regras e o histórico padrão ficam) */
    limpar: () => guardar(g => ({ ...g, extrato: null })),
    saldo,

    // ---- a conta bancária e a conta dela no SCI
    bancos,
    banco,
    escolherBanco: (id: string) => mudarExtrato(x => ({ ...x, banco: id })),
    contaDoBanco,
    nomeDaContaDoBanco: contaDoBancoNoPlano?.nome || '',
    contaDoBancoForaDoPlano: !!contaDoBanco && !contaDoBancoNoPlano,
    /** de onde veio a conta do banco: digitada aqui, do Cadastro pelo de/para, ou o código do Cadastro sem par no SCI */
    origemDaContaDoBanco: contaDigitada ? 'aqui' as const : contaPeloCadastro ? 'cadastro' as const : contaDoNads ? 'semPar' as const : null,
    contaDoNads,
    definirContaDoBanco: (c: string) => guardar(g => ({ ...g, contasDosBancos: { ...g.contasDosBancos, [banco?.id || '']: sci.contaDoPlano(plano, c)?.codigo || c.trim() } })),
    voltarContaDoCadastro: () => guardar(g => { const c = { ...g.contasDosBancos }; delete c[banco?.id || '']; return { ...g, contasDosBancos: c }; }),

    // ---- o histórico padrão e o lote
    historicoPadrao: guardado.historicoPadrao,
    nomeDoHistorico: (h: string) => sci.historicoDoSci(h)?.nome || '',
    definirHistoricoPadrao: (lado: keyof sci.HistoricosPadrao, h: string) => guardar(g => ({ ...g, historicoPadrao: { ...g.historicoPadrao, [lado]: sci.historicoDoSci(h)?.codigo || h.trim() } })),
    lote,
    loteDoExtrato,
    definirLote: (l: string) => mudarExtrato(x => ({ ...x, lote: l.toUpperCase().replace(/\s/g, '').slice(0, sci.TAMANHO_DO_LOTE) })),

    // ---- a grade
    linhas: comProblemas,
    visiveis,
    resumo,
    prontos: prontos.length,
    comProblema: lancamentos.length - prontos.length,
    valorPronto,
    filtro, setFiltro,
    busca, setBusca,
    escolherConta: (chave: string, conta: string) => decidir(chave, d => ({ ...d, conta: sci.contaDoPlano(plano, conta)?.codigo || conta.trim() })),
    tirarConta: (chave: string) => decidir(chave, d => ({ ...d, conta: '' })),
    voltarAoAutomatico: (chave: string) => decidir(chave, ({ conta: _c, ...d }) => d),
    ignorar: (chave: string, sim: boolean) => decidir(chave, ({ ignorar: _i, ...d }) => (sim ? { ...d, ignorar: true } : d)),

    // ---- as regras do minimum
    regras: guardado.regras.map(r => ({ ...r, nomeDaConta: sci.contaDoPlano(plano, r.conta)?.nome || '' })),
    regrasDoLancatudo: lancatudo.config.regras.length,
    /** a regra a partir da linha, com a conta dela: vale para as próximas linhas iguais (e para os próximos extratos) */
    criarRegra: (chave: string) => {
      const l = linhas.find(x => x.chave === chave);
      if (!l?.contrapartida) return;
      const padrao = l.valor > 0 ? guardado.historicoPadrao.entrada : guardado.historicoPadrao.saida;
      const r = sci.regraDoMinimumDaLinha(l, l.contrapartida, operador?.nome || '', new Date(), l.historico !== padrao ? l.historico : '');
      const nova = { ...r, descricao: r.expressao };
      // a mesma expressão no mesmo sentido: troca a antiga
      guardar(g => ({ ...g, regras: [...g.regras.filter(x => !(x.expressao === nova.expressao && x.sentido === nova.sentido)), nova] }));
      // a escolha da linha vira a regra: a linha volta ao automático
      decidir(chave, ({ conta: _c, ...d }) => d);
      const iguais = linhas.filter(x => x.chave !== chave && lt.expressaoCasa(nova, x.historicoDoBanco) && (x.valor > 0) === (l.valor > 0)).length;
      toast('Regra criada: "' + nova.expressao + '" → ' + nova.conta + (iguais ? ' (vale para mais ' + (iguais === 1 ? '1 linha' : iguais + ' linhas') + ')' : ''));
    },
    excluirRegra: (id: string) => guardar(g => ({ ...g, regras: g.regras.filter(r => r.id !== id) })),

    // ---- as paletas
    paleta, abrirPaleta: setPaleta, fecharPaleta: () => setPaleta(null),
    itensDasContas, filtrarContas, itensDosHistoricos, filtrarHistoricos,

    // ---- a planilha
    podeBaixar: prontos.length > 0,
    baixar: () => {
      // um lote próprio por planilha, com a empresa no código (27/11/2026: "vamos usar esse controle de lotes")
      const loteDaPlanilha = empresa?.codigo != null ? sci.loteDoMinimum(empresa.codigo) : '';
      const bytes = sci.planilhaDoSci(lancamentos, loteDaPlanilha);
      baixarBytes(bytes, sci.nomeDaPlanilhaSci(min.cnpj, mes, 'extrato ' + nomeDoBanco, loteDaPlanilha), sci.TIPO_XLSX_SCI);
      const fora = lancamentos.length - prontos.length;
      aviso({
        tom: fora ? 'info' : 'ok', titulo: (prontos.length === 1 ? '1 lançamento' : prontos.length + ' lançamentos') + ' na aba Importar',
        texto: (loteDaPlanilha ? 'Lote ' + loteDaPlanilha + '. ' : '') + (fora ? (fora === 1 ? '1 linha foi' : fora + ' linhas foram') + ' para a aba Conferir, com o motivo: não entram no SCI.' : 'Pronta para importar no SCI.'),
      });
    },
  };
}

export type VmExtratoParaSci = ReturnType<typeof useExtratoParaSci>;
