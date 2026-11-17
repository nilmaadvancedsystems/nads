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
}

/** O chamado como o escritório o guarda: com quem mexeu, observações e notas internas (nada disso sai). */
export interface ChamadoInterno {
  id: string;
  tipo: string;
  titulo: string;
  situacao: string;
  mensagens: { de: string; texto: string; em: string; autor?: string; interna?: boolean }[];
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
  };
}

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
