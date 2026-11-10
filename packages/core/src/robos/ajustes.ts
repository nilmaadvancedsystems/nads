// A segunda parte da Central dos robôs (10/11/2026): os ajustes num lugar só, os horários, os alertas e quem pode o quê.
// Tudo aqui só lê e confere; quem grava é o repositório do site, e o robô confere de novo (robo/central.js, horarios.js,
// alertas.js). A lista de ajustes é fechada: um campo fora dela não aparece nem é gravado (a senha, o token, o certificado e
// o endereço do serviço de contas ficam de fora de propósito).
import { ACOES, acaoPorId, ROBOS, MAQUINAS, type RoboDaCentral } from './central';
import catalogo from './catalogo.json';

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
const txt = (v: unknown) => (v == null ? '' : String(v));

// ---------- os ajustes (config/*, o MESMO documento que o robô já lê) ----------

export type ValorDeAjuste = boolean | number | string | string[] | number[];
export type TipoDoAjuste = 'chave' | 'escolha' | 'numero' | 'texto' | 'dias-do-mes' | 'lista-emails';

export interface CampoDeAjuste {
  /** o caminho no documento ('regua.ligada') */
  campo: string; nome: string; descricao: string; tipo: TipoDoAjuste; padrao: ValorDeAjuste;
  opcoes?: { valor: string; nome: string }[]; min?: number; max?: number; maxLetras?: number; formato?: RegExp; dicaDoFormato?: string;
}
export interface GrupoDeAjustes { doc: string; titulo: string; robo: string; campos: CampoDeAjuste[] }

const MODELO = { formato: /^[A-Za-z0-9._-]{0,60}$/, dicaDoFormato: 'Só letras, números, ponto e traço.', maxLetras: 60 };

export const AJUSTES: GrupoDeAjustes[] = [
  { doc: 'fgts', titulo: 'FGTS Digital', robo: 'fgts', campos: [
    { campo: 'onde', nome: 'Onde emite as guias', descricao: 'A máquina que atende os pedidos do FGTS.', tipo: 'escolha', padrao: 'pc', opcoes: [{ valor: 'pc', nome: 'PC do escritório' }, { valor: 'servidor', nome: 'Servidor' }] },
  ] },
  { doc: 'cobranca', titulo: 'Cobrança de documentos', robo: 'vigia', campos: [
    { campo: 'regua.ligada', nome: 'Régua de cobrança', descricao: 'Manda e-mail de cobrança aos clientes nos dias marcados.', tipo: 'chave', padrao: false },
    { campo: 'regua.dias', nome: 'Dias da régua', descricao: 'Dias do mês, de 1 a 28, separados por vírgula.', tipo: 'dias-do-mes', padrao: [] },
    { campo: 'diaLimite', nome: 'Dia limite', descricao: 'Até que dia do mês o cliente tem para mandar (0 = sem dia).', tipo: 'numero', padrao: 0, min: 0, max: 31 },
    { campo: 'comprovanteEmail', nome: 'Comprovante por e-mail', descricao: 'Manda ao cliente o comprovante das entregas confirmadas.', tipo: 'chave', padrao: false },
    { campo: 'assinatura', nome: 'Assinatura', descricao: 'O nome no fim dos e-mails.', tipo: 'texto', padrao: 'Nilma Contabilidade', maxLetras: 120 },
  ] },
  { doc: 'caixasGmail', titulo: 'Envio dos e-mails', robo: 'vigia', campos: [
    { campo: 'enviarPeloRobo', nome: 'Enviar pela caixa do robô', descricao: 'Desligado, a cobrança de cada setor sai pela caixa do próprio setor.', tipo: 'chave', padrao: true },
  ] },
  { doc: 'roboIgnorados', titulo: 'Remetentes ignorados', robo: 'vigia', campos: [
    { campo: 'remetentes', nome: 'Remetentes', descricao: 'O robô não baixa nem lista como desconhecido o e-mail destes endereços.', tipo: 'lista-emails', padrao: [] },
  ] },
  { doc: 'indiceDrive', titulo: 'Índice do Drive', robo: 'vigia', campos: [
    { campo: 'contas', nome: 'Aprender as contas pelos extratos', descricao: 'Lê os extratos das pastas para descobrir as contas bancárias do cliente.', tipo: 'chave', padrao: true },
    { campo: 'marcar', nome: 'Marcar os documentos encontrados', descricao: 'Marca no cadastro o que achou na pasta do cliente.', tipo: 'chave', padrao: false },
  ] },
  { doc: 'integracoes', titulo: 'Inteligência artificial', robo: 'ia', campos: [
    { campo: 'iaMotor', nome: 'Quem responde', descricao: 'O atendente que responde as perguntas do sistema.', tipo: 'escolha', padrao: 'claude', opcoes: [{ valor: 'claude', nome: 'Claude, no PC' }, { valor: 'gemini', nome: 'Gemini, na nuvem' }] },
    { campo: 'iaModeloClaude', nome: 'Modelo do Claude', descricao: 'Em branco, o padrão do robô.', tipo: 'texto', padrao: '', ...MODELO },
    { campo: 'iaModelo', nome: 'Modelo do Gemini', descricao: 'Em branco, o padrão do robô.', tipo: 'texto', padrao: '', ...MODELO },
  ] },
  { doc: 'avisoCertificados', titulo: 'Certificados', robo: 'vigia', campos: [
    { campo: 'ligado', nome: 'Avisar dos certificados vencendo', descricao: 'Avisa os administradores dos certificados do cofre perto do vencimento.', tipo: 'chave', padrao: true },
  ] },
];

const pegar = (d: Obj, caminho: string): unknown => caminho.split('.').reduce<unknown>((o, k) => obj(o)[k], d);

function normalizar(c: CampoDeAjuste, v: unknown): ValorDeAjuste {
  switch (c.tipo) {
    case 'chave': return typeof v === 'boolean' ? v : c.padrao;
    case 'numero': return Number.isFinite(Number(v)) && v !== '' && v != null ? Number(v) : c.padrao;
    case 'escolha': return c.opcoes!.some(o => o.valor === v) ? String(v) : c.padrao;
    case 'texto': return v == null ? c.padrao : String(v);
    case 'dias-do-mes': return Array.isArray(v) ? v.map(Number).filter(n => Number.isInteger(n)) : typeof v === 'string' ? listaDeDias(v) : c.padrao;
    case 'lista-emails': return Array.isArray(v) ? v.map(txt) : c.padrao;
  }
}

/** "5, 10 15" em [5, 10, 15]. */
export function listaDeDias(texto: string): number[] {
  return [...new Set(texto.split(/[^0-9]+/).filter(Boolean).map(Number))].sort((a, b) => a - b);
}

/** Só os campos da lista, com o padrão do robô quando não há valor. Nada mais do documento passa daqui. */
export function lerValores(g: GrupoDeAjustes, d: Obj | null | undefined): Record<string, ValorDeAjuste> {
  const saida: Record<string, ValorDeAjuste> = {};
  for (const c of g.campos) saida[c.campo] = normalizar(c, pegar(obj(d), c.campo));
  return saida;
}

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** '' = serve; senão, o que está errado. */
export function validarAjuste(c: CampoDeAjuste, v: unknown): string {
  switch (c.tipo) {
    case 'chave': return typeof v === 'boolean' ? '' : 'Valor inválido.';
    case 'escolha': return c.opcoes!.some(o => o.valor === v) ? '' : 'Escolha uma das opções.';
    case 'numero': { const n = Number(v); return v !== '' && Number.isInteger(n) && n >= (c.min ?? -Infinity) && n <= (c.max ?? Infinity) ? '' : 'Use um número de ' + c.min + ' a ' + c.max + '.'; }
    case 'texto': if (typeof v !== 'string' || v.length > (c.maxLetras ?? 200)) return 'Texto comprido demais.'; return c.formato && !c.formato.test(v) ? c.dicaDoFormato || 'Formato inválido.' : '';
    case 'dias-do-mes': return Array.isArray(v) && v.every(n => Number.isInteger(n) && n >= 1 && n <= 28) ? '' : 'Dias de 1 a 28.';
    case 'lista-emails': return Array.isArray(v) && v.every(e => EMAIL_OK.test(String(e))) ? '' : 'Tem um endereço de e-mail inválido.';
  }
}

/** O que grava: { regua: { ligada: true } } a partir de { 'regua.ligada': true }, recusando o que não está na lista. */
export function gravacaoDoAjuste(g: GrupoDeAjustes, mudancas: Record<string, ValorDeAjuste>): Obj {
  const saida: Obj = {};
  for (const [campo, valor] of Object.entries(mudancas)) {
    const c = g.campos.find(x => x.campo === campo);
    if (!c) throw new Error('Ajuste fora da lista: ' + campo);
    const erro = validarAjuste(c, valor);
    if (erro) throw new Error(c.nome + ': ' + erro);
    const partes = campo.split('.');
    let alvo = saida;
    for (const p of partes.slice(0, -1)) alvo = (alvo[p] = obj(alvo[p]));
    alvo[partes[partes.length - 1]] = valor;
  }
  return saida;
}

/** O que mudou num grupo, só o que a pessoa mexeu. */
export function mudancasDoGrupo(g: GrupoDeAjustes, antes: Record<string, ValorDeAjuste>, agora: Record<string, ValorDeAjuste>): Record<string, ValorDeAjuste> {
  const saida: Record<string, ValorDeAjuste> = {};
  for (const c of g.campos) if (JSON.stringify(antes[c.campo]) !== JSON.stringify(agora[c.campo])) saida[c.campo] = agora[c.campo];
  return saida;
}

/** O valor em palavras, para a confirmação (de → para). */
export function textoDoAjuste(c: CampoDeAjuste, v: ValorDeAjuste): string {
  if (c.tipo === 'chave') return v ? 'Ligado' : 'Desligado';
  if (c.tipo === 'escolha') return c.opcoes!.find(o => o.valor === v)?.nome || String(v);
  if (Array.isArray(v)) return v.length ? v.join(', ') : 'nenhum';
  return v === '' ? 'em branco' : String(v);
}

// ---------- os horários (config/robosHorarios) ----------

export interface SuporteAoHorario { janela: boolean; intervalo: boolean; nota?: string }
export interface HorarioDoRobo { ativo: boolean; dias: number[]; de: string; ate: string; intervaloMin?: number }

const L = (catalogo as unknown as { limites: { horarios: { janelaMinimaMin: number; intervaloMin: number; intervaloMax: number }; alertas: { repetirMin: number[]; maxPorHora: number[]; semSinalMin: number[]; discoLimite: number[]; padrao: { repetirMin: number; maxPorHora: number; semSinalMin: number; discoLimite: number } } } }).limites;
export const LIMITES_DO_HORARIO = L.horarios;
export const LIMITES_DOS_ALERTAS = L.alertas;

export const ROBOS_COM_HORARIO: RoboDaCentral[] = ROBOS.filter(r => r.horario);
export const HORARIO_PADRAO: HorarioDoRobo = { ativo: false, dias: [1, 2, 3, 4, 5], de: '07:00', ate: '19:00' };
export const DIAS_DA_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const HORA_OK = /^([01]\d|2[0-3]):[0-5]\d$/;
const minutosDe = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));

/** O documento como a tela mostra: quem não tem configuração sai no padrão, desligado. */
export function lerHorarios(d: Obj | null | undefined): Record<string, HorarioDoRobo> {
  const robos = obj(obj(d).robos);
  const saida: Record<string, HorarioDoRobo> = {};
  for (const r of ROBOS_COM_HORARIO) {
    const x = obj(robos[r.id]);
    const dias = Array.isArray(x.dias) ? x.dias.map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 6) : HORARIO_PADRAO.dias;
    saida[r.id] = {
      ativo: x.ativo === true, dias, de: HORA_OK.test(txt(x.de)) ? txt(x.de) : HORARIO_PADRAO.de, ate: HORA_OK.test(txt(x.ate)) ? txt(x.ate) : HORARIO_PADRAO.ate,
      ...(r.horario?.intervalo && Number.isInteger(x.intervaloMin) ? { intervaloMin: x.intervaloMin as number } : {}),
    };
  }
  return saida;
}

export function validarHorario(r: RoboDaCentral, h: HorarioDoRobo): string {
  if (!r.horario) return 'Este robô não aceita horário.';
  if (!h.ativo) return '';
  if (!h.dias.length) return 'Marque pelo menos um dia.';
  if (!HORA_OK.test(h.de) || !HORA_OK.test(h.ate)) return 'Preencha as duas horas.';
  if ((minutosDe(h.ate) - minutosDe(h.de) + 1440) % 1440 < LIMITES_DO_HORARIO.janelaMinimaMin) return 'A janela precisa ter pelo menos 1 hora.';
  if (h.intervaloMin != null && (!r.horario.intervalo || !Number.isInteger(h.intervaloMin) || h.intervaloMin < LIMITES_DO_HORARIO.intervaloMin || h.intervaloMin > LIMITES_DO_HORARIO.intervaloMax)) return 'O intervalo vai de ' + LIMITES_DO_HORARIO.intervaloMin + ' a ' + LIMITES_DO_HORARIO.intervaloMax + ' minutos.';
  return '';
}

/** O horário em palavras, para a confirmação. */
export function textoDoHorario(r: RoboDaCentral, h: HorarioDoRobo): string {
  if (!h.ativo) return 'Sem horário, como sempre';
  const dias = [...h.dias].sort((a, b) => a - b).map(d => DIAS_DA_SEMANA[d]).join(', ');
  return dias + ', das ' + h.de + ' às ' + h.ate + (r.horario?.intervalo && h.intervaloMin ? ', a cada ' + h.intervaloMin + ' min' : '');
}

// ---------- os alertas (config/robosAlertas): tudo começa desligado ----------

export interface AlertasDosRobos {
  ligado: boolean; pessoas: string[];
  erro: { ligado: boolean; robos: string[] };
  semSinal: { ligado: boolean; minutos: number; maquinas: string[] };
  disco: { ligado: boolean; limite: number; maquinas: string[] };
  repetirMin: number; maxPorHora: number;
}

const noLimite = (v: unknown, [min, max]: number[], padrao: number) => { const n = Number(v); return Number.isInteger(n) && n >= min && n <= max ? n : padrao; };
const daLista = (v: unknown, validos: readonly string[]) => (Array.isArray(v) ? [...new Set(v.map(txt))].filter(x => validos.includes(x)) : []);
const ids = (l: readonly { id: string }[]) => l.map(x => x.id);

export function lerAlertas(bruto: Obj | null | undefined): AlertasDosRobos {
  const d = obj(bruto), e = obj(d.erro), s = obj(d.semSinal), q = obj(d.disco), p = LIMITES_DOS_ALERTAS.padrao;
  return {
    ligado: d.ligado === true,
    pessoas: Array.isArray(d.pessoas) ? d.pessoas.map(txt).filter(Boolean) : [],
    erro: { ligado: e.ligado === true, robos: daLista(e.robos, ids(ROBOS)) },
    semSinal: { ligado: s.ligado === true, minutos: noLimite(s.minutos, LIMITES_DOS_ALERTAS.semSinalMin, p.semSinalMin), maquinas: daLista(s.maquinas, ids(MAQUINAS)) },
    disco: { ligado: q.ligado === true, limite: noLimite(q.limite, LIMITES_DOS_ALERTAS.discoLimite, p.discoLimite), maquinas: daLista(q.maquinas, ids(MAQUINAS)) },
    repetirMin: noLimite(d.repetirMin, LIMITES_DOS_ALERTAS.repetirMin, p.repetirMin),
    maxPorHora: noLimite(d.maxPorHora, LIMITES_DOS_ALERTAS.maxPorHora, p.maxPorHora),
  };
}

export function validarAlertas(a: AlertasDosRobos): string {
  const fora = (v: number, [min, max]: number[], nome: string) => (Number.isInteger(v) && v >= min && v <= max ? '' : nome + ' vai de ' + min + ' a ' + max + '.');
  if (a.ligado && !a.pessoas.length) return 'Escolha quem recebe os avisos.';
  if (a.ligado && !a.erro.ligado && !a.semSinal.ligado && !a.disco.ligado) return 'Ligue pelo menos um tipo de aviso.';
  if (a.semSinal.ligado && !a.semSinal.maquinas.length) return 'Escolha as máquinas do aviso de sinal.';
  if (a.disco.ligado && !a.disco.maquinas.length) return 'Escolha as máquinas do aviso de disco.';
  return fora(a.semSinal.minutos, LIMITES_DOS_ALERTAS.semSinalMin, 'O tempo sem sinal') || fora(a.disco.limite, LIMITES_DOS_ALERTAS.discoLimite, 'O limite do disco')
    || fora(a.repetirMin, LIMITES_DOS_ALERTAS.repetirMin, 'O tempo para repetir') || fora(a.maxPorHora, LIMITES_DOS_ALERTAS.maxPorHora, 'O máximo por hora');
}

// ---------- quem pode o quê (robosPermissoes/{uid}) ----------

export type PapelNaCentral = '' | 'ver' | 'comandar' | 'administrar';
export interface PermissaoNaCentral { admin: boolean; papel: PapelNaCentral; robos: string[] }
export const SEM_PERMISSAO: PermissaoNaCentral = { admin: false, papel: '', robos: [] };
export const TODA_PERMISSAO: PermissaoNaCentral = { admin: true, papel: 'administrar', robos: [] };
export const PAPEIS: { id: PapelNaCentral; nome: string; descricao: string }[] = [
  { id: '', nome: 'Sem acesso', descricao: 'Não entra na central.' },
  { id: 'ver', nome: 'Só olhar', descricao: 'Vê os robôs, as filas e os registros; não manda nada.' },
  { id: 'comandar', nome: 'Comandar', descricao: 'Pausa, refaz e mexe na fila dos robôs marcados.' },
  { id: 'administrar', nome: 'Administrar', descricao: 'Todos os robôs, as máquinas e os ajustes. Não muda quem pode o quê.' },
];

export function lerPermissao(d: Obj | null | undefined, admin = false): PermissaoNaCentral {
  if (admin) return TODA_PERMISSAO;
  const x = obj(d);
  const papel = PAPEIS.some(p => p.id === x.papel) ? (x.papel as PapelNaCentral) : '';
  return { admin: false, papel, robos: papel === 'comandar' ? daLista(x.robos, ids(ROBOS)) : [] };
}

export const temAcesso = (p: PermissaoNaCentral) => p.admin || p.papel !== '';
export const administra = (p: PermissaoNaCentral) => p.admin || p.papel === 'administrar';

/** A mesma conta do robô (robo/central.js podeFazer) e da regra do banco. */
export function podeNaCentral(p: PermissaoNaCentral, acao: string, robo?: string): boolean {
  if (administra(p)) return true;
  const a = acaoPorId(acao);
  if (!a) return false;
  if (a.nivel === 'ver') return temAcesso(p);
  return a.nivel === 'comandar' && p.papel === 'comandar' && !!robo && p.robos.includes(robo);
}

export function validarPermissao(p: PermissaoNaCentral): string {
  if (p.papel === 'comandar' && !p.robos.length) return 'Marque pelo menos um robô.';
  return '';
}

/** As ações de "comandar", para conferir com a regra escrita. */
export const ACOES_DE_COMANDAR = ACOES.filter(a => a.nivel === 'comandar').map(a => a.id);
