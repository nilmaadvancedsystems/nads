// A Central dos robôs (Vitor, 07/11/2026: um site só para os robôs, com a cara do Umbrel, para ver e mandar de qualquer
// lugar, inclusive do celular). Aqui fica a regra, sem tela e sem banco:
//   - o catálogo (catalogo.json): as 3 máquinas, os robôs de cada uma e a LISTA FECHADA de ações;
//   - a situação de cada máquina e de cada robô (ok / atenção / parado / pausado), reaproveitando a conta do painel do robô
//     (entregas/painelRobo.ts: ligado até 3 min sem batimento, atrasado até 10, depois sem sinal);
//   - o pedido de uma ação (robosComandos/{id}), que o robô de cada máquina confere de novo (robo/central.js);
//   - o espelho dos registros (robosRegistros/{robo}) e o estado da máquina (robosMaquinas/{maquina});
//   - os controles (10/11/2026): a fila vista pedido a pedido, o "refazer" do que deu erro, o pedido para um cliente e a pausa
//     de todos, com a hora de voltar.
import { situacaoDoRobo, lerBatimento, haQuanto, type AtividadeDoRobo, type BatimentoDoRobo, type IdRobo } from '../entregas';
import catalogo from './catalogo.json';

export type IdMaquina = 'servidor' | 'nuvem' | 'escritorio';
export type IdAcao = 'pausar' | 'retomar' | 'rodar-agora' | 'limpar-fila' | 'reiniciar' | 'atualizar' | 'assistir' | 'refazer' | 'cancelar-item' | 'na-frente' | 'pedir-cliente' | 'parar-tudo' | 'retomar-tudo';
export type Tom = 'ok' | 'aviso' | 'erro' | 'neutro';

export interface MaquinaDaCentral { id: IdMaquina; nome: string; /** o nome curto, para os lugares apertados */ curto: string; /** "no Servidor", "na Nuvem" */ em: string; host: string; onde: string; batimento: string; icone: string }
export interface TarefaDoRobo { id: string; nome: string }
/** A fila vista pedido a pedido: a coleção, os status de cada lado (os de robo/painel.js FILAS) e o que se pode fazer com um pedido. */
export interface ItensDaFila { colecao: string; esperando: string[]; andamento: string[]; cancelar: boolean; naFrente: boolean; refazer: boolean }
export interface RoboDaCentral {
  id: string; nome: string; maquina: IdMaquina; icone: string;
  /** o símbolo do serviço com que o robô trabalha (apps/web/.../robos/logos); '' = o ícone próprio */
  logo: string; cor: [string, string]; descricao: string;
  /** as marcas do log ('[sieg]') que são deste robô; '' = as linhas sem marca da máquina */
  tags: string[];
  /** o id da fila no batimento do painel (robo/painel.js FILAS); '' = sem fila */
  fila: string;
  /** os tipos de atividade (roboAtividade.tipo) que são deste robô */
  tipos: string[];
  tarefas: TarefaDoRobo[];
  pausavel: boolean;
  limpavel: boolean;
  /** a fila pedido a pedido; sem isto, só o total do painel */
  itens?: ItensDaFila;
  /** o que dá para pedir para um cliente e uma competência (robo/central.js PEDIDOS_POR_CLIENTE) */
  pedidos?: TarefaDoRobo[];
}
export interface AcaoDaCentral { id: IdAcao; nome: string; alvo: 'robo' | 'maquina'; destrutiva: boolean; interna?: boolean; descricao: string }

export const MAQUINAS = catalogo.maquinas as MaquinaDaCentral[];
export const ROBOS = catalogo.robos as unknown as RoboDaCentral[];
export const ACOES = catalogo.acoes as AcaoDaCentral[];
/** O comando vale por 5 min: depois disso o robô recusa (quem pediu já desistiu ou pediu de novo). */
export const VALIDADE_DO_COMANDO_MS = 5 * 60 * 1000;
/** O histórico dos comandos fica 30 dias (expiraEm; o robô apaga os mais velhos). */
export const HISTORICO_DIAS = 30;
/** O espelho do log: no máximo isto de linhas por robô (robo/central.js corta do mesmo jeito). */
export const LINHAS_DO_REGISTRO = 200;

export const maquinaPorId = (id: string) => MAQUINAS.find(m => m.id === id) || null;
export const roboPorId = (id: string) => ROBOS.find(r => r.id === id) || null;
export const acaoPorId = (id: string) => ACOES.find(a => a.id === id) || null;
export const robosDaMaquina = (m: IdMaquina) => ROBOS.filter(r => r.maquina === m);
/** Qual robô do painel antigo (robo/painelPC, robo/painelVM) é a máquina. */
export const painelDaMaquina = (m: IdMaquina): IdRobo | null => (m === 'servidor' ? 'pc' : m === 'nuvem' ? 'vm' : null);

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {});
const txt = (v: unknown) => (v == null ? '' : String(v));
const numOuNulo = (v: unknown) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const MIN = 60 * 1000;
const HORA = 60 * MIN;
const idade = (iso: string, agora: number) => { const t = Date.parse(iso); return Number.isFinite(t) ? agora - t : Infinity; };

/** "Bom dia", "Boa tarde", "Boa noite" (pela hora local). */
export function saudacao(hora: number): string {
  if (hora >= 5 && hora < 12) return 'Bom dia';
  if (hora >= 12 && hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** O primeiro nome ("Vitor Hugo" → "Vitor"). */
export const primeiroNome = (nome: string) => (String(nome || '').trim().split(/\s+/)[0] || '');

// ---------- o estado da máquina (robosMaquinas/{maquina}) ----------

/** Os sinais baratos da máquina (o robô mede a cada minuto: os.loadavg/os.freemem e o disco). null = não mediu. */
export interface SinaisDaMaquina { cpu: number | null; memoria: number | null; disco: number | null; discoLivreGb: number | null; ligadaHa: number | null }
export interface Pausa { por: string; em: string; /** a hora marcada para voltar sozinho (ISO); '' = até alguém retomar */ ate: string }
export interface EstadoDaMaquina {
  maquina: IdMaquina; host: string; em: string; ligadoEm: string; versao: string; desligadoEm: string;
  sinais: SinaisDaMaquina;
  pausados: Record<string, Pausa>;
  /** a central do robô ainda não sabe fazer (o gancho não está ligado nesta versão), por ação */
  semGancho: string[];
}

export function lerEstadoDaMaquina(maquina: IdMaquina, d: Obj | null | undefined): EstadoDaMaquina | null {
  if (!d) return null;
  const s = obj(d.sinais);
  const p = obj(d.pausados);
  const pausados: Record<string, Pausa> = {};
  for (const [k, v] of Object.entries(p)) { const x = obj(v); pausados[k] = { por: txt(x.por), em: txt(x.em), ate: txt(x.ate) }; }
  return {
    maquina, host: txt(d.host), em: txt(d.em), ligadoEm: txt(d.ligadoEm), versao: txt(d.versao), desligadoEm: txt(d.desligadoEm),
    sinais: { cpu: numOuNulo(s.cpu), memoria: numOuNulo(s.memoria), disco: numOuNulo(s.disco), discoLivreGb: numOuNulo(s.discoLivreGb), ligadaHa: numOuNulo(s.ligadaHa) },
    pausados,
    semGancho: Array.isArray(d.semGancho) ? d.semGancho.map(txt) : [],
  };
}

export interface SituacaoDaMaquina {
  maquina: MaquinaDaCentral;
  tom: Tom;
  /** Ligada, Atrasada, Sem sinal, Desligada, Sem informação */
  rotulo: string;
  /** "há 1 min" */
  sinal: string;
  host: string;
  versao: string;
  sinais: SinaisDaMaquina | null;
  /** as ações que a central do robô desta máquina ainda não sabe fazer (o gancho não está nesta versão) */
  semGancho: string[];
}

const ROTULO_DA_MAQUINA: Record<string, string> = { Ligado: 'Ligada', Atrasado: 'Atrasada', Desligado: 'Desligada', 'Sem sinal': 'Sem sinal', 'Sem informação': 'Sem informação', 'Ligado, sem o painel': 'Ligada' };

/**
 * A máquina está viva? O mais novo entre o batimento do painel (robo/painelPC, robo/painelVM) e o estado da central
 * (robosMaquinas). A conta é a do painel (situacaoDoRobo): até 3 min, ligada; até 10, atrasada; depois, sem sinal.
 */
export function situacaoDaMaquina(m: MaquinaDaCentral, batimento: BatimentoDoRobo | null, estado: EstadoDaMaquina | null, agora = Date.now()): SituacaoDaMaquina {
  const painel = painelDaMaquina(m.id) || 'pc';
  // o mais novo dos dois sinais vira o "batimento" da conta do painel
  const doEstado = estado ? lerBatimento(painel, { em: estado.em, maquina: estado.host, versao: estado.versao, ligadoEm: estado.ligadoEm, desligadoEm: estado.desligadoEm }) : null;
  const usar = !batimento ? doEstado : !doEstado ? batimento : (Date.parse(doEstado.em) || 0) > (Date.parse(batimento.em) || 0) ? { ...batimento, em: doEstado.em, desligadoEm: doEstado.desligadoEm } : batimento;
  const s = situacaoDoRobo(painel, usar, null, agora);
  return {
    maquina: m, tom: s.tom, rotulo: ROTULO_DA_MAQUINA[s.rotulo] || s.rotulo, sinal: s.sinal,
    host: s.maquina || estado?.host || m.host, versao: s.versao || estado?.versao || '',
    sinais: estado && (estado.sinais.cpu != null || estado.sinais.memoria != null || estado.sinais.disco != null) ? estado.sinais : null,
    semGancho: estado?.semGancho || [],
  };
}

// ---------- a situação de cada robô ----------

export interface SituacaoDoRoboNaCentral {
  robo: RoboDaCentral;
  tom: Tom;
  /** Funcionando, Ocioso, Atenção, Parado, Pausado */
  rotulo: string;
  /** a razão curta do tom ("2 erros hoje", "a máquina está sem sinal") */
  motivo: string;
  fila: { esperando: number; andamento: number; espera: string; erro: string } | null;
  /** o que está fazendo agora */
  agora: string[];
  ultimo: AtividadeDoRobo | null;
  ultimoErro: AtividadeDoRobo | null;
  errosHoje: number;
  pausa: Pausa | null;
}

const daChave = (r: RoboDaCentral, chave: string) => {
  const c = chave.toLowerCase();
  return c === r.id || c.startsWith(r.id + '-') || c.startsWith(r.id + ':') || r.tipos.includes(c) || (r.fila !== '' && c === r.fila);
};
const doRobo = (r: RoboDaCentral, a: AtividadeDoRobo) => r.tipos.includes(a.tipo) && (painelDaMaquina(r.maquina) === null || a.robo === painelDaMaquina(r.maquina));
const mesmoDia = (iso: string, agora: number) => { const a = new Date(Date.parse(iso)); const b = new Date(agora); return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); };

export function situacaoDoRoboNaCentral(r: RoboDaCentral, maquina: SituacaoDaMaquina, batimento: BatimentoDoRobo | null, estado: EstadoDaMaquina | null, atividades: readonly AtividadeDoRobo[], agora = Date.now()): SituacaoDoRoboNaCentral {
  const f = r.fila && batimento ? batimento.filas.find(x => x.id === r.fila) || null : null;
  const fila = f ? { esperando: f.esperando, andamento: f.andamento, espera: f.esperando + f.andamento > 0 && f.maisAntigoEm ? haQuanto(f.maisAntigoEm, agora) : '', erro: f.erro } : null;
  const minhas = atividades.filter(a => doRobo(r, a)).sort((a, b) => b.em.localeCompare(a.em));
  const ultimo = minhas.find(a => !a.erro) || null;
  const ultimoErro = minhas.find(a => a.erro) || null;
  const errosHoje = minhas.filter(a => a.erro && mesmoDia(a.em, agora)).length;
  const fazendo = maquina.tom === 'erro' || !batimento ? [] : batimento.agora.filter(x => daChave(r, x.chave)).map(x => x.texto);
  const modulo = batimento?.modulos.find(m => m.id === r.id) || null;
  const pausa = estado?.pausados[r.id] || null;
  const filaVelha = !!f && f.esperando > 0 && idade(f.maisAntigoEm, agora) >= HORA;
  const base = { robo: r, fila, agora: fazendo, ultimo, ultimoErro, errosHoje, pausa };
  if (maquina.tom === 'erro') return { ...base, tom: 'erro', rotulo: 'Parado', motivo: 'A máquina (' + maquina.maquina.nome + ') está ' + maquina.rotulo.toLowerCase() + '.' };
  if (maquina.tom === 'neutro') return { ...base, tom: 'neutro', rotulo: 'Sem informação', motivo: 'A máquina ainda não mandou sinal.' };
  if (pausa) return { ...base, tom: 'aviso', rotulo: 'Pausado', motivo: 'Pausado' + (pausa.por ? ' por ' + pausa.por : '') + (pausa.ate ? ', volta ' + quandoVolta(pausa.ate, agora) : pausa.em ? ' ' + haQuanto(pausa.em, agora) : '') + '.' };
  if (modulo && !modulo.ligado) return { ...base, tom: 'erro', rotulo: 'Parado', motivo: 'Não ligou' + (modulo.motivo ? ': ' + modulo.motivo : '') + '.' };
  if (fila?.erro) return { ...base, tom: 'aviso', rotulo: 'Atenção', motivo: 'A fila não foi lida: ' + fila.erro };
  if (filaVelha) return { ...base, tom: 'aviso', rotulo: 'Atenção', motivo: 'Tem pedido esperando ' + fila!.espera + '.' };
  if (errosHoje > 0 && ultimoErro && (!ultimo || ultimoErro.em > ultimo.em)) return { ...base, tom: 'aviso', rotulo: 'Atenção', motivo: errosHoje === 1 ? '1 erro hoje.' : errosHoje + ' erros hoje.' };
  if (maquina.tom === 'aviso') return { ...base, tom: 'aviso', rotulo: 'Atenção', motivo: 'A máquina está atrasada no sinal (' + maquina.sinal + ').' };
  return { ...base, tom: 'ok', rotulo: fazendo.length || (fila && fila.andamento > 0) ? 'Trabalhando' : 'Funcionando', motivo: '' };
}

// ---------- os widgets ----------

export interface ResumoDasFilas { esperando: number; andamento: number; linhas: { robo: RoboDaCentral; esperando: number; andamento: number; espera: string }[] }

export function resumoDasFilas(situacoes: readonly SituacaoDoRoboNaCentral[]): ResumoDasFilas {
  const linhas = situacoes.filter(s => s.fila && s.fila.esperando + s.fila.andamento > 0)
    .map(s => ({ robo: s.robo, esperando: s.fila!.esperando, andamento: s.fila!.andamento, espera: s.fila!.espera }))
    .sort((a, b) => b.esperando + b.andamento - (a.esperando + a.andamento));
  return { esperando: linhas.reduce((t, l) => t + l.esperando, 0), andamento: linhas.reduce((t, l) => t + l.andamento, 0), linhas };
}

/** Os erros de hoje de todos os robôs, o mais novo primeiro. */
export function errosDeHoje(atividades: readonly AtividadeDoRobo[], agora = Date.now()): AtividadeDoRobo[] {
  return atividades.filter(a => a.erro && mesmoDia(a.em, agora)).sort((a, b) => b.em.localeCompare(a.em));
}

/** Qual robô fez esta atividade (pelo tipo e pela máquina); null se nenhum. */
export function roboDaAtividade(a: AtividadeDoRobo): RoboDaCentral | null {
  return ROBOS.find(r => doRobo(r, a)) || null;
}

/** A busca da tela inicial: pelo nome, pela máquina e pela descrição, sem acento. */
export function buscarRobos(termo: string, robos: readonly RoboDaCentral[] = ROBOS): RoboDaCentral[] {
  const limpar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const t = limpar(termo.trim());
  if (!t) return [...robos];
  return robos.filter(r => limpar([r.nome, r.descricao, maquinaPorId(r.maquina)?.nome || '', r.id].join(' ')).includes(t));
}

// ---------- as ações ----------

/** As ações que a tela oferece para este robô (as da máquina vêm junto). */
export function acoesDoRobo(r: RoboDaCentral, pausado: boolean): AcaoDaCentral[] {
  return ACOES.filter(a => {
    if (a.interna) return false;
    if (a.id === 'pausar') return r.pausavel && !pausado;
    if (a.id === 'retomar') return r.pausavel && pausado;
    if (a.id === 'rodar-agora') return r.tarefas.length > 0;
    if (a.id === 'limpar-fila') return r.limpavel && !!r.fila;
    return a.alvo === 'maquina';
  });
}

/** O que vem junto da ação, quando ela precisa: o pedido da fila (item), o cliente e a competência, a hora de voltar (ate), e o texto para o histórico (rotulo). */
export interface ExtrasDaAcao { item?: string; cliente?: string; competencia?: string; ate?: string; rotulo?: string }
export interface PedidoDeAcao extends ExtrasDaAcao { maquina: IdMaquina; robo: string; acao: IdAcao; tarefa: string }
export interface DocDoComando extends PedidoDeAcao { por: string; porNome: string; em: string; status: 'pendente'; expiraEm: Date }

// o formato do que acompanha um comando (o robô confere tudo de novo, robo/central.js)
const ITEM_OK = /^[A-Za-z0-9_-]{1,128}$/;
const CLIENTE_OK = /^\d{1,9}$/;
const COMPETENCIA_OK = /^20\d{2}-(0[1-9]|1[0-2])$/;
const PAUSA_MAXIMA_MS = 7 * 24 * HORA;

/**
 * O documento do comando (robosComandos/{id}). Confere o pedido contra o catálogo: ação da lista, robô da máquina,
 * tarefa conhecida. Lança erro com o motivo (a tela mostra). O robô confere tudo de novo (robo/central.js).
 */
export function montarComando(p: { robo: string; acao: string; tarefa?: string; maquina?: string } & ExtrasDaAcao, quem: { uid: string; nome: string }, agora = Date.now()): DocDoComando {
  const acao = acaoPorId(p.acao);
  if (!acao) throw new Error('Ação desconhecida: ' + p.acao);
  if (!quem.uid) throw new Error('Entre com a sua conta para mandar uma ação.');
  let maquina: MaquinaDaCentral | null;
  let robo: string;
  if (acao.alvo === 'maquina') {
    maquina = maquinaPorId(p.maquina || roboPorId(p.robo)?.maquina || '');
    if (!maquina) throw new Error('Máquina desconhecida.');
    robo = p.robo && roboPorId(p.robo)?.maquina === maquina.id ? p.robo : '';
  } else {
    const r = roboPorId(p.robo);
    if (!r) throw new Error('Robô desconhecido: ' + p.robo);
    maquina = maquinaPorId(r.maquina);
    robo = r.id;
    if (acao.id === 'rodar-agora' && !r.tarefas.some(t => t.id === p.tarefa)) throw new Error('Tarefa desconhecida para o ' + r.nome + '.');
    if ((acao.id === 'pausar' || acao.id === 'retomar') && !r.pausavel) throw new Error('O ' + r.nome + ' ainda não sabe pausar.');
    if (acao.id === 'limpar-fila' && !r.limpavel) throw new Error('A fila do ' + r.nome + ' não se limpa por aqui.');
    if (acao.id === 'refazer' || acao.id === 'cancelar-item' || acao.id === 'na-frente') {
      if (!ITEM_OK.test(String(p.item || ''))) throw new Error('Pedido da fila inválido.');
      const pode = acao.id === 'refazer' ? r.itens?.refazer : acao.id === 'cancelar-item' ? r.itens?.cancelar : r.itens?.naFrente;
      if (!pode) throw new Error('A fila do ' + r.nome + ' não deixa isso por aqui.');
    }
    if (acao.id === 'pedir-cliente') {
      if (!r.pedidos?.some(x => x.id === p.tarefa)) throw new Error('Pedido desconhecido para o ' + r.nome + '.');
      if (!CLIENTE_OK.test(String(p.cliente || ''))) throw new Error('Escolha o cliente pelo código.');
      if (!COMPETENCIA_OK.test(String(p.competencia || ''))) throw new Error('Escolha a competência.');
    }
  }
  const extras: ExtrasDaAcao = {};
  if (acao.id === 'refazer' || acao.id === 'cancelar-item' || acao.id === 'na-frente') extras.item = String(p.item);
  if (acao.id === 'pedir-cliente') { extras.cliente = String(p.cliente); extras.competencia = String(p.competencia); }
  if ((acao.id === 'pausar' || acao.id === 'parar-tudo') && p.ate) {
    const t = Date.parse(p.ate);
    if (!Number.isFinite(t) || t <= agora) throw new Error('A hora de voltar já passou.');
    if (t - agora > PAUSA_MAXIMA_MS) throw new Error('A pausa marcada vai até 7 dias, no máximo.');
    extras.ate = new Date(t).toISOString();
  }
  if (p.rotulo) extras.rotulo = String(p.rotulo).slice(0, 120);
  return {
    maquina: maquina!.id, robo, acao: acao.id, tarefa: acao.id === 'rodar-agora' || acao.id === 'pedir-cliente' ? String(p.tarefa) : '',
    por: quem.uid, porNome: String(quem.nome || '').slice(0, 80), em: new Date(agora).toISOString(), status: 'pendente',
    expiraEm: new Date(agora + HISTORICO_DIAS * 24 * HORA), ...extras,
  };
}

export type StatusDoComando = 'pendente' | 'aceito' | 'feito' | 'erro' | 'recusado';
export interface Comando extends PedidoDeAcao {
  id: string; por: string; porNome: string; em: string; status: StatusDoComando; mensagem: string; respondidoEm: string;
}

export function lerComando(id: string, d: Obj): Comando {
  const st = txt(d.status);
  return {
    id, maquina: (txt(d.maquina) || 'servidor') as IdMaquina, robo: txt(d.robo), acao: txt(d.acao) as IdAcao, tarefa: txt(d.tarefa),
    por: txt(d.por), porNome: txt(d.porNome), em: txt(d.em),
    status: (['pendente', 'aceito', 'feito', 'erro', 'recusado'].includes(st) ? st : 'pendente') as StatusDoComando,
    mensagem: txt(d.mensagem), respondidoEm: txt(d.respondidoEm),
    item: txt(d.item), cliente: txt(d.cliente), competencia: txt(d.competencia), ate: txt(d.ate), rotulo: txt(d.rotulo),
  };
}

/** O comando ainda pendente passou da validade (o robô não respondeu em 5 min): a tela mostra "sem resposta". */
export const comandoSemResposta = (c: Comando, agora = Date.now()) => c.status === 'pendente' && idade(c.em, agora) > VALIDADE_DO_COMANDO_MS;

/** O texto do comando para o histórico ("Pausar · SIEG", "Rodar agora: Ler o Gmail agora · Gmail e avisos"). */
export function textoDoComando(c: Pick<Comando, 'acao' | 'robo' | 'tarefa' | 'maquina'> & ExtrasDaAcao): string {
  const a = acaoPorId(c.acao);
  const r = roboPorId(c.robo);
  const tarefa = r?.tarefas.find(t => t.id === c.tarefa)?.nome || c.tarefa;
  const alvo = a?.alvo === 'maquina' ? maquinaPorId(c.maquina)?.nome || c.maquina : r?.nome || c.robo;
  const o = c.acao === 'rodar-agora' && tarefa ? tarefa
    : c.acao === 'pedir-cliente' ? (r?.pedidos?.find(x => x.id === c.tarefa)?.nome || c.tarefa) + ', cliente ' + c.cliente + (c.competencia ? ' (' + mesEAno(c.competencia) + ')' : '')
    : a?.nome || c.acao;
  return alvo + ': ' + o.charAt(0).toLowerCase() + o.slice(1) + (c.rotulo ? ' · ' + c.rotulo : '');
}

export const ROTULO_DO_STATUS: Record<StatusDoComando, string> = { pendente: 'Esperando o robô', aceito: 'Aceito, fazendo', feito: 'Feito', erro: 'Deu erro', recusado: 'Recusado' };
export const TOM_DO_STATUS: Record<StatusDoComando, Tom> = { pendente: 'neutro', aceito: 'aviso', feito: 'ok', erro: 'erro', recusado: 'erro' };

// ---------- a fila pedido a pedido ----------

export interface ItemDaFila {
  id: string; titulo: string; detalhe: string; status: string; rotulo: string; emAndamento: boolean; criadoEm: string; criadoPor: string;
  /** quando foi passado na frente ('' = nunca) */
  naFrenteEm: string;
  podeCancelar: boolean; podePassarNaFrente: boolean;
}

/** "10/2026" a partir de "2026-10" (ou o que veio). */
export function mesEAno(competencia: string): string {
  return /^\d{4}-\d{2}$/.test(competencia) ? competencia.slice(5) + '/' + competencia.slice(0, 4) : competencia;
}

const ROTULO_DO_ITEM: Record<string, string> = { pendente: 'Na fila', aguardando: 'Aguardando', processando: 'Fazendo', trabalhando: 'Fazendo', verificacao: 'Na verificação do gov.br', login: 'Entrando no portal' };
const TIPOS_DO_SIEG: Record<string, string> = { xmls: 'Baixar os XMLs', contagem: 'Contar as notas', zipFaltam: 'O .zip das notas que faltam', xmlsCliente: 'XMLs que o cliente mandou' };
const TIPOS_DO_ALTERDATA: Record<string, string> = { mensal: 'Balancete e razão', balancete: 'Balancete da Conferência', importar: 'Importar lançamentos' };
const TIPOS_DO_GMAIL: Record<string, string> = { verificar: 'Ler o Gmail', um: 'Cobrança', lote: 'Cobrança em lote', salvar: 'Salvar no Drive', disparo: 'Disparo', responder: 'Responder e-mail', desligar: 'Tirar e-mail do cliente errado', envioDp: 'Documentos do DP' };

/** O pedido como a tela mostra (título, o que é, se dá para mexer). */
export function lerItemDaFila(r: RoboDaCentral, id: string, d: Obj): ItemDaFila {
  const itens = r.itens;
  const status = txt(d.status);
  const emAndamento = !!itens && itens.andamento.includes(status);
  const comp = txt(d.competencia);
  const quem = [txt(d.codigo), txt(d.empresa) || txt(d.clienteNome) || txt(d.cliente)].filter(Boolean).join(' ');
  let titulo = quem + (comp ? (quem ? ' ' : '') + '(' + mesEAno(comp) + ')' : '');
  let detalhe = '';
  if (r.id === 'fgts') detalhe = d.modo === 'emitir' ? 'Emitir a guia' : 'Conferir sem emitir';
  else if (r.id === 'sieg') detalhe = TIPOS_DO_SIEG[txt(d.tipo)] || 'Baixar as saídas';
  else if (r.id === 'alterdata') detalhe = TIPOS_DO_ALTERDATA[txt(d.tipo) || 'balancete'] || txt(d.tipo);
  else if (r.id === 'sefaz') detalhe = 'Situação das notas';
  else if (r.id === 'arquivador') { titulo = 'Arquivar agora'; detalhe = d.modo === 'SIMULACAO' ? 'Simulação' : 'Para valer'; }
  else if (r.id === 'vigia') { titulo = txt(d.clienteNome) || txt(d.para) || txt(d.assunto) || TIPOS_DO_GMAIL[txt(d.tipo)] || 'Pedido'; detalhe = TIPOS_DO_GMAIL[txt(d.tipo)] || txt(d.tipo); }
  const espera = !!itens && !emAndamento;
  return {
    id, titulo: titulo || 'Pedido ' + id.slice(0, 6), detalhe, status, rotulo: ROTULO_DO_ITEM[status] || status, emAndamento,
    criadoEm: txt(d.criadoEm) || txt(d.em), criadoPor: txt(d.criadoPor), naFrenteEm: txt(d.naFrenteEm),
    podeCancelar: espera && !!itens?.cancelar, podePassarNaFrente: espera && !!itens?.naFrente,
  };
}

/** A ordem da tela: o que já está andando, os passados na frente (o mais recente primeiro) e depois do mais antigo ao mais novo. */
export function ordenarFila(itens: readonly ItemDaFila[]): ItemDaFila[] {
  const peso = (i: ItemDaFila) => (i.emAndamento ? 0 : i.naFrenteEm ? 1 : 2);
  return [...itens].sort((a, b) => peso(a) - peso(b) || b.naFrenteEm.localeCompare(a.naFrenteEm) || a.criadoEm.localeCompare(b.criadoEm));
}

/**
 * O botão "Refazer" de um erro: 'nao' (o robô não sabe refazer ou o erro não tem pedido: lote que não abriu, erro antigo),
 * 'pode', ou 'pedido' (já pediram depois deste erro, e o robô não recusou).
 */
export function estadoDoRefazer(a: AtividadeDoRobo, comandos: readonly Comando[], agora = Date.now()): 'nao' | 'pode' | 'pedido' {
  const r = roboDaAtividade(a);
  if (!a.erro || !a.pedido || !r?.itens?.refazer) return 'nao';
  const pedido = comandos.some(c => c.acao === 'refazer' && c.item === a.pedido && c.em >= a.em && !comandoSemResposta(c, agora) && c.status !== 'erro' && c.status !== 'recusado');
  return pedido ? 'pedido' : 'pode';
}

// ---------- a pausa geral ----------

export interface PausaGeral {
  pausaveis: RoboDaCentral[];
  pausados: SituacaoDoRoboNaCentral[];
  /** os que continuam trabalhando num "Parar tudo" (não sabem pausar) */
  naoPausam: RoboDaCentral[];
  /** as máquinas com robô pausável ainda trabalhando / com robô pausado (um comando por máquina) */
  paraParar: MaquinaDaCentral[];
  paraRetomar: MaquinaDaCentral[];
  /** a volta marcada mais próxima (ISO); '' se nenhuma */
  voltaEm: string;
}

export function pausaGeral(situacoes: readonly SituacaoDoRoboNaCentral[]): PausaGeral {
  const daLista = (l: readonly SituacaoDoRoboNaCentral[]) => MAQUINAS.filter(m => l.some(s => s.robo.maquina === m.id));
  const pausaveis = situacoes.filter(s => s.robo.pausavel);
  const pausados = pausaveis.filter(s => s.pausa);
  const voltas = pausados.map(s => s.pausa!.ate).filter(Boolean).sort();
  return {
    pausaveis: pausaveis.map(s => s.robo), pausados, naoPausam: situacoes.filter(s => !s.robo.pausavel).map(s => s.robo),
    paraParar: daLista(pausaveis.filter(s => !s.pausa)), paraRetomar: daLista(pausados), voltaEm: voltas[0] || '',
  };
}

/** A hora digitada ("18:30") em ISO: hoje, ou amanhã se essa hora já passou. '' se não for uma hora. */
export function ateDaHora(hora: string, agora = Date.now()): string {
  const m = /^(\d{2}):(\d{2})$/.exec(hora);
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return '';
  const d = new Date(agora);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  if (d.getTime() <= agora) d.setDate(d.getDate() + 1);
  return d.toISOString();
}

/** "às 18:30", ou "em 12/11 às 18:30" se não for hoje. */
export function quandoVolta(ate: string, agora = Date.now()): string {
  const t = Date.parse(ate);
  if (!Number.isFinite(t)) return '';
  const d = new Date(t);
  const dd = (n: number) => String(n).padStart(2, '0');
  const hoje = new Date(agora);
  const mesmo = d.getFullYear() === hoje.getFullYear() && d.getMonth() === hoje.getMonth() && d.getDate() === hoje.getDate();
  return (mesmo ? '' : 'em ' + dd(d.getDate()) + '/' + dd(d.getMonth() + 1) + ' ') + 'às ' + dd(d.getHours()) + ':' + dd(d.getMinutes());
}

/** A competência que a tela sugere: o mês passado ("2026-10"). */
export function competenciaAnterior(agora = Date.now()): string {
  const d = new Date(agora);
  const m = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return m.getFullYear() + '-' + String(m.getMonth() + 1).padStart(2, '0');
}

/** O código do cliente no campo ("486 VS MEDICINA" → "486"); '' se não começa com um código. */
export function codigoDoCampo(texto: string): string {
  const m = /^\s*(\d{1,9})(?:\s|$)/.exec(texto);
  return m ? m[1] : '';
}

// ---------- os registros (robosRegistros/{robo}) ----------

export interface LinhaDoRegistro { em: string; texto: string; nivel: 'info' | 'erro' }
export interface RegistrosDoRobo { robo: string; em: string; linhas: LinhaDoRegistro[]; aoVivoAte: string }

export function lerRegistros(robo: string, d: Obj | null | undefined): RegistrosDoRobo {
  if (!d) return { robo, em: '', linhas: [], aoVivoAte: '' };
  const linhas = (Array.isArray(d.linhas) ? d.linhas : []).map(obj).map(x => ({ em: txt(x.em), texto: txt(x.texto), nivel: (x.nivel === 'erro' ? 'erro' : 'info') as 'info' | 'erro' }))
    .filter(x => x.texto).slice(-LINHAS_DO_REGISTRO);
  return { robo, em: txt(d.em), linhas, aoVivoAte: txt(d.aoVivoAte) };
}

/** A hora da linha do registro ("14:03:12"). */
export function horaDaLinha(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const d = new Date(t);
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, '0')).join(':');
}

/** "há 3 min" (o mesmo do painel), ou '' sem data. */
export const haQuantoTempo = (iso: string, agora = Date.now()) => haQuanto(iso, agora) || '';

/** Uma porcentagem para a barra do widget (0..100) ou null. */
export const porcento = (v: number | null) => (v == null ? null : Math.max(0, Math.min(100, Math.round(v))));

/** O tempo ligado ("3 d 4 h", "5 h", "12 min") a partir de segundos. */
export function tempoLigado(segundos: number | null): string {
  if (segundos == null || !Number.isFinite(segundos) || segundos < 0) return '';
  const min = Math.floor(segundos / 60);
  if (min < 60) return min + ' min';
  const h = Math.floor(min / 60);
  if (h < 24) return h + ' h';
  const d = Math.floor(h / 24);
  return d + ' d' + (h % 24 ? ' ' + (h % 24) + ' h' : '');
}
