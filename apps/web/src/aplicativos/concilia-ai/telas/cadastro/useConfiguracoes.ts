// ViewModel do Cadastro › Configurações (Entradas, Saídas, Tomados, Prestados).
// Origem: conferencia.html #view-cad-cfop (~L1157-1174), cadAba (~L1761), trava das abas em
// aplicarBloqueios (~L1849-1864), renderNaturezaDePara (~L2082-2132), venda à vista
// (vendaVistaCard/vistaRowCfop/vistaBloqueia/vistaGravar ~L2164-2265), vincular conta
// (ndpRenderAddLista ~L2356, cliques ~L2364-2415), serviços (renderCadServ ~L4486,
// servFormHtml/servAbrirForm/servListaForn/servConfirmar ~L4476-4615).
//
// CONTRATO DE ENTRADA (usado pelo Relatório, botão "Colocar em X"): abrir esta página com
//   irPara('cadastro/configuracoes?servAdd=' + encodeURIComponent(tipo + '|' + cat + '|' + nome))
// (tipo = 'tomados' | 'prestados', cat = id da categoria em SERV_CAT, nome = participante).
// A página vai para a aba do tipo e abre o "Adicionar fornecedor" da categoria já com o
// participante escolhido (o servIrParaForm do original, ~L4539); o parâmetro sai da URL em seguida.
import { conferencia as c } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useBeforeUnload, useBlocker, useSearchParams } from 'react-router';
import { useSessao, type AbaCadastro } from '../../casca/sessao';

const ORDEM_ABAS: AbaCadastro[] = ['entradas', 'saidas', 'tomados', 'prestados'];
const ROTULO_ABA: Record<AbaCadastro, string> = { entradas: 'Entradas', saidas: 'Saídas', tomados: 'Tomados', prestados: 'Prestados' };
const IMPORTE: Record<AbaCadastro, string> = { entradas: 'as entradas', saidas: 'as saídas', prestados: 'os serviços prestados', tomados: 'os serviços tomados' };

// ---------- o que a View desenha ----------
export interface ContaNaLista { codigo: string; nome: string; grupo: c.Grupo }

/** Chips das contas ligadas + o "Adicionar"/"Vincular conta" (.ndp-add) de uma chave. */
export interface Vinculo {
  chave: string;
  chips: { codigo: string; texto: string }[];
  aberto: boolean;
  busca: string;
  /** lista de contas aberta embaixo do campo (null = escondida) */
  lista: ContaNaLista[] | null;
  abrir: () => void;
  digitar: (v: string) => void;
  focar: () => void;
  sair: () => void;
  escolher: (codigo: string) => void;
  desvincular: (codigo: string) => void;
}

export interface SlotVista {
  t: c.TipoVista;
  rot: string;
  valor: string;
  /** valor da pílula, com zeros à esquerda até 4 dígitos */
  valorMostrado: string;
  editando: boolean;
  sugestao: string;
  falta: boolean;
  /** o primeiro que falta: recebe o foco depois do aviso "Preencha os lançamentos" */
  focarAgora: number;
}

export interface ItemNatureza {
  k: string;
  titulo: string;
  nao: boolean;
  vinculo: Vinculo;
  /** mostra o "Não vai para o Contábil" (sem conta ligada) */
  podeNaoContabil: boolean;
  vista: { slots: SlotVista[]; info: string } | null;
}

export interface FormServ {
  aberto: boolean;
  texto: string;
  escolhido: string | null;
  lista: { itens: { nome: string; sub: string }[]; adicionar: string | null; vazio: boolean } | null;
  /** muda → a View rola até o formulário e foca o botão Adicionar */
  focarOk: number;
  abrir: () => void;
  digitar: (v: string) => void;
  focar: () => void;
  sair: () => void;
  escolher: (nome: string) => void;
  confirmar: () => void;
  cancelar: () => void;
  enter: () => void;
}

export interface CategoriaView {
  id: string;
  nome: string;
  lanc: string;
  travado: boolean;
  dica?: string;
  vinculo: Vinculo;
  /** só nas categorias específicas (não geral, não travada) */
  fornecedores: null | {
    itens: { nome: string; qtd: string; tirar: () => void }[];
    form: FormServ;
    sugestoes: { nome: string; colocar: () => void }[];
  };
}

interface EstadoForm { texto: string; escolhido: string | null; lista: boolean }

export function useConfiguracoes() {
  const s = useSessao();
  const { toast, modal } = useRetorno();
  const e = s.empresa;
  const tem = c.disponivel(e);
  const semP = c.semPrest(e);

  // ---------- aba (cadAba + trava do aplicarBloqueios) ----------
  let aba = s.abaCadastro;
  if (aba === 'prestados' && semP) aba = 'entradas';
  if (!tem[aba]) { const pri = ORDEM_ABAS.find(t => tem[t]); if (pri) aba = pri; }
  const serv = c.ehServ(aba);

  // ---------- estado da tela ----------
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [listaDe, setListaDe] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, EstadoForm>>({});
  const [focoForm, setFocoForm] = useState<{ chave: string; seq: number } | null>(null);
  const [editando, setEditando] = useState<{ k: string; t: c.TipoVista } | null>(null);
  const [textoEdit, setTextoEdit] = useState('');
  const [destacar, setDestacar] = useState(false);
  const [focarFalta, setFocarFalta] = useState(0);

  /** no original cada gravação redesenhava a tela: os campos abertos voltavam a ser só o botão */
  const limparUi = useCallback(() => { setCampos({}); setListaDe(null); setForms({}); }, []);

  // ---------- não sai das Saídas com lançamento à vista/a prazo faltando (vistaBloqueia) ----------
  const avisarPendentes = useCallback((): boolean => {
    const p = c.vistaPendentes(e);
    if (!p.length) { setDestacar(false); return false; }
    setDestacar(true); setEditando(null); limparUi();
    const qtdCfop = p.map(x => x.k).filter((k, i, l) => l.indexOf(k) === i).length;
    void modal({
      icone: 'alert', titulo: 'Preencha os lançamentos',
      html: 'Com <b>Vendas à vista e à prazo</b> ligado, cada CFOP de venda precisa do lançamento à vista e do a prazo. Faltam <b>' + p.length + '</b> em <b>' + qtdCfop + '</b> CFOP' + (qtdCfop > 1 ? 's' : '') + ', destacados em vermelho.',
      botoes: [{ rotulo: 'Preencher', valor: true, variante: 'btn-primary' }],
    }).then(() => setFocarFalta(x => x + 1));
    return true;
  }, [e, modal, limparUi]);
  const bloquear = useCallback(() => aba === 'saidas' && avisarPendentes(), [aba, avisarPendentes]);

  // sair da página pela casca (menu, abas, início da empresa); "Sair" da empresa passa (ver relatório)
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    aba === 'saidas' && nextLocation.pathname !== currentLocation.pathname && nextLocation.pathname !== '/' && c.vistaPendentes(e).length > 0);
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    blocker.reset();
    bloquear();
  }, [blocker, bloquear]);
  useBeforeUnload(useCallback((ev: BeforeUnloadEvent) => {
    if (aba === 'saidas' && c.vistaPendentes(e).length) { ev.preventDefault(); ev.returnValue = ''; }
  }, [aba, e]));

  // a casca pode trocar a aba por fora (clique em "Cadastro" no menu): também passa pelo aviso
  const abaAnterior = useRef(aba);
  const liberado = useRef(false);
  useEffect(() => {
    if (abaAnterior.current === 'saidas' && aba !== 'saidas' && !liberado.current && tem.saidas && c.vistaPendentes(e).length) {
      s.setAbaCadastro('saidas');
      avisarPendentes();
      return;
    }
    liberado.current = false;
    abaAnterior.current = aba;
    if (aba !== s.abaCadastro) s.setAbaCadastro(aba);
  }, [aba, s, e, tem.saidas, avisarPendentes]);

  function mudarAba(t: AbaCadastro) {
    if (!tem[t] && !(t === 'prestados' && semP)) { s.avisoImportar(t); return; }
    if (t === aba) return;
    if (t !== 'saidas' && bloquear()) return;
    liberado.current = true;
    s.setAbaCadastro(t);
  }

  const abas = ORDEM_ABAS.map(t => {
    const oculta = semP && t === 'prestados';
    const trava = !oculta && !tem[t];
    return { valor: t, rotulo: ROTULO_ABA[t], oculta, travada: trava ? 'Importe ' + IMPORTE[t] + ' primeiro' : (false as const) };
  });

  // ---------- vincular conta (.ndp-add) ----------
  function vinculo(k: string): Vinculo {
    const ligadas = c.contasDaNatureza(e, k);
    const aberto = campos[k] !== undefined;
    const busca = campos[k] || '';
    return {
      chave: k,
      chips: ligadas.map(codigo => { const a = c.contaPorCodigo(e, codigo); return { codigo, texto: codigo + (a ? ' — ' + a.nome : ' — fora do plano') }; }),
      aberto, busca,
      lista: aberto && listaDe === k ? c.contasParaVincular(e, ligadas, busca.trim()).map(a => ({ codigo: a.codigo, nome: a.nome, grupo: a.grupo })) : null,
      abrir: () => { setCampos(x => ({ ...x, [k]: '' })); setListaDe(k); },
      digitar: v => { setCampos(x => ({ ...x, [k]: v })); setListaDe(k); },
      focar: () => setListaDe(k),
      sair: () => {
        setTimeout(() => {
          setListaDe(x => (x === k ? null : x));
          // saiu sem digitar: volta a ser só o botão
          setCampos(x => { if (x[k] === undefined || x[k].trim()) return x; const y = { ...x }; delete y[k]; return y; });
        }, 150);
      },
      escolher: codigo => { s.aplicar(x => c.vincularConta(x, k, codigo)); limparUi(); },
      desvincular: codigo => { s.aplicar(x => c.desvincularConta(x, k, codigo)); limparUi(); },
    };
  }

  function naoContabil(k: string, marcar: boolean) {
    s.aplicar(x => c.marcarNaoContabil(x, k, marcar));
    limparUi();
  }

  // ---------- venda à vista (Saídas) ----------
  function alternarVista() {
    const nova = s.aplicar(c.alternarVendaVista);
    const ativo = !!nova?.vendaVista.ativo;
    if (!ativo) setDestacar(false);
    limparUi();
    toast(ativo ? 'Vendas à vista e à prazo ligado — preencha os dois lançamentos nos CFOPs de venda.' : 'Vendas à prazo — o CPF segue o lançamento do CNPJ.');
  }

  function editarVista(k: string, t: c.TipoVista) {
    setEditando({ k, t });
    setTextoEdit(c.vistaValor(e, k, t));
    limparUi();
  }

  function gravarVista(k: string, t: c.TipoVista, valor: string) {
    setEditando(null);
    let msg = '';
    s.aplicar(x => { const r = c.gravarLancVista(x, k, t, valor); msg = r.mensagem; return r.empresa; });
    limparUi();
    if (msg) toast(msg);
  }

  const vista = {
    editarVista,
    removerVista: (k: string, t: c.TipoVista) => gravarVista(k, t, ''),
    digitarVista: (v: string) => setTextoEdit(v.replace(/\D/g, '')),
    textoEdit,
    salvarVista: () => { if (editando) gravarVista(editando.k, editando.t, textoEdit); },
    cancelarVista: () => setEditando(null),
    teclaVista: (tecla: string) => {
      if (tecla === 'Enter') { if (editando) gravarVista(editando.k, editando.t, textoEdit); }
      else if (tecla === 'Escape') setEditando(null);
    },
  };

  // ---------- naturezas de entrada/saída ----------
  function montarNaturezas() {
    if (serv) return null;
    const t: c.TipoCfop = aba === 'entradas' ? 'Entrada' : 'Saída';
    const temContas = e.contas.length > 0;
    const temNotas = e.entradas.length > 0 || e.saidas.length > 0;
    if (!temContas || !temNotas) {
      const faltando: string[] = [];
      if (!temContas) faltando.push('o balancete');
      if (!temNotas) faltando.push('as notas de entradas e/ou saídas');
      return { titulo: t === 'Entrada' ? 'Naturezas de entrada' : 'Naturezas de saída', falta: 'Falta importar ' + faltando.join(' e ') + ' antes de vincular as naturezas às contas.', cartaoVista: null, itens: [], vazio: '' };
    }
    const grupos = c.todosGruposNatureza(e);
    const ks = c.ordenarPorCfop(grupos).filter(k => grupos[k].tipo === t);
    const ativo = !!e.vendaVista.ativo;
    let primeiraFalta = true;
    const itens: ItemNatureza[] = ks.map(k => {
      const gr = grupos[k];
      const ligadas = c.contasDaNatureza(e, k);
      const nao = !ligadas.length && c.naoContabil(e, k);
      let linhaVista: ItemNatureza['vista'] = null;
      if (t === 'Saída' && !nao && ativo && c.ehGrupoVenda(gr)) {
        const r = c.resumoVistaDoGrupo(e, k, gr);
        linhaVista = {
          slots: c.VISTA_TIPOS.map(o => {
            const valor = c.vistaValor(e, k, o.t);
            const ed = !!editando && editando.k === k && editando.t === o.t;
            const falta = !ed && !valor && destacar;
            const foco = falta && primeiraFalta ? focarFalta : 0;
            if (falta) primeiraFalta = false;
            return { t: o.t, rot: o.rot, valor, valorMostrado: valor.length < 4 ? ('0000' + valor).slice(-4) : valor, editando: ed, sugestao: r.sug[o.t] || 'Código', falta, focarAgora: foco };
          }),
          info: r.qtd.vista + ' nota' + (r.qtd.vista === 1 ? '' : 's') + ' à vista e ' + r.qtd.prazo + ' nota' + (r.qtd.prazo === 1 ? '' : 's') + ' a prazo',
        };
      }
      return { k, titulo: c.tituloDoGrupo(gr), nao, vinculo: vinculo(k), podeNaoContabil: !ligadas.length, vista: linhaVista };
    });
    return {
      titulo: t === 'Entrada' ? 'Naturezas de entrada' : 'Naturezas de saída',
      falta: '',
      cartaoVista: t === 'Saída' ? { ativo, titulo: ativo ? 'Vendas à vista e à prazo' : 'Vendas à prazo', semDoc: c.saidasSemDocumento(e) } : null,
      itens,
      vazio: 'Nenhuma natureza de CFOP de ' + (t === 'Entrada' ? 'entrada' : 'saída') + ' nas notas.',
    };
  }

  // ---------- serviços (Tomados / Prestados) ----------
  const chaveForm = (t: c.TipoServico, cat: string) => t + '|' + cat;

  const irParaForm = useCallback((t: c.TipoServico, cat: string, nome: string) => {
    liberado.current = true;
    s.setAbaCadastro(t);
    const ch = chaveForm(t, cat);
    setForms(x => ({ ...x, [ch]: nome ? { texto: nome, escolhido: nome, lista: false } : { texto: '', escolhido: null, lista: true } }));
    if (nome) setFocoForm(f => ({ chave: ch, seq: (f?.seq || 0) + 1 }));
  }, [s]);

  // ?servAdd=tipo|cat|nome (ver contrato no topo)
  const [params, setParams] = useSearchParams();
  const servAdd = params.get('servAdd');
  const servAddTratado = useRef<string | null>(null);
  useEffect(() => {
    if (servAdd == null) { servAddTratado.current = null; return; }
    if (servAdd === servAddTratado.current) return;
    servAddTratado.current = servAdd;
    const [t, cat, ...resto] = servAdd.split('|');
    if (c.ehServ(t) && cat) irParaForm(t, cat, resto.join('|'));
    setParams(p => { p.delete('servAdd'); return p; }, { replace: true });
  }, [servAdd, irParaForm, setParams]);

  function formServ(t: c.TipoServico, cat: string): FormServ {
    const ch = chaveForm(t, cat);
    const f = forms[ch];
    const set = (fn: (x: EstadoForm) => EstadoForm) => setForms(x => (x[ch] ? { ...x, [ch]: fn(x[ch]) } : x));
    const qRaw = f ? f.texto.trim() : '';
    let lista: FormServ['lista'] = null;
    if (f && f.lista) {
      const ks = c.participantesParaCategoria(e, t, cat, qRaw);
      lista = {
        itens: ks.map(p => ({ nome: p.nome, sub: p.qtd + ' nota(s) · hoje em ' + p.hoje })),
        adicionar: qRaw && !ks.length && !c.ehParticipanteConhecido(e, t, qRaw) ? qRaw.toUpperCase() : null,
        vazio: !ks.length && !qRaw,
      };
    }
    const confirmar = () => {
      if (!f) return;
      const nome = f.escolhido || f.texto.trim().toUpperCase();
      if (!nome) { toast('Escolha o fornecedor.'); return; }
      if (c.catFixa(t, nome)) { toast('Esse fornecedor é de Honorário, que é permanente.'); return; }
      s.aplicar(x => c.colocarNaCategoria(x, t, cat, nome));
      limparUi();
      const cs = c.catServ(t, cat);
      toast(nome + ' → ' + cs.nome + ' (lançamento ' + cs.lanc + ').');
    };
    return {
      aberto: !!f, texto: f ? f.texto : '', escolhido: f ? f.escolhido : null, lista,
      focarOk: focoForm && focoForm.chave === ch ? focoForm.seq : 0,
      abrir: () => setForms(x => ({ ...x, [ch]: { texto: '', escolhido: null, lista: true } })),
      digitar: v => set(() => ({ texto: v, escolhido: null, lista: true })),
      focar: () => set(x => (x.escolhido ? x : { ...x, lista: true })),
      sair: () => { setTimeout(() => set(x => ({ ...x, lista: false })), 150); },
      escolher: nome => { set(() => ({ texto: nome, escolhido: nome, lista: false })); setFocoForm(v => ({ chave: ch, seq: (v?.seq || 0) + 1 })); },
      confirmar,
      cancelar: () => setForms(x => { const y = { ...x }; delete y[ch]; return y; }),
      enter: () => {
        // lista aberta e nada escolhido: pega o primeiro da lista; senão confirma
        const primeiro = lista ? (lista.itens[0]?.nome || lista.adicionar) : null;
        if (primeiro && f && !f.escolhido) { set(() => ({ texto: primeiro, escolhido: primeiro, lista: false })); setFocoForm(v => ({ chave: ch, seq: (v?.seq || 0) + 1 })); }
        else confirmar();
      },
    };
  }

  function montarServicos() {
    if (!serv) return null;
    const t = aba as c.TipoServico;
    const titulo = c.SV[t].rotulo;
    if (!e.contas.length) return { titulo, vazio: 'Importe o balancete para vincular as contas.', categorias: [] as CategoriaView[] };
    const geral = c.SERV_CAT[t][0].nome;
    const categorias: CategoriaView[] = c.cadastroServicos(e, t).map(x => {
      const especifica = x.cat.id !== 'geral' && !x.cat.travado;
      return {
        id: x.cat.id, nome: x.cat.nome, lanc: x.cat.lanc, travado: !!x.cat.travado, dica: x.cat.dica,
        vinculo: vinculo(x.chaveConta),
        fornecedores: !especifica ? null : {
          itens: x.participantes.map(p => ({
            nome: p.nome,
            qtd: p.qtd != null ? p.qtd + ' ' + (p.qtd === 1 ? 'nota' : 'notas') : 'sem notas',
            tirar: () => { s.aplicar(y => c.tirarDaCategoria(y, t, p.nome)); limparUi(); toast(p.nome + ' voltou pra ' + geral + '.'); },
          })),
          form: formServ(t, x.cat.id),
          sugestoes: x.sugestoes.map(nome => ({ nome, colocar: () => irParaForm(t, x.cat.id, nome) })),
        },
      };
    });
    return { titulo, vazio: '', categorias, tituloGeral: geral };
  }

  return {
    aba, abas, mudarAba, serv,
    naturezas: montarNaturezas(),
    servicos: montarServicos(),
    alternarVista, naoContabil, vista,
  };
}

/** Classe da etiqueta de grupo na lista de contas (grupoTag ~L2344). */
export function classeGrupo(g: c.Grupo | undefined): string {
  const cls = g ? ({ Ativo: 'g-a', Passivo: 'g-p', Despesa: 'g-d', Receita: 'g-r' } as Partial<Record<c.Grupo, string>>)[g] : undefined;
  return cls ? 'grupo-tag ' + cls : 'grupo-tag';
}
