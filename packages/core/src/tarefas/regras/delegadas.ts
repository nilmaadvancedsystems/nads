// O delegador de tarefas (28/10/2026: "preciso montar um delegador de tarefas, esse é o antigo do Toriba"; o "Minhas
// Tarefas" de lá): qualquer pessoa da equipe cria uma tarefa e delega para qualquer outra; quem recebe vê no correio ao
// lado da engrenagem. Cada tarefa tem o título, a descrição, o cliente vinculado (opcional), a prioridade, o prazo, o
// status, quem criou e quem é o responsável, os pareceres (os comentários), o histórico das mudanças e os anexos.
// Aqui só as regras (TypeScript puro): validar, ordenar, filtrar por aba, buscar, montar o histórico de cada mudança e ler
// o documento do banco. A gravação é do repositório da Tarefas (dados/tarefasDelegadas*.ts).
import { diaEmBrasilia, nomeNorm } from '../../formatos';

export type Prioridade = 'baixa' | 'normal' | 'alta' | 'urgente';
export type Status = 'pendente' | 'andamento' | 'pausada' | 'cancelada' | 'concluida';

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

/**
 * A etapa que dá para delegar (Vitor, 10/11/2026: Clientes e Fornecedores; 11/11/2026: a Contabilização da Folha, id 'dp', em
 * que os "contas" são os itens do checklist: o código é o id do item).
 */
export type EtapaQueDelega = 'clientes' | 'fornecedores' | 'dp';
export interface ContaDelegada { codigo: string; nome: string }
/**
 * A etapa da Tarefa que foi delegada: a empresa, o período, todas as contas ou só as escolhidas e as que quem recebeu já marcou
 * como feitas. Quem recebe abre só essa etapa; quem pediu vê as feitas ofuscadas.
 */
export interface EtapaDelegada {
  etapa: EtapaQueDelega;
  /** o endereço da empresa e o período, como na rota do executor */
  rota: string; periodo: string;
  todas: boolean;
  /** as escolhidas (vazio com todas) */
  contas: ContaDelegada[];
  /** o código das contas já feitas */
  feitas: string[];
}

export interface TarefaDelegada {
  id: string;
  /** o número para falar da tarefa ("a tarefa 12"), como o ID do Toriba */
  numero: number;
  titulo: string;
  descricao: string;
  /** o primeiro dos clientes vinculados (o campo de antes; quem ainda lê só ele segue vendo um cliente) */
  cliente: ClienteVinculado | null;
  /** os clientes vinculados (09/11/2026: "deixe eu colocar mais de um") */
  clientes: ClienteVinculado[];
  prioridade: Prioridade;
  /** 'aaaa-mm-dd' ou '' (sem prazo) */
  prazo: string;
  /** a hora do prazo, 'hh:mm', ou '' (o dia todo; 09/11/2026) */
  prazoHora: string;
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
  etapaDelegada?: EtapaDelegada;
  /** o pedido de documentos (12/11/2026): quem recebeu anexa e confirma "Anexei tudo, concluir" */
  tipo?: 'documentos';
  /** ISO de quando quem recebeu abriu a tarefa pela primeira vez (o Visualizado de quem delegou; 12/11/2026) */
  visualizadaEm?: string;
}

/** O que a pessoa preenche no cadastro da tarefa (a nova e a aberta). */
export interface Rascunho {
  titulo: string;
  descricao: string;
  clientes: ClienteVinculado[];
  prioridade: Prioridade;
  prazo: string;
  prazoHora: string;
  status: Status;
  responsavel: Pessoa | null;
  /** só ao criar: a etapa que esta tarefa delega */
  etapaDelegada?: EtapaDelegada;
  /** só ao criar: o pedido de documentos */
  tipo?: 'documentos';
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
  { valor: 'pausada', rotulo: 'Pausada', tom: 'neutral' },
  { valor: 'concluida', rotulo: 'Concluída', tom: 'ok' },
  { valor: 'cancelada', rotulo: 'Cancelada', tom: 'neutral' },
];

export const ehPrioridade = (v: unknown): v is Prioridade => PRIORIDADES.some(p => p.valor === v);
export const ehStatus = (v: unknown): v is Status => STATUS.some(s => s.valor === v);
export const rotuloDaPrioridade = (p: Prioridade): string => PRIORIDADES.find(x => x.valor === p)?.rotulo || p;
export const rotuloDoStatus = (s: Status): string => STATUS.find(x => x.valor === s)?.rotulo || s;
export const tomDoStatus = (s: Status) => STATUS.find(x => x.valor === s)?.tom || 'neutral';

export const MAIS_CLIENTES = 20;
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

/** '' ou uma hora que existe, 'hh:mm' (24h). */
export const horaValida = (h: string): boolean => h === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(h);

/** O prazo como a tela mostra: 'dd/mm/aaaa' ou 'dd/mm/aaaa hh:mm'. */
export const prazoComHora = (t: Pick<TarefaDelegada, 'prazo' | 'prazoHora'>): string => (t.prazo ? prazoParaTela(t.prazo) + (t.prazoHora ? ' ' + t.prazoHora : '') : '');

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
  if (r.clientes.length > MAIS_CLIENTES) return 'A tarefa aceita até ' + MAIS_CLIENTES + ' clientes.';
  if (!r.responsavel || !r.responsavel.uid) return 'Escolha para quem delegar.';
  if (!ehPrioridade(r.prioridade)) return 'Escolha a prioridade.';
  if (!ehStatus(r.status)) return 'Escolha o status.';
  if (!prazoValido(r.prazo)) return 'O prazo não é uma data válida.';
  if (!horaValida(r.prazoHora)) return 'A hora do prazo não é válida.';
  if (r.prazoHora && !r.prazo) return 'Escolha a data do prazo.';
  if (r.clientes.some(c => !limparTexto(c.nome))) return 'O cliente vinculado está sem nome.';
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

/** Pendente, em andamento ou pausada (o que o correio conta). */
export const emAberto = (t: Pick<TarefaDelegada, 'status'>): boolean => t.status === 'pendente' || t.status === 'andamento' || t.status === 'pausada';

/** Em aberto e com o prazo antes de hoje ('aaaa-mm-dd'); com a hora do prazo e a de agora ('hh:mm'), hoje também pode ter passado. */
export function atrasada(t: Pick<TarefaDelegada, 'status' | 'prazo'> & { prazoHora?: string }, hoje: string, agora = ''): boolean {
  if (!emAberto(t) || !t.prazo) return false;
  return t.prazo < hoje || (t.prazo === hoje && !!t.prazoHora && !!agora && t.prazoHora < agora);
}

export type GrupoDoPrazo = 'atrasadas' | 'hoje' | 'proximos' | 'depois' | 'sem-prazo';

/** Os grupos da lista, na ordem em que aparecem. */
export const GRUPOS_DO_PRAZO: readonly { valor: GrupoDoPrazo; rotulo: string }[] = [
  { valor: 'atrasadas', rotulo: 'Atrasadas' },
  { valor: 'hoje', rotulo: 'Hoje' },
  { valor: 'proximos', rotulo: 'Próximos 7 dias' },
  { valor: 'depois', rotulo: 'Mais adiante' },
  { valor: 'sem-prazo', rotulo: 'Sem prazo' },
];

/** Em que grupo da lista a tarefa em aberto cai, pelo prazo. */
export function grupoDoPrazo(t: Pick<TarefaDelegada, 'status' | 'prazo'> & { prazoHora?: string }, hoje: string, agora = ''): GrupoDoPrazo {
  if (!t.prazo) return 'sem-prazo';
  if (atrasada(t, hoje, agora)) return 'atrasadas';
  if (t.prazo === hoje) return 'hoje';
  const limite = new Date(Date.parse(hoje + 'T12:00:00Z') + 7 * 86400000).toISOString().slice(0, 10);
  return t.prazo <= limite ? 'proximos' : 'depois';
}

const PESO_DA_PRIORIDADE: Record<Prioridade, number> = { urgente: 0, alta: 1, normal: 2, baixa: 3 };

/**
 * A ordem da lista: as em aberto primeiro — as atrasadas, depois as urgentes, depois o resto —, cada grupo pelo prazo (a
 * sem prazo por último), depois a prioridade e a mais nova. As encerradas (concluídas e canceladas) depois, a que fechou
 * por último em cima.
 */
export function ordenar<T extends Pick<TarefaDelegada, 'status' | 'prazo' | 'prioridade' | 'criadaEm' | 'concluidaEm' | 'atualizadaEm'> & { prazoHora?: string }>(lista: readonly T[], hoje: string, agora = ''): T[] {
  const grupo = (t: T) => (!emAberto(t) ? 3 : atrasada(t, hoje, agora) ? 0 : t.prioridade === 'urgente' ? 1 : 2);
  const fechou = (t: T) => t.concluidaEm || t.atualizadaEm || t.criadaEm;
  return [...lista].sort((a, b) => {
    const g = grupo(a) - grupo(b);
    if (g) return g;
    if (grupo(a) === 3) return fechou(b).localeCompare(fechou(a));
    const pa = a.prazo ? a.prazo + (a.prazoHora || '') : '9999-99-99', pb = b.prazo ? b.prazo + (b.prazoHora || '') : '9999-99-99';
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
  return aba === 'concluidas' ? ['concluida', 'cancelada'] : ['pendente', 'andamento', 'pausada'];
}

/** O número clicado no alto da lista: um status, as atrasadas ou '' (todas da aba). */
export type FiltroDaLista = Status | 'atrasadas' | '';

const ROTULO_DO_NUMERO: Record<Status, string> = { pendente: 'Pendentes', andamento: 'Em andamento', pausada: 'Pausadas', concluida: 'Concluídas', cancelada: 'Canceladas' };

export function filtrarPorSituacao<T extends Pick<TarefaDelegada, 'status' | 'prazo'> & { prazoHora?: string }>(lista: readonly T[], filtro: FiltroDaLista, hoje: string, agora = ''): T[] {
  if (filtro === 'atrasadas') return lista.filter(t => atrasada(t, hoje, agora));
  return filtro ? lista.filter(t => t.status === filtro) : [...lista];
}

/** Os números do alto da lista (09/11/2026: "no pique do financeiro"): o total da aba, um por status e, nas em aberto, as atrasadas. */
export function numerosDaLista(lista: readonly (Pick<TarefaDelegada, 'status' | 'prazo'> & { prazoHora?: string })[], aba: Aba, hoje: string, agora = ''): { filtro: FiltroDaLista; rotulo: string; quantas: number }[] {
  const numeros: { filtro: FiltroDaLista; rotulo: string; quantas: number }[] = [
    { filtro: '', rotulo: aba === 'concluidas' ? 'Encerradas' : 'Em aberto', quantas: lista.length },
    ...statusDaAba(aba).map(s => ({ filtro: s as FiltroDaLista, rotulo: ROTULO_DO_NUMERO[s], quantas: lista.filter(t => t.status === s).length })),
  ];
  if (aba !== 'concluidas') numeros.push({ filtro: 'atrasadas', rotulo: 'Atrasadas', quantas: filtrarPorSituacao(lista, 'atrasadas', hoje, agora).length });
  return numeros;
}

/** A busca "O que você procura?": no número, no título, na descrição e no cliente (o código ou o nome), sem acento. */
export function buscar<T extends Pick<TarefaDelegada, 'numero' | 'titulo' | 'descricao' | 'clientes'>>(lista: readonly T[], q: string): T[] {
  const termos = nomeNorm(q).split(' ').filter(Boolean);
  if (!termos.length) return [...lista];
  return lista.filter(t => {
    const onde = nomeNorm([t.numero, t.titulo, t.descricao, ...t.clientes.flatMap(c => [c.codigo ?? '', c.nome])].join(' '));
    return termos.every(x => onde.includes(x));
  });
}

/** Quem pode mudar a tarefa: quem criou ou o responsável. */
export const podeMudar = (t: Pick<TarefaDelegada, 'criadaPor' | 'responsavel'>, uid: string): boolean => !!uid && (t.criadaPor.uid === uid || t.responsavel.uid === uid);
/** Quem pode excluir: quem criou (ou o admin). */
export const podeExcluir = (t: Pick<TarefaDelegada, 'criadaPor'>, uid: string, admin = false): boolean => admin || (!!uid && t.criadaPor.uid === uid);

/** Um botão de quem vai fazer a tarefa e o status para onde ele leva. */
export interface AcaoDaTarefa { id: 'iniciar' | 'retomar' | 'pausar' | 'concluir'; rotulo: string; status: Status }

/**
 * Os botões do responsável (09/11/2026: "um botão de iniciar, ele pode pausar, e ele pode clicar em concluir"): a pendente
 * inicia ou conclui; a em andamento pausa ou conclui; a pausada retoma ou conclui; a encerrada não tem botão. O Concluir
 * fica em toda tarefa em aberto (12/11/2026: a Clara não conseguiu concluir a que recebeu, a pendente só tinha o Iniciar).
 */
export function acoesDoStatus(s: Status): AcaoDaTarefa[] {
  const concluir: AcaoDaTarefa = { id: 'concluir', rotulo: 'Concluir', status: 'concluida' };
  if (s === 'pendente') return [{ id: 'iniciar', rotulo: 'Iniciar', status: 'andamento' }, concluir];
  if (s === 'andamento') return [{ id: 'pausar', rotulo: 'Pausar', status: 'pausada' }, concluir];
  if (s === 'pausada') return [{ id: 'retomar', rotulo: 'Retomar', status: 'andamento' }, concluir];
  return [];
}

const MOVIMENTO = /^(Iniciou|Retomou|Pausou|Concluiu) a tarefa$|^Mudou o status /;

/** O último movimento da tarefa no histórico (quem iniciou, pausou, retomou ou concluiu, e quando): o controle de quem delegou. */
export function ultimoMovimento(t: Pick<TarefaDelegada, 'historico'>): Nota | null {
  for (let i = t.historico.length - 1; i >= 0; i--) if (MOVIMENTO.test(t.historico[i].texto)) return t.historico[i];
  return null;
}

// ---------------------------------------------------------------------------------------------------------------------
// o expediente: a pausa sozinha no almoço e à noite (12/11/2026)
// ---------------------------------------------------------------------------------------------------------------------
// "a pessoa clica em Iniciar; o sistema pausa sozinho às 11:05 e despausa às 13:00; pausa de novo às 18:05 e despausa às
// 07:00 do dia seguinte". O banco não muda: a tarefa segue Em andamento e a tela mostra Pausada nos intervalos; o tempo
// trabalhado conta só o que caiu dentro do expediente. Os horários são os de Brasília (UTC−3, sem horário de verão desde
// 2019), não os do computador.

const MIN = 60_000;
const FUSO_DE_BRASILIA = -3 * 60;
/** os trechos do dia em que a tarefa em andamento corre, em minutos desde a meia-noite: 07:00–11:05 e 13:00–18:05 */
export const EXPEDIENTE: readonly { de: number; ate: number }[] = [{ de: 7 * 60, ate: 11 * 60 + 5 }, { de: 13 * 60, ate: 18 * 60 + 5 }];

const hhmm = (m: number) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const msDe = (quando: Date | string) => (typeof quando === 'string' ? Date.parse(quando) : quando.getTime());
/** a meia-noite de Brasília do dia de "ms" (em ms UTC) e os minutos desde ela */
function noDiaDeBrasilia(ms: number): { meiaNoite: number; minuto: number } {
  const local = ms + FUSO_DE_BRASILIA * MIN;
  const meiaNoiteLocal = Math.floor(local / (1440 * MIN)) * 1440 * MIN;
  return { meiaNoite: meiaNoiteLocal - FUSO_DE_BRASILIA * MIN, minuto: Math.floor((local - meiaNoiteLocal) / MIN) };
}

/** Agora é intervalo (11:05–13:00 ou 18:05–07:00)? */
export function noIntervalo(agora: Date | string): boolean {
  const ms = msDe(agora);
  if (!Number.isFinite(ms)) return false;
  const { minuto } = noDiaDeBrasilia(ms);
  return !EXPEDIENTE.some(e => minuto >= e.de && minuto < e.ate);
}

/** A próxima virada (pausa ou volta) depois de agora: a tela se redesenha nela. */
export function proximaVirada(agora: Date | string): Date {
  const ms = msDe(agora);
  const { meiaNoite } = noDiaDeBrasilia(ms);
  const viradas = [0, 1].flatMap(dia => EXPEDIENTE.flatMap(e => [e.de, e.ate]).map(m => meiaNoite + (dia * 1440 + m) * MIN));
  return new Date(viradas.find(v => v > ms) as number);
}

/** A hora em que o intervalo de agora acaba ('13:00' ou '07:00'); fora do intervalo, ''. */
export function voltaDoIntervalo(agora: Date | string): string {
  if (!noIntervalo(agora)) return '';
  const { minuto } = noDiaDeBrasilia(msDe(proximaVirada(agora)));
  return hhmm(minuto);
}

/** A situação da tarefa na tela agora: a em andamento aparece Pausada nos intervalos (automatica), e diz quando volta. */
export function situacaoNoHorario(t: Pick<TarefaDelegada, 'status'>, agora: Date | string): { status: Status; automatica: boolean; volta: string } {
  if (t.status !== 'andamento' || !noIntervalo(agora)) return { status: t.status, automatica: false, volta: '' };
  return { status: 'pausada', automatica: true, volta: voltaDoIntervalo(agora) };
}

/** O rótulo do status na tela, com a pausa do intervalo ("Pausada até 13:00"). */
export function rotuloNoHorario(t: Pick<TarefaDelegada, 'status'>, agora: Date | string): string {
  const s = situacaoNoHorario(t, agora);
  return s.automatica ? 'Pausada até ' + s.volta : rotuloDoStatus(s.status);
}

/** Os botões na tela agora: no intervalo, só o Concluir (a tarefa volta sozinha no horário). */
export function acoesNoHorario(t: Pick<TarefaDelegada, 'status'>, agora: Date | string): AcaoDaTarefa[] {
  const acoes = acoesDoStatus(t.status);
  return situacaoNoHorario(t, agora).automatica ? acoes.filter(a => a.id === 'concluir') : acoes;
}

/** Os minutos de expediente entre dois instantes (ms UTC): o que cai fora de 07:00–11:05 e 13:00–18:05 não conta. */
export function minutosDeExpediente(inicio: number, fim: number): number {
  if (!(fim > inicio)) return 0;
  let total = 0;
  for (let dia = noDiaDeBrasilia(inicio).meiaNoite; dia < fim; dia += 1440 * MIN) {
    for (const e of EXPEDIENTE) total += Math.max(0, Math.min(fim, dia + e.ate * MIN) - Math.max(inicio, dia + e.de * MIN));
  }
  return Math.round(total / MIN);
}

const COMECA = /^(Iniciou|Retomou) a tarefa$|^Mudou o status de .* para Em andamento$/;
const PARA = /^(Pausou|Concluiu) a tarefa$|^Mudou o status de Em andamento para /;

/**
 * Os trechos em que a tarefa esteve em andamento, pelo histórico (Iniciou/Retomou até Pausou/Concluiu); o que ainda está
 * em andamento vai até agora. A tarefa criada já em andamento ("Já estava fazendo") sem a linha do Iniciou começa em criadaEm.
 */
export function trechosEmAndamento(t: Pick<TarefaDelegada, 'status' | 'historico' | 'criadaEm'>, agora: Date | string): { de: number; ate: number }[] {
  const trechos: { de: number; ate: number }[] = [];
  let desde: number | null = null;
  let algumMovimento = false;
  for (const h of t.historico) {
    const em = Date.parse(h.em);
    if (!Number.isFinite(em)) continue;
    if (COMECA.test(h.texto)) { algumMovimento = true; if (desde === null) desde = em; }
    else if (PARA.test(h.texto)) {
      // parou sem ter começado no histórico: a tarefa nasceu em andamento
      if (desde === null && !algumMovimento && /^Pausou|^Mudou/.test(h.texto)) desde = Date.parse(t.criadaEm);
      algumMovimento = true;
      if (desde !== null && Number.isFinite(desde)) trechos.push({ de: desde, ate: em });
      desde = null;
    }
  }
  if (t.status === 'andamento') {
    if (desde === null && !algumMovimento) desde = Date.parse(t.criadaEm);
    if (desde !== null && Number.isFinite(desde)) trechos.push({ de: desde, ate: msDe(agora) });
  }
  return trechos;
}

/** Os minutos trabalhados na tarefa: os trechos em andamento, sem os intervalos. */
export const minutosTrabalhados = (t: Pick<TarefaDelegada, 'status' | 'historico' | 'criadaEm'>, agora: Date | string): number =>
  trechosEmAndamento(t, agora).reduce((s, x) => s + minutosDeExpediente(x.de, x.ate), 0);

// ---------------------------------------------------------------------------------------------------------------------
// o pedido de documentos e o Visualizado (12/11/2026)
// ---------------------------------------------------------------------------------------------------------------------
// "Onde o cara que foi delegado a função anexe documentos; após anexar, já dá como concluído": quem recebeu anexa e
// confirma ("Anexei tudo, concluir"; às vezes são vários arquivos). "Visualizado: se a pessoa clicou e visualizou a
// tarefa ou não": a primeira vez que quem recebeu abre a tarefa fica gravada.

export const TITULO_DO_PEDIDO = 'Pedido de documentos';
export const pedeDocumentos = (t: Pick<TarefaDelegada, 'tipo'>): boolean => t.tipo === 'documentos';

/** O pedido de documentos com anexo e em aberto: quem recebeu já pode confirmar que anexou tudo. */
export const podeConfirmarDocumentos = (t: Pick<TarefaDelegada, 'tipo' | 'anexos' | 'status'>): boolean => pedeDocumentos(t) && t.anexos.length > 0 && emAberto(t);

/** Os botões do pedido de documentos: o Concluir vira "Anexei tudo, concluir" quando já tem anexo. */
export function acoesDaTarefa(t: Pick<TarefaDelegada, 'status' | 'tipo' | 'anexos'>, agora: Date | string): AcaoDaTarefa[] {
  const acoes = acoesNoHorario(t, agora);
  return podeConfirmarDocumentos(t) ? acoes.map(a => (a.id === 'concluir' ? { ...a, rotulo: 'Anexei tudo, concluir' } : a)) : acoes;
}

/** Quem recebeu abriu agora e ainda não estava marcada: gravar o visualizadaEm (quem delegou para si mesmo não conta). */
export const marcaVisualizada = (t: Pick<TarefaDelegada, 'responsavel' | 'criadaPor' | 'visualizadaEm'>, uid: string): boolean =>
  !!uid && t.responsavel.uid === uid && t.criadaPor.uid !== uid && !t.visualizadaEm;

/** O Visualizado para quem delegou: 'Visualizada 12/11 14:03' ou 'Ainda não visualizada' (para si mesmo, vazio). */
export function rotuloDaVisualizacao(t: Pick<TarefaDelegada, 'responsavel' | 'criadaPor' | 'visualizadaEm'>): string {
  if (t.responsavel.uid === t.criadaPor.uid) return '';
  const ms = Date.parse(t.visualizadaEm || '');
  if (!Number.isFinite(ms)) return 'Ainda não visualizada';
  const { meiaNoite, minuto } = noDiaDeBrasilia(ms);
  const dia = new Date(meiaNoite - FUSO_DE_BRASILIA * MIN);
  return 'Visualizada ' + String(dia.getUTCDate()).padStart(2, '0') + '/' + String(dia.getUTCMonth() + 1).padStart(2, '0') + ' ' + hhmm(minuto);
}

/** '2h 35min', '40min', '0min'. */
export function duracaoParaTela(minutos: number): string {
  const h = Math.floor(minutos / 60), m = minutos % 60;
  return h ? h + 'h' + (m ? ' ' + m + 'min' : '') : m + 'min';
}
// ---------------------------------------------------------------------------------------------------------------------
// o histórico de cada mudança
// ---------------------------------------------------------------------------------------------------------------------

const clienteLimpo = (c: ClienteVinculado): ClienteVinculado => ({ codigo: c.codigo ?? null, nome: limparTexto(c.nome) });
const nomeDoCliente = (c: ClienteVinculado) => (c.codigo != null ? c.codigo + ' · ' : '') + c.nome;
const mesmoCliente = (a: ClienteVinculado, b: ClienteVinculado) => a.codigo === b.codigo && a.nome === b.nome;
const mesmosClientes = (a: readonly ClienteVinculado[], b: readonly ClienteVinculado[]) => a.length === b.length && a.every((c, i) => mesmoCliente(c, b[i]));

/** A linha do histórico de uma mudança de status: o que os botões fazem tem nome próprio. */
function linhaDoStatus(de: Status, para: Status): string {
  if (para === 'concluida') return 'Concluiu a tarefa';
  if (para === 'pausada') return 'Pausou a tarefa';
  if (para === 'andamento' && de === 'pendente') return 'Iniciou a tarefa';
  if (para === 'andamento' && de === 'pausada') return 'Retomou a tarefa';
  return 'Mudou o status de ' + rotuloDoStatus(de) + ' para ' + rotuloDoStatus(para);
}

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
  const clientes = r.clientes.map(clienteLimpo);
  const sairam = antes.clientes.filter(c => !clientes.some(x => mesmoCliente(x, c)));
  const entraram = clientes.filter(c => !antes.clientes.some(x => mesmoCliente(x, c)));
  if (sairam.length === 1 && entraram.length === 1 && clientes.length === 1) linhas.push('Trocou o cliente de ' + nomeDoCliente(sairam[0]) + ' para ' + nomeDoCliente(entraram[0]));
  else {
    for (const c of sairam) linhas.push('Tirou o cliente ' + nomeDoCliente(c));
    for (const c of entraram) linhas.push('Vinculou o cliente ' + nomeDoCliente(c));
  }
  if (r.responsavel && r.responsavel.uid !== antes.responsavel.uid) linhas.push('Delegou de ' + antes.responsavel.nome + ' para ' + r.responsavel.nome);
  if (r.status !== antes.status) linhas.push(linhaDoStatus(antes.status, r.status));
  if (r.prioridade !== antes.prioridade) linhas.push('Mudou a prioridade de ' + rotuloDaPrioridade(antes.prioridade) + ' para ' + rotuloDaPrioridade(r.prioridade));
  if (r.prazo !== antes.prazo || r.prazoHora !== antes.prazoHora) {
    if (!antes.prazo) linhas.push('Pôs o prazo ' + prazoComHora(r));
    else if (!r.prazo) linhas.push('Tirou o prazo ' + prazoComHora(antes));
    else linhas.push('Mudou o prazo de ' + prazoComHora(antes) + ' para ' + prazoComHora(r));
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
  return { titulo: '', descricao: '', clientes: [], prioridade: 'normal', prazo: '', prazoHora: '', status: 'pendente', responsavel };
}

export function rascunhoDe(t: TarefaDelegada): Rascunho {
  return { titulo: t.titulo, descricao: t.descricao, clientes: t.clientes, prioridade: t.prioridade, prazo: t.prazo, prazoHora: t.prazoHora, status: t.status, responsavel: t.responsavel };
}

/** O rascunho mudou alguma coisa da tarefa? */
export const mudouAlgo = (t: TarefaDelegada, r: Rascunho): boolean => historicoDaMudanca(t, r, '', '').length > 0;


/** Os clientes para gravar e o primeiro deles no campo de antes. */
const comOsClientes = (lista: readonly ClienteVinculado[]) => { const clientes = lista.map(clienteLimpo); return { clientes, cliente: clientes[0] || null }; };

/** A tarefa nova, pronta para gravar (o rascunho já passou por problemaDaTarefa). */
export function nova(r: Rascunho, o: { id: string; numero: number; por: Pessoa; em: string }): TarefaDelegada {
  const responsavel = r.responsavel || o.por;
  const base = { criadaPor: o.por, responsavel };
  return {
    id: o.id, numero: o.numero, titulo: limparTexto(r.titulo), descricao: limparTexto(r.descricao), ...comOsClientes(r.clientes),
    prioridade: r.prioridade, prazo: r.prazo, prazoHora: r.prazoHora, status: r.status, ...base,
    criadaEm: o.em, concluidaEm: r.status === 'concluida' ? o.em : '', atualizadaEm: o.em,
    // a que nasce em andamento ("Já estava fazendo") já leva o Iniciou: o tempo trabalhado conta dali (12/11/2026)
    pareceres: [], historico: [...historicoDaCriacao(base, o.em), ...(r.status === 'andamento' ? [{ por: o.por.nome, em: o.em, texto: 'Iniciou a tarefa' }] : [])], anexos: [],
    ...(r.etapaDelegada ? { etapaDelegada: r.etapaDelegada } : {}),
    ...(r.tipo === 'documentos' ? { tipo: 'documentos' as const } : {}),
  };
}

/** A conta está no que foi delegado? */
export const contaNaDelegacao = (e: EtapaDelegada, codigo: string): boolean => e.todas || e.contas.some(c => c.codigo === codigo);

/** A linha do histórico da conta marcada (ou desmarcada) como feita. */
export const historicoDaContaFeita = (conta: ContaDelegada, feita: boolean, por: string, em: string): Nota => ({ por, em, texto: (feita ? 'Marcou como feita: ' : 'Desmarcou: ') + conta.codigo + ' ' + conta.nome });

/** A tarefa com a conta marcada (ou desmarcada) como feita. */
export function comContaFeita(t: TarefaDelegada, conta: ContaDelegada, feita: boolean, por: string, em: string): TarefaDelegada {
  if (!t.etapaDelegada) return t;
  const resto = t.etapaDelegada.feitas.filter(c => c !== conta.codigo);
  return { ...t, etapaDelegada: { ...t.etapaDelegada, feitas: feita ? [...resto, conta.codigo] : resto }, atualizadaEm: em, historico: noHistorico(t.historico, [historicoDaContaFeita(conta, feita, por, em)]) };
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
    ...antes, titulo: limparTexto(r.titulo), descricao: limparTexto(r.descricao), ...comOsClientes(r.clientes),
    prioridade: r.prioridade, prazo: r.prazo, prazoHora: r.prazoHora, status: r.status, responsavel: r.responsavel || antes.responsavel,
    concluidaEm, atualizadaEm: em, historico: noHistorico(antes.historico, linhas),
  };
}

// gravar só o que a pessoa mudou (30/10/2026, revisão dos dados): o formulário parava de seguir o banco quando a pessoa
// mexia nele, e o Salvar regravava todos os campos do rascunho; o status ou o responsável que outra pessoa tinha mudado
// nesse meio-tempo voltavam ao que era, e o histórico punha a volta no nome de quem salvou

/** O que a pessoa mudou no formulário: só os campos do rascunho diferentes do que ela abriu (vazio = nada). */
export function mudancasDoRascunho(inicial: Rascunho, r: Rascunho): Partial<Rascunho> {
  const m: Partial<Rascunho> = {};
  if (limparTexto(r.titulo) !== limparTexto(inicial.titulo)) m.titulo = r.titulo;
  if (limparTexto(r.descricao) !== limparTexto(inicial.descricao)) m.descricao = r.descricao;
  if (!mesmosClientes(inicial.clientes.map(clienteLimpo), r.clientes.map(clienteLimpo))) m.clientes = r.clientes;
  if (r.prioridade !== inicial.prioridade) m.prioridade = r.prioridade;
  if (r.prazo !== inicial.prazo) m.prazo = r.prazo;
  if (r.prazoHora !== inicial.prazoHora) m.prazoHora = r.prazoHora;
  if (r.status !== inicial.status) m.status = r.status;
  if ((r.responsavel?.uid || '') !== (inicial.responsavel?.uid || '')) m.responsavel = r.responsavel;
  return m;
}

/** O rascunho da tarefa como está agora com as mudanças da pessoa por cima (o resto fica como está no banco). */
export const comMudancas = (t: TarefaDelegada, m: Partial<Rascunho>): Rascunho => ({ ...rascunhoDe(t), ...m });

const CAMPOS_DA_MUDANCA = ['titulo', 'descricao', 'cliente', 'clientes', 'prioridade', 'prazo', 'prazoHora', 'status', 'responsavel', 'concluidaEm'] as const;
export type CampoDaMudanca = typeof CAMPOS_DA_MUDANCA[number];

/**
 * A gravação das mudanças da pessoa sobre a tarefa como está no banco agora: os campos que mudam de fato (só os que a
 * pessoa mexeu, e a data de conclusão quando o status muda), as linhas do histórico só desses campos e a tarefa já mudada.
 * Sem mudança (a pessoa voltou atrás, ou outra pessoa já tinha feito o mesmo), nada a gravar: linhas vazias.
 */
export function gravacaoDasMudancas(antes: TarefaDelegada, m: Partial<Rascunho>, por: Pessoa, em: string): {
  campos: Partial<Pick<TarefaDelegada, CampoDaMudanca>>; linhas: Nota[]; tarefa: TarefaDelegada;
} {
  const r = comMudancas(antes, m);
  const linhas = historicoDaMudanca(antes, r, por.nome, em);
  const tarefa = mudar(antes, r, por, em);
  const campos: Record<string, unknown> = {};
  for (const k of CAMPOS_DA_MUDANCA) if (JSON.stringify(tarefa[k]) !== JSON.stringify(antes[k])) campos[k] = tarefa[k];
  return { campos: campos as Partial<Pick<TarefaDelegada, CampoDaMudanca>>, linhas, tarefa };
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
  const lerCliente = (v: unknown): ClienteVinculado | null => {
    const c = obj(v);
    return c && texto(c.nome) ? { codigo: c.codigo == null || c.codigo === '' || !Number.isFinite(Number(c.codigo)) ? null : Number(c.codigo), nome: texto(c.nome) } : null;
  };
  const cliente = lerCliente(x.cliente);
  // a tarefa de antes só tem o campo cliente
  const clientes = Array.isArray(x.clientes) && x.clientes.length ? x.clientes.map(lerCliente).filter((c): c is ClienteVinculado => !!c) : cliente ? [cliente] : [];
  const anexos = Array.isArray(x.anexos) ? x.anexos.map(obj).filter((a): a is Record<string, unknown> => !!a) : [];
  const ed = obj(x.etapaDelegada);
  const lerContas = (v: unknown): ContaDelegada[] => (Array.isArray(v) ? v.map(obj).filter((c): c is Record<string, unknown> => !!c).map(c => ({ codigo: texto(c.codigo), nome: texto(c.nome) })) : []);
  const etapaDelegada: EtapaDelegada | null = ed && (ed.etapa === 'clientes' || ed.etapa === 'fornecedores' || ed.etapa === 'dp')
    ? { etapa: ed.etapa, rota: texto(ed.rota), periodo: texto(ed.periodo), todas: ed.todas === true, contas: lerContas(ed.contas), feitas: Array.isArray(ed.feitas) ? ed.feitas.map(texto) : [] }
    : null;
  return {
    id, numero: Number(x.numero) || 0, titulo: texto(x.titulo), descricao: texto(x.descricao),
    cliente, clientes,
    prioridade: ehPrioridade(x.prioridade) ? x.prioridade : 'normal',
    prazo: typeof x.prazo === 'string' && prazoValido(x.prazo) ? x.prazo : '',
    prazoHora: typeof x.prazoHora === 'string' && horaValida(x.prazoHora) ? x.prazoHora : '',
    status: ehStatus(x.status) ? x.status : 'pendente',
    criadaPor: lerPessoa(x.criadaPor), responsavel: lerPessoa(x.responsavel),
    criadaEm: texto(x.criadaEm), concluidaEm: texto(x.concluidaEm), atualizadaEm: texto(x.atualizadaEm) || texto(x.criadaEm),
    pareceres: lerNotas(x.pareceres), historico: lerNotas(x.historico),
    anexos: anexos.map(a => ({ id: texto(a.id), nome: texto(a.nome), extensao: texto(a.extensao), tamanho: Number(a.tamanho) || 0, em: texto(a.em), por: texto(a.por), partes: Number(a.partes) || 0, ...(a.gzip === true ? { gzip: true as const } : {}) }))
      .filter(a => a.id && a.partes > 0),
    ...(etapaDelegada ? { etapaDelegada } : {}),
    ...(x.tipo === 'documentos' ? { tipo: 'documentos' as const } : {}),
    ...(texto(x.visualizadaEm) ? { visualizadaEm: texto(x.visualizadaEm) } : {}),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// exportar
// ---------------------------------------------------------------------------------------------------------------------

export const CABECALHO_DA_PLANILHA = ['Nº', 'Status', 'Título', 'Prioridade', 'Prazo', 'Cliente', 'Responsável', 'Delegada por', 'Criada em', 'Concluída em', 'Descrição'] as const;

// o dia em Brasília (31/10/2026: cortar o ISO, que é UTC, dava o dia seguinte para a tarefa criada ou concluída depois das 21h)
const dataDoIso = (iso: string) => (iso ? prazoParaTela(diaEmBrasilia(iso)) : '');

/** As linhas da planilha (o .xlsx e o .csv do Exportar), na ordem da lista. */
export function linhasDaPlanilha(lista: readonly TarefaDelegada[]): (string | number)[][] {
  return lista.map(t => [
    t.numero, rotuloDoStatus(t.status), t.titulo, rotuloDaPrioridade(t.prioridade), prazoComHora(t), t.clientes.map(nomeDoCliente).join(', '),
    t.responsavel.nome, t.criadaPor.nome, dataDoIso(t.criadaEm), dataDoIso(t.concluidaEm), t.descricao,
  ]);
}

/** Uma célula do CSV do escritório (separador ";"): entre aspas quando tem ; aspas ou quebra de linha. */
export function celulaDoCsv(v: string | number): string {
  const s = String(v);
  return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
