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

export type PaginaDoArquivo = 'caixas' | 'arquivar' | 'encontrar' | 'retirados' | 'devolucao';

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
  // os envelopes impressos que aguardam quem arquive (19/11/2026: "o responsável imprime, coloca o envelope, e outra pessoa
  // arquiva"): a fila da página A arquivar, o mês "Impresso" na grade e a confirmação ao guardar pelo QR
  const imp = repo.impressos();
  const aguardando = useMemo(() => af.aguardandoArquivamento(imp.lista, caixas), [imp.lista, caixas]);
  const aguardandoPorCodigo = useMemo(() => new Map(aguardando.map(x => [x.id, x])), [aguardando]);
  const hoje = formatos.diaEmBrasilia();
  // as caixas que já completaram os 2 anos no escritório e podem voltar para o cliente (19/11/2026)
  const vencidas = useMemo(() => af.paraDevolver(caixas, hoje), [caixas, hoje]);
  /** a volta para o cliente sendo registrada: a caixa e quem recebe */
  const [devolvendo, setDevolvendo] = useState<{ caixa: string; para: string } | null>(null);

  // ------------------------------------------------------------------------------------------- a caixa aberta
  const idAberta = params.get('caixa');
  const envelopeEmDestaque = params.get('envelope');
  const aberta = idAberta ? caixas.find(c => c.id === idAberta) || null : null;
  /** o QR abriu uma caixa que a lista não tem (apagada, ou de outro banco) */
  const abertaSumiu = !!idAberta && estado.carregada && !aberta;
  const mudarParams = (f: (p: URLSearchParams) => void) => setParams(p => { const n = new URLSearchParams(p); f(n); return n; }, { replace: false });
  // o que está escolhido na grade da caixa: o id de um envelope, 'mes:AAAA-MM' (um mês que não está na caixa) ou 'novo'
  // (outro envelope: o ano todo, uma observação); sem escolha, o envelope do QR
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [obsNova, setObsNova] = useState('');
  const [compNova, setCompNova] = useState('');
  const [retirando, setRetirando] = useState<RetiradaEmAndamento | null>(null);
  const [ocupado, setOcupado] = useState(false);
  // a impressão das prateleiras e das fileiras
  const [prateleiras, setPrateleiras] = useState<{ prateleiras: string; fileiras: string } | null>(null);

  // ------------------------------------------------------------------------------------------- o envelope lido pelo QR
  // (19/11/2026: o QR do envelope abre o ENVELOPE — onde está, retirar, devolver — e, se ainda não está em caixa nenhuma,
  // guarda ele com um toque: "facilitando a pessoa que vai fazer isso")
  const refLida = useMemo(() => af.lerCodigoDoEnvelope(params.get('envelope-lido') || ''), [params]);
  const achadoLido = useMemo(() => (refLida && estado.carregada ? af.procurarEnvelope(caixas, refLida) : null), [refLida, caixas, estado.carregada]);
  const empresaLida = refLida ? EMPRESAS.find(e => e.codigo === refLida.codigo) || null : null;
  /** o lugar da caixa nova, quando o envelope não tem caixa onde entrar */
  const [lugarNovo, setLugarNovo] = useState<{ prateleira: string; fileira: string }>({ prateleira: '', fileira: '' });

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
    exemplos: repo.exemplos, carregada: estado.carregada, erro: estado.erro, total: caixas.length, eu, ocupado,
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

    // A arquivar
    aguardando, impressosCarregados: imp.carregada, erroDosImpressos: imp.erro,
    /** o envelope impresso que aguarda, pelo mês da caixa (o mês "Impresso" na grade) */
    impressoDoMes: (c: af.Caixa, competencia: string) => aguardandoPorCodigo.get(af.codigoDoEnvelope({ codigo: c.codigo, departamento: c.departamento, competencia })) || null,
    /** abre o envelope da fila como se o QR tivesse sido lido */
    arquivar(x: af.EnvelopeImpresso) { setRetirando(null); mudarParams(p => { p.delete('caixa'); p.delete('envelope'); p.set('envelope-lido', x.id); }); },
    /** a etiqueta de um mês que ainda não está na caixa: imprime e põe o envelope na fila de quem arquiva */
    async registrarImpressao(c: af.Caixa, competencia: string) {
      const novos = af.novosImpressos([{ ref: { codigo: c.codigo, departamento: c.departamento, competencia }, nome: c.nome }], caixas, eu, agora());
      if (novos.length) await fazer(() => repo.registrarImpressos(novos), '');
    },

    // Retirados e Descarte
    fora, vencidas, anosNoEscritorio: af.ANOS_NO_ESCRITORIO,
    /** desde quando a caixa pode voltar para o cliente ('01/01/2029') */
    liberadaEm: (c: af.Caixa) => dataBr(af.devolucaoLiberadaEm(c)),
    devolvendo,
    comecarDevolucao(c: af.Caixa) { setDevolvendo({ caixa: c.id, para: '' }); },
    mudarDevolucao(para: string) { setDevolvendo(d => (d ? { ...d, para } : d)); },
    cancelarDevolucao() { setDevolvendo(null); },

    // a caixa aberta
    aberta, abertaSumiu, envelopeEmDestaque,
    abrir(id: string, envelope?: string) { setEscolhido(null); setObsNova(''); setRetirando(null); mudarParams(p => { p.set('caixa', id); if (envelope) p.set('envelope', envelope); else p.delete('envelope'); }); },
    fechar() { setRetirando(null); setEscolhido(null); mudarParams(p => { p.delete('caixa'); p.delete('envelope'); }); },
    /** a grade da caixa: os 12 meses e os outros envelopes */
    grade: aberta ? af.gradeDaCaixa(aberta) : null,
    /** o escolhido na grade (sem escolha, o envelope do QR) */
    escolhido: escolhido ?? envelopeEmDestaque,
    /** toca num mês ou envelope; tocar de novo fecha */
    escolher(x: string) {
      setRetirando(null); setObsNova('');
      const atual = escolhido ?? envelopeEmDestaque;
      if (x === 'novo') setCompNova(aberta ? String(aberta.ano) : '');
      setEscolhido(atual === x ? '' : x);
    },
    obsNova, setObsNova, compNova, setCompNova,
    /** as competências que dá para escolher no "outro envelope": o ano todo e os 12 meses */
    competenciasDaCaixa: aberta ? [String(aberta.ano), ...MESES_DO_ANO.map((_, i) => aberta.ano + '-' + String(i + 1).padStart(2, '0'))] : [],
    /** guarda um envelope (o mês tocado, ou o "outro envelope") */
    async guardar(competencia: string) {
      const c = aberta;
      if (!c || !competencia) return;
      const obs = obsNova;
      let novo = '';
      const ok = await fazer(() => repo.mudar(c.id, atual => {
        const r = af.adicionarEnvelopes(atual, [competencia], atual.departamento, obs, eu, agora());
        novo = r.caixa.envelopes.find(e => e.competencia === competencia && e.observacao === obs.trim())?.id || '';
        return { caixa: r.caixa, problema: r.novos ? '' : 'Esse envelope já está na caixa.' };
      }), 'Envelope ' + af.rotuloDaCompetencia(competencia) + ' guardado.');
      if (ok) {
        setObsNova(''); setEscolhido(novo || '');
        // o envelope estava impresso, esperando quem arquive: guardar é a confirmação
        const cod = af.codigoDoEnvelope({ codigo: c.codigo, departamento: c.departamento, competencia });
        if (aguardandoPorCodigo.has(cod)) await repo.confirmarArquivamento(cod, c.id, eu, agora());
      }
    },
    /** os meses que faltam, de uma vez */
    async completarOAno() {
      const c = aberta;
      if (!c) return;
      const faltam = af.gradeDaCaixa(c).meses.filter(m => !m.envelope).map(m => m.competencia);
      if (!faltam.length) return;
      await fazer(() => repo.mudar(c.id, atual => {
        const r = af.adicionarEnvelopes(atual, faltam, atual.departamento, '', eu, agora());
        return { caixa: r.caixa, problema: r.novos ? '' : 'Os meses já estão na caixa.' };
      }), faltam.length === 1 ? '1 envelope guardado.' : faltam.length + ' envelopes guardados.');
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
      if (await fazer(() => repo.mudar(c.id, atual => af.removerEnvelope(atual, envelope.id, eu, agora())), 'Envelope tirado da caixa.')) setEscolhido('');
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

    // a volta para o cliente e apagar
    /** registra que a caixa voltou para o cliente, com quem recebeu */
    async confirmarDevolucao() {
      const d = devolvendo;
      if (!d) return;
      if (await fazer(() => repo.mudar(d.caixa, atual => af.devolverAoCliente(atual, eu, d.para, formatos.diaEmBrasilia())), 'Caixa registrada como entregue ao cliente.')) setDevolvendo(null);
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

    // o envelope lido pelo QR
    lido: refLida && achadoLido ? {
      ref: refLida, achado: achadoLido, codigo: af.codigoDoEnvelope(refLida),
      // o nome da caixa (o mesmo da etiqueta); sem caixa, o do Cadastro
      empresa: achadoLido.situacao === 'guardado' ? achadoLido.caixa.nome : achadoLido.caixas[0]?.nome || (empresaLida ? empresaLida.nome : 'Empresa ' + refLida.codigo),
      /** a caixa nova que seria criada (quando não há caixa da empresa, do ano e do departamento) */
      numeroNovo: af.proximoNumero(caixas, refLida.codigo, af.anoDoEnvelope(refLida), refLida.departamento),
    } : null,
    /** o QR de um envelope que não é do nads (o código não vale) */
    lidoInvalido: !!params.get('envelope-lido') && !refLida,
    /** quem imprimiu o envelope lido e quando (se ele está na fila de arquivamento) */
    impressoLido: refLida ? aguardandoPorCodigo.get(af.codigoDoEnvelope(refLida)) || null : null,
    fecharLido() { setRetirando(null); mudarParams(p => p.delete('envelope-lido')); },
    lugarNovo, mudarLugarNovo(campos: Partial<{ prateleira: string; fileira: string }>) { setLugarNovo(l => ({ ...l, ...campos })); },
    /** guarda o envelope lido numa caixa que já existe */
    async guardarLido(caixaId: string) {
      const ref = refLida;
      if (!ref) return;
      const quando = agora();
      const ok = await fazer(() => repo.mudar(caixaId, atual => {
        const res = af.adicionarEnvelopes(atual, [ref.competencia], ref.departamento, '', eu, quando);
        return { caixa: res.caixa, problema: res.novos ? '' : 'Esse envelope já está nessa caixa.' };
      }), 'Arquivamento confirmado: envelope ' + af.rotuloDaCompetencia(ref.competencia) + ' guardado na caixa.');
      // a confirmação do arquivamento: o envelope sai da fila, com quem arquivou e quando
      if (ok) await repo.confirmarArquivamento(af.codigoDoEnvelope(ref), caixaId, eu, quando);
    },
    /** cria a caixa da empresa, do ano e do departamento do envelope lido, já com ele dentro */
    async criarCaixaDoLido() {
      const ref = refLida;
      if (!ref) return;
      const ano = af.anoDoEnvelope(ref);
      const numero = af.proximoNumero(caixas, ref.codigo, ano, ref.departamento);
      const p = Number(lugarNovo.prateleira), fi = Number(lugarNovo.fileira);
      const local = p > 0 && fi > 0 ? af.rotuloDoLugar({ prateleira: p, fileira: fi }) : '';
      const quando = agora();
      const rascunho: af.RascunhoDaCaixa = {
        codigo: ref.codigo, nome: empresaLida ? empresaLida.nome : 'Empresa ' + ref.codigo, tipo: tipoDa(empresaLida?.regime || '', ref.departamento),
        departamento: ref.departamento, ano, numero, arquivadaEm: formatos.diaEmBrasilia(), local, observacoes: '',
      };
      const problema = af.problemaDaCaixa(rascunho, caixas, null, anoDeHoje());
      if (problema) { toast(problema); return; }
      const c = af.adicionarEnvelopes(af.montarCaixa(rascunho, eu, quando), [ref.competencia], ref.departamento, '', eu, quando).caixa;
      if (await fazer(() => repo.criar(c), 'Arquivamento confirmado: caixa ' + af.codigoDaCaixa(numero) + ' criada, com o envelope ' + af.rotuloDaCompetencia(ref.competencia) + ' dentro.')) {
        await repo.confirmarArquivamento(af.codigoDoEnvelope(ref), c.id, eu, quando);
      }
    },
    /** retira o envelope lido (quem leva e para quê, no mesmo formulário da caixa) */
    async confirmarRetiradaDoLido() {
      const r = retirando, a = achadoLido;
      if (!r || !a || a.situacao !== 'guardado') return;
      if (await fazer(() => repo.mudar(a.caixa.id, atual => af.retirar(atual, { envelope: a.envelope.id }, r.quem, r.motivo, agora())), 'Retirada do envelope registrada.')) setRetirando(null);
    },
    /** da janela do envelope para a caixa dele */
    abrirCaixaDoLido(caixaId: string, envelopeId: string) { setRetirando(null); mudarParams(p => { p.delete('envelope-lido'); p.set('caixa', caixaId); p.set('envelope', envelopeId); }); },

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
