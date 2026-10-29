// O delegador de tarefas (28/10/2026: "preciso montar um delegador de tarefas, esse é o antigo do Toriba"; o "Minhas
// Tarefas" de lá): qualquer pessoa da equipe cria uma tarefa e delega para qualquer outra; quem recebe vê no correio ao
// lado da engrenagem. Cada tarefa tem o título, a descrição, o cliente vinculado (opcional), a prioridade, o prazo, o
// status, quem criou e quem é o responsável, os pareceres (os comentários), o histórico das mudanças e os anexos.
// Aqui só as regras (TypeScript puro): validar, ordenar, filtrar por aba, buscar, montar o histórico de cada mudança e ler
// o documento do banco. A gravação é do repositório da Tarefas (dados/tarefasDelegadas*.ts).
import { nomeNorm } from '../../formatos';

export type Prioridade = 'baixa' | 'normal' | 'alta' | 'urgente';
export type Status = 'pendente' | 'andamento' | 'cancelada' | 'concluida';

/** Uma pessoa da equipe (o uid do login do Entregas e o nome). */
export interface Pessoa { uid: string; nome: string }
/** O cliente vinculado (o código do ERP e o nome; o código pode faltar na empresa nova). */
export interface ClienteVinculado { codigo: number | null; nome: string }
/** Uma linha do parecer ou do histórico: quem (o nome), quando (ISO) e o texto. */
export interface Nota { por: string; em: string; texto: string }
/**
 * Um anexo: o arquivo vai em pedaços no banco; aqui só o que a lista mostra. tamanho = o do arquivo (o que a pessoa baixa);
 * gzip = os pedaços estão em gzip (descomprime ao baixar; sem o campo, os bytes são o próprio arquivo).
 */
export interface Anexo { id: string; nome: string; extensao: string; tamanho: number; em: string; por: string; partes: number; gzip?: true }

export interface TarefaDelegada {
  id: string;
  /** o número para falar da tarefa ("a tarefa 12"), como o ID do Toriba */
  numero: number;
  titulo: string;
  descricao: string;
  cliente: ClienteVinculado | null;
  prioridade: Prioridade;
  /** 'aaaa-mm-dd' ou '' (sem prazo) */
  prazo: string;
  status: Status;
  criadaPor: Pessoa;
  responsavel: Pessoa;
  /** ISO */
  criadaEm: string;
  /** ISO, ou '' (só a concluída tem) */
  concluidaEm: string;
  /** ISO da última mudança */
  atualizadaEm: string;
  pareceres: Nota[];
  historico: Nota[];
  anexos: Anexo[];
}

/** O que a pessoa preenche no cadastro da tarefa (a nova e a aberta). */
export interface Rascunho {
  titulo: string;
  descricao: string;
  cliente: ClienteVinculado | null;
  prioridade: Prioridade;
  prazo: string;
  status: Status;
  responsavel: Pessoa | null;
}

// ---------------------------------------------------------------------------------------------------------------------
// rótulos e limites
// ---------------------------------------------------------------------------------------------------------------------

/** Da mais baixa para a mais alta (a ordem do select, como o Toriba: NORMAL no meio). */
export const PRIORIDADES: readonly { valor: Prioridade; rotulo: string }[] = [
  { valor: 'baixa', rotulo: 'Baixa' },
  { valor: 'normal', rotulo: 'Normal' },
  { valor: 'alta', rotulo: 'Alta' },
  { valor: 'urgente', rotulo: 'Urgente' },
];

/** A legenda do Toriba (Pendente, Em andamento, Cancelada, Concluída) e o tom da bolinha de cada um. */
export const STATUS: readonly { valor: Status; rotulo: string; tom: 'warn' | 'info' | 'neutral' | 'ok' }[] = [
  { valor: 'pendente', rotulo: 'Pendente', tom: 'warn' },
  { valor: 'andamento', rotulo: 'Em andamento', tom: 'info' },
  { valor: 'concluida', rotulo: 'Concluída', tom: 'ok' },
  { valor: 'cancelada', rotulo: 'Cancelada', tom: 'neutral' },
];

export const ehPrioridade = (v: unknown): v is Prioridade => PRIORIDADES.some(p => p.valor === v);
export const ehStatus = (v: unknown): v is Status => STATUS.some(s => s.valor === v);
export const rotuloDaPrioridade = (p: Prioridade): string => PRIORIDADES.find(x => x.valor === p)?.rotulo || p;
export const rotuloDoStatus = (s: Status): string => STATUS.find(x => x.valor === s)?.rotulo || s;
export const tomDoStatus = (s: Status) => STATUS.find(x => x.valor === s)?.tom || 'neutral';

export const MAIOR_TITULO = 200;
export const MAIOR_DESCRICAO = 5000;
export const MAIOR_PARECER = 2000;
/** a tarefa guarda as últimas 300 mudanças (as mais antigas saem) */
export const MAIOR_HISTORICO = 300;
export const MAIS_PARECERES = 200;
/** cada arquivo até 10 MB; a tarefa inteira até 30 MB e 20 arquivos */
export const MAIOR_ANEXO = 10 * 1024 * 1024;
export const MAIOR_TOTAL_DE_ANEXOS = 30 * 1024 * 1024;
export const MAIS_ANEXOS = 20;
export const MAIOR_NOME_DE_ANEXO = 160;
/** a imagem anexada vira WebP com o lado maior até 2000 px (o print e a foto de documento seguem legíveis) */
export const MAIOR_LADO_DA_IMAGEM = 2000;
export const QUALIDADE_DA_IMAGEM = 0.8;

/** O texto pronto para gravar: sem espaços sobrando nas pontas e sem linhas em branco repetidas. */
export function limparTexto(texto: string): string {
  return String(texto || '').replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ---------------------------------------------------------------------------------------------------------------------
// datas
// ---------------------------------------------------------------------------------------------------------------------

/** Hoje, 'aaaa-mm-dd' no fuso do computador. */
export function hojeIso(d = new Date()): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/** '' ou uma data que existe ('2026-02-30' não). */
export function prazoValido(p: string): boolean {
  if (p === '') return true;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(p);
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]);
}

/** 'aaaa-mm-dd' → 'dd/mm/aaaa' ('' fica ''). */
export function prazoParaTela(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? m[3] + '/' + m[2] + '/' + m[1] : '';
}

/** 'dd/mm/aaaa' (do CampoData) → 'aaaa-mm-dd'; vazio → ''; incompleta ou que não existe → null. */
export function prazoDaTela(br: string): string | null {
  const s = String(br || '').trim();
  if (!s) return '';
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (!m) return null;
  const iso = m[3] + '-' + m[2] + '-' + m[1];
  return prazoValido(iso) ? iso : null;
}

// ---------------------------------------------------------------------------------------------------------------------
// validação
// ---------------------------------------------------------------------------------------------------------------------

/** O que impede de salvar a tarefa ('' quando pode). */
export function problemaDaTarefa(r: Rascunho): string {
  const titulo = limparTexto(r.titulo);
  if (!titulo) return 'Escreva o título da tarefa.';
  if (titulo.length > MAIOR_TITULO) return 'O título passou de ' + MAIOR_TITULO + ' caracteres.';
  if (limparTexto(r.descricao).length > MAIOR_DESCRICAO) return 'A descrição passou de ' + MAIOR_DESCRICAO + ' caracteres.';
  if (!r.responsavel || !r.responsavel.uid) return 'Escolha para quem delegar.';
  if (!ehPrioridade(r.prioridade)) return 'Escolha a prioridade.';
  if (!ehStatus(r.status)) return 'Escolha o status.';
  if (!prazoValido(r.prazo)) return 'O prazo não é uma data válida.';
  if (r.cliente && !limparTexto(r.cliente.nome)) return 'O cliente vinculado está sem nome.';
  return '';
}

/** O que impede de escrever o parecer ('' quando pode). */
export function problemaDoParecer(texto: string, t?: Pick<TarefaDelegada, 'pareceres'>): string {
  const x = limparTexto(texto);
  if (!x) return 'Escreva o parecer.';
  if (x.length > MAIOR_PARECER) return 'O parecer passou de ' + MAIOR_PARECER + ' caracteres.';
  if (t && t.pareceres.length >= MAIS_PARECERES) return 'A tarefa chegou ao limite de ' + MAIS_PARECERES + ' pareceres.';
  return '';
}

/** A extensão do arquivo, minúscula e sem o ponto ('' sem extensão). */
export function extensaoDe(nome: string): string {
  const m = /\.([A-Za-z0-9]{1,10})$/.exec(String(nome || '').trim());
  return m ? m[1].toLowerCase() : '';
}

/** O nome do arquivo sem a pasta e sem os caracteres que o Windows não aceita, até 160 caracteres. */
export function nomeDoAnexo(nome: string): string {
  const base = String(nome || '').split(/[\\/]/).pop() || '';
  // os caracteres de controle saem (sem regex: o lint não deixa); os proibidos no Windows viram _
  const limpo = Array.from(base).filter(ch => ch.charCodeAt(0) >= 32).join('').replace(/[\\/:*?"<>|]/g, '_').trim();
  if (limpo.length <= MAIOR_NOME_DE_ANEXO) return limpo || 'arquivo';
  const ext = extensaoDe(limpo);
  return ext ? limpo.slice(0, MAIOR_NOME_DE_ANEXO - ext.length - 1) + '.' + ext : limpo.slice(0, MAIOR_NOME_DE_ANEXO);
}

const IMAGENS = new Set(['jpg', 'jpeg', 'png', 'bmp', 'webp']);
// o que já vem comprimido (o gzip quase não tira nada): compactados, Office novo, áudio, vídeo e as imagens que não redesenho
const JA_COMPRIMIDOS = new Set(['zip', 'rar', '7z', 'gz', 'tgz', 'bz2', 'xz', 'xlsx', 'xlsm', 'docx', 'pptx', 'odt', 'ods', 'odp',
  'mp3', 'm4a', 'ogg', 'mp4', 'mov', 'avi', 'mkv', 'webm', 'gif', 'heic', 'heif']);

/**
 * Como o anexo gasta menos no banco: 'imagem' (redesenha em WebP, menor), 'gzip' (sem perda: PDF, XML, TXT, planilha
 * antiga...) ou 'nada' (já vem comprimido).
 */
export function comoEncolher(nome: string): 'imagem' | 'gzip' | 'nada' {
  const ext = extensaoDe(nome);
  if (IMAGENS.has(ext)) return 'imagem';
  return JA_COMPRIMIDOS.has(ext) ? 'nada' : 'gzip';
}

/** Vale guardar o encolhido só se tirou pelo menos 5% (senão fica o original, sem o trabalho de abrir). */
export const valeEncolher = (original: number, encolhido: number) => encolhido > 0 && encolhido <= original * 0.95;

/** O nome da imagem que virou WebP (foto.PNG → foto.webp). */
export function nomeDaImagemEncolhida(nome: string): string {
  const ext = extensaoDe(nome);
  return (ext ? nome.slice(0, -ext.length - 1) : nome) + '.webp';
}

/**
 * O que impede de anexar estes arquivos à tarefa ('' quando pode): vazio, maior que 10 MB, mais de 20 na tarefa ou a
 * tarefa passando de 30 MB somando os que já tem.
 */
export function problemaDosAnexos(novos: readonly { nome: string; tamanho: number }[], atuais: readonly Pick<Anexo, 'tamanho'>[] = []): string {
  for (const a of novos) {
    if (!a.tamanho) return a.nome + ': o arquivo está vazio.';
    if (a.tamanho > MAIOR_ANEXO) return a.nome + ': passa de ' + MAIOR_ANEXO / 1024 / 1024 + ' MB.';
  }
  if (atuais.length + novos.length > MAIS_ANEXOS) return 'A tarefa aceita até ' + MAIS_ANEXOS + ' arquivos.';
  const total = [...atuais, ...novos].reduce((s, a) => s + a.tamanho, 0);
  if (total > MAIOR_TOTAL_DE_ANEXOS) return 'Os anexos da tarefa passam de ' + MAIOR_TOTAL_DE_ANEXOS / 1024 / 1024 + ' MB.';
  return '';
}

// ---------------------------------------------------------------------------------------------------------------------
// a lista: em aberto, atrasada, ordem, abas e busca
// ---------------------------------------------------------------------------------------------------------------------

/** Pendente ou em andamento (o que o correio conta). */
export const emAberto = (t: Pick<TarefaDelegada, 'status'>): boolean => t.status === 'pendente' || t.status === 'andamento';

/** Em aberto e com o prazo antes de hoje ('aaaa-mm-dd'). */
export function atrasada(t: Pick<TarefaDelegada, 'status' | 'prazo'>, hoje: string): boolean {
  return emAberto(t) && !!t.prazo && t.prazo < hoje;
}

const PESO_DA_PRIORIDADE: Record<Prioridade, number> = { urgente: 0, alta: 1, normal: 2, baixa: 3 };

/**
 * A ordem da lista: as em aberto primeiro — as atrasadas, depois as urgentes, depois o resto —, cada grupo pelo prazo (a
 * sem prazo por último), depois a prioridade e a mais nova. As encerradas (concluídas e canceladas) depois, a que fechou
 * por último em cima.
 */
export function ordenar<T extends Pick<TarefaDelegada, 'status' | 'prazo' | 'prioridade' | 'criadaEm' | 'concluidaEm' | 'atualizadaEm'>>(lista: readonly T[], hoje: string): T[] {
  const grupo = (t: T) => (!emAberto(t) ? 3 : atrasada(t, hoje) ? 0 : t.prioridade === 'urgente' ? 1 : 2);
  const fechou = (t: T) => t.concluidaEm || t.atualizadaEm || t.criadaEm;
  return [...lista].sort((a, b) => {
    const g = grupo(a) - grupo(b);
    if (g) return g;
    if (grupo(a) === 3) return fechou(b).localeCompare(fechou(a));
    const pa = a.prazo || '9999-99-99', pb = b.prazo || '9999-99-99';
    return pa.localeCompare(pb) || PESO_DA_PRIORIDADE[a.prioridade] - PESO_DA_PRIORIDADE[b.prioridade] || b.criadaEm.localeCompare(a.criadaEm);
  });
}

/** As abas da Central: as minhas (eu sou o responsável), as que eu deleguei a outro e as encerradas (minhas ou que criei). */
export type Aba = 'minhas' | 'delegadas' | 'concluidas';

export const ABAS: readonly { valor: Aba; rotulo: string }[] = [
  { valor: 'minhas', rotulo: 'Minhas tarefas' },
  { valor: 'delegadas', rotulo: 'Delegadas por mim' },
  { valor: 'concluidas', rotulo: 'Concluídas' },
];

/** A tarefa é da aba, para quem tem este uid? */
export function naAba(t: Pick<TarefaDelegada, 'status' | 'criadaPor' | 'responsavel'>, aba: Aba, uid: string): boolean {
  const minha = t.responsavel.uid === uid;
  const criei = t.criadaPor.uid === uid;
  if (aba === 'minhas') return minha && emAberto(t);
  if (aba === 'delegadas') return criei && !minha && emAberto(t);
  return (minha || criei) && !emAberto(t);
}

export function daAba<T extends Pick<TarefaDelegada, 'status' | 'criadaPor' | 'responsavel'>>(lista: readonly T[], aba: Aba, uid: string): T[] {
  return lista.filter(t => naAba(t, aba, uid));
}

/** Quantas tem em cada aba (os contadores da lateral; o das minhas é o número do correio). */
export function contarAbas(lista: readonly Pick<TarefaDelegada, 'status' | 'criadaPor' | 'responsavel'>[], uid: string): Record<Aba, number> {
  return { minhas: daAba(lista, 'minhas', uid).length, delegadas: daAba(lista, 'delegadas', uid).length, concluidas: daAba(lista, 'concluidas', uid).length };
}

/** Os status que cada aba mostra (o filtro de status da barra só oferece estes). */
export function statusDaAba(aba: Aba): Status[] {
  return aba === 'concluidas' ? ['concluida', 'cancelada'] : ['pendente', 'andamento'];
}

/** A busca "O que você procura?": no número, no título, na descrição e no cliente (o código ou o nome), sem acento. */
export function buscar<T extends Pick<TarefaDelegada, 'numero' | 'titulo' | 'descricao' | 'cliente'>>(lista: readonly T[], q: string): T[] {
  const termos = nomeNorm(q).split(' ').filter(Boolean);
  if (!termos.length) return [...lista];
  return lista.filter(t => {
    const onde = nomeNorm([t.numero, t.titulo, t.descricao, t.cliente?.codigo ?? '', t.cliente?.nome ?? ''].join(' '));
    return termos.every(x => onde.includes(x));
  });
}

/** Quem pode mudar a tarefa: quem criou ou o responsável. */
export const podeMudar = (t: Pick<TarefaDelegada, 'criadaPor' | 'responsavel'>, uid: string): boolean => !!uid && (t.criadaPor.uid === uid || t.responsavel.uid === uid);
/** Quem pode excluir: quem criou (ou o admin). */
export const podeExcluir = (t: Pick<TarefaDelegada, 'criadaPor'>, uid: string, admin = false): boolean => admin || (!!uid && t.criadaPor.uid === uid);

// ---------------------------------------------------------------------------------------------------------------------
// o histórico de cada mudança
// ---------------------------------------------------------------------------------------------------------------------

const nomeDoCliente = (c: ClienteVinculado) => (c.codigo != null ? c.codigo + ' · ' : '') + c.nome;
const mesmoCliente = (a: ClienteVinculado | null, b: ClienteVinculado | null) => (!a && !b) || (!!a && !!b && a.codigo === b.codigo && a.nome === b.nome);

/** Junta as linhas novas no histórico, guardando só as últimas MAIOR_HISTORICO. */
export function noHistorico(historico: readonly Nota[], novas: readonly Nota[]): Nota[] {
  const junto = [...historico, ...novas];
  return junto.length > MAIOR_HISTORICO ? junto.slice(junto.length - MAIOR_HISTORICO) : junto;
}

/** As linhas do histórico de uma tarefa nova: criou e, se for para outra pessoa, delegou. */
export function historicoDaCriacao(t: Pick<TarefaDelegada, 'criadaPor' | 'responsavel'>, em: string): Nota[] {
  const por = t.criadaPor.nome;
  const linhas: Nota[] = [{ por, em, texto: 'Criou a tarefa' }];
  if (t.responsavel.uid !== t.criadaPor.uid) linhas.push({ por, em, texto: 'Delegou para ' + t.responsavel.nome });
  return linhas;
}

/** O que mudou entre a tarefa e o rascunho salvo, uma linha por mudança (vazio = nada mudou). */
export function historicoDaMudanca(antes: TarefaDelegada, r: Rascunho, por: string, em: string): Nota[] {
  const linhas: string[] = [];
  const titulo = limparTexto(r.titulo);
  if (titulo !== antes.titulo) linhas.push('Mudou o título para "' + titulo + '"');
  if (limparTexto(r.descricao) !== antes.descricao) linhas.push('Mudou a descrição');
  if (!mesmoCliente(antes.cliente, r.cliente)) {
    if (!antes.cliente && r.cliente) linhas.push('Vinculou o cliente ' + nomeDoCliente(r.cliente));
    else if (antes.cliente && !r.cliente) linhas.push('Tirou o cliente ' + nomeDoCliente(antes.cliente));
    else if (antes.cliente && r.cliente) linhas.push('Trocou o cliente de ' + nomeDoCliente(antes.cliente) + ' para ' + nomeDoCliente(r.cliente));
  }
  if (r.responsavel && r.responsavel.uid !== antes.responsavel.uid) linhas.push('Delegou de ' + antes.responsavel.nome + ' para ' + r.responsavel.nome);
  if (r.status !== antes.status) linhas.push('Mudou o status de ' + rotuloDoStatus(antes.status) + ' para ' + rotuloDoStatus(r.status));
  if (r.prioridade !== antes.prioridade) linhas.push('Mudou a prioridade de ' + rotuloDaPrioridade(antes.prioridade) + ' para ' + rotuloDaPrioridade(r.prioridade));
  if (r.prazo !== antes.prazo) {
    if (!antes.prazo) linhas.push('Pôs o prazo ' + prazoParaTela(r.prazo));
    else if (!r.prazo) linhas.push('Tirou o prazo ' + prazoParaTela(antes.prazo));
    else linhas.push('Mudou o prazo de ' + prazoParaTela(antes.prazo) + ' para ' + prazoParaTela(r.prazo));
  }
  return linhas.map(texto => ({ por, em, texto }));
}

export const historicoDoAnexo = (acao: 'anexou' | 'tirou', nome: string, por: string, em: string): Nota =>
  ({ por, em, texto: (acao === 'anexou' ? 'Anexou o arquivo ' : 'Tirou o arquivo ') + nome });
export const historicoDoParecer = (por: string, em: string): Nota => ({ por, em, texto: 'Escreveu um parecer' });

// ---------------------------------------------------------------------------------------------------------------------
// criar e mudar
// ---------------------------------------------------------------------------------------------------------------------

export function rascunhoVazio(responsavel: Pessoa | null): Rascunho {
  return { titulo: '', descricao: '', cliente: null, prioridade: 'normal', prazo: '', status: 'pendente', responsavel };
}

export function rascunhoDe(t: TarefaDelegada): Rascunho {
  return { titulo: t.titulo, descricao: t.descricao, cliente: t.cliente, prioridade: t.prioridade, prazo: t.prazo, status: t.status, responsavel: t.responsavel };
}

/** O rascunho mudou alguma coisa da tarefa? */
export const mudouAlgo = (t: TarefaDelegada, r: Rascunho): boolean => historicoDaMudanca(t, r, '', '').length > 0;

const clienteLimpo = (c: ClienteVinculado | null): ClienteVinculado | null => (c ? { codigo: c.codigo ?? null, nome: limparTexto(c.nome) } : null);

/** A tarefa nova, pronta para gravar (o rascunho já passou por problemaDaTarefa). */
export function nova(r: Rascunho, o: { id: string; numero: number; por: Pessoa; em: string }): TarefaDelegada {
  const responsavel = r.responsavel || o.por;
  const base = { criadaPor: o.por, responsavel };
  return {
    id: o.id, numero: o.numero, titulo: limparTexto(r.titulo), descricao: limparTexto(r.descricao), cliente: clienteLimpo(r.cliente),
    prioridade: r.prioridade, prazo: r.prazo, status: r.status, ...base,
    criadaEm: o.em, concluidaEm: r.status === 'concluida' ? o.em : '', atualizadaEm: o.em,
    pareceres: [], historico: historicoDaCriacao(base, o.em), anexos: [],
  };
}

/**
 * A tarefa com o rascunho salvo: os campos novos, o histórico do que mudou e a data de conclusão (concluiu agora: hoje;
 * saiu de concluída: limpa). Sem mudança, a mesma tarefa.
 */
export function mudar(antes: TarefaDelegada, r: Rascunho, por: Pessoa, em: string): TarefaDelegada {
  const linhas = historicoDaMudanca(antes, r, por.nome, em);
  if (!linhas.length) return antes;
  const concluidaEm = r.status === 'concluida' ? (antes.status === 'concluida' ? antes.concluidaEm : em) : '';
  return {
    ...antes, titulo: limparTexto(r.titulo), descricao: limparTexto(r.descricao), cliente: clienteLimpo(r.cliente),
    prioridade: r.prioridade, prazo: r.prazo, status: r.status, responsavel: r.responsavel || antes.responsavel,
    concluidaEm, atualizadaEm: em, historico: noHistorico(antes.historico, linhas),
  };
}

export function comParecer(t: TarefaDelegada, texto: string, por: string, em: string): TarefaDelegada {
  return { ...t, pareceres: [...t.pareceres, { por, em, texto: limparTexto(texto) }], historico: noHistorico(t.historico, [historicoDoParecer(por, em)]), atualizadaEm: em };
}

export function comAnexos(t: TarefaDelegada, anexos: readonly Anexo[], por: string, em: string): TarefaDelegada {
  if (!anexos.length) return t;
  return { ...t, anexos: [...t.anexos, ...anexos], historico: noHistorico(t.historico, anexos.map(a => historicoDoAnexo('anexou', a.nome, por, em))), atualizadaEm: em };
}

export function semAnexo(t: TarefaDelegada, anexoId: string, por: string, em: string): TarefaDelegada {
  const a = t.anexos.find(x => x.id === anexoId);
  if (!a) return t;
  return { ...t, anexos: t.anexos.filter(x => x.id !== anexoId), historico: noHistorico(t.historico, [historicoDoAnexo('tirou', a.nome, por, em)]), atualizadaEm: em };
}

/** As pessoas da tarefa (quem criou e o responsável, sem repetir): o banco busca por elas. */
export const pessoasDaTarefa = (t: Pick<TarefaDelegada, 'criadaPor' | 'responsavel'>): string[] => [...new Set([t.criadaPor.uid, t.responsavel.uid])];

// ---------------------------------------------------------------------------------------------------------------------
// ler do banco
// ---------------------------------------------------------------------------------------------------------------------

const texto = (v: unknown) => (v == null ? '' : String(v));
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null);
const lerPessoa = (v: unknown): Pessoa => { const p = obj(v); return { uid: texto(p?.uid), nome: texto(p?.nome) }; };
const lerNotas = (v: unknown): Nota[] => (Array.isArray(v) ? v.map(obj).filter((x): x is Record<string, unknown> => !!x).map(x => ({ por: texto(x.por), em: texto(x.em), texto: texto(x.texto) })) : []);

/** O documento do banco como tarefa (o que falta ou veio torto fica no padrão, sem quebrar a lista). */
export function lerTarefa(id: string, x: Record<string, unknown>): TarefaDelegada {
  const c = obj(x.cliente);
  const anexos = Array.isArray(x.anexos) ? x.anexos.map(obj).filter((a): a is Record<string, unknown> => !!a) : [];
  return {
    id, numero: Number(x.numero) || 0, titulo: texto(x.titulo), descricao: texto(x.descricao),
    cliente: c && texto(c.nome) ? { codigo: c.codigo == null || c.codigo === '' || !Number.isFinite(Number(c.codigo)) ? null : Number(c.codigo), nome: texto(c.nome) } : null,
    prioridade: ehPrioridade(x.prioridade) ? x.prioridade : 'normal',
    prazo: typeof x.prazo === 'string' && prazoValido(x.prazo) ? x.prazo : '',
    status: ehStatus(x.status) ? x.status : 'pendente',
    criadaPor: lerPessoa(x.criadaPor), responsavel: lerPessoa(x.responsavel),
    criadaEm: texto(x.criadaEm), concluidaEm: texto(x.concluidaEm), atualizadaEm: texto(x.atualizadaEm) || texto(x.criadaEm),
    pareceres: lerNotas(x.pareceres), historico: lerNotas(x.historico),
    anexos: anexos.map(a => ({ id: texto(a.id), nome: texto(a.nome), extensao: texto(a.extensao), tamanho: Number(a.tamanho) || 0, em: texto(a.em), por: texto(a.por), partes: Number(a.partes) || 0, ...(a.gzip === true ? { gzip: true as const } : {}) }))
      .filter(a => a.id && a.partes > 0),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// exportar
// ---------------------------------------------------------------------------------------------------------------------

export const CABECALHO_DA_PLANILHA = ['Nº', 'Status', 'Título', 'Prioridade', 'Prazo', 'Cliente', 'Responsável', 'Delegada por', 'Criada em', 'Concluída em', 'Descrição'] as const;

const dataDoIso = (iso: string) => (iso ? prazoParaTela(iso.slice(0, 10)) : '');

/** As linhas da planilha (o .xlsx e o .csv do Exportar), na ordem da lista. */
export function linhasDaPlanilha(lista: readonly TarefaDelegada[]): (string | number)[][] {
  return lista.map(t => [
    t.numero, rotuloDoStatus(t.status), t.titulo, rotuloDaPrioridade(t.prioridade), prazoParaTela(t.prazo), t.cliente ? nomeDoCliente(t.cliente) : '',
    t.responsavel.nome, t.criadaPor.nome, dataDoIso(t.criadaEm), dataDoIso(t.concluidaEm), t.descricao,
  ]);
}

/** Uma célula do CSV do escritório (separador ";"): entre aspas quando tem ; aspas ou quebra de linha. */
export function celulaDoCsv(v: string | number): string {
  const s = String(v);
  return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
