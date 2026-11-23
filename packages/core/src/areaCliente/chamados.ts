// Os chamados da Área do Cliente (Vitor, 16/10/2026): o cliente abre (caixa de entrada areaClienteChamados, que o robô
// valida e apaga) e o escritório responde; o robô espelha em areasCliente/{token}/chamados/{id} SÓ o que sai daqui.

export type TipoDeChamado = 'admissao' | 'ferias' | 'demissao' | 'duvida' | 'documento' | 'outro';
export type SituacaoDoChamado = 'aberto' | 'em andamento' | 'respondido' | 'concluido';

export interface MensagemDoChamado {
  de: 'cliente' | 'escritorio';
  /** "Você", ou o primeiro nome de quem do escritório respondeu (12/11/2026: "quero o nome do usuário que mandou"); sem
   *  nome, "Escritório" */
  autor: string;
  texto: string;
  /** ISO */
  em: string;
}

export interface ChamadoDoCliente {
  id: string;
  tipo: TipoDeChamado;
  titulo: string;
  situacao: SituacaoDoChamado;
  mensagens: MensagemDoChamado[];
  /** o passo atual do pedido do DP (23/11/2026, ficha processos-visiveis): só um, nunca a lista */
  passo?: { nome: string; n: number; total: number };
}

/** O chamado como o escritório o guarda: com quem mexeu, observações e notas internas (nada disso sai). */
export interface ChamadoInterno {
  id: string;
  tipo: string;
  titulo: string;
  situacao: string;
  mensagens: { de: string; texto: string; em: string; autor?: string; interna?: boolean }[];
  /** os passos marcados pela equipe ({ nome: ISO }; o formato antigo, uma lista, é ignorado) */
  passos?: unknown;
}

export const TIPOS_DE_CHAMADO: { valor: TipoDeChamado; rotulo: string; dica: string }[] = [
  { valor: 'admissao', rotulo: 'Contratar um funcionário', dica: 'Admissão' },
  { valor: 'ferias', rotulo: 'Férias', dica: 'Marcar ou tirar uma dúvida sobre férias' },
  { valor: 'demissao', rotulo: 'Desligar um funcionário', dica: 'Demissão' },
  { valor: 'duvida', rotulo: 'Tirar uma dúvida', dica: 'Qualquer pergunta para o escritório' },
  { valor: 'documento', rotulo: 'Pedir um documento', dica: 'Certidão, declaração, segunda via…' },
  { valor: 'outro', rotulo: 'Outro assunto', dica: 'O que não se encaixa nos outros' },
];

export const ROTULO_DA_SITUACAO_DO_CHAMADO: Record<SituacaoDoChamado, string> = {
  aberto: 'Aberto', 'em andamento': 'Em andamento', respondido: 'Respondido', concluido: 'Concluído',
};

const TIPOS = new Set<string>(TIPOS_DE_CHAMADO.map(t => t.valor));
const SITUACOES = new Set<string>(['aberto', 'em andamento', 'respondido', 'concluido']);

export const MAIOR_TEXTO_DO_CHAMADO = 4000;

/**
 * O nome de quem do escritório respondeu, como o cliente vê: só o primeiro nome (12/11/2026: "quero o nome do usuário que
 * mandou"; antes, sempre "Escritório"). Sem nome, ou com um e-mail no lugar do nome, fica "Escritório".
 */
export function autorDoEscritorio(autor?: string): string {
  const primeiro = (autor ?? '').trim().split(/\s+/)[0] ?? '';
  if (!primeiro || primeiro.includes('@') || /^escrit[oó]rio$/i.test(primeiro)) return 'Escritório';
  return primeiro.charAt(0).toUpperCase() + primeiro.slice(1).toLowerCase();
}

/** O chamado que o cliente vê: lista branca; do escritório, só o primeiro nome de quem respondeu; nota interna não sai. */
export function chamadoDoCliente(c: ChamadoInterno): ChamadoDoCliente {
  return {
    id: c.id,
    tipo: (TIPOS.has(c.tipo) ? c.tipo : 'outro') as TipoDeChamado,
    titulo: c.titulo,
    situacao: (SITUACOES.has(c.situacao) ? c.situacao : 'aberto') as SituacaoDoChamado,
    mensagens: c.mensagens.filter(m => !m.interna).map(m => {
      const doCliente = m.de === 'cliente';
      return { de: doCliente ? 'cliente' as const : 'escritorio' as const, autor: doCliente ? 'Você' : autorDoEscritorio(m.autor), texto: m.texto, em: m.em };
    }),
    ...(passoDoInterno(c) ? { passo: passoDoInterno(c)! } : {}),
  };
}

/** o passo atual do pedido (23/11/2026, ficha processos-visiveis) */
const passoDoInterno = (c: ChamadoInterno) => passoAtual(c.tipo, lerPassos(c.tipo, c.passos));

/** Confere o que o cliente digitou ao abrir um chamado; devolve o erro em português, ou '' se está bom. */
export function erroDoNovoChamado(tipo: string, texto: string): string {
  if (!TIPOS.has(tipo)) return 'Escolha o assunto.';
  if (!texto.trim()) return 'Conte o que você precisa.';
  if (texto.length > MAIOR_TEXTO_DO_CHAMADO) return 'O texto está muito grande. Resuma um pouco.';
  return '';
}

/** O título do chamado: a primeira linha do texto, curta (o cliente não digita título). */
export function tituloDoChamado(tipo: TipoDeChamado, texto: string): string {
  const linha = texto.trim().split(/\r?\n/)[0] || '';
  const base = TIPOS_DE_CHAMADO.find(t => t.valor === tipo)?.rotulo || 'Chamado';
  return linha ? (linha.length > 60 ? linha.slice(0, 57).trimEnd() + '…' : linha) : base;
}

/** O cliente pode responder enquanto o chamado não foi concluído. */
export function chamadoAceitaResposta(c: Pick<ChamadoDoCliente, 'situacao'>): boolean {
  return c.situacao !== 'concluido';
}

// O passo atual do pedido do DP visível ao cliente (plano do Acessórias, ficha 2A.14 processos-visiveis; o dono, 23/11/2026:
// "Faz, só o passo atual"). Em 16/11/2026 os passos saíram do painel por "muita informação": por isso o cliente vê só UM
// passo, o atual, dentro da solicitação aberta (nunca na lista). A equipe marca o passo em Área do Cliente › Solicitações
// (chamados/{id}.passos { [nome do passo]: ISO }); o robô do PC leva só o passo atual ao espelho { nome, n, total }. Nada de
// nota interna nem do motivo da demissão. Os nomes dos passos são do DP (fáceis de trocar aqui). Só a lógica.
export const PASSOS_POR_TIPO: Partial<Record<TipoDeChamado, readonly string[]>> = {
  admissao: ['Pedido recebido', 'Documentos conferidos', 'eSocial enviado', 'Contrato pronto'],
  demissao: ['Pedido recebido', 'Cálculo da rescisão', 'Guias geradas', 'Rescisão pronta'],
  ferias: ['Pedido recebido', 'Férias calculadas', 'Recibo pronto'],
};

/** Os passos do tipo ([] = o tipo não tem passos). */
export const passosDoTipo = (tipo: string): readonly string[] => PASSOS_POR_TIPO[tipo as TipoDeChamado] ?? [];

/** Os passos marcados, lidos do banco (só os nomes do tipo, com a data ISO). */
export function lerPassos(tipo: string, x: unknown): Record<string, string> {
  const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
  const nomes = passosDoTipo(tipo);
  const r: Record<string, string> = {};
  for (const n of nomes) if (typeof o[n] === 'string' && o[n]) r[n] = (o[n] as string).slice(0, 40);
  return r;
}

/** O passo atual: o último marcado na ordem do tipo (null sem passos ou sem nenhum marcado). */
export function passoAtual(tipo: string, passos: Record<string, string>): { nome: string; n: number; total: number } | null {
  const nomes = passosDoTipo(tipo);
  let atual = -1;
  nomes.forEach((nome, i) => { if (passos[nome]) atual = i; });
  return atual < 0 ? null : { nome: nomes[atual], n: atual + 1, total: nomes.length };
}

/** Marcar um passo marca os anteriores que faltam (o pedido não volta); desmarcar tira ele e os seguintes. */
export function marcarPasso(tipo: string, passos: Record<string, string>, nome: string, marcar: boolean, agora: string): Record<string, string> {
  const nomes = passosDoTipo(tipo);
  const i = nomes.indexOf(nome);
  if (i < 0) return { ...passos };
  const r: Record<string, string> = {};
  nomes.forEach((n, j) => {
    if (marcar ? j <= i : j < i) r[n] = passos[n] || agora;
  });
  return r;
}
