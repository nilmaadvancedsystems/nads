// ViewModel do "Pedir extratos": a janela do pedido de documentos (e-mail obrigatório — é a relação formal —
// e, se a pessoa quiser, WhatsApp junto, com a mensagem que ela digita) e o histórico dos pedidos.
// O contato vem do cadastro de clientes do Entregas (mesmo login do Drive). O e-mail vai para a fila do robô
// do Entregas com o HTML montado aqui (regras/email.ts) e o texto; o WhatsApp abre pelo link wa.me.
// Cada pedido fica no histórico da empresa (extrator/{empresa}.pedidos).
import { creditor, extrator as x, tarefas } from '@nads/core';
import { useState } from 'react';
import { useDrive } from '../../dados/repo';

/** O que o pedido usa da tela (a etapa passa o ViewModel dela; a prévia passa um de exemplo). */
export interface VmDoPedido {
  competencia: string;
  competencias: { valor: string; rotulo: string }[];
  bancos: { id: string; nome: string; marca: string; conta: string; extrato: { qtdArquivos: number } }[];
  pedidos: x.PedidoRegistrado[];
  registrarPedido(reg: x.PedidoRegistrado): void;
  avisar(titulo: string): void;
  avisarErro(titulo: string, detalhe: string): void;
}

/** As imagens do e-mail (endereços completos, publicados no site). */
export interface ImagensDoEmail { logo: string; logoDoBanco: (marca: string) => string | null }

/** O WhatsApp do escritório (o botão no fim do e-mail). */
const WHATSAPP_DO_ESCRITORIO = { numero: '553891383638', rotulo: '(38) 9138-3638' };

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
  const [aberto, setAberto] = useState(false);
  const [contato, setContato] = useState<{ carregando: boolean; erro: string; dados: creditor.ContatoDoCliente | null }>({ carregando: false, erro: '', dados: null });
  const [marcados, setMarcados] = useState<string[]>([]);
  const [extras, setExtras] = useState<x.DocumentoDoPedido[]>([]);
  const [mais, setMais] = useState(false);
  const [outrasComp, setOutrasComp] = useState<string[]>([]);
  const [prazo, setPrazo] = useState('');
  const [emails, setEmails] = useState<string[]>([]);
  const [whats, setWhats] = useState({ ligado: false, texto: '', editado: false });
  const [enviando, setEnviando] = useState('');
  const [historico, setHistorico] = useState<{ aberto: boolean; situacoes: Record<string, creditor.SituacaoDoEmail>; erro: string }>({ aberto: false, situacoes: {}, erro: '' });

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

  const precisaEntrar = () => !acesso.entrou && !drive.exemplos;

  function abrir() {
    if (precisaEntrar()) {
      if (drive.loginDeFora) { vm.avisarErro('Entre no Entregas', 'O pedido usa o cadastro de clientes do Entregas.'); return; }
      pedirLogin(() => abrir());
      return;
    }
    // já marcados: os extratos que ainda faltam na competência (e não estão sem movimento)
    const faltam = vm.bancos.filter(b => !b.extrato.qtdArquivos && !semMovimento.includes(b.id)).map(b => 'extrato:' + b.id);
    setMarcados(faltam.length ? faltam : vm.bancos.map(b => 'extrato:' + b.id));
    setExtras([]); setMais(false); setOutrasComp([]); setEnviando('');
    setPrazo(x.prazoPadrao(new Date()));
    setWhats({ ligado: false, texto: '', editado: false });
    setAberto(true);
    void carregarContato();
  }

  const catalogo = [...x.documentosDoPedido(vm.bancos.map(b => ({ id: b.id, nome: b.nome, marca: b.marca, conta: b.conta || undefined }))), ...extras];
  const pedido: x.PedidoDeExtratos = {
    cliente: contato.dados?.nome || empresa,
    documentos: catalogo.filter(d => marcados.includes(d.id)),
    competencias: [vm.competencia, ...(mais ? outrasComp : [])],
  };
  const textoWhats = whats.editado ? whats.texto : x.textoDoWhatsApp(pedido, prazo);
  const telefone = contato.dados ? x.telefoneParaWhatsApp(contato.dados.telefone) : '';
  const html = aberto ? x.htmlDoPedido({ pedido, prazo, enviadoEm: new Date(), logo: imagens.logo, logoDoBanco: imagens.logoDoBanco, whatsapp: WHATSAPP_DO_ESCRITORIO }) : '';
  const pode = !!contato.dados && emails.length > 0 && pedido.documentos.length > 0 && !enviando && (!whats.ligado || !!telefone);

  async function enviar() {
    if (!pode || !contato.dados || !drive.pedirEmail) return;
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
        competencias: pedido.competencias, documentos: pedido.documentos.map(d => d.nome), prazo,
        email: { para: emails, assunto, solicitacoes },
        ...(whats.ligado && contato.dados ? { whatsapp: { telefone: contato.dados.telefone, texto: textoWhats } } : {}),
      });
      setAberto(false);
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

  return {
    aberto, abrir, fechar: () => { if (!enviando) setAberto(false); },
    exemplos: drive.exemplos,
    contato,
    emails: (contato.dados?.emails || []).map(e => ({ email: e, marcado: emails.includes(e) })),
    alternarEmail: (e: string) => setEmails(v => alternar(v, e)),
    documentos: catalogo.map(d => ({
      ...d, marcado: marcados.includes(d.id),
      jaTem: d.id.startsWith('extrato:') && (vm.bancos.find(b => 'extrato:' + b.id === d.id)?.extrato.qtdArquivos || 0) > 0,
    })),
    alternarDocumento: (id: string) => setMarcados(v => alternar(v, id)),
    /** um documento que não está na lista (ex.: "Relatórios da LJ") */
    adicionarDocumento: (nome: string) => {
      const n = nome.trim();
      if (!n) return;
      const id = 'outro:' + n.toLowerCase();
      if (!catalogo.some(d => d.id === id)) setExtras(v => [...v, { id, nome: n, detalhe: '' }]);
      setMarcados(v => (v.includes(id) ? v : [...v, id]));
    },
    competencia: { valor: vm.competencia, rotulo: tarefas.rotuloCompetencia(vm.competencia) },
    mais, setMais,
    outrasCompetencias: vm.competencias.filter(c => c.valor !== vm.competencia).map(c => ({ ...c, marcado: outrasComp.includes(c.valor) })),
    alternarCompetencia: (c: string) => setOutrasComp(v => alternar(v, c)),
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
    assunto: x.assuntoDoPedido(pedido),
    html,
    pode, enviando,
    enviar: () => { void enviar(); },
    // histórico
    pedidos: vm.pedidos,
    historico,
    abrirHistorico: () => { void abrirHistorico(); },
    fecharHistorico: () => setHistorico(h => ({ ...h, aberto: false })),
  };
}
