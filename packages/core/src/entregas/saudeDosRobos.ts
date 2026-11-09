// Saúde dos robôs (Vitor, 07/11/2026: "um painel de saúde dos robôs"): um cartão por robô com o último batimento, o último
// trabalho feito, a fila pendente, os últimos erros e um estado simples (ok / atenção / parado). Só junta o que os robôs já
// gravam: o batimento de cada máquina (robo/painelPC e robo/painelVM: módulos, filas, "fazendo agora" e, desde hoje, o
// último trabalho e o último erro de cada tipo), a atividade dos últimos 7 dias (roboAtividade) e o backup (robo/estado).
// Aqui só as contas; quem lê o banco é o repositório do painel do robô (um ouvinte em dois documentos e na atividade).
import { type AtividadeDoRobo, type BatimentoDoRobo, type DocsDoPainelRobo, type IdRobo, type TomDoPainel, NOMES_DOS_ROBOS, ONDE_RODA, quandoNoPainel } from './painelRobo';
import { haQuanto } from './saude';

/** Um robô (um trabalho) de um dos dois processos: que módulo é, que tipos de atividade e que filas são dele. */
/** chaves: o começo das chaves do "fazendo agora" do painel que são dele. */
export interface DefDoRobo { id: string; nome: string; robo: IdRobo; modulo: string; tipos: readonly string[]; filas: readonly string[]; chaves: readonly string[] }

/** Os robôs de cada máquina. O que o painel já publica (modulos, filas, tipos) decide a que cartão cada coisa pertence. */
export const ROBOS_DA_SAUDE: readonly DefDoRobo[] = [
  { id: 'arquivador', nome: 'Arquivador', robo: 'pc', modulo: 'arquivamento', tipos: ['arquivamento'], filas: ['arquivamento', 'mensagens', 'pedidos-arquivador'], chaves: ['rotina', 'arquivo', 'arquivador-novo', 'arquivamento'] },
  { id: 'sieg', nome: 'SIEG (XMLs)', robo: 'pc', modulo: 'sieg', tipos: ['sieg'], filas: ['sieg'], chaves: ['sieg'] },
  { id: 'fgts', nome: 'FGTS Digital', robo: 'pc', modulo: 'fgts', tipos: ['fgts'], filas: ['fgts'], chaves: ['fgts'] },
  { id: 'alterdata', nome: 'Alterdata (balancete e razão)', robo: 'pc', modulo: 'alterdata', tipos: ['alterdata'], filas: ['alterdata'], chaves: ['alterdata'] },
  { id: 'area-cliente', nome: 'Área do Cliente', robo: 'pc', modulo: 'area-cliente', tipos: ['area-cliente'], filas: ['area-chamados', 'area-envios'], chaves: ['area-cliente'] },
  { id: 'gmail', nome: 'Gmail, cobranças e envios do DP', robo: 'vm', modulo: 'gmail', tipos: ['gmail', 'cobranca', 'extratos'], filas: ['gmail'], chaves: ['gmail'] },
  { id: 'envios', nome: 'Envios do nads', robo: 'vm', modulo: 'envios', tipos: ['envios'], filas: ['envios'], chaves: ['envios'] },
  { id: 'nfse', nome: 'NFS-e dos honorários', robo: 'vm', modulo: 'nfse', tipos: ['nfse'], filas: ['nfse'], chaves: ['nfse'] },
  { id: 'sefaz', nome: 'Situação na SEFAZ', robo: 'vm', modulo: 'sefaz', tipos: ['sefaz'], filas: ['sefaz'], chaves: ['sefaz'] },
];

export interface ErroDoCartao { id: string; texto: string; detalhe: string; quando: string }
export interface FilaDoCartao { esperando: number; andamento: number; /** "há 12 min" */ maisAntigo: string; erro: string }
export interface CartaoDaSaude {
  id: string;
  nome: string;
  /** a máquina onde roda ("Nuvem do Google · robo-nilma") */
  onde: string;
  tom: TomDoPainel;
  /** Ok, Atenção, Parado, Sem informação */
  rotulo: string;
  /** por que não está ok (vazio quando está) */
  motivos: string[];
  /** o último batimento da máquina: "há 1 min", "desligou há 2 h", "nenhum ainda" */
  batimento: string;
  /** o último trabalho feito ("hoje, 09:12"); null: nenhum nos registros */
  ultimoTrabalho: { texto: string; quando: string } | null;
  /** null: este robô não tem fila de pedidos (o backup) */
  fila: FilaDoCartao | null;
  /** o que está fazendo agora */
  fazendo: string[];
  /** os últimos erros (até 3, das últimas 24 h) */
  erros: ErroDoCartao[];
  /** uma linha a mais (o backup: as tentativas do dia) */
  nota: string;
}

/** Sem batimento há mais que isto = parado; mais que ATRASO = atenção. */
export const PARADO_APOS_MIN = 15;
export const ATRASO_APOS_MIN = 3;
/** Pedido esperando há mais que isto = fila parada (atenção). */
export const FILA_VELHA_MIN = 60;
export const ERRO_RECENTE_HORAS = 24;
/** O backup que passou disto é atenção. */
export const BACKUP_VELHO_HORAS = 30;

const MIN = 60 * 1000;
const HORA = 60 * MIN;
type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {});
const txt = (v: unknown) => (v == null ? '' : String(v));
const idade = (iso: string, agora: number) => { const t = Date.parse(iso); return Number.isFinite(t) ? agora - t : Infinity; };
const ROTULO: Record<TomDoPainel, string> = { ok: 'Ok', aviso: 'Atenção', erro: 'Parado', neutro: 'Sem informação' };

/** A situação da máquina pelo batimento: parado (15 min sem sinal ou desligado), atrasado (3 min) ou em dia. */
export function estadoDaMaquina(b: BatimentoDoRobo | null, agora: number): { tom: TomDoPainel; motivo: string; sinal: string } {
  if (!b) return { tom: 'neutro', motivo: 'o robô ainda não publicou o painel', sinal: 'nenhum ainda' };
  if (b.desligadoEm) return { tom: 'erro', motivo: 'o robô foi desligado', sinal: 'desligou ' + (haQuanto(b.desligadoEm, agora) || '') };
  const d = idade(b.em, agora);
  const sinal = haQuanto(b.em, agora) || 'desconhecido';
  if (d >= PARADO_APOS_MIN * MIN) return { tom: 'erro', motivo: 'sem batimento ' + sinal, sinal };
  if (d >= ATRASO_APOS_MIN * MIN) return { tom: 'aviso', motivo: 'batimento atrasado (' + sinal + ')', sinal };
  return { tom: 'ok', motivo: '', sinal };
}

const maisGrave = (a: TomDoPainel, b: TomDoPainel): TomDoPainel => {
  const ordem: TomDoPainel[] = ['ok', 'neutro', 'aviso', 'erro'];
  return ordem.indexOf(b) > ordem.indexOf(a) ? b : a;
};

/** Os cartões dos robôs do painel (PC e nuvem), na ordem de ROBOS_DA_SAUDE. */
export function cartoesDosRobos(painel: DocsDoPainelRobo, agora = Date.now()): CartaoDaSaude[] {
  return ROBOS_DA_SAUDE.map(def => cartaoDoRobo(def, painel.pc, painel.vm, painel.atividades, agora));
}

export function cartaoDoRobo(def: DefDoRobo, pc: BatimentoDoRobo | null, vm: BatimentoDoRobo | null, atividades: readonly AtividadeDoRobo[], agora = Date.now()): CartaoDaSaude {
  const b = def.robo === 'pc' ? pc : vm;
  const maquina = estadoDaMaquina(b, agora);
  const onde = ONDE_RODA[def.robo] + (b?.maquina ? ' · ' + b.maquina : '');
  const base = { id: def.id, nome: def.nome, onde, batimento: maquina.sinal, nota: '' };
  if (!b) {
    return { ...base, tom: 'neutro', rotulo: ROTULO.neutro, motivos: [NOMES_DOS_ROBOS[def.robo] + ': ' + maquina.motivo], ultimoTrabalho: null, fila: null, fazendo: [], erros: [] };
  }
  let tom = maquina.tom;
  const motivos: string[] = maquina.motivo ? [maquina.motivo] : [];

  // o módulo deste robô não ligou (o painel diz por quê)
  const modulo = b.modulos.find(m => m.id === def.modulo);
  if (modulo && !modulo.ligado) { tom = maisGrave(tom, 'aviso'); motivos.push('desligado' + (modulo.motivo ? ': ' + modulo.motivo : '')); }

  // a fila: os pedidos esperando e o mais antigo
  const filas = b.filas.filter(f => def.filas.includes(f.id));
  const esperando = filas.reduce((s, f) => s + f.esperando, 0);
  const andamento = filas.reduce((s, f) => s + f.andamento, 0);
  const antigoEm = filas.filter(f => f.esperando > 0 && f.maisAntigoEm).map(f => f.maisAntigoEm).sort()[0] || '';
  const erroDaFila = filas.map(f => f.erro).find(Boolean) || '';
  if (esperando > 0 && antigoEm && idade(antigoEm, agora) >= FILA_VELHA_MIN * MIN) { tom = maisGrave(tom, 'aviso'); motivos.push('pedido esperando ' + (haQuanto(antigoEm, agora) || '')); }
  if (erroDaFila) { tom = maisGrave(tom, 'aviso'); motivos.push('não consegui contar a fila: ' + erroDaFila); }

  // o último trabalho e os erros: o que o robô guardou no batimento (vale além das 150 linhas lidas) e a atividade
  const dosTipos = atividades.filter(a => a.robo === def.robo && def.tipos.includes(a.tipo));
  let trabalho: { em: string; texto: string } | null = null;
  for (const t of def.tipos) {
    const u = b.ultimos[t]?.trabalho;
    if (u && (!trabalho || u.em > trabalho.em)) trabalho = u;
  }
  for (const a of dosTipos) if (!a.erro && (!trabalho || a.em > trabalho.em)) trabalho = { em: a.em, texto: a.texto };

  const erros = new Map<string, ErroDoCartao & { em: string }>();
  const guardar = (em: string, texto: string, detalhe: string) => {
    if (idade(em, agora) >= ERRO_RECENTE_HORAS * HORA) return;
    erros.set(em + '|' + texto, { id: em + '|' + texto, em, texto, detalhe, quando: quandoNoPainel(em, agora) });
  };
  for (const t of def.tipos) { const e = b.ultimos[t]?.erro; if (e) guardar(e.em, e.texto, e.detalhe); }
  for (const a of dosTipos) if (a.erro) guardar(a.em, a.texto, a.detalhe);
  const recentes = Array.from(erros.values()).sort((x, y) => y.em.localeCompare(x.em));
  // erro depois do último trabalho = ainda está dando erro; erro seguido de trabalho = já passou
  if (recentes.length && (!trabalho || recentes[0].em > trabalho.em)) {
    tom = maisGrave(tom, 'aviso');
    motivos.push('erro ' + (haQuanto(recentes[0].em, agora) || 'recente') + ' sem trabalho depois');
  }

  return {
    ...base, tom, rotulo: ROTULO[tom], motivos,
    ultimoTrabalho: trabalho ? { texto: trabalho.texto, quando: quandoNoPainel(trabalho.em, agora) } : null,
    fila: { esperando, andamento, maisAntigo: esperando > 0 && antigoEm ? haQuanto(antigoEm, agora) : '', erro: erroDaFila },
    fazendo: tom === 'erro' ? [] : b.agora.filter(a => def.chaves.some(c => a.chave.startsWith(c))).map(a => a.texto),
    erros: recentes.slice(0, 3).map(({ id, texto, detalhe, quando }) => ({ id, texto, detalhe, quando })),
  };
}

/**
 * O backup do dia (robo/estado.backup, roda no robô da nuvem): falhou = parado; sem backup bom há mais de 30 h = atenção;
 * com o robô da nuvem parado, no mínimo atenção (quem faz o backup é ele).
 */
export function cartaoDoBackup(estado: Record<string, unknown> | null, vm: BatimentoDoRobo | null, agora = Date.now()): CartaoDaSaude {
  const base = { id: 'backup', nome: 'Backup do banco', onde: ONDE_RODA.vm + (vm?.maquina ? ' · ' + vm.maquina : ''), fila: null, fazendo: [] as string[], erros: [] as ErroDoCartao[] };
  if (!estado || !estado.backup) {
    return { ...base, tom: 'neutro', rotulo: ROTULO.neutro, motivos: ['nenhum backup registrado ainda'], batimento: 'nenhum ainda', ultimoTrabalho: null, nota: '' };
  }
  const b = obj(estado.backup);
  const tentou = txt(b.tentadoEm) || txt(b.em);
  const bom = txt(b.em);
  const motivos: string[] = [];
  let tom: TomDoPainel = 'ok';
  if (b.ok === false) { tom = 'erro'; motivos.push('o último backup falhou' + (txt(b.resumo) ? ': ' + txt(b.resumo) : '')); }
  else if (idade(bom, agora) >= BACKUP_VELHO_HORAS * HORA) { tom = 'aviso'; motivos.push(bom ? 'último backup bom ' + haQuanto(bom, agora) : 'sem backup bom registrado'); }
  const maquina = estadoDaMaquina(vm, agora);
  if (maquina.tom === 'erro' || maquina.tom === 'aviso') { tom = maisGrave(tom, 'aviso'); motivos.push('robô da nuvem: ' + maquina.motivo); }
  const t = obj(estado.backupTentativas);
  const hoje = new Date(agora);
  const dia = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0') + '-' + String(hoje.getDate()).padStart(2, '0');
  const nota = t.dia === dia ? 'Tentativas hoje: backup ' + (Number(t.backup) || 0) + ', planilha ' + (Number(t.planilha) || 0) + ', Drive ' + (Number(t.drive) || 0) : '';
  return {
    ...base, tom, rotulo: ROTULO[tom], motivos, nota,
    batimento: haQuanto(tentou, agora) || 'desconhecido',
    ultimoTrabalho: bom ? { texto: b.ok === false ? 'Último bom: ' + (txt(b.resumo) || 'backup') : txt(b.resumo) || 'Backup feito', quando: quandoNoPainel(bom, agora) } : null,
  };
}

/** O placar de cima: quantos precisam de atenção ou estão parados. */
export function placarDaSaude(cartoes: readonly CartaoDaSaude[]): { parados: number; atencao: number; ok: number; semInfo: number; tom: TomDoPainel } {
  const parados = cartoes.filter(c => c.tom === 'erro').length;
  const atencao = cartoes.filter(c => c.tom === 'aviso').length;
  const ok = cartoes.filter(c => c.tom === 'ok').length;
  const semInfo = cartoes.filter(c => c.tom === 'neutro').length;
  return { parados, atencao, ok, semInfo, tom: parados ? 'erro' : atencao ? 'aviso' : ok ? 'ok' : 'neutro' };
}
