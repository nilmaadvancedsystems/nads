// ViewModel do ShadersCI (23/11/2026: "Quero fazer uma aba de lançamento mais clean, a do meu sistema SCI é horrivel"): a empresa
// (a busca da barra, a mesma do Lançatudo), o plano padrão do SCI (90113 ou 90011), o CNPJ que vai na planilha, o formulário do
// lançamento (novo ou editando), a tabela com a seleção, o copiar e colar (botão direito, Ctrl+C e Ctrl+V), o desfazer e a
// planilha do gerador do SCI. Tudo fica só neste navegador, por empresa (o dono: "Só no navegador"): nada vai para o banco.
import { sci } from '@nads/core';
import { baixarBytes, useCarregando, useRetorno } from '@nads/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useModoDesenvolvedor } from '../../../../comum/modoDesenvolvedor';
import { useDadosDaEmpresaNoEntregas, useTodosOsCadastros } from '../../dados/repo';
import { useLancatudo } from '../lancatudo/useLancatudo';

type Lancamento = sci.LancamentoDoShader;

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

const doLancamento = (l: sci.CamposDoLancamento): Formulario => ({
  data: sci.dataParaTexto(l.data), debito: l.debito, credito: l.credito, valor: l.valor ? sci.valorParaTexto(l.valor) : '', historico: l.historico,
  complemento: l.complemento, documento: l.documento, participanteD: l.participanteD, participanteC: l.participanteC,
});

export function useShadersCi() {
  const { toast, aviso } = useRetorno();
  const [dev] = useModoDesenvolvedor();
  // só as empresas que estão no SCI (24/11/2026: "Apenas empresas que estão na sci"): o "Está no SCI" do Cadastro e, no
  // modo desenvolvedor, as marcadas pelo ⚡ Dados de teste
  const cadastros = useTodosOsCadastros();
  useCarregando(!cadastros.carregada);
  const [testeSci, setTesteSci] = useState<number[]>(lerTesteSci);
  const doSci = useMemo(() => {
    const s = new Set<number>();
    for (const c of cadastros.porId.values()) if (c.noSci && c.codigo != null) s.add(c.codigo);
    if (dev) for (const c of testeSci) s.add(c);
    return s;
  }, [cadastros.porId, testeSci, dev]);
  const entrada = useLancatudo(doSci);
  const chave = entrada.empresa ? String(entrada.empresa.codigo) : null;
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
      problemas: problemas[i],
    }));
  }, [guardado.lancamentos, plano]);
  const q = sci.semAcento(busca.trim());
  const visiveis = q ? linhas.filter(l => [sci.dataParaTexto(l.data), l.debito, l.credito, l.nomeD, l.nomeC, sci.valorParaTexto(l.valor), l.historico, l.complemento, l.documento, l.participanteD, l.participanteC]
    .some(v => sci.semAcento(v).includes(q))) : linhas;
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
    const novos = sci.lancamentosDoTexto(texto, ano).map(l => ({ ...sci.lancamentoLimpo(l, plano), id: idNovo() }));
    if (!novos.length) { toast('Nada para colar: copie linhas da tabela ou do Excel (Data, Débito, Crédito, Valor, Histórico...).'); return; }
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
    dev,
    // o plano e o CNPJ da empresa (o que vai na coluna CNPJ da planilha)
    planos: sci.PLANOS_DO_SCI,
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
    mudarPartida: (chave: string, campo: CampoDaPartida, v: string) =>
      mudarMultiplo(m => ({ ...m, partidas: m.partidas.map(pt => (pt.chave === chave ? { ...pt, [campo]: v } : pt)) })),
    /** a partida nova já vem no lado que falta, com o valor que falta para bater */
    adicionarPartida: () => mudarMultiplo(m => {
      const d = totaisDoMultiplo.diferenca;
      const lado: sci.LadoDoLancamento = d > 0 ? 'credito' : d < 0 ? 'debito' : m.partidas[m.partidas.length - 1]?.lado || 'debito';
      return { ...m, partidas: [...m.partidas, partidaVazia(lado, d ? sci.valorParaTexto(Math.abs(d)) : '')] };
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
    carregada: cadastros.carregada,
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
          { ...sci.LANCAMENTO_VAZIO, data: d(10), debito: clientes, credito: caixa, valor: 1000, historico: 'Tarifa', complemento: 'Lançamento com problema, para testar' },
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
