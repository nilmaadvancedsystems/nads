// ViewModel do "Pedir extratos": a janela do pedido de documentos (e-mail obrigatório — é a relação formal —
// e, se a pessoa quiser, WhatsApp junto, com a mensagem que ela digita) e o histórico dos pedidos.
// Duas etapas: montar (para quem, os documentos — cada um com os seus meses —, o prazo e o WhatsApp) e
// conferir (o e-mail como o cliente vai ver). Documento de um mês já importado no sistema ou já achado no
// Drive fica travado. O contato vem do cadastro de clientes do Entregas (mesmo login do Drive); o e-mail vai
// para a fila do robô do Entregas com o HTML montado aqui (regras/email.ts); o WhatsApp abre pelo link wa.me.
// Cada pedido fica no histórico da empresa (extrator/{empresa}.pedidos).
import { creditor, extrator as x, tarefas } from '@nads/core';
import { useState } from 'react';
import { useDrive } from '../../dados/repo';

/** O que o pedido usa da tela (a etapa passa o ViewModel dela; a prévia passa um de exemplo). */
export interface VmDoPedido {
  competencia: string;
  competencias: { valor: string; rotulo: string }[];
  bancos: { id: string; nome: string; marca: string; conta: string; extrato: { qtdArquivos: number } }[];
  /** o extrato do banco naquela competência já foi importado no sistema? */
  extratoImportado(banco: string, competencia: string): boolean;
  pedidos: x.PedidoRegistrado[];
  registrarPedido(reg: x.PedidoRegistrado): void;
  avisar(titulo: string): void;
  avisarErro(titulo: string, detalhe: string): void;
}

/** As imagens do e-mail (endereços completos, publicados no site). */
export interface ImagensDoEmail { logo: string; logoDoBanco: (marca: string) => string | null }

/** O WhatsApp do escritório (o botão no fim do e-mail). */
const WHATSAPP_DO_ESCRITORIO = { numero: '553891383638', rotulo: '(38) 9138-3638' };

type Travado = '' | 'no Drive' | 'importado';

const mensagemDeErro = (e: unknown) => (e instanceof Error ? e.message : String(e));
const alternar = (lista: string[], v: string) => (lista.includes(v) ? lista.filter(i => i !== v) : [...lista, v]);
const paraData = (br: string) => (/^\d{2}\/\d{2}\/\d{4}$/.test(br) ? br.slice(6) + '-' + br.slice(3, 5) + '-' + br.slice(0, 2) : '');
const deData = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.slice(8) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '');

/** Quem está pedindo: a pessoa escolhida na Tarefas (mesmo endereço) ou quem entrou no Entregas. */
function quemPede(acesso: creditor.AcessoDrive): string {
  try { return localStorage.getItem('nads-tarefas-operador') || acesso.quem || 'nads'; } catch { return acesso.quem || 'nads'; }
}

export function usePedirExtratos(vm: VmDoPedido, codigo: number | null, empresa: string, semMovimento: string[], pedirLogin: (depois: () => void) => void, imagens: ImagensDoEmail) {
  const { drive, acesso } = useDrive();
  const [etapa, setEtapa] = useState<'fechado' | 'montar' | 'conferir'>('fechado');
  const [contato, setContato] = useState<{ carregando: boolean; erro: string; dados: creditor.ContatoDoCliente | null }>({ carregando: false, erro: '', dados: null });
  // de qual Gmail sai (o do setor de quem pede, a mesma regra do robô); null = não se sabe (aberto dentro do Entregas)
  const [de, setDe] = useState<{ carregando: boolean; email: string; respostas: string; erro: string } | null>(null);
  // o que está marcado: 'documento|competência'
  const [marcados, setMarcados] = useState<string[]>([]);
  // os documentos com a lista de "Outros meses" aberta
  const [mesesAbertos, setMesesAbertos] = useState<string[]>([]);
  const [pasta, setPasta] = useState<{ raiz: string; itens: creditor.ItemDrive[] } | null>(null);
  const [extras, setExtras] = useState<x.DocumentoDoPedido[]>([]);
  const [prazo, setPrazo] = useState('');
  const [emails, setEmails] = useState<string[]>([]);
  const [whats, setWhats] = useState({ ligado: false, texto: '', editado: false });
  const [enviando, setEnviando] = useState('');
  const [historico, setHistorico] = useState<{ aberto: boolean; situacoes: Record<string, creditor.SituacaoDoEmail>; erro: string }>({ aberto: false, situacoes: {}, erro: '' });

  async function carregarRemetente() {
    if (!drive.remetente) { setDe(null); return; }
    setDe({ carregando: true, email: '', respostas: '', erro: '' });
    try {
      const r = await drive.remetente();
      setDe({ carregando: false, email: r.email, respostas: r.respostas, erro: r.email ? '' : 'O Gmail do setor fiscal ainda não foi autorizado: o robô não consegue enviar.' });
    } catch (e) {
      setDe({ carregando: false, email: '', respostas: '', erro: mensagemDeErro(e) });
    }
  }

  async function carregarContato() {
    if (codigo == null) { setContato({ carregando: false, erro: 'A empresa não tem o código do ERP para achar no cadastro.', dados: null }); return; }
    if (!drive.contatoDoCliente) { setContato({ carregando: false, erro: 'Aberto dentro do Entregas: peça pela tela de Pendências.', dados: null }); return; }
    setContato({ carregando: true, erro: '', dados: null });
    try {
      const dados = await drive.contatoDoCliente(codigo);
      setContato({ carregando: false, erro: dados ? '' : 'A empresa ' + codigo + ' não está no cadastro de clientes do Entregas.', dados });
      setEmails(dados?.emails.slice(0, 1) || []);
    } catch (e) {
      setContato({ carregando: false, erro: mensagemDeErro(e), dados: null });
    }
  }

  /** A pasta do cliente no Drive (para saber o que já está lá); sem pasta ou sem acesso, nada fica travado por ela. */
  async function carregarPasta() {
    setPasta(null);
    try { const p = await drive.pastaDoCliente(codigo); setPasta(p ? { raiz: p.raiz, itens: p.itens } : null); } catch { setPasta(null); }
  }

  const precisaEntrar = () => !acesso.entrou && !drive.exemplos;
  const chave = (doc: string, comp: string) => doc + '|' + comp;
  // os meses que dá para pedir: o da tela primeiro, depois os anteriores
  const meses = [vm.competencia, ...vm.competencias.map(c => c.valor).filter(c => c !== vm.competencia)];

  /** Por que o documento daquele mês não dá para pedir ('' = dá): já importado no sistema ou já no Drive. */
  function travado(docId: string, comp: string): Travado {
    if (!docId.startsWith('extrato:')) return '';
    const b = vm.bancos.find(bb => 'extrato:' + bb.id === docId);
    if (!b) return '';
    if (vm.extratoImportado(b.id, comp)) return 'importado';
    if (pasta && x.acharExtratoNoDrive(pasta.itens, pasta.raiz, comp, { nome: b.nome, marca: b.marca, conta: b.conta || undefined }).situacao === 'achou') return 'no Drive';
    return '';
  }

  function abrir() {
    if (precisaEntrar()) {
      if (drive.loginDeFora) { vm.avisarErro('Entre no Entregas', 'O pedido usa o cadastro de clientes do Entregas.'); return; }
      pedirLogin(() => abrir());
      return;
    }
    // já marcados: os extratos do mês da tela que ainda faltam (não importados e não sem movimento)
    setMarcados(vm.bancos.filter(b => !vm.extratoImportado(b.id, vm.competencia) && !semMovimento.includes(b.id)).map(b => chave('extrato:' + b.id, vm.competencia)));
    setMesesAbertos([]); setExtras([]); setEnviando('');
    setPrazo(x.prazoPadrao(new Date()));
    setWhats({ ligado: false, texto: '', editado: false });
    setEtapa('montar');
    void carregarContato();
    void carregarPasta();
    void carregarRemetente();
  }

  const catalogo = [...x.documentosDoPedido(vm.bancos.map(b => ({ id: b.id, nome: b.nome, marca: b.marca, conta: b.conta || undefined }))), ...extras];
  const vale = (docId: string, comp: string) => marcados.includes(chave(docId, comp)) && !travado(docId, comp);
  const documentosDoPedido = catalogo
    .map(d => ({ ...d, competencias: meses.filter(c => vale(d.id, c)).sort() }))
    .filter(d => d.competencias.length);
  const compsDoPedido = [...new Set(documentosDoPedido.flatMap(d => d.competencias))].sort();
  const pedido: x.PedidoDeExtratos = {
    cliente: contato.dados?.nome || empresa,
    documentos: documentosDoPedido,
    competencias: compsDoPedido.length ? compsDoPedido : [vm.competencia],
  };
  const textoWhats = whats.editado ? whats.texto : x.textoDoWhatsApp(pedido, prazo);
  const telefone = contato.dados ? x.telefoneParaWhatsApp(contato.dados.telefone) : '';
  const html = etapa === 'conferir' ? x.htmlDoPedido({ pedido, prazo, enviadoEm: new Date(), logo: imagens.logo, logoDoBanco: imagens.logoDoBanco, whatsapp: WHATSAPP_DO_ESCRITORIO }) : '';
  const podeContinuar = !!contato.dados && emails.length > 0 && pedido.documentos.length > 0 && (!whats.ligado || !!telefone) && !de?.erro;

  async function enviar() {
    if (!podeContinuar || enviando || !contato.dados || !drive.pedirEmail) return;
    const assunto = x.assuntoDoPedido(pedido);
    const corpo = x.textoDoPedido(pedido, prazo);
    try {
      const solicitacoes: string[] = [];
      let naFila = false;
      for (const para of emails) {
        setEnviando('Enviando para ' + para);
        const r = await drive.pedirEmail({ contato: contato.dados, para, assunto, corpo, html, competencia: x.competenciaDoPedido(pedido) }, passo => setEnviando(passo));
        solicitacoes.push(r.id);
        if (r.situacao !== 'enviado') naFila = true;
      }
      vm.registrarPedido({
        id: Date.now().toString(36), em: new Date().toISOString(), por: quemPede(acesso),
        competencias: pedido.competencias, documentos: pedido.documentos.map(d => x.nomeComCompetencias(d, pedido)), prazo,
        email: { para: emails, assunto, solicitacoes },
        ...(whats.ligado && contato.dados ? { whatsapp: { telefone: contato.dados.telefone, texto: textoWhats } } : {}),
      });
      setEtapa('fechado');
      vm.avisar(naFila ? 'Pedido na fila do robô do Entregas: o e-mail sai assim que ele estiver online' : 'E-mail enviado para ' + emails.join(', '));
    } catch (e) {
      vm.avisarErro('O e-mail não foi', mensagemDeErro(e));
    } finally {
      setEnviando('');
    }
  }

  async function abrirHistorico() {
    setHistorico({ aberto: true, situacoes: {}, erro: '' });
    const ids = vm.pedidos.flatMap(p => p.email?.solicitacoes || []);
    if (!ids.length || !drive.situacaoDosEmails || precisaEntrar()) return;
    try { const s = await drive.situacaoDosEmails(ids); setHistorico(h => ({ ...h, situacoes: s })); }
    catch (e) { setHistorico(h => ({ ...h, erro: mensagemDeErro(e) })); }
  }

  const rotuloMes = (c: string) => tarefas.rotuloCurtoCompetencia(c);
  return {
    aberto: etapa !== 'fechado', etapa,
    abrir, fechar: () => { if (!enviando) setEtapa('fechado'); },
    continuar: () => { if (podeContinuar) setEtapa('conferir'); },
    voltar: () => { if (!enviando) setEtapa('montar'); },
    exemplos: drive.exemplos,
    contato,
    /** de qual Gmail o pedido sai */
    de,
    emails: (contato.dados?.emails || []).map(e => ({ email: e, marcado: emails.includes(e) })),
    alternarEmail: (e: string) => setEmails(v => alternar(v, e)),
    competencia: { valor: vm.competencia, rotulo: rotuloMes(vm.competencia) },
    /**
     * Cada documento: a caixinha do mês da tela, e "Outros meses" (os meses anteriores, cada um com a sua;
     * travado = já importado no sistema ou já no Drive).
     */
    documentos: catalogo.map(d => {
      const deste = (c: string) => ({ valor: c, rotulo: rotuloMes(c), marcado: vale(d.id, c), travado: travado(d.id, c) });
      const outros = meses.slice(1).map(deste);
      return { ...d, atual: deste(vm.competencia), outros, outrosMarcados: outros.filter(m => m.marcado), mesesAbertos: mesesAbertos.includes(d.id) };
    }),
    alternarDocumento: (id: string, comp: string) => { if (!travado(id, comp)) setMarcados(v => alternar(v, chave(id, comp))); },
    alternarMeses: (id: string) => setMesesAbertos(v => alternar(v, id)),
    /** um documento que não está na lista (ex.: "Relatórios da LJ"), já marcado no mês da tela */
    adicionarDocumento: (nome: string) => {
      const n = nome.trim();
      if (!n) return;
      const id = 'outro:' + n.toLowerCase();
      if (!catalogo.some(d => d.id === id)) setExtras(v => [...v, { id, nome: n, detalhe: '' }]);
      setMarcados(v => (v.includes(chave(id, vm.competencia)) ? v : [...v, chave(id, vm.competencia)]));
    },
    /** o prazo no formato do campo de data ('aaaa-mm-dd') */
    prazo: paraData(prazo),
    setPrazo: (iso: string) => setPrazo(deData(iso)),
    whatsapp: {
      ...whats, texto: textoWhats, telefone: contato.dados?.telefone || '', ok: !!telefone,
      ligar: (v: boolean) => setWhats(w => ({ ...w, ligado: v })),
      escrever: (t: string) => setWhats(w => ({ ...w, texto: t, editado: true })),
      refazer: () => setWhats(w => ({ ...w, texto: '', editado: false })),
      link: contato.dados ? x.linkDoWhatsApp(contato.dados.telefone, textoWhats) : '',
    },
    /** o resumo do que vai ser pedido (a etapa de conferir) */
    resumo: { documentos: pedido.documentos.length, meses: compsDoPedido.map(rotuloMes), para: emails, de: de?.email || '' },
    assunto: x.assuntoDoPedido(pedido),
    html,
    podeContinuar, enviando,
    enviar: () => { void enviar(); },
    // histórico
    pedidos: vm.pedidos,
    historico,
    abrirHistorico: () => { void abrirHistorico(); },
    fecharHistorico: () => setHistorico(h => ({ ...h, aberto: false })),
  };
}
