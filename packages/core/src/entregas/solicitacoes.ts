// As solicitações da equipe (16/10/2026, a cópia fiel do Entregas: "cadê as solicitações"): o pedido para a rua —
// entregar documento, buscar documento, buscar atestado na clínica, outro —, com o prazo ("Concluir até") e a prioridade.
// Os mesmos documentos do Entregas (coleção solicitacoes) e as mesmas regras da janela de Solicitações de lá
// (nilma-solicitacoes.js): o office boy cuida da fila da equipe inteira; o resto vê e conclui só o que pediu.
//   solicitacoes/{id}  { tipo 'entregar'|'buscar'|'atestado'|'outro', local, descricao, urgente, prazo 'AAAA-MM-DD',
//                        status 'pendente'|'concluida', criadoPor (e-mail), criadoPorNome, criadoEm,
//                        atestadoClinica?, atestadoFuncionario?, atestadoEmpresa?, atestadoEmpresaId?,
//                        concluidoEm?, concluidoPor?, concluidoPorNome? }
import { rotuloDoCliente, semAcento, type ClienteDaRota } from './documentos';

export type TipoDaSolicitacao = 'entregar' | 'buscar' | 'atestado' | 'outro';
export const TIPOS_DE_SOLICITACAO: readonly { valor: TipoDaSolicitacao; rotulo: string }[] = [
  { valor: 'entregar', rotulo: 'Entregar documento' },
  { valor: 'buscar', rotulo: 'Buscar documento' },
  { valor: 'atestado', rotulo: 'Buscar atestado (clínica)' },
  { valor: 'outro', rotulo: 'Outro' },
];
export const CLINICAS: readonly { valor: string; rotulo: string }[] = [
  { valor: 'Assegi', rotulo: 'Assegi' }, { valor: 'Preventive', rotulo: 'Preventive' }, { valor: 'Outra', rotulo: 'Outra clínica' },
];
/** O tipo na linha da lista (tipoSolicitacaoLabel). */
export function rotuloDoTipoDaSolicitacao(t: string): string {
  if (t === 'entregar') return 'Entregar documento';
  if (t === 'buscar') return 'Buscar documento';
  if (t === 'atestado') return 'Buscar atestado';
  return 'Outro';
}

export interface Solicitacao {
  id: string;
  tipo: string;
  local: string;
  descricao: string;
  urgente: boolean;
  prazo: string;
  status: 'pendente' | 'concluida';
  criadoPor: string;
  criadoPorNome: string;
  criadoEm: string;
  atestadoClinica: string;
  atestadoFuncionario: string;
  atestadoEmpresa: string;
  concluidoEm: string;
  concluidoPor: string;
  concluidoPorNome: string;
}
const t = (v: unknown) => (v == null ? '' : String(v));
export function solicitacaoDoDocumento(id: string, d: Record<string, unknown>): Solicitacao {
  return {
    id, tipo: t(d.tipo), local: t(d.local), descricao: t(d.descricao), urgente: !!d.urgente, prazo: t(d.prazo), status: d.status === 'concluida' ? 'concluida' : 'pendente',
    criadoPor: t(d.criadoPor), criadoPorNome: t(d.criadoPorNome), criadoEm: t(d.criadoEm), atestadoClinica: t(d.atestadoClinica),
    atestadoFuncionario: t(d.atestadoFuncionario), atestadoEmpresa: t(d.atestadoEmpresa), concluidoEm: t(d.concluidoEm), concluidoPor: t(d.concluidoPor),
    concluidoPorNome: t(d.concluidoPorNome),
  };
}

/** O office boy cuida da fila da equipe toda (veTudo); os outros, do que pediram. */
export const veTodasAsSolicitacoes = (papeis: readonly string[]) => papeis.includes('office_boy');
export const podeConcluirSolicitacao = (s: Pick<Solicitacao, 'criadoPor'>, papeis: readonly string[], email: string) =>
  veTodasAsSolicitacoes(papeis) || (!!s.criadoPor && s.criadoPor === email);

const isoDoDia = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
/** O prazo que já vem preenchido: daqui a 2 dias. */
export function prazoPadraoDaSolicitacao(hoje = new Date()): string {
  const d = new Date(hoje);
  d.setDate(d.getDate() + 2);
  return isoDoDia(d);
}

/** A busca: a descrição, o local, quem pediu, o tipo e quem concluiu, sem acento. */
export function solicitacaoCombina(s: Solicitacao, busca: string): boolean {
  const q = semAcento(busca.trim());
  if (!q) return true;
  return semAcento([s.descricao, s.local, s.criadoPorNome, s.criadoPor, rotuloDoTipoDaSolicitacao(s.tipo), s.concluidoPorNome].join(' ')).includes(q);
}

/** As pendentes: quem vence antes vem antes (sem prazo no fim; empate: o pedido mais antigo); urgentes à parte. */
export function pendentesPeloPrazo(l: readonly Solicitacao[]): { urgentes: Solicitacao[]; outras: Solicitacao[] } {
  const ord = [...l].sort((a, b) => {
    const pa = a.prazo || '9', pb = b.prazo || '9';
    if (pa !== pb) return pa < pb ? -1 : 1;
    return a.criadoEm.localeCompare(b.criadoEm);
  });
  return { urgentes: ord.filter(s => s.urgente), outras: ord.filter(s => !s.urgente) };
}
/** As últimas 30 concluídas, a mais recente primeiro. */
export const ultimasConcluidas = (l: readonly Solicitacao[]) =>
  l.filter(s => s.status === 'concluida').sort((a, b) => (b.concluidoEm || b.criadoEm).localeCompare(a.concluidoEm || a.criadoEm)).slice(0, 30);

const dataCurta = (iso: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; };
const dataHora = (iso: string) => {
  const d = iso ? new Date(iso) : null;
  if (!d || isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};
/** As linhas de apoio de um pedido (o tipo, o local, quem pediu; as datas; quem concluiu) e se está atrasado. */
export function linhaDaSolicitacao(s: Solicitacao, email: string, hoje = new Date()) {
  const h = isoDoDia(hoje);
  const quem = s.criadoPor === email ? 'você' : s.criadoPorNome || s.criadoPor || 'alguém da equipe';
  const atrasada = s.status !== 'concluida' && !!s.prazo && s.prazo < h;
  return {
    titulo: s.descricao || '(sem descrição)',
    apoio: [rotuloDoTipoDaSolicitacao(s.tipo), s.local].filter(Boolean).join(' · ') + ' · pedido por ' + quem,
    datas: 'Pedido em ' + dataHora(s.criadoEm) + (s.prazo ? ' · ' + (s.status === 'concluida' ? 'prazo era ' : 'concluir até ') + dataCurta(s.prazo) + (s.status !== 'concluida' && s.prazo === h ? ' (hoje)' : '') : ''),
    concluida: s.status === 'concluida' ? 'concluída' + (s.concluidoPorNome ? ' por ' + s.concluidoPorNome : '') + (s.concluidoEm ? ' · ' + dataHora(s.concluidoEm) : '') : '',
    atrasada,
  };
}

export interface SolicitacaoNova {
  tipo: TipoDaSolicitacao;
  local: string;
  descricao: string;
  clinica: string;
  funcionario: string;
  empresa: Pick<ClienteDaRota, 'id' | 'nome' | 'codigoOrigem'> | null;
  /** 'AAAA-MM-DD' */
  prazo: string;
  urgente: boolean;
}
/** O que falta (as mensagens da janela de Solicitações do Entregas); '' = pode enviar. */
export function faltaNaSolicitacao(n: SolicitacaoNova, hoje = new Date()): { texto: string; campo: 'funcionario' | 'empresa' | 'descricao' | 'prazo' | '' } {
  if (n.tipo === 'atestado') {
    const f: string[] = [];
    if (!n.funcionario.trim()) f.push('o nome do funcionário');
    if (!n.empresa) f.push('a empresa (escolha da lista)');
    if (f.length) return { texto: 'Falta ' + f.join(' e ') + '.', campo: !n.funcionario.trim() ? 'funcionario' : 'empresa' };
  } else if (!n.descricao.trim()) return { texto: 'Descreva o que precisa ser feito.', campo: 'descricao' };
  if (!n.prazo || n.prazo < isoDoDia(hoje)) return { texto: 'Escolha até quando precisa ser feito (hoje ou depois).', campo: 'prazo' };
  return { texto: '', campo: '' };
}
/** O documento novo, campo a campo como o Entregas grava (a regra confere criadoPor = o e-mail do login). */
export function dadosDaSolicitacao(n: SolicitacaoNova, quem: { email: string; nome: string }, agora: string): Record<string, unknown> {
  const atestado = n.tipo === 'atestado' && n.empresa;
  const empresa = n.empresa ? rotuloDoCliente(n.empresa) : '';
  return {
    tipo: n.tipo,
    local: atestado ? n.clinica : n.local.trim(),
    descricao: atestado ? 'Buscar atestado de ' + n.funcionario.trim() + ' — ' + empresa + ' (clínica ' + n.clinica + ')' : n.descricao.trim(),
    urgente: n.urgente,
    prazo: n.prazo,
    status: 'pendente',
    criadoPor: quem.email,
    criadoPorNome: quem.nome,
    criadoEm: agora,
    ...(atestado && n.empresa ? { atestadoClinica: n.clinica, atestadoFuncionario: n.funcionario.trim(), atestadoEmpresa: empresa, atestadoEmpresaId: n.empresa.id } : {}),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// a tarefa delegada ao office boy vira solicitação (16/11/2026: "quando for delegado para o officeboy, a opcao 'entrega' que vai
// jogar direto no modulo de entregas"): na Nova tarefa, escolhido o office boy, a caixinha Entrega; marcada, nenhuma tarefa é
// criada, o pedido vai para a fila do office boy (Entregas › Solicitações) e quem pediu acompanha lá
// ---------------------------------------------------------------------------------------------------------------------

/** Os tipos que a tarefa escolhe (o atestado tem o formulário próprio, na janela de Solicitações). */
export const TIPOS_DA_ENTREGA_DA_TAREFA: readonly { valor: Exclude<TipoDaSolicitacao, 'atestado'>; rotulo: string }[] = [
  { valor: 'entregar', rotulo: 'Entregar' },
  { valor: 'buscar', rotulo: 'Buscar' },
  { valor: 'outro', rotulo: 'Outro' },
];

/** A pessoa é office boy? (é quem cuida da fila das solicitações) */
export const ehOfficeBoy = veTodasAsSolicitacoes;

/** O tipo que já vem marcado, pelo nome da tarefa ("Retirada de documentação" → Buscar); sem pista, Entregar. */
export function tipoProvavelDaEntrega(titulo: string): Exclude<TipoDaSolicitacao, 'atestado'> {
  const t = semAcento(titulo);
  if (/\b(retir|busc|recolh|colet|trazer|traga|pegar|pega)/.test(t)) return 'buscar';
  if (/\b(entreg|levar|leva\b|deixar|protocol)/.test(t)) return 'entregar';
  if (/\b(pagar|pagamento|cartorio|prefeitura|reconhec|autentic)/.test(t)) return 'outro';
  return 'entregar';
}

/** O que a tarefa leva para a solicitação. */
export interface TarefaParaEntrega {
  titulo: string;
  descricao: string;
  clientes: readonly { codigo: number | null; nome: string }[];
  prioridade: string;
  /** 'aaaa-mm-dd' ou '' */
  prazo: string;
  /** 'hh:mm' ou '' */
  prazoHora: string;
}

/**
 * A solicitação da tarefa: o local são os clientes, a descrição é o nome com os Detalhes (e a hora do prazo, que a solicitação
 * não tem), o prazo sem data vira o padrão (daqui a 2 dias) e só a prioridade Urgente vira urgente.
 */
export function solicitacaoDaTarefa(t: TarefaParaEntrega, tipo: Exclude<TipoDaSolicitacao, 'atestado'>, hoje = new Date()): SolicitacaoNova {
  const detalhes = t.descricao.replace(/\s+/g, ' ').trim();
  const descricao = t.titulo.trim() + (detalhes ? ' — ' + detalhes : '') + (t.prazo && t.prazoHora ? ' (até ' + t.prazoHora + ')' : '');
  return {
    tipo, local: t.clientes.map(c => c.nome.trim()).filter(Boolean).join(', '), descricao, clinica: '', funcionario: '', empresa: null,
    prazo: t.prazo || prazoPadraoDaSolicitacao(hoje), urgente: t.prioridade === 'urgente',
  };
}

/** Por que a tarefa não vai como entrega ('' = vai): os anexos e os links não cabem na solicitação, e o que a solicitação exige. */
export function problemaDaEntregaDaTarefa(t: TarefaParaEntrega & { anexos: number; links: number }, tipo: Exclude<TipoDaSolicitacao, 'atestado'>, hoje = new Date()): string {
  if (t.anexos || t.links) return 'A entrega não leva anexos nem links: tire-os ou desmarque Entrega.';
  if (!t.titulo.trim()) return 'Dê um nome à entrega.';
  if (t.prazo && t.prazo < isoDoDia(hoje)) return 'O prazo da entrega já passou: escolha hoje ou depois.';
  return faltaNaSolicitacao(solicitacaoDaTarefa(t, tipo, hoje), hoje).texto;
}
