// ViewModel do ShadersCI (23/11/2026: "Quero fazer uma aba de lançamento mais clean, a do meu sistema SCI é horrivel"): a empresa
// (a busca da barra, a mesma do Lançatudo), o plano padrão do SCI (90113 ou 90011), o CNPJ que vai na planilha, o formulário do
// lançamento (novo ou editando), a tabela com a seleção, o copiar e colar (botão direito, Ctrl+C e Ctrl+V), o desfazer e a
// planilha do gerador do SCI. Tudo fica só neste navegador, por empresa (o dono: "Só no navegador"): nada vai para o banco.
import { sci } from '@nads/core';
import { baixarBytes, useCarregando, useRetorno } from '@nads/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useModoDesenvolvedor } from '../../../../comum/modoDesenvolvedor';
import { useTodosOsCadastros } from '../../dados/repo';
import { useLancatudo } from '../lancatudo/useLancatudo';

type Lancamento = sci.LancamentoDoShader;

/** O que fica guardado por empresa neste navegador. */
interface Guardado { plano: sci.IdDoPlanoSci; cnpj: string; lancamentos: Lancamento[] }
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

let contador = 0;
const idNovo = () => Date.now().toString(36) + (contador++).toString(36) + Math.random().toString(36).slice(2, 6);

/** O formulário em texto, como se digita. */
export interface Formulario { data: string; debito: string; credito: string; valor: string; historico: string; complemento: string; documento: string; participanteD: string; participanteC: string }
const FORMULARIO_VAZIO: Formulario = { data: '', debito: '', credito: '', valor: '', historico: '', complemento: '', documento: '', participanteD: '', participanteC: '' };

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
  const [marcados, setMarcados] = useState<ReadonlySet<string>>(new Set());
  const [busca, setBusca] = useState('');
  const [pesquisa, setPesquisa] = useState<'debito' | 'credito' | null>(null);

  const plano = sci.planoDoSci(guardado.plano);
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

  const linhas = useMemo(() => guardado.lancamentos.map(l => ({
    ...l,
    nomeD: sci.contaDoPlano(plano, l.debito)?.nome || '',
    nomeC: sci.contaDoPlano(plano, l.credito)?.nome || '',
    problemas: sci.problemasDoLancamento(l, plano),
  })), [guardado.lancamentos, plano]);
  const q = sci.semAcento(busca.trim());
  const visiveis = q ? linhas.filter(l => [sci.dataParaTexto(l.data), l.debito, l.credito, l.nomeD, l.nomeC, sci.valorParaTexto(l.valor), l.historico, l.complemento, l.documento, l.participanteD, l.participanteC]
    .some(v => sci.semAcento(v).includes(q))) : linhas;
  const resumo = sci.resumoDosLancamentos(guardado.lancamentos, plano);
  const cnpjOk = (() => { const d = guardado.cnpj.replace(/\D/g, ''); return d.length === 14 || d.length === 11; })();

  // o formulário lido: o lançamento e o que falta nele
  const doFormulario = (f: Formulario): sci.CamposDoLancamento => {
    const valor = sci.valorDoTexto(f.valor);
    return sci.lancamentoLimpo({
      data: sci.dataDoTexto(f.data, ano), debito: f.debito, credito: f.credito, valor: isNaN(valor) ? 0 : Math.abs(valor), historico: f.historico,
      complemento: f.complemento, documento: f.documento, participanteD: f.participanteD, participanteC: f.participanteC,
    }, plano);
  };
  const lido = doFormulario(form);
  const contaD = sci.contaDoPlano(plano, form.debito);
  const contaC = sci.contaDoPlano(plano, form.credito);
  const vazio = Object.values(form).every(v => !v.trim());

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
    plano: guardado.plano,
    setPlano: (p: sci.IdDoPlanoSci) => guardar(g => ({ ...g, plano: p })),
    cnpj: guardado.cnpj,
    setCnpj: (v: string) => guardar(g => ({ ...g, cnpj: v })),
    cnpjOk,
    // o formulário
    form, editando,
    mudar: (campo: keyof Formulario, v: string) => setForm(f => ({ ...f, [campo]: v })),
    contaD: contaD ? { codigo: contaD.codigo, nome: contaD.nome, participante: contaD.participante, analitica: contaD.analitica } : null,
    contaC: contaC ? { codigo: contaC.codigo, nome: contaC.nome, participante: contaC.participante, analitica: contaC.analitica } : null,
    problemasDoFormulario: vazio ? [] : sci.problemasDoLancamento(lido, plano),
    vazio,
    /** Enter no formulário: grava (novo ou a edição) e deixa a data e as contas para o próximo, como no SCI */
    gravar() {
      if (vazio) return;
      if (editando) {
        mudarLista(ls => ls.map(l => (l.id === editando ? { ...lido, id: editando } : l)));
        setEditando(null);
        setForm(FORMULARIO_VAZIO);
        toast('Lançamento alterado.');
        return;
      }
      const novo = { ...lido, id: idNovo() };
      mudarLista(ls => [...ls, novo]);
      // o próximo começa na mesma data (o SCI repete a data); o resto limpa
      setForm({ ...FORMULARIO_VAZIO, data: form.data });
    },
    limparFormulario: () => { setForm(FORMULARIO_VAZIO); setEditando(null); },
    editar: (id: string) => { const l = guardado.lancamentos.find(x => x.id === id); if (!l) return; setEditando(id); setForm(doLancamento(l)); },
    // a pesquisa no plano (F2 ou a lupa)
    pesquisa, abrirPesquisa: (lado: 'debito' | 'credito') => setPesquisa(lado), fecharPesquisa: () => setPesquisa(null),
    buscarNoPlano: (texto: string) => sci.buscarNoPlano(plano, texto, 80),
    escolherNoPlano: (codigo: string) => { if (pesquisa) setForm(f => ({ ...f, [pesquisa]: codigo })); setPesquisa(null); },
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
      const copias = ls.map(l => ({ ...l, id: idNovo() }));
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
      if (!cnpjOk) { aviso({ tom: 'info', titulo: 'Falta o CNPJ da empresa', texto: 'Ele vai em todas as linhas da planilha e o SCI confere com o da empresa.' }); return; }
      const lsci = sci.lancamentosDoShaderParaOSci(guardado.lancamentos, plano, guardado.cnpj);
      const mes = sci.mesPrincipal(guardado.lancamentos);
      baixarBytes(sci.planilhaDoSci(lsci), sci.nomeDaPlanilhaSci(guardado.cnpj, mes, 'minimum'), sci.TIPO_XLSX_SCI);
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
        const d = (dia: number) => ano + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(dia).padStart(2, '0');
        const exemplos: sci.CamposDoLancamento[] = guardado.plano === '90113' ? [
          { ...sci.LANCAMENTO_VAZIO, data: d(2), debito: '7', credito: '5', valor: 500000, historico: '1', complemento: 'Depósito do caixa no Banco do Brasil' },
          { ...sci.LANCAMENTO_VAZIO, data: d(5), debito: '16', credito: '5', valor: 123456, historico: '10', complemento: 'Venda a prazo NF 1001', documento: '1001', participanteD: '120' },
          { ...sci.LANCAMENTO_VAZIO, data: d(8), debito: '148', credito: '7', valor: 89000, historico: '20', complemento: 'Pagamento de fornecedor NF 555', documento: '555', participanteD: '45' },
          { ...sci.LANCAMENTO_VAZIO, data: d(10), debito: '7', credito: '16', valor: 123456, historico: '30', complemento: 'Recebimento de cliente NF 1001', documento: '1001', participanteC: '120' },
          { ...sci.LANCAMENTO_VAZIO, data: d(12), debito: '15', credito: '5', valor: 1000, historico: 'Tarifa', complemento: 'Lançamento com problema, para testar' },
        ] : [
          { ...sci.LANCAMENTO_VAZIO, data: d(2), debito: '78', credito: '51', valor: 500000, historico: '1', complemento: 'Depósito do caixa no Banco do Brasil' },
          { ...sci.LANCAMENTO_VAZIO, data: d(5), debito: '159', credito: '51', valor: 123456, historico: '10', complemento: 'Venda a prazo NF 1001', documento: '1001', participanteD: '120' },
          { ...sci.LANCAMENTO_VAZIO, data: d(8), debito: '100005', credito: '78', valor: 89000, historico: '20', complemento: 'Pagamento de fornecedor NF 555', documento: '555', participanteD: '45' },
          { ...sci.LANCAMENTO_VAZIO, data: d(12), debito: '140', credito: '51', valor: 1000, historico: 'Tarifa', complemento: 'Lançamento com problema, para testar' },
        ];
        mudarLista(ls => [...ls, ...exemplos.map(l => ({ ...l, id: idNovo() }))]);
        if (!guardado.cnpj) guardar(g => ({ ...g, cnpj: '11.222.333/0001-81' }));
      },
      apagar() { mudarLista(() => []); setMarcados(new Set()); },
    },
  };
}

export type VmShadersCi = ReturnType<typeof useShadersCi>;
