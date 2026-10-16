// Pôr na rota, confirmar e tentar de novo (16/10/2026, a cópia fiel do Entregas): os documentos que o entregas.html grava,
// campo a campo (as regras do banco conferem cada um), e as exigências de cada tela — a Nova entrega (Preparar rota ou Pelo
// link), a parada (entregue com assinatura ou foto, entregue sem assinatura com a foto, não entregue com o motivo e a foto;
// só honorário em dinheiro e só notas dispensam o comprovante; honorário via Pix pede a foto do comprovante), as paradas
// assinadas juntas, a edição da parada e o "Tentar de novo?".
import type { AvaliacaoDoLocal } from './rotaDeEntregas';
import { rotuloDoCliente, type ClienteDaRota, type CodigoPagamento, type Entrega, type Geo, type ItemDaEntrega } from './documentos';

/** Quem grava: o e-mail da conta (as regras do banco conferem com o login) e o nome. */
export interface QuemEntrega { email: string; nome: string }

export type ParaQuem = { tipo: 'cliente'; cliente: ClienteDaRota } | { tipo: 'avulso'; nome: string } | { tipo: 'banco'; nome: string };

/** Preparar rota (a parada espera a assinatura) ou Pelo link (a guia vai para a página do cliente, que toca em "Recebi"). */
export type ModoDaNovaEntrega = 'rota' | 'link';

export interface EntregaNova {
  modo: ModoDaNovaEntrega;
  para: ParaQuem;
  competencia: string;
  /** 'AAAA-MM-DD' ou '' */
  vencimento: string;
  itens: ItemDaEntrega[];
  zona: string;
  codigoPagamento: CodigoPagamento | null;
  /** a imagem anexada (a primeira página do PDF da guia) */
  foto: string | null;
  /** a imagem é a da guia (veio de um PDF) */
  fotoEhGuia: boolean;
}

/** O que falta para pôr na rota, por campo (as mensagens do formulário do Entregas). */
export function faltasNaEntrega(n: Pick<EntregaNova, 'para' | 'competencia' | 'itens'>): { cliente?: string; competencia?: string; itens?: string } {
  const f: { cliente?: string; competencia?: string; itens?: string } = {};
  const p = n.para;
  if (p.tipo === 'cliente' ? !p.cliente : !p.nome.trim()) f.cliente = p.tipo === 'banco' ? 'Diga qual banco.' : 'Selecione um cliente da lista, ou informe o nome.';
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(n.competencia)) f.competencia = 'Informe a competência.';
  if (!n.itens.length) f.itens = 'Adicione ao menos um documento.';
  return f;
}

/** O nome que vai na entrega ("Banco: Caixa", o avulso, ou "123 - CLIENTE"). */
export function nomeDaEntregaNova(p: ParaQuem): string {
  return p.tipo === 'cliente' ? rotuloDoCliente(p.cliente) : p.tipo === 'banco' ? 'Banco: ' + p.nome.trim() : p.nome.trim();
}

/** O documento novo (status 'pendente' na rota, ou 'link' no link do cliente), campo a campo como o Entregas grava. */
export function dadosDaEntregaNova(n: EntregaNova, quem: QuemEntrega, agora: string): Record<string, unknown> {
  const p = n.para;
  const link = n.modo === 'link';
  return {
    clienteId: p.tipo === 'cliente' ? p.cliente.id : null,
    clienteNome: nomeDaEntregaNova(p),
    avulso: p.tipo !== 'cliente',
    banco: p.tipo === 'banco' ? p.nome.trim().slice(0, 80) : null,
    competencia: n.competencia,
    vencimento: n.vencimento || '',
    codigoPagamento: n.codigoPagamento || null,
    temGuia: !!(n.fotoEhGuia && n.foto),
    itens: n.itens.map(i => (i.funcionario !== undefined ? { tipo: i.tipo, valor: i.valor, funcionario: i.funcionario.trim() } : { tipo: i.tipo, valor: i.valor })),
    recebedor: '',
    temAssinatura: false,
    temFoto: !!n.foto,
    falha: false,
    motivoFalha: '',
    zona: link ? '' : n.zona || '',
    canal: link ? 'link' : '',
    geo: null,
    localDivergente: false,
    entregadoPor: quem.email,
    entregadoPorNome: quem.nome || quem.email,
    status: link ? 'link' : 'pendente',
    criadoEm: agora,
    confirmadoEm: null,
  };
}

/** O aviso depois de gravar (o toast do Entregas). */
export const avisoDaEntregaNova = (modo: ModoDaNovaEntrega) =>
  modo === 'link' ? 'Publicado no link do cliente. Quando ele tocar em "Recebi", vira entrega confirmada.' : 'Adicionado à rota — aguardando assinatura.';

// ---------------------------------------------------------------------------------------------------------------------
// a confirmação da parada
// ---------------------------------------------------------------------------------------------------------------------
const soDoTipo = (itens: readonly ItemDaEntrega[], tipo: string) => itens.length > 0 && itens.every(i => i.tipo === tipo);
/** Só honorário (pode ser em dinheiro: dispensa o comprovante; via Pix: pede a foto). */
export const soHonorario = (itens: readonly ItemDaEntrega[]) => soDoTipo(itens, 'Honorário');
/** Só notas (dispensa o comprovante: não é pagamento). */
export const soNotas = (itens: readonly ItemDaEntrega[]) => soDoTipo(itens, 'Notas');

export interface Confirmacao {
  /** cliente ausente / entrega não realizada */
  falha: boolean;
  /** "Entreguei, mas o cliente não assinou": a foto vale como comprovante */
  semAssinatura: boolean;
  /** honorário via Pix (o comprovante da transferência é a foto) */
  comPix: boolean;
  recebedor: string;
  motivoFalha: string;
  motivoSemAssinatura: string;
  assinatura: string | null;
  foto: string | null;
  geo: Geo | null;
}

/** O que falta para confirmar a parada, por campo (as mensagens da janela do Entregas). */
export function faltasNaConfirmacao(c: Confirmacao, itens: readonly ItemDaEntrega[]): { foto?: string; motivo?: string; assinatura?: string } {
  if (c.falha) {
    const f: { foto?: string; motivo?: string } = {};
    if (!c.foto) f.foto = 'Anexe uma foto — é obrigatória nesse caso.';
    if (!c.motivoFalha.trim()) f.motivo = 'Explique o que aconteceu.';
    return f;
  }
  if (c.semAssinatura || c.comPix) return c.foto ? {} : { foto: 'Anexe uma foto — é obrigatória nesse caso.' };
  const dispensa = (soHonorario(itens) && !c.comPix) || soNotas(itens);
  if (!dispensa && !c.assinatura && !c.foto) return { assinatura: 'Colha a assinatura ou anexe uma foto antes de confirmar.' };
  return {};
}

/** A atualização da parada ao confirmar (as regras exigem entregadoPor = quem confirma; a autoria pode mudar só pra ela). */
export function dadosDaConfirmacao(c: Confirmacao, avaliacao: AvaliacaoDoLocal, quem: QuemEntrega, agora: string): Record<string, unknown> {
  return {
    recebedor: c.falha ? '' : c.recebedor.trim(),
    geo: c.geo,
    temAssinatura: !c.falha && !c.semAssinatura && !!c.assinatura,
    temFoto: !!c.foto,
    // com a foto obrigatória, "sem assinatura" não é mais "sem comprovante"
    semComprovante: false,
    semAssinatura: !c.falha && c.semAssinatura,
    motivoSemAssinatura: !c.falha && c.semAssinatura ? c.motivoSemAssinatura.trim() : '',
    localDivergente: !c.falha && avaliacao.divergente,
    distanciaDoClienteKm: avaliacao.distancia,
    falha: c.falha,
    motivoFalha: c.falha ? c.motivoFalha.trim() : '',
    entregadoPor: quem.email,
    entregadoPorNome: quem.nome || quem.email,
    status: c.falha ? 'falha' : 'confirmada',
    confirmadoEm: agora,
  };
}

/** O comprovante que vai junto (só o que EXISTE: gravar null apagaria a guia que já estava lá). */
export function comprovanteDaConfirmacao(c: Pick<Confirmacao, 'falha' | 'semAssinatura' | 'assinatura' | 'foto'>): { assinatura?: string; foto?: string } | null {
  const r: { assinatura?: string; foto?: string } = {};
  if (!c.falha && !c.semAssinatura && c.assinatura) r.assinatura = c.assinatura;
  if (c.foto) r.foto = c.foto;
  return Object.keys(r).length ? r : null;
}

/** O aviso depois de confirmar. */
export function avisoDaConfirmacao(c: Pick<Confirmacao, 'falha' | 'semAssinatura'>): string {
  return c.falha ? 'Entrega não realizada registrada.' : c.semAssinatura ? 'Entrega confirmada com foto, sem assinatura.' : 'Entrega confirmada.';
}

// ---------------------------------------------------------------------------------------------------------------------
// as paradas assinadas juntas (uma assinatura para todas)
// ---------------------------------------------------------------------------------------------------------------------
export interface ConfirmacaoEmLote { falha: boolean; recebedor: string; motivoFalha: string; assinatura: string | null; foto: string | null; geo: Geo | null }
export function faltasNoLote(c: ConfirmacaoEmLote, escolhidas: number): { escolha?: string; foto?: string; motivo?: string; assinatura?: string } {
  if (!escolhidas) return { escolha: 'Escolha ao menos uma entrega.' };
  if (c.falha) {
    const f: { foto?: string; motivo?: string } = {};
    if (!c.foto) f.foto = 'Anexe uma foto — é obrigatória nesse caso.';
    if (!c.motivoFalha.trim()) f.motivo = 'Explique o que aconteceu.';
    return f;
  }
  return c.assinatura || c.foto ? {} : { assinatura: 'Colha a assinatura ou anexe uma foto antes de confirmar.' };
}
export function dadosDoLote(c: ConfirmacaoEmLote, avaliacao: AvaliacaoDoLocal, quem: QuemEntrega, agora: string): Record<string, unknown> {
  return {
    recebedor: c.falha ? '' : c.recebedor.trim(),
    geo: c.geo,
    temAssinatura: !c.falha && !!c.assinatura,
    temFoto: !!c.foto,
    localDivergente: !c.falha && avaliacao.divergente,
    distanciaDoClienteKm: c.falha ? null : avaliacao.distancia,
    falha: c.falha,
    motivoFalha: c.falha ? c.motivoFalha.trim() : '',
    entregadoPor: quem.email,
    entregadoPorNome: quem.nome || quem.email,
    status: c.falha ? 'falha' : 'confirmada',
    confirmadoEm: agora,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// tentar de novo, e editar a parada
// ---------------------------------------------------------------------------------------------------------------------
/** De volta à rota depois de não entregue (oferecerReagendar_): os mesmos documentos, a tentativa seguinte. */
export function dadosDaNovaTentativa(e: Entrega, motivo: string, quem: QuemEntrega, agora: string): Record<string, unknown> {
  return {
    clienteId: e.clienteId || '',
    clienteNome: e.clienteNome || '',
    competencia: e.competencia || '',
    itens: e.itens,
    zona: e.zona || '',
    observacao: e.observacao || '',
    status: 'pendente',
    tentativa: (e.tentativa || 1) + 1,
    motivoTentativaAnterior: motivo || '',
    entregadoPor: quem.email,
    entregadoPorNome: quem.nome || quem.email,
    criadoEm: agora,
  };
}
/** A tentativa seguinte de um grupo (a maior + 1). */
export const proximaTentativa = (l: readonly Pick<Entrega, 'tentativa'>[]) => l.reduce((m, e) => Math.max(m, e.tentativa || 1), 1) + 1;

/** A edição da parada (abrirEdicaoPendente): só a competência, a região e os documentos. */
export function dadosDaEdicao(competencia: string, zona: string, itens: readonly ItemDaEntrega[]): Record<string, unknown> {
  return { competencia, zona, itens: itens.map(i => (i.funcionario !== undefined ? { tipo: i.tipo, valor: i.valor, funcionario: i.funcionario.trim() } : { tipo: i.tipo, valor: i.valor })) };
}

/** O texto do comprovante para mandar ao cliente (o "Enviar comprovante" do Entregas). */
export function textoDoComprovante(e: Entrega, nomeDoCliente: string, rotuloDaCompetencia: (c: string) => string, reais: (n: number) => string, dataHora: (iso: string) => string): string {
  const itens = e.itens.map(i => '• ' + i.tipo + (i.valor != null ? ' — ' + reais(i.valor) : '')).join('\n');
  const total = Math.round(e.itens.reduce((s, i) => s + (i.valor || 0), 0) * 100) / 100;
  return 'Comprovante de entrega — ' + nomeDoCliente + '\n' + rotuloDaCompetencia(e.competencia) + '\n\n' + itens
    + (total > 0 ? '\n\nTotal: ' + reais(total) : '')
    + '\nRecebido por: ' + (e.recebedor || 'não informado')
    + '\nEntregue por: ' + (e.entregadoPorNome || e.entregadoPor || 'não informado')
    + '\nData: ' + dataHora(e.confirmadoEm || e.criadoEm);
}
