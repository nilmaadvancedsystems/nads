// ViewModel do ShadersCI (23/11/2026: "Quero fazer uma aba de lançamento mais clean, a do meu sistema SCI é horrivel"): a empresa
// (a busca da barra, a mesma do Lançatudo), o plano padrão do SCI (90113 ou 90011), o CNPJ que vai na planilha, o formulário do
// lançamento (novo ou editando), a tabela com a seleção, o copiar e colar (botão direito, Ctrl+C e Ctrl+V), o desfazer e a
// planilha do gerador do SCI. Tudo fica só neste navegador, por empresa (o dono: "Só no navegador"): nada vai para o banco.
import { sci } from '@nads/core';
import { baixarBytes, useCarregando, useRetorno } from '@nads/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useModoDesenvolvedor } from '../../../../comum/modoDesenvolvedor';
import { useDadosDaEmpresaNoEntregas, useTodosOsCadastros } from '../../dados/repo';
import { useEmpresasDaPessoa } from '../empresas/andamento';
import { useLancatudo } from '../lancatudo/useLancatudo';

type Lancamento = sci.LancamentoDoShader;

/**
 * Os apps do minimum, depois de escolher a empresa: os Lançamentos do SCI, o Extratudo (o Lançatudo, o extrato que vira lançamento),
 * o Visualizar lançamentos (o razão do SCI) e o Extrato → SCI (25/11/2026: o PDF do extrato direto na planilha do SCI, só no navegador).
 */
export type AppDoMinimum = 'lancamentos' | 'extratudo' | 'razao' | 'extrato' | 'baixa';
const appDoEndereco = (m: string | null): AppDoMinimum | null => (m === 'lancamentos' || m === 'extratudo' || m === 'razao' || m === 'extrato' || m === 'baixa' ? m : null);

/** As colunas da tabela que ordenam e filtram (o clique no cabeçalho). */
export type ColunaDosLancamentos = 'data' | 'debito' | 'credito' | 'valor' | 'historico' | 'documento' | 'participanteD' | 'participanteC';
interface LinhaParaColuna { data: string; debito: string; credito: string; nomeD: string; nomeC: string; valor: number; historico: string; nomeH: string; complemento: string; documento: string; participanteD: string; participanteC: string }
/** o texto da coluna, o que o filtro procura (o código e o nome) */
function textoDaColuna(l: LinhaParaColuna, c: ColunaDosLancamentos): string {
  switch (c) {
    case 'data': return sci.dataParaTexto(l.data);
    case 'debito': return l.debito + ' ' + l.nomeD;
    case 'credito': return l.credito + ' ' + l.nomeC;
    case 'valor': return sci.valorParaTexto(l.valor);
    case 'historico': return l.historico + ' ' + l.nomeH + ' ' + l.complemento;
    default: return l[c];
  }
}
/** o que ordena o lançamento (o múltiplo pelo total dos débitos e pela primeira conta de cada lado) */
function chaveDaColuna(g: readonly LinhaParaColuna[], c: ColunaDosLancamentos): string | number {
  const multiplo = g.length > 1;
  if (c === 'valor') return multiplo ? g.filter(l => l.debito).reduce((t, l) => t + l.valor, 0) : g[0].valor;
  if (c === 'data') return g[0].data;
  if (c === 'debito') { const l = g.find(x => x.debito) || g[0]; return l.nomeD || l.debito; }
  if (c === 'credito') { const l = g.find(x => x.credito) || g[0]; return l.nomeC || l.credito; }
  if (c === 'historico') return [g[0].nomeH, g[0].complemento].filter(Boolean).join(' ') || g[0].historico;
  return g.find(l => l[c])?.[c] || '';
}


/**
 * O Salvar do Novo lançamento (24/11/2026: "as vezes ela nao quer lancar e so salva, mas nao e pra colocar na tabela, e pra deixar
 * prenchido quando ela coloca novo lancamento"): o formulário como estava, simples ou múltiplo; não entra na lista.
 */
interface Rascunho { form: Formulario; multiplo: MultiploDoFormulario | null }

/** O que fica guardado por empresa neste navegador. */
interface Guardado { plano: sci.IdDoPlanoSci; cnpj: string; lancamentos: Lancamento[]; rascunho?: Rascunho | null }
const VAZIO: Guardado = { plano: '90113', cnpj: '', lancamentos: [] };
const PREFIXO = 'nads-shadersci-v1|';

function lerGuardado(chave: string | null): Guardado {
  if (!chave) return VAZIO;
  try {
    const g = JSON.parse(localStorage.getItem(PREFIXO + chave) || 'null') as Partial<Guardado> | null;
    return g ? { ...VAZIO, ...g, lancamentos: Array.isArray(g.lancamentos) ? g.lancamentos : [] } : VAZIO;
  } catch { return VAZIO; }
}
function gravarGuardado(chave: string, g: Guardado) {
  try { localStorage.setItem(PREFIXO + chave, JSON.stringify(g)); } catch { /* sem espaço: fica só na tela */ }
}

// a última empresa aberta no minimum, neste navegador
const CHAVE_ULTIMA_EMPRESA = 'nads-minimum-ultima-empresa';
const lembrarEmpresa = (codigo: string) => { try { localStorage.setItem(CHAVE_ULTIMA_EMPRESA, codigo); } catch { /* sem espaço */ } };
const empresaLembrada = () => { try { return localStorage.getItem(CHAVE_ULTIMA_EMPRESA); } catch { return null; } };
const esquecerEmpresa = () => { try { localStorage.removeItem(CHAVE_ULTIMA_EMPRESA); } catch { /* sem armazenamento */ } };

// as empresas marcadas no SCI pelo ⚡ Dados de teste: só neste navegador, só no modo desenvolvedor
const CHAVE_TESTE_SCI = 'nads-minimum-sci-teste';
function lerTesteSci(): number[] {
  try { const v = JSON.parse(localStorage.getItem(CHAVE_TESTE_SCI) || '[]'); return Array.isArray(v) ? v.filter((n): n is number => typeof n === 'number') : []; } catch { return []; }
}
function gravarTesteSci(codigos: number[]) {
  try { if (codigos.length) localStorage.setItem(CHAVE_TESTE_SCI, JSON.stringify(codigos)); else localStorage.removeItem(CHAVE_TESTE_SCI); } catch { /* sem espaço */ }
}

const DIAS_DA_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

let contador = 0;
const idNovo = () => Date.now().toString(36) + (contador++).toString(36) + Math.random().toString(36).slice(2, 6);

/** O formulário em texto, como se digita. */
export interface Formulario { data: string; debito: string; credito: string; valor: string; historico: string; complemento: string; documento: string; participanteD: string; participanteC: string }
const FORMULARIO_VAZIO: Formulario = { data: '', debito: '', credito: '', valor: '', historico: '', complemento: '', documento: '', participanteD: '', participanteC: '' };

/**
 * A partida do lançamento múltiplo, em texto como se digita (24/11/2026: "uma funcao chamada lançamento multiplo, onde debito e
 * credito tem que bater com partidas simples"): o lado, a conta, o participante (só quando a conta pede naquele lado), o valor, o
 * histórico e o complemento. A data e o documento são do múltiplo inteiro.
 */
export interface PartidaDoFormulario { chave: string; lado: sci.LadoDoLancamento; conta: string; participante: string; valor: string; historico: string; complemento: string }
export interface MultiploDoFormulario { id: string; editando: boolean; data: string; documento: string; partidas: PartidaDoFormulario[] }
type CampoDaPartida = Exclude<keyof PartidaDoFormulario, 'chave'>;
const partidaVazia = (lado: sci.LadoDoLancamento, valor = ''): PartidaDoFormulario => ({ chave: idNovo(), lado, conta: '', participante: '', valor, historico: '', complemento: '' });
/** põe a partida no bloco do lado dela: o débito logo depois do último débito, o crédito no fim (os débitos em cima) */
function noBlocoDoLado(ps: PartidaDoFormulario[], pt: PartidaDoFormulario): PartidaDoFormulario[] {
  if (pt.lado === 'credito') return [...ps, pt];
  let i = -1;
  ps.forEach((x, k) => { if (x.lado === 'debito') i = k; });
  return [...ps.slice(0, i + 1), pt, ...ps.slice(i + 1)];
}

const doLancamento = (l: sci.CamposDoLancamento): Formulario => ({
  data: sci.dataParaTexto(l.data), debito: l.debito, credito: l.credito, valor: l.valor ? sci.valorParaTexto(l.valor) : '', historico: l.historico,
  complemento: l.complemento, documento: l.documento, participanteD: l.participanteD, participanteC: l.participanteC,
});

export function useShadersCi() {
  const { toast, aviso, modal } = useRetorno();
  const [dev] = useModoDesenvolvedor();
  // só as empresas que estão no SCI (24/11/2026: "Apenas empresas que estão na sci"): o "Está no SCI" do Cadastro e, no
  // modo desenvolvedor, as marcadas pelo ⚡ Dados de teste
  // e, delas, só as de que a pessoa é a responsável do Contábil no Cadastro, para todo mundo, o diretor também (25/11/2026: "minimum
  // tbm segue a regra de empresas liberadas para cada usuario que tenha a opcao sci marcada"; "no minimum ta aparecendo todas as
  // empresas que eu nao sou responsavel, o minimum e apenas cada um responsavel com sua empresa por enquanto")
  const cadastros = useTodosOsCadastros();
  const daPessoa = useEmpresasDaPessoa();
  const carregada = cadastros.carregada && daPessoa.carregada;
  useCarregando(!carregada);
  const [testeSci, setTesteSci] = useState<number[]>(lerTesteSci);
  // a lista pelos códigos (o minha() é novo a cada render): o conjunto só muda quando as empresas mudam
  const codigosDoSci: number[] = [];
  if (carregada) for (const c of cadastros.porId.values()) if (c.noSci && c.codigo != null && daPessoa.minha({ nome: c.nome, codigo: c.codigo }, 'contabil')) codigosDoSci.push(c.codigo);
  if (dev) for (const c of testeSci) codigosDoSci.push(c);
  const chaveDoSci = codigosDoSci.sort((a, b) => a - b).join(',');
  const doSci = useMemo(() => new Set(chaveDoSci ? chaveDoSci.split(',').map(Number) : []), [chaveDoSci]);
  const entrada = useLancatudo(doSci);
  const chave = entrada.empresa ? String(entrada.empresa.codigo) : null;
  // a empresa fica lembrada neste navegador (25/11/2026: "pessoa logou no minimum, deixa a empresa dele logada, para nao precisar
  // selecionar toda vez"): abrir o minimum sem empresa no endereço entra na última, se ela ainda está no SCI; o Trocar a esquece
  useEffect(() => { if (chave) lembrarEmpresa(chave); }, [chave]);
  const semEmpresaNoEndereco = !entrada.doEndereco('e');
  const { mudarNoEndereco } = entrada;
  useEffect(() => {
    if (!carregada || !semEmpresaNoEndereco) return;
    const ultima = Number(empresaLembrada());
    if (ultima && doSci.has(ultima)) mudarNoEndereco({ e: String(ultima) }, true);
  }, [carregada, semEmpresaNoEndereco, doSci, mudarNoEndereco]);
  const [guardado, setGuardado] = useState<Guardado>(() => lerGuardado(chave));
  const [daChave, setDaChave] = useState(chave);
  // trocou de empresa: o que é dela
  if (daChave !== chave) { setDaChave(chave); setGuardado(lerGuardado(chave)); }
  const [anterior, setAnterior] = useState<Lancamento[] | null>(null);
  const [form, setForm] = useState<Formulario>(FORMULARIO_VAZIO);
  const [editando, setEditando] = useState<string | null>(null);
  // o formulário numa janela (24/11/2026: "um botão do lado de planilha do sci, chamado novo lançamento, vai abrir uma popup")
  const [janela, setJanela] = useState(false);
  const [marcados, setMarcados] = useState<ReadonlySet<string>>(new Set());
  const [busca, setBusca] = useState('');
  const [ordem, setOrdem] = useState<{ coluna: ColunaDosLancamentos; desc: boolean } | null>(null);
  const [filtrosDasColunas, setFiltrosDasColunas] = useState<Partial<Record<ColunaDosLancamentos, string>>>({});
  // o mês da Data (25/11/2026: "No filtro da data, coloca a opcao de filtrar por meses") e a faixa do Valor, em centavos (25/11/2026:
  // "No valor, filtros de valores, acima e abaixo de")
  const [mesDaData, setMesDaData] = useState<string | null>(null);
  const [faixaDoValor, setFaixaDoValor] = useState<{ acima: string; abaixo: string }>({ acima: '', abaixo: '' });
  // a lupa (F2): a conta de um dos lados ou o histórico
  const [pesquisa, setPesquisa] = useState<'debito' | 'credito' | 'historico' | null>(null);
  // a lupa de uma partida do múltiplo (a chave dela); null = a do lançamento simples
  const [pesquisaDaPartida, setPesquisaDaPartida] = useState<string | null>(null);
  // a janela do lançamento múltiplo
  const [multiplo, setMultiplo] = useState<MultiploDoFormulario | null>(null);

  // o plano do Cadastro (24/11/2026: "referenciar para nao ficar selecionando"): com ele, a empresa já abre nele e não se
  // escolhe; sem, vale o escolhido aqui
  const planoDoCadastro = useMemo(() => {
    if (!entrada.empresa) return null;
    for (const c of cadastros.porId.values()) if (c.codigo === entrada.empresa.codigo && c.noSci) return c.planoSci ?? null;
    return null;
  }, [cadastros.porId, entrada.empresa]);
  const idDoPlano: sci.IdDoPlanoSci = planoDoCadastro ?? guardado.plano;
  const plano = sci.planoDoSci(idDoPlano);
  // o mesmo plano no Extratudo (no formato do plano do Cadastro): as contas do extrato são as dos Lançamentos
  const planoDoExtratudo = useMemo(() => sci.planoDoSci(idDoPlano).contas.map((c, ordem) => ({ codigo: c.codigo, nome: c.nome, classificacao: c.classificacao, sintetica: !c.analitica, ordem })), [idDoPlano]);
  // o CNPJ da planilha (24/11/2026: o campo do topo saiu, "remove isso"): o do Cadastro da empresa; sem ele, o do Entregas; sem
  // nenhum, o digitado antes aqui (ou o dos dados de teste)
  const cnpjDoEntregas = useDadosDaEmpresaNoEntregas(entrada.empresa?.codigo ?? null).dados?.documento || '';
  const cnpjDoCadastro = useMemo(() => {
    if (!entrada.empresa) return '';
    for (const c of cadastros.porId.values()) if (c.codigo === entrada.empresa.codigo) return c.cnpj || '';
    return '';
  }, [cadastros.porId, entrada.empresa]);
  const cnpj = cnpjDoCadastro || cnpjDoEntregas || guardado.cnpj;
  const ano = new Date().getFullYear();

  // o app aberto (?m=): os Lançamentos, o Extratudo ou nenhum (a tela dos apps); sem empresa, nenhum
  // na versão final, só os Lançamentos (e o Visualizar lançamentos, que abre dele); o Extratudo só no modo desenvolvedor
  // (25/11/2026: "pode publicar o minimum para a versao final do usuario, liberando apenas a aba lancamentos, irei trabalhar no extratudo")
  // o Extrato → SCI também só no modo desenvolvedor até o teste da importação no SCI (25/11/2026)
  const apps: readonly AppDoMinimum[] = dev ? ['lancamentos', 'extratudo', 'extrato', 'baixa', 'razao'] : ['lancamentos', 'razao'];
  const pedido = entrada.empresa ? appDoEndereco(entrada.doEndereco('m')) : null;
  // fora do modo desenvolvedor só há os Lançamentos: a empresa escolhida já abre neles, sem a tela dos apps (25/11/2026: "O minumum
  // pode abrir na aba de lancamento direto, apos selecionar a empresa na versao final")
  const app = pedido && apps.includes(pedido) ? pedido : entrada.empresa && !dev ? 'lancamentos' : null;

  const guardar = useCallback((muda: (g: Guardado) => Guardado) => {
    setGuardado(g => { const novo = muda(g); if (chave) gravarGuardado(chave, novo); return novo; });
  }, [chave]);
  /** muda a lista guardando a de antes (o Desfazer) */
  const mudarLista = (muda: (ls: Lancamento[]) => Lancamento[]) => {
    setAnterior(guardado.lancamentos);
    guardar(g => ({ ...g, lancamentos: muda(g.lancamentos) }));
  };

  // a outra aba deste navegador mexeu na mesma empresa: relê
  useEffect(() => {
    const outra = (e: StorageEvent) => { if (chave && e.key === PREFIXO + chave) setGuardado(lerGuardado(chave)); };
    window.addEventListener('storage', outra);
    return () => window.removeEventListener('storage', outra);
  }, [chave]);

  const linhas = useMemo(() => {
    const problemas = sci.problemasDosLancamentos(guardado.lancamentos, plano);
    return guardado.lancamentos.map((l, i) => ({
      ...l,
      nomeD: sci.contaDoPlano(plano, l.debito)?.nome || '',
      nomeC: sci.contaDoPlano(plano, l.credito)?.nome || '',
      nomeH: sci.historicoDoSci(l.historico)?.nome || '',
      problemas: problemas[i],
    }));
  }, [guardado.lancamentos, plano]);
  // o filtro geral do topo saiu (25/11/2026: "Remove esse filtro"): os filtros ficam nas colunas
  const q = sci.semAcento(busca.trim());
  const filtradas = linhas.filter(l => (!q || [sci.dataParaTexto(l.data), l.debito, l.credito, l.nomeD, l.nomeC, sci.valorParaTexto(l.valor), l.historico, l.nomeH, l.complemento, l.documento, l.participanteD, l.participanteC]
    .some(v => sci.semAcento(v).includes(q))));
  // ordenar e filtrar pela coluna (25/11/2026: "Coloca funcoes de ordenar e filtros quando voce clica na coluna"): o múltiplo anda
  // inteiro, e passa no filtro da coluna quando alguma partida passa; a ordem vale por lançamento, e o empate fica na ordem de antes
  const visiveis = useMemo(() => {
    const grupos = new Map<string, typeof filtradas>();
    for (const l of filtradas) { const k = l.multiplo || l.id; const g = grupos.get(k); if (g) g.push(l); else grupos.set(k, [l]); }
    const filtros = (Object.entries(filtrosDasColunas) as [ColunaDosLancamentos, string][]).map(([c, v]) => [c, sci.semAcento(v.trim())] as const).filter(([, v]) => v);
    const centavos = (t: string) => { const n = sci.valorDoTexto(t); return Number.isFinite(n) ? n : null; };
    const acima = centavos(faixaDoValor.acima);
    const abaixo = centavos(faixaDoValor.abaixo);
    let lista = [...grupos.values()].filter(g => filtros.every(([c, v]) => g.some(l => sci.semAcento(textoDaColuna(l, c)).includes(v)))
      && (!mesDaData || g.some(l => l.data.startsWith(mesDaData)))
      && (acima == null || (chaveDaColuna(g, 'valor') as number) >= acima) && (abaixo == null || (chaveDaColuna(g, 'valor') as number) <= abaixo));
    if (ordem) {
      const chave = (g: typeof filtradas) => chaveDaColuna(g, ordem.coluna);
      lista = lista.map((g, i) => ({ g, i, k: chave(g) })).sort((a, b) => {
        const d = typeof a.k === 'number' && typeof b.k === 'number' ? a.k - b.k : String(a.k).localeCompare(String(b.k), 'pt-BR', { numeric: true, sensitivity: 'base' });
        return (ordem.desc ? -d : d) || a.i - b.i;
      }).map(x => x.g);
    }
    return lista.flat();
  }, [filtradas, filtrosDasColunas, ordem, mesDaData, faixaDoValor]);
  // os meses que têm lançamento, do mais novo ao mais antigo
  const mesesDasDatas = useMemo(() => [...new Set(linhas.map(l => l.data.slice(0, 7)).filter(m => /^\d{4}-\d{2}$/.test(m)))].sort().reverse(), [linhas]);
  const resumo = sci.resumoDosLancamentos(guardado.lancamentos, plano);
  const cnpjOk = (() => { const d = cnpj.replace(/\D/g, ''); return d.length === 14 || d.length === 11; })();

  // o formulário lido: o lançamento e o que falta nele. O participante só vale onde a conta pede (24/11/2026: "Voce disponibiliza
  // os inputs de acordo com o que a pessoa selecionar"): o que ficou escondido não vai
  const contaD = sci.contaDoPlano(plano, form.debito);
  const contaC = sci.contaDoPlano(plano, form.credito);
  const pedeD = sci.participanteDoLado(contaD, 'debito');
  const pedeC = sci.participanteDoLado(contaC, 'credito');
  const historico = sci.historicoDoSci(form.historico);
  const valorLido = sci.valorDoTexto(form.valor);
  const lido = sci.lancamentoLimpo({
    data: sci.dataDoTexto(form.data, ano), debito: form.debito, credito: form.credito, valor: isNaN(valorLido) ? 0 : Math.abs(valorLido), historico: form.historico,
    complemento: form.complemento, documento: form.documento, participanteD: pedeD ? form.participanteD : '', participanteC: pedeC ? form.participanteC : '',
  }, plano);
  const conta = (c: sci.ContaDoPlanoSci | null, lado: sci.LadoDoLancamento) => c
    ? { codigo: c.codigo, nome: c.nome, analitica: c.analitica, foraDoLado: sci.contaForaDoLado(c, lado), participante: sci.participanteDoLado(c, lado) }
    : null;
  const vazio = Object.values(form).every(v => !v.trim());
  const problemasDoFormulario = vazio ? [] : sci.problemasDoLancamento(lido, plano);
  /** fecha a janela: o que não foi lançado nem salvo some */
  const fechar = () => { setJanela(false); setForm(FORMULARIO_VAZIO); setEditando(null); setMultiplo(null); setPesquisa(null); setPesquisaDaPartida(null); };

  // o múltiplo lido: as partidas como vão para a lista, os problemas de cada uma e os totais
  const partidasLidas: sci.LancamentoDoShader[] = multiplo ? multiplo.partidas.map(pt => {
    const valor = sci.valorDoTexto(pt.valor);
    const conta = sci.contaDoPlano(plano, pt.conta);
    const pede = sci.participanteDoLado(conta, pt.lado);
    return {
      ...sci.lancamentoLimpo({
        ...sci.LANCAMENTO_VAZIO, data: sci.dataDoTexto(multiplo.data, ano), documento: multiplo.documento,
        debito: pt.lado === 'debito' ? pt.conta : '', credito: pt.lado === 'credito' ? pt.conta : '',
        participanteD: pt.lado === 'debito' && pede ? pt.participante : '', participanteC: pt.lado === 'credito' && pede ? pt.participante : '',
        valor: isNaN(valor) ? 0 : Math.abs(valor), historico: pt.historico, complemento: pt.complemento,
      }, plano),
      id: pt.chave, multiplo: multiplo.id,
    };
  }) : [];
  const problemasDasPartidas = multiplo ? partidasLidas.map(l => sci.problemasDaPartida(l, plano)) : [];
  const problemasDoMultiplo = multiplo ? sci.problemasDoMultiplo(partidasLidas) : [];
  const totaisDoMultiplo = sci.totaisDoMultiplo(partidasLidas);
  const mudarMultiplo = (muda: (m: MultiploDoFormulario) => MultiploDoFormulario) => setMultiplo(m => (m ? muda(m) : m));
  /** abre o múltiplo de uma linha da lista (para editar) */
  const abrirMultiplo = (id: string) => {
    const ls = guardado.lancamentos.filter(l => l.multiplo === id);
    if (!ls.length) return;
    setMultiplo({
      id, editando: true, data: sci.dataParaTexto(ls[0].data), documento: ls[0].documento,
      partidas: ls.map(l => {
        const lado: sci.LadoDoLancamento = sci.ladoDaPartida(l) || 'debito';
        return {
          chave: l.id, lado, conta: lado === 'debito' ? l.debito : l.credito, participante: lado === 'debito' ? l.participanteD : l.participanteC,
          valor: l.valor ? sci.valorParaTexto(l.valor) : '', historico: l.historico, complemento: l.complemento,
        };
      }),
    });
  };

  const ids = (alvo?: readonly string[]) => (alvo && alvo.length ? alvo : [...marcados]);
  const doAlvo = (alvo?: readonly string[]) => { const s = new Set(ids(alvo)); return guardado.lancamentos.filter(l => s.has(l.id)); };

  async function copiar(alvo?: readonly string[]) {
    const ls = doAlvo(alvo);
    if (!ls.length) return;
    try { await navigator.clipboard.writeText(sci.textoDosLancamentos(ls)); toast(ls.length === 1 ? 'Lançamento copiado.' : ls.length + ' lançamentos copiados.'); }
    catch { aviso({ tom: 'erro', titulo: 'Não consegui copiar', texto: 'O navegador não deixou usar a área de transferência. Tente o Ctrl+C.' }); }
  }
  function colarTexto(texto: string, depoisDe?: string) {
    const lidos = sci.lancamentosDoTexto(texto, ano).map(l => ({ ...sci.lancamentoLimpo(l, plano), id: idNovo() }));
    if (!lidos.length) { toast('Nada para colar: copie linhas da tabela ou do Excel (Data, Débito, Crédito, Valor, Histórico...).'); return; }
    // só entra o que está na norma do SCI (25/11/2026: "Nao existe lancamentos com problema, todos tem que estar dentro da norma"):
    // a linha fora fica de fora (o múltiplo, inteiro) e o aviso diz o porquê
    const problemas = sci.problemasDosLancamentos(lidos, plano);
    const multiplosFora = new Set(lidos.filter((l, i) => l.multiplo && problemas[i].length).map(l => l.multiplo as string));
    const novos = lidos.filter((l, i) => !problemas[i].length && !(l.multiplo && multiplosFora.has(l.multiplo)));
    const fora = lidos.length - novos.length;
    if (fora) {
      const motivo = problemas.find(p => p.length)?.[0] || 'fora da norma do SCI';
      aviso({ tom: 'info', titulo: fora === 1 ? '1 linha ficou de fora' : fora + ' linhas ficaram de fora', texto: 'Só entra lançamento dentro da norma do SCI. Por exemplo: ' + motivo + '.' });
    }
    if (!novos.length) return;
    mudarLista(ls => {
      const i = depoisDe ? ls.findIndex(l => l.id === depoisDe) : -1;
      return i < 0 ? [...ls, ...novos] : [...ls.slice(0, i + 1), ...novos, ...ls.slice(i + 1)];
    });
    setMarcados(new Set(novos.map(l => l.id)));
    toast(novos.length === 1 ? '1 lançamento colado.' : novos.length + ' lançamentos colados.');
  }

  return {
    entrada,
    empresa: entrada.empresa,
    /**
     * As setas ao lado do nome (24/11/2026: "deixe o aviso, que ao trocar de empresa, os lancamentos serao perdidos"; o dono
     * escolheu que trocar apaga): com lançamentos, pergunta antes; confirmado, apaga os desta empresa (e o salvo) e volta à escolha.
     * Só no app Lançamentos (25/11/2026: "A popup de trocar e apagar e somente no app lancamentos, somente la, o extratudo vai ser
     * diferente"): na tela dos apps e no Extratudo, troca direto e os lançamentos da empresa ficam guardados.
     */
    async trocarEmpresa() {
      const n = app === 'lancamentos' ? guardado.lancamentos.length : 0;
      if (n) {
        const sim = await modal<boolean>({
          icone: 'alert', titulo: 'Trocar de empresa?',
          texto: (n === 1 ? 'O lançamento desta empresa será perdido.' : 'Os ' + n + ' lançamentos desta empresa serão perdidos.') + ' Baixe a Planilha do SCI antes, se precisar deles.',
          botoes: [{ rotulo: 'Trocar e apagar', valor: true, variante: 'btn-danger' }, { rotulo: 'Cancelar', valor: false }],
        });
        if (!sim) return;
        guardar(g => ({ ...g, lancamentos: [], rascunho: null }));
        setAnterior(null);
        setMarcados(new Set());
      }
      // sai também do app aberto: a próxima empresa abre na tela dos apps; e esquece a lembrada, para não voltar sozinha
      esquecerEmpresa();
      entrada.mudarNoEndereco({ e: null, b: null, m: null });
    },
    /**
     * Os apps da empresa (25/11/2026: "vai ter os apps, lancamentos e extratudo (Atual lancatudo). Entrando nesses apps, ja vai
     * estar logado com a empresa"): o aberto vai no endereço (?m=), para o Voltar do navegador e o link levarem direto; sem
     * empresa, nenhum
     */
    app,
    abrirApp: (m: AppDoMinimum | null) => entrada.mudarNoEndereco({ m }),
    /** o Extratudo ligado aos Lançamentos (25/11/2026: "tudo que puder deixar integrado entre o tarefas e o minimum") */
    extratudo: {
      plano: planoDoExtratudo,
      /**
       * as linhas conciliadas do extrato entram nos Lançamentos (com o Desfazer), só as dentro da norma do SCI (25/11/2026): as
       * outras ficam no Extratudo, com o motivo da primeira
       */
      enviar: (banco: string, linhas: readonly sci.LinhaDoExtratoConciliada[]) => {
        const novas = sci.lancamentosDoExtrato(banco, linhas, guardado.lancamentos);
        const problemas = sci.problemasDosLancamentos(novas, plano);
        const boas = novas.filter((_, i) => !problemas[i].length);
        if (boas.length) mudarLista(ls => [...ls, ...boas.filter(b => !ls.some(l => l.id === b.id))]);
        return { enviadas: boas.length, fora: novas.length - boas.length, motivo: problemas.find(p => p.length)?.[0] || '' };
      },
    },
    dev,
    /** os apps que a pessoa abre: o Extratudo só no modo desenvolvedor */
    apps,
    // o plano e o CNPJ da empresa (o que vai na coluna CNPJ da planilha)
    planos: sci.planosDoSci(),
    plano: idDoPlano,
    /** o plano veio do Cadastro: não se escolhe aqui */
    planoDoCadastro: planoDoCadastro !== null,
    setPlano: (p: sci.IdDoPlanoSci) => guardar(g => ({ ...g, plano: p })),
    cnpj,
    cnpjOk,
    // o formulário, na janela do lançamento
    form, editando, janela,
    /** o botão Novo lançamento: a janela com o que foi salvo (o Salvar); sem nada salvo, limpa */
    novoLancamento: () => {
      const r = guardado.rascunho;
      setForm(r?.form ? { ...FORMULARIO_VAZIO, ...r.form } : FORMULARIO_VAZIO); setEditando(null);
      setMultiplo(r?.multiplo ? { ...r.multiplo, editando: false } : null); setJanela(true);
    },
    /** fecha a janela (o Fechar, o Esc e o ×): o que não foi lançado nem salvo some */
    fecharJanela: fechar,
    /** o Salvar do Novo lançamento: guarda o formulário (não entra na lista) e fecha; o próximo Novo lançamento abre nele */
    podeSalvar: !editando && !multiplo?.editando && (!vazio || !!multiplo),
    salvarRascunho() {
      if (editando || multiplo?.editando) return;
      guardar(g => ({ ...g, rascunho: vazio && !multiplo ? null : { form, multiplo } }));
      fechar();
      toast('Salvo: o Novo lançamento abre preenchido.');
    },
    mudar: (campo: keyof Formulario, v: string) => setForm(f => ({ ...f, [campo]: v })),
    contaD: conta(contaD, 'debito'),
    contaC: conta(contaC, 'credito'),
    /** o histórico digitado, no plano de históricos (o nome ao lado do número) */
    historico: historico ? { codigo: historico.codigo, nome: historico.nome, pulaComplemento: historico.pulaComplemento } : null,
    /** o sábado e o feriado nacional, travados no calendário (24/11/2026: "nao deixa lançar nos sábados e feriados nacionais") */
    diaSemLancamento: sci.diaSemLancamento,
    /** o dia da semana da data digitada (24/11/2026: "Deixa aparecendo o dia da semana, ao usuario lançar"); '' sem data válida */
    diaDaSemana: lido.data ? DIAS_DA_SEMANA[new Date(Date.UTC(+lido.data.slice(0, 4), +lido.data.slice(5, 7) - 1, +lido.data.slice(8, 10))).getUTCDay()] : '',
    /** o Lançar: só com tudo certo (24/11/2026: "Nao gostei desses avisos, as vezes e so bloquear": sem a lista do que falta) */
    podeLancar: !vazio && !problemasDoFormulario.length,
    /**
     * Enter no formulário: grava. A edição fecha a janela; o novo fica com ela aberta para o próximo, na mesma data (o SCI
     * repete a data); o resto limpa. O novo lançado tira o que estava salvo
     */
    gravar() {
      if (vazio || problemasDoFormulario.length) return;
      if (editando) {
        mudarLista(ls => ls.map(l => (l.id === editando ? { ...lido, id: editando } : l)));
        setEditando(null);
        setForm(FORMULARIO_VAZIO);
        setJanela(false);
        toast('Lançamento alterado.');
        return;
      }
      const novo = { ...lido, id: idNovo() };
      mudarLista(ls => [...ls, novo]);
      if (guardado.rascunho) guardar(g => ({ ...g, rascunho: null }));
      setForm({ ...FORMULARIO_VAZIO, data: form.data });
      toast('Lançado.');
    },
    limparFormulario: () => { setForm(FORMULARIO_VAZIO); setEditando(null); },
    editar: (id: string) => {
      const l = guardado.lancamentos.find(x => x.id === id);
      if (!l) return;
      // a partida de um múltiplo abre o múltiplo inteiro
      if (l.multiplo) { abrirMultiplo(l.multiplo); setEditando(null); setJanela(true); return; }
      setEditando(id); setForm(doLancamento(l)); setJanela(true);
    },
    // ------------------------------------------------------------------------------------ o lançamento múltiplo
    multiplo,
    /** o botão Lançamento múltiplo: um débito e um crédito para começar */
    /**
     * A caixinha "Lançamento múltiplo" do Novo lançamento (24/11/2026: "coloca uma opção de marcar"): marcada, o que já foi
     * digitado vira a primeira partida de débito e a primeira de crédito; desmarcada, a primeira de cada lado volta para o
     * lançamento simples. Na edição ela não muda (o lançamento continua do tipo que era)
     */
    marcarMultiplo(sim: boolean) {
      if (editando || multiplo?.editando) return;
      if (sim) {
        const doLado = (lado: sci.LadoDoLancamento): PartidaDoFormulario => ({
          ...partidaVazia(lado), conta: lado === 'debito' ? form.debito : form.credito, participante: lado === 'debito' ? form.participanteD : form.participanteC,
          valor: form.valor, historico: form.historico, complemento: form.complemento,
        });
        setMultiplo({ id: idNovo(), editando: false, data: form.data, documento: form.documento, partidas: [doLado('debito'), doLado('credito')] });
        return;
      }
      if (multiplo) {
        const d = multiplo.partidas.find(pt => pt.lado === 'debito');
        const c = multiplo.partidas.find(pt => pt.lado === 'credito');
        const base = d || c;
        setForm({
          ...FORMULARIO_VAZIO, data: multiplo.data, documento: multiplo.documento, debito: d?.conta || '', credito: c?.conta || '',
          participanteD: d?.participante || '', participanteC: c?.participante || '', valor: base?.valor || '', historico: base?.historico || '', complemento: base?.complemento || '',
        });
      }
      setMultiplo(null);
    },
    mudarDoMultiplo: (campo: 'data' | 'documento', v: string) => mudarMultiplo(m => ({ ...m, [campo]: v })),
    /** trocar o lado leva a partida para o bloco dele: os débitos em cima, os créditos embaixo (24/11/2026: "Priorize deixar o debito na parte superior e credito na parte inferior") */
    mudarPartida: (chave: string, campo: CampoDaPartida, v: string) =>
      mudarMultiplo(m => {
        const pt = m.partidas.find(x => x.chave === chave);
        if (!pt) return m;
        const nova = { ...pt, [campo]: v };
        if (campo !== 'lado' || pt.lado === v) return { ...m, partidas: m.partidas.map(x => (x.chave === chave ? nova : x)) };
        return { ...m, partidas: noBlocoDoLado(m.partidas.filter(x => x.chave !== chave), nova) };
      }),
    /**
     * a partida nova já vem no lado que falta, com o valor que falta para bater, no bloco do lado dela (o débito depois do
     * último débito, o crédito no fim); devolve a chave dela (o foco vai para a conta)
     */
    adicionarPartida: () => {
      if (!multiplo) return null;
      const d = totaisDoMultiplo.diferenca;
      const lado: sci.LadoDoLancamento = d > 0 ? 'credito' : d < 0 ? 'debito' : multiplo.partidas[multiplo.partidas.length - 1]?.lado || 'debito';
      const nova = partidaVazia(lado, d ? sci.valorParaTexto(Math.abs(d)) : '');
      mudarMultiplo(m => ({ ...m, partidas: noBlocoDoLado(m.partidas, nova) }));
      return nova.chave;
    },
    /** arrastar uma partida para o lugar de outra (24/11/2026: "De a opcao do usuario organizar as linhas arrastando") */
    moverPartida: (de: string, para: string) => mudarMultiplo(m => {
      const i = m.partidas.findIndex(x => x.chave === de);
      const j = m.partidas.findIndex(x => x.chave === para);
      if (i < 0 || j < 0 || i === j) return m;
      const ps = [...m.partidas];
      const [pt] = ps.splice(i, 1);
      ps.splice(j, 0, pt);
      return { ...m, partidas: ps };
    }),
    removerPartida: (chave: string) => mudarMultiplo(m => ({ ...m, partidas: m.partidas.filter(pt => pt.chave !== chave) })),
    /** o que a tela mostra de cada partida: o nome da conta, o participante que ela pede e o histórico */
    partidaLida: (chave: string) => {
      const i = multiplo ? multiplo.partidas.findIndex(pt => pt.chave === chave) : -1;
      const pt = multiplo?.partidas[i];
      if (!pt) return null;
      const c = sci.contaDoPlano(plano, pt.conta);
      return {
        conta: c ? { nome: c.nome, analitica: c.analitica, foraDoLado: sci.contaForaDoLado(c, pt.lado) } : null,
        participante: sci.participanteDoLado(c, pt.lado),
        historico: sci.historicoDoSci(pt.historico),
        problemas: problemasDasPartidas[i] || [],
      };
    },
    diaDaSemanaDoMultiplo: (() => { const d = partidasLidas[0]?.data; return d ? DIAS_DA_SEMANA[new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10))).getUTCDay()] : ''; })(),
    totaisDoMultiplo: { ...totaisDoMultiplo, debitoTexto: sci.valorParaTexto(totaisDoMultiplo.debito), creditoTexto: sci.valorParaTexto(totaisDoMultiplo.credito), diferencaTexto: sci.valorParaTexto(Math.abs(totaisDoMultiplo.diferenca)) },
    /** o que falta no múltiplo: o dele e o das partidas, sem repetir */
    problemasDoMultiplo: [...new Set([...problemasDoMultiplo, ...problemasDasPartidas.flat()])],
    /** Lançar: só com débito = crédito e nada faltando; o editado volta para o mesmo lugar da lista */
    gravarMultiplo() {
      if (!multiplo || problemasDoMultiplo.length || problemasDasPartidas.some(x => x.length)) return;
      const novas = partidasLidas.map(l => ({ ...l, id: multiplo.editando ? l.id : idNovo() }));
      mudarLista(ls => {
        const i = ls.findIndex(l => l.multiplo === multiplo.id);
        if (i < 0) return [...ls, ...novas];
        const resto = ls.filter(l => l.multiplo !== multiplo.id);
        return [...resto.slice(0, i), ...novas, ...resto.slice(i)];
      });
      if (!multiplo.editando && guardado.rascunho) guardar(g => ({ ...g, rascunho: null }));
      // a edição fecha; o novo deixa a janela aberta, no múltiplo, para o próximo (na mesma data)
      if (multiplo.editando) { setMultiplo(null); setJanela(false); }
      else setMultiplo({ id: idNovo(), editando: false, data: multiplo.data, documento: '', partidas: [partidaVazia('debito'), partidaVazia('credito')] });
      toast(multiplo.editando ? 'Lançamento múltiplo alterado.' : 'Lançamento múltiplo lançado: ' + novas.length + ' partidas.');
    },
    // a pesquisa no plano (F2 ou a lupa)
    pesquisa, abrirPesquisa: (lado: 'debito' | 'credito' | 'historico', partida: string | null = null) => { setPesquisa(lado); setPesquisaDaPartida(partida); },
    fecharPesquisa: () => { setPesquisa(null); setPesquisaDaPartida(null); },
    /** o texto que a lupa já abre buscando e o campo que volta a ter o foco */
    textoDaPesquisa: (() => {
      const pt = pesquisaDaPartida && multiplo?.partidas.find(x => x.chave === pesquisaDaPartida);
      if (pt) return pesquisa === 'historico' ? pt.historico : pt.conta;
      return pesquisa ? form[pesquisa] : '';
    })(),
    campoDaPesquisa: pesquisaDaPartida ? 'sci-mp-' + (pesquisa === 'historico' ? 'hist' : 'conta') + '-' + pesquisaDaPartida : 'sci-' + (pesquisa || ''),
    /** a CD não aparece na lupa do débito, nem a FD na do crédito (24/11/2026: "nem deixa aparecer para o usuario essas contas dependendo do input que ele está") */
    buscarNoPlano: (texto: string, lado: sci.LadoDoLancamento) => sci.buscarNoPlano(plano, texto, 120).filter(c => !sci.contaForaDoLado(c, lado)).slice(0, 80),
    buscarHistoricos: (texto: string) => sci.buscarHistoricos(texto, 80),
    escolherNoPlano: (codigo: string) => {
      if (pesquisaDaPartida) {
        const campo: CampoDaPartida = pesquisa === 'historico' ? 'historico' : 'conta';
        mudarMultiplo(m => ({ ...m, partidas: m.partidas.map(pt => (pt.chave === pesquisaDaPartida ? { ...pt, [campo]: codigo } : pt)) }));
      } else if (pesquisa) setForm(f => ({ ...f, [pesquisa]: codigo }));
      setPesquisa(null); setPesquisaDaPartida(null);
    },
    // a tabela
    busca, setBusca,
    /** a ordem e os filtros das colunas (o clique no cabeçalho) */
    ordem, ordenar: (coluna: ColunaDosLancamentos, desc: boolean) => setOrdem({ coluna, desc }), semOrdem: () => setOrdem(null),
    filtrosDasColunas, filtrarColuna: (coluna: ColunaDosLancamentos, texto: string) => setFiltrosDasColunas(f => ({ ...f, [coluna]: texto })),
    limparColuna: (coluna: ColunaDosLancamentos) => {
      setFiltrosDasColunas(f => { const n = { ...f }; delete n[coluna]; return n; });
      setOrdem(o => (o?.coluna === coluna ? null : o));
      if (coluna === 'data') setMesDaData(null);
      if (coluna === 'valor') setFaixaDoValor({ acima: '', abaixo: '' });
    },
    mesesDasDatas, mesDaData, setMesDaData,
    faixaDoValor, mudarFaixaDoValor: (lado: 'acima' | 'abaixo', texto: string) => setFaixaDoValor(f => ({ ...f, [lado]: texto })),
    linhas: visiveis.map(l => ({ ...l, dataTexto: sci.dataParaTexto(l.data), valorTexto: l.valor ? sci.valorParaTexto(l.valor) : '' })),
    total: linhas.length,
    resumo: { ...resumo, totalTexto: sci.valorParaTexto(resumo.total), totalProntoTexto: sci.valorParaTexto(resumo.totalPronto) },
    marcados,
    marcado: (id: string) => marcados.has(id),
    marcar: (id: string, junto: boolean) => setMarcados(m => {
      if (!junto) return m.size === 1 && m.has(id) ? new Set() : new Set([id]);
      const n = new Set(m); if (n.has(id)) n.delete(id); else n.add(id); return n;
    }),
    /** clicou com o botão direito numa linha fora da seleção: ela vira a seleção */
    garantirMarcado: (id: string) => setMarcados(m => (m.has(id) ? m : new Set([id]))),
    /** o múltiplo numa linha só (24/11/2026: "como se fosse um lancamento so"): marca ou desmarca as partidas dele juntas */
    marcarGrupo: (ids: readonly string[], junto: boolean) => setMarcados(m => {
      const todas = ids.every(id => m.has(id));
      if (!junto) return todas && m.size === ids.length ? new Set() : new Set(ids);
      const n = new Set(m); for (const id of ids) { if (todas) n.delete(id); else n.add(id); } return n;
    }),
    /** o botão direito no múltiplo fora da seleção: as partidas dele viram a seleção */
    garantirGrupo: (ids: readonly string[]) => setMarcados(m => (ids.every(id => m.has(id)) ? m : new Set(ids))),
    todasMarcadas: visiveis.length > 0 && visiveis.every(l => marcados.has(l.id)),
    marcarTodas: (sim: boolean) => setMarcados(sim ? new Set(visiveis.map(l => l.id)) : new Set()),
    // as ações (botão direito, teclado)
    copiar,
    async colar(depoisDe?: string) {
      try { colarTexto(await navigator.clipboard.readText(), depoisDe); }
      catch { aviso({ tom: 'info', titulo: 'Use o Ctrl+V', texto: 'O navegador não deixou ler a área de transferência pelo menu. Clique na tabela e aperte Ctrl+V.' }); }
    },
    colarTexto,
    duplicar(alvo?: readonly string[]) {
      const ls = doAlvo(alvo);
      if (!ls.length) return;
      // a cópia de um múltiplo é outro múltiplo
      const novosMultiplos = new Map<string, string>();
      const copias = ls.map(l => {
        if (!l.multiplo) return { ...l, id: idNovo() };
        if (!novosMultiplos.has(l.multiplo)) novosMultiplos.set(l.multiplo, idNovo());
        return { ...l, id: idNovo(), multiplo: novosMultiplos.get(l.multiplo) };
      });
      const ultimo = ls[ls.length - 1].id;
      mudarLista(todos => { const i = todos.findIndex(l => l.id === ultimo); return [...todos.slice(0, i + 1), ...copias, ...todos.slice(i + 1)]; });
      setMarcados(new Set(copias.map(l => l.id)));
    },
    inverter(alvo?: readonly string[]) {
      const s = new Set(ids(alvo));
      if (!s.size) return;
      mudarLista(ls => ls.map(l => (s.has(l.id) ? sci.invertido(l) : l)));
    },
    excluir(alvo?: readonly string[]) {
      const s = new Set(ids(alvo));
      if (!s.size) return;
      mudarLista(ls => ls.filter(l => !s.has(l.id)));
      setMarcados(new Set());
      if (editando && s.has(editando)) { setEditando(null); setForm(FORMULARIO_VAZIO); }
      toast((s.size === 1 ? '1 lançamento excluído' : s.size + ' lançamentos excluídos') + '. Ctrl+Z desfaz.');
    },
    /**
     * Altera em lote os marcados (25/11/2026: "Coloca alguma funcao de alterar em lote: data, conta debito, conta credito, valor,
     * numero do historico"): o campo vazio fica como está; os múltiplos não mudam (a regra, sci.alterarEmLote). Devolve o erro
     * do que foi digitado, ou '' quando aplicou. O Ctrl+Z desfaz.
     */
    alterarEmLote(t: { data: string; debito: string; credito: string; valor: string; historico: string }): string {
      const marcadosAgora = new Set(marcados);
      if (!marcadosAgora.size) return 'Marque os lançamentos.';
      const m: sci.MudancaEmLote = {};
      if (t.data.trim()) { m.data = sci.dataDoTexto(t.data, ano); if (!m.data) return 'A data ' + t.data.trim() + ' não é válida.'; }
      if (t.valor.trim()) { const v = sci.valorDoTexto(t.valor); if (isNaN(v) || v <= 0) return 'O valor ' + t.valor.trim() + ' não é válido.'; m.valor = Math.abs(v); }
      if (t.debito.trim()) { if (!sci.contaDoPlano(plano, t.debito)) return 'A conta ' + t.debito.trim() + ' não está no plano.'; m.debito = t.debito; }
      if (t.credito.trim()) { if (!sci.contaDoPlano(plano, t.credito)) return 'A conta ' + t.credito.trim() + ' não está no plano.'; m.credito = t.credito; }
      if (t.historico.trim()) { if (!sci.historicoDoSci(t.historico)) return 'O histórico ' + t.historico.trim() + ' não está no plano de históricos.'; m.historico = t.historico; }
      if (!Object.keys(m).length) return 'Preencha o que vai mudar.';
      const r = sci.alterarEmLote(guardado.lancamentos, marcadosAgora, m, plano);
      const fora = r.multiplos ? ' Os múltiplos não mudam em lote.' : '';
      if (!r.mudados) { toast('Nada mudou.' + fora); return ''; }
      mudarLista(() => r.lancamentos);
      toast((r.mudados === 1 ? '1 lançamento alterado.' : r.mudados + ' lançamentos alterados.') + fora + ' Ctrl+Z desfaz.');
      return '';
    },
    /** a conta do plano pelo código ou apelido (para mostrar o nome no lote) */
    contaNoPlano: (texto: string) => (texto.trim() ? sci.contaDoPlano(plano, texto) : null),
    /** o histórico padrão pelo número (para mostrar o nome no lote) */
    historicoNoSci: (texto: string) => (texto.trim() ? sci.historicoDoSci(texto) : null),
    podeDesfazer: anterior !== null,
    desfazer() {
      if (anterior === null) return;
      const volta = anterior;
      setAnterior(null);
      guardar(g => ({ ...g, lancamentos: volta }));
      toast('Desfeito.');
    },
    // a planilha do SCI
    podeExportar: resumo.quantos > 0,
    exportar() {
      if (!entrada.empresa) return;
      if (!cnpjOk) { aviso({ tom: 'info', titulo: 'Falta o CNPJ da empresa', texto: 'Ele vai em todas as linhas da planilha e o SCI confere com o da empresa. Preencha em Cadastro › Dados da empresa.' }); return; }
      const lsci = sci.lancamentosDoShaderParaOSci(guardado.lancamentos, plano, cnpj);
      const mes = sci.mesPrincipal(guardado.lancamentos);
      baixarBytes(sci.planilhaDoSci(lsci), sci.nomeDaPlanilhaSci(cnpj, mes, 'minimum'), sci.TIPO_XLSX_SCI);
      const fora = lsci.filter(l => l.problemas.length).length;
      if (fora) aviso({ tom: 'info', titulo: 'Planilha baixada, com ' + fora + (fora === 1 ? ' lançamento' : ' lançamentos') + ' para conferir', texto: 'Os prontos estão na aba Importar; os que têm problema ficaram na aba Conferir, com o motivo.' });
      else toast('Planilha do SCI baixada: ' + lsci.length + (lsci.length === 1 ? ' lançamento.' : ' lançamentos.'));
    },
    /** a tela inicial: as empresas do SCI, por nome, e se a lista já chegou do banco */
    empresasDoSci: entrada.lista,
    carregada,
    // o ⚡ Dados de teste (só no modo desenvolvedor; fica só neste navegador)
    teste: {
      temSciDeTeste: testeSci.length > 0,
      /** marca 4 empresas da lista como no SCI, só neste navegador */
      marcarSci() {
        const novas = entrada.todas.filter(e => !doSci.has(e.codigo)).slice(0, 4).map(e => e.codigo);
        const todas = [...testeSci, ...novas];
        setTesteSci(todas); gravarTesteSci(todas);
        toast(novas.length + (novas.length === 1 ? ' empresa marcada' : ' empresas marcadas') + ' no SCI, só neste navegador.');
      },
      desmarcarSci() { setTesteSci([]); gravarTesteSci([]); },
      preencher() {
        // os dias de exemplo caem num dia em que se lança (nem sábado nem feriado nacional)
        const mes = ano + '-' + String(new Date().getMonth() + 1).padStart(2, '0');
        const d = (dia: number) => { let n = dia; while (sci.diaSemLancamento(mes + '-' + String(n).padStart(2, '0'))) n++; return mes + '-' + String(n).padStart(2, '0'); };
        const [banco, caixa, clientes, fornecedores] = idDoPlano === '90113' ? ['7', '5', '16', '148'] : ['78', '51', '159', '100005'];
        const exemplos: sci.CamposDoLancamento[] = [
          { ...sci.LANCAMENTO_VAZIO, data: d(2), debito: banco, credito: caixa, valor: 500000, historico: '367', complemento: 'dinheiro do caixa', documento: '1' },
          { ...sci.LANCAMENTO_VAZIO, data: d(5), debito: banco, credito: clientes, valor: 123456, historico: '2000', complemento: 'NF 1001', documento: '1001', participanteC: '120' },
          { ...sci.LANCAMENTO_VAZIO, data: d(8), debito: fornecedores, credito: banco, valor: 89000, historico: '1000', complemento: 'NF 555', documento: '555', participanteD: '45' },
        ];
        // e um múltiplo: o caixa paga o fornecedor e deposita o resto no banco (um crédito, dois débitos)
        const m = idNovo();
        const parte = { ...sci.LANCAMENTO_VAZIO, data: d(15), documento: '900', multiplo: m };
        exemplos.push(
          { ...parte, credito: caixa, valor: 150000, historico: '367', complemento: 'saída do caixa' },
          { ...parte, debito: fornecedores, valor: 100000, historico: '1000', complemento: 'NF 900', participanteD: '45' },
          { ...parte, debito: banco, valor: 50000, historico: '367', complemento: 'depósito do troco' },
        );
        mudarLista(ls => [...ls, ...exemplos.map(l => ({ ...l, id: idNovo() }))]);
        if (!guardado.cnpj) guardar(g => ({ ...g, cnpj: '11.222.333/0001-81' }));
      },
      apagar() { mudarLista(() => []); setMarcados(new Set()); },
    },
  };
}

export type VmShadersCi = ReturnType<typeof useShadersCi>;
