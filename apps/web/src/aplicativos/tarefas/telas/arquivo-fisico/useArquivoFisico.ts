// ViewModel do Arquivo físico (19/11/2026: "os documentos ficam em caixas, e dentro de cada caixa há envelopes … quero saber
// o que tem em cada caixa e encontrar um documento de forma mais fácil"). As páginas: Caixas (a lista com os filtros),
// Encontrar (empresa, departamento, ano e mês → a caixa, o local e o envelope), Retirados (o que está fora, com a
// devolução) e Descarte (o que passou do prazo de guarda; descartar é só do admin). A caixa abre numa janela, também pelo
// endereço (?caixa=…&envelope=…), que é o que o QR da etiqueta abre no celular. As regras ficam no core (arquivoFisico).
import { arquivoFisico as af, empresas, formatos, tarefas as t } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useOperador } from '../../casca/operador';
import { useArquivoFisico as useRepoDoArquivo } from '../../dados/repo';

export type PaginaDoArquivo = 'caixas' | 'encontrar' | 'retirados' | 'descarte';

export interface EmpresaDoArquivo { codigo: number; nome: string; regime: string }

/** As empresas do Cadastro com código (a caixa sempre leva o código). */
const EMPRESAS: readonly EmpresaDoArquivo[] = empresas.EMPRESAS.filter(e => e.codigo != null).map(e => ({ codigo: e.codigo as number, nome: e.nome, regime: e.regime }));

export const MESES_DO_ANO = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** O formulário da caixa: a nova (com os meses já marcados para virar envelopes) ou a que está sendo mudada. */
export interface FormDaCaixa extends af.RascunhoDaCaixa {
  /** a busca da empresa no campo (o código ou o nome) */
  empresaTexto: string;
  /** a nova já com os envelopes de janeiro a dezembro */
  comOsMeses: boolean;
  /** o tipo foi digitado (aí não segue o departamento) */
  tipoManual: boolean;
  /** a data do arquivamento como se digita no campo do nads ('19/11/2026'); vira arquivadaEm quando está completa */
  arquivadaTexto: string;
}

/** A retirada sendo preenchida: de quem (a caixa ou um envelope), quem leva e para quê. */
export interface RetiradaEmAndamento { alvo: af.Alvo; quem: string; motivo: string }

const anoDeHoje = () => Number(formatos.diaEmBrasilia().slice(0, 4));
const tipoDa = (regime: string, d: af.Departamento) => t.tipoNaEtiqueta(regime, d);
const dataBr = (iso: string) => (/^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10).split('-').reverse().join('/') : '');

export function useArquivoFisico(pagina: PaginaDoArquivo) {
  const repo = useRepoDoArquivo();
  const { toast, modal } = useRetorno();
  const op = useOperador().operador;
  const eu = op?.nome || '';
  const podeDescartar = !!op?.admin;
  const [params, setParams] = useSearchParams();
  const estado = repo.caixas();
  const caixas = estado.lista;

  // ------------------------------------------------------------------------------------------------- a lista (Caixas)
  const [filtro, setFiltro] = useState<af.FiltroDoArquivo>(af.FILTRO_VAZIO);
  // ---------------------------------------------------------------------------------------- a busca rápida (Encontrar)
  const [procura, setProcura] = useState<af.FiltroDoArquivo>({ ...af.FILTRO_VAZIO, ano: anoDeHoje() });
  // o lugar vem do endereço (o QR da etiqueta da fileira abre a lista das caixas dela)
  const localNoEndereco = params.get('local') || '';
  const achados = useMemo(() => af.buscar(caixas, pagina === 'encontrar' ? procura : { ...filtro, local: localNoEndereco }), [caixas, pagina, procura, filtro, localNoEndereco]);
  /** a Encontrar só mostra resultado depois de dizer alguma coisa */
  const procurou = !!(procura.texto.trim() || procura.mes != null || procura.departamento);
  const anos = useMemo(() => {
    const a = new Set(af.anosDasCaixas(caixas));
    a.add(anoDeHoje());
    return [...a].sort((x, y) => y - x);
  }, [caixas]);

  // ---------------------------------------------------------------------------------------- Retirados e Descarte
  const fora = useMemo(() => af.emprestados(caixas, new Date()), [caixas]);
  const hoje = formatos.diaEmBrasilia();
  const vencidas = useMemo(() => af.paraDescartar(caixas, hoje), [caixas, hoje]);

  // ------------------------------------------------------------------------------------------- a caixa aberta
  const idAberta = params.get('caixa');
  const envelopeEmDestaque = params.get('envelope');
  const aberta = idAberta ? caixas.find(c => c.id === idAberta) || null : null;
  /** o QR abriu uma caixa que a lista não tem (apagada, ou de outro banco) */
  const abertaSumiu = !!idAberta && estado.carregada && !aberta;
  const mudarParams = (f: (p: URLSearchParams) => void) => setParams(p => { const n = new URLSearchParams(p); f(n); return n; }, { replace: false });
  const [mesesMarcados, setMesesMarcados] = useState<string[]>([]);
  const [obsDoEnvelope, setObsDoEnvelope] = useState('');
  const [retirando, setRetirando] = useState<RetiradaEmAndamento | null>(null);
  const [ocupado, setOcupado] = useState(false);
  // a impressão das prateleiras e das fileiras
  const [prateleiras, setPrateleiras] = useState<{ prateleiras: string; fileiras: string } | null>(null);

  // ------------------------------------------------------------------------------------------- o formulário
  const [form, setForm] = useState<FormDaCaixa | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const empresasAchadas = useMemo(() => {
    if (!form || editando) return [];
    const q = form.empresaTexto.trim();
    if (!q || (form.codigo != null && q === form.codigo + ' — ' + form.nome)) return [];
    return empresas.buscarEmpresas(EMPRESAS, q).slice(0, 8) as EmpresaDoArquivo[];
  }, [form, editando]);
  const problemaDoForm = form ? af.problemaDaCaixa(form, caixas, editando, anoDeHoje()) : '';

  /** grava pelo repositório; mostra o problema, se houver (devolve se deu certo) */
  async function fazer(acao: () => Promise<string>, feito: string): Promise<boolean> {
    if (ocupado) return false;
    setOcupado(true);
    try {
      const problema = await acao();
      if (problema) { toast(problema); return false; }
      if (feito) toast(feito);
      return true;
    } catch (e) {
      toast('Não deu: ' + (e instanceof Error ? e.message : String(e)));
      return false;
    } finally { setOcupado(false); }
  }
  const agora = () => new Date().toISOString();

  return {
    exemplos: repo.exemplos, carregada: estado.carregada, erro: estado.erro, total: caixas.length, eu, podeDescartar, ocupado,
    recarregar: () => repo.recarregar(),
    anos, departamentos: af.DEPARTAMENTOS,

    // Caixas
    filtro, achados,
    mudarFiltro(f: Partial<af.FiltroDoArquivo>) { setFiltro(x => ({ ...x, ...f })); },
    limparFiltro() { setFiltro(af.FILTRO_VAZIO); },
    /** o lugar escolhido pelo QR da fileira (vazio: todos) */
    local: localNoEndereco,
    tirarLocal() { mudarParams(p => p.delete('local')); },

    // a impressão das prateleiras (6 prateleiras de 6 fileiras, 19/11/2026)
    prateleiras,
    abrirPrateleiras() { setPrateleiras({ prateleiras: String(af.PRATELEIRAS_PADRAO), fileiras: String(af.FILEIRAS_PADRAO) }); },
    fecharPrateleiras() { setPrateleiras(null); },
    mudarPrateleiras(campos: Partial<{ prateleiras: string; fileiras: string }>) { setPrateleiras(x => (x ? { ...x, ...campos } : x)); },
    /** as quantidades valendo (de 1 ao teto) */
    contasDasPrateleiras() {
      return { prateleiras: af.quantidadeDeLugares(prateleiras?.prateleiras, af.PRATELEIRAS_PADRAO, af.MAXIMO_DE_PRATELEIRAS), fileiras: af.quantidadeDeLugares(prateleiras?.fileiras, af.FILEIRAS_PADRAO, af.MAXIMO_DE_FILEIRAS) };
    },

    // Encontrar
    procura, procurou,
    mudarProcura(f: Partial<af.FiltroDoArquivo>) { setProcura(x => ({ ...x, ...f })); },

    // Retirados e Descarte
    fora, vencidas, prazos: af.PRAZOS_PADRAO,
    liberadaEm: (c: af.Caixa) => dataBr(af.descarteLiberadoEm(c)),

    // a caixa aberta
    aberta, abertaSumiu, envelopeEmDestaque,
    abrir(id: string, envelope?: string) { setMesesMarcados([]); setObsDoEnvelope(''); setRetirando(null); mudarParams(p => { p.set('caixa', id); if (envelope) p.set('envelope', envelope); else p.delete('envelope'); }); },
    fechar() { setRetirando(null); mudarParams(p => { p.delete('caixa'); p.delete('envelope'); }); },
    mesesMarcados, obsDoEnvelope, setObsDoEnvelope,
    /** marca ou desmarca um mês ('AAAA-MM') ou o ano todo ('AAAA') */
    marcarMes(comp: string) { setMesesMarcados(ms => (ms.includes(comp) ? ms.filter(m => m !== comp) : [...ms, comp])); },
    /** os meses da caixa que ainda não têm envelope (o atalho "Os que faltam") */
    marcarOsQueFaltam() {
      if (!aberta) return;
      const tem = new Set(aberta.envelopes.filter(e => !e.observacao).map(e => e.competencia));
      setMesesMarcados(MESES_DO_ANO.map((_, i) => aberta.ano + '-' + String(i + 1).padStart(2, '0')).filter(m => !tem.has(m)));
    },
    async adicionarEnvelopes() {
      const c = aberta;
      if (!c || !mesesMarcados.length) return;
      let novos = 0, repetidos: string[] = [];
      const ok = await fazer(() => repo.mudar(c.id, atual => {
        const r = af.adicionarEnvelopes(atual, mesesMarcados, atual.departamento, obsDoEnvelope, eu, agora());
        novos = r.novos; repetidos = r.repetidos;
        return { caixa: r.caixa, problema: r.novos ? '' : 'Esses envelopes já estão na caixa.' };
      }), '');
      if (!ok) return;
      toast(novos === 1 ? '1 envelope guardado.' : novos + ' envelopes guardados.' + (repetidos.length ? ' (' + repetidos.length + ' já estavam na caixa)' : ''));
      setMesesMarcados([]); setObsDoEnvelope('');
    },
    async mudarObservacao(envelope: string, observacao: string) {
      const c = aberta;
      if (!c) return;
      await fazer(() => repo.mudar(c.id, atual => ({ caixa: af.mudarEnvelope(atual, envelope, { observacao }, eu, agora()), problema: '' })), 'Observação salva.');
    },
    async removerEnvelope(envelope: af.Envelope) {
      const c = aberta;
      if (!c) return;
      const sim = await modal<boolean>({ icone: 'alert', titulo: 'Tirar o envelope ' + af.rotuloDaCompetencia(envelope.competencia) + ' da caixa?', texto: 'Ele sai do controle desta caixa (o papel continua onde estiver).',
        botoes: [{ rotulo: 'Voltar', valor: false, variante: 'btn-outline' }, { rotulo: 'Tirar', valor: true, variante: 'btn-danger' }] });
      if (!sim) return;
      await fazer(() => repo.mudar(c.id, atual => af.removerEnvelope(atual, envelope.id, eu, agora())), 'Envelope tirado da caixa.');
    },

    // retirar e devolver
    retirando,
    comecarRetirada(envelope: string | null) { setRetirando({ alvo: { envelope }, quem: eu, motivo: '' }); },
    mudarRetirada(campos: Partial<Pick<RetiradaEmAndamento, 'quem' | 'motivo'>>) { setRetirando(r => (r ? { ...r, ...campos } : r)); },
    cancelarRetirada() { setRetirando(null); },
    async confirmarRetirada() {
      const c = aberta, r = retirando;
      if (!c || !r) return;
      if (await fazer(() => repo.mudar(c.id, atual => af.retirar(atual, r.alvo, r.quem, r.motivo, agora())), r.alvo.envelope ? 'Retirada do envelope registrada.' : 'Retirada da caixa registrada.')) setRetirando(null);
    },
    async devolver(caixa: string, envelope: string | null) {
      await fazer(() => repo.mudar(caixa, atual => af.devolver(atual, { envelope }, eu, agora())), envelope ? 'Envelope de volta na caixa.' : 'Caixa de volta no lugar.');
    },

    // descartar e apagar
    async descartar(c: af.Caixa) {
      if (!podeDescartar) return;
      const sim = await modal<boolean>({ icone: 'alert', titulo: 'Marcar a caixa ' + af.rotuloDaCaixa(c) + ' como descartada?', texto: 'Ela continua na lista, marcada como descartada, com a data e quem descartou.',
        botoes: [{ rotulo: 'Voltar', valor: false, variante: 'btn-outline' }, { rotulo: 'Descartada', valor: true, variante: 'btn-danger' }] });
      if (!sim) return;
      await fazer(() => repo.mudar(c.id, atual => af.descartar(atual, eu, formatos.diaEmBrasilia())), 'Caixa marcada como descartada.');
    },
    async apagar(c: af.Caixa) {
      const sim = await modal<boolean>({ icone: 'alert', titulo: 'Apagar a caixa ' + af.rotuloDaCaixa(c) + '?', texto: 'Só a caixa vazia (criada por engano) pode ser apagada.',
        botoes: [{ rotulo: 'Voltar', valor: false, variante: 'btn-outline' }, { rotulo: 'Apagar', valor: true, variante: 'btn-danger' }] });
      if (!sim) return;
      if (await fazer(() => repo.excluir(c.id), 'Caixa apagada.')) mudarParams(p => { p.delete('caixa'); p.delete('envelope'); });
    },

    // o formulário da caixa
    form, editando, empresasAchadas, problemaDoForm,
    /** a prateleira e a fileira do local do formulário (null: texto livre) */
    lugarDoForm: form ? af.lerLugar(form.local) : null,
    lugaresPossiveis: { prateleiras: Array.from({ length: af.PRATELEIRAS_PADRAO }, (_, i) => i + 1), fileiras: Array.from({ length: af.FILEIRAS_PADRAO }, (_, i) => i + 1) },
    /** escolheu a prateleira ou a fileira: o local vira 'Prateleira 3 · Fileira 2' */
    escolherLugar(l: Partial<af.Lugar>) {
      setForm(f => {
        if (!f) return f;
        const atual = af.lerLugar(f.local) || { prateleira: 1, fileira: 1 };
        return { ...f, local: af.rotuloDoLugar({ ...atual, ...l }) };
      });
    },
    /** a caixa nova; com uma empresa já escolhida (o botão dentro de outra caixa), o próximo código dela */
    novaCaixa(base?: Pick<af.Caixa, 'codigo' | 'nome' | 'tipo' | 'departamento' | 'ano' | 'local'>) {
      setEditando(null);
      const ano = base?.ano ?? anoDeHoje();
      const departamento = base?.departamento ?? 'Fiscal';
      setForm({
        codigo: base?.codigo ?? null, nome: base?.nome ?? '', empresaTexto: base ? base.codigo + ' — ' + base.nome : '', tipo: base?.tipo ?? '', tipoManual: false,
        departamento, ano, numero: base ? af.proximoNumero(caixas, base.codigo, ano, departamento) : 1,
        arquivadaEm: formatos.diaEmBrasilia(), arquivadaTexto: dataBr(formatos.diaEmBrasilia()), local: base?.local ?? '', observacoes: '', comOsMeses: true,
      });
    },
    editarCaixa(c: af.Caixa) {
      setEditando(c.id);
      setForm({ codigo: c.codigo, nome: c.nome, empresaTexto: c.codigo + ' — ' + c.nome, tipo: c.tipo, tipoManual: true, departamento: c.departamento, ano: c.ano, numero: c.numero, arquivadaEm: c.arquivadaEm, arquivadaTexto: dataBr(c.arquivadaEm), local: c.local, observacoes: c.observacoes, comOsMeses: false });
    },
    fecharForm() { setForm(null); setEditando(null); },
    mudarForm(campos: Partial<FormDaCaixa>) {
      setForm(f => {
        if (!f) return f;
        const n = { ...f, ...campos };
        if ('empresaTexto' in campos) { n.codigo = null; n.nome = ''; if (!n.tipoManual) n.tipo = ''; }
        if ('tipo' in campos) n.tipoManual = true;
        // a data digitada: completa ('dd/mm/aaaa') vira 'aaaa-mm-dd'; pela metade, fica sem data (o formulário avisa)
        if ('arquivadaTexto' in campos) { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(n.arquivadaTexto); n.arquivadaEm = m ? m[3] + '-' + m[2] + '-' + m[1] : ''; }
        // a empresa, o ano ou o departamento mudaram: o tipo segue o departamento e o código vai para o próximo livre
        if (!editando && n.codigo != null && n.ano != null && ('departamento' in campos || 'ano' in campos)) n.numero = af.proximoNumero(caixas, n.codigo, n.ano, n.departamento);
        if (!n.tipoManual && n.codigo != null) n.tipo = tipoDa(EMPRESAS.find(e => e.codigo === n.codigo)?.regime || '', n.departamento);
        return n;
      });
    },
    escolherEmpresa(e: EmpresaDoArquivo) {
      setForm(f => (f ? {
        ...f, codigo: e.codigo, nome: e.nome, empresaTexto: e.codigo + ' — ' + e.nome, tipo: f.tipoManual ? f.tipo : tipoDa(e.regime, f.departamento),
        numero: f.ano != null ? af.proximoNumero(caixas, e.codigo, f.ano, f.departamento) : f.numero,
      } : f));
    },
    async salvarForm() {
      const f = form;
      if (!f || problemaDoForm) { if (problemaDoForm) toast(problemaDoForm); return; }
      const quando = agora();
      if (editando) {
        const id = editando;
        if (await fazer(() => repo.mudar(id, atual => ({ caixa: af.montarCaixa(f, eu, quando, atual), problema: '' })), 'Caixa salva.')) { setForm(null); setEditando(null); }
        return;
      }
      let c = af.montarCaixa(f, eu, quando);
      if (f.comOsMeses && f.ano != null) c = af.adicionarEnvelopes(c, MESES_DO_ANO.map((_, i) => f.ano + '-' + String(i + 1).padStart(2, '0')), c.departamento, '', eu, quando).caixa;
      if (await fazer(() => repo.criar(c), 'Caixa ' + af.codigoDaCaixa(c.numero) + ' criada.')) {
        setForm(null);
        mudarParams(p => { p.set('caixa', c.id); p.delete('envelope'); });
      }
    },

    // textos prontos
    rotulo: af.rotuloDaCaixa,
    codigo: af.codigoDaCaixa,
    competencia: af.rotuloDaCompetencia,
    meses: af.mesesDaCaixa,
    situacao: af.situacaoDaCaixa,
    rotuloDaSituacao: (s: af.SituacaoDaCaixa) => af.ROTULO_DA_SITUACAO[s],
    retiradaAberta: af.retiradaAberta,
    dataBr,
    /** 'ISO' → '19/11/2026 14:05' */
    quando: (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); },
  };
}

export type VmDoArquivo = ReturnType<typeof useArquivoFisico>;
