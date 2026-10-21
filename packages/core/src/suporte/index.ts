// @nads/core/suporte — o suporte de leitura do nads (Vitor, 20/10/2026): o balão do canto de baixo, à direita. A conversa
// começa guiada por cápsulas (o problema, o banco, o mês), já com a tela, a empresa e o período de onde a pessoa está, e
// termina nas instruções, diretas, só os passos. Não resolveu: vira um bug nos Feedbacks (aba Bugs), com o arquivo, e o
// robô do PC do escritório investiga e escreve o report, que termina em "Realmente, isso é erro do sistema" ou "Precisa da
// sua análise". Só leitura de arquivo; criar coisa nova é com o Vitor ou o Gustavo. TypeScript puro: quem chama desenha.

/** A tela em que a pessoa está, do jeito que o suporte entende. */
export type TelaDoSuporte = 'bancos' | 'balancete' | 'notas' | 'razao' | 'outra';

export interface ContextoDoSuporte {
  tela: TelaDoSuporte;
  /** o nome da tela como aparece ("Bancos", "Balancete e razões", "Caixa") */
  rotuloDaTela: string;
  empresa: string;
  codigo: number | null;
  /** os meses da tarefa ('aaaa-mm'), em ordem */
  meses: string[];
  /** os bancos da empresa (o nome de cada conta, como aparece na tela) */
  bancos: string[];
  /** onde a pessoa está, por extenso ("Importação › Bancos") */
  pagina?: string;
  /** os botões de importação que estão na página (lidos da tela, já sem o mês: "Importar extrato", "Importar razão") */
  botoes?: string[];
}

export interface OpcaoDoSuporte { id: string; rotulo: string }

export type PassoDoSuporte =
  /**
   * aviso: uma fala antes da pergunta ("Você está na página…"). multipla: dá para marcar mais de uma e confirmar (a
   * resposta é o prefixo + os valores separados por '|'); a opção "Todos" (prefixo + '*') e o "Outro" respondem na hora.
   */
  | { tipo: 'pergunta'; texto: string; opcoes: OpcaoDoSuporte[]; aviso?: string; multipla?: boolean }
  /** as instruções, com onde a pessoa está antes; depois, a tela pergunta "Resolveu" / "Não resolveu" */
  | { tipo: 'instrucoes'; passos: string[]; aviso?: string }
  /** mandar ao suporte: o arquivo e uma frase */
  | { tipo: 'encaminhar'; texto: string };

/** "Não resolveu" (e o "Outro"): a escolha que leva ao encaminhar. */
export const NAO_RESOLVEU = 'nao-resolveu';
export const OUTRO = 'outro';

/** A tela pelo nome da aba ou da etapa aberta. */
export function telaPeloRotulo(rotulo: string): TelaDoSuporte {
  const r = sem(rotulo);
  if (/^bancos?\b|extrato/.test(r)) return 'bancos';
  if (/balancete|razoes/.test(r)) return 'balancete';
  if (/^(entradas|saidas|tomados|prestados)\b|nota/.test(r)) return 'notas';
  if (/caixa|razao|salario|inss|fgts|pro ?labore|honorario|emprestimo|adiantamento|cliente|fornecedor/.test(r)) return 'razao';
  return 'outra';
}

const sem = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const rotuloDoMes = (m: string) => m.slice(5) + '/' + m.slice(0, 4);
const ENCAMINHAR = 'Anexe o arquivo que deu problema e envie. Vai para o suporte.';

/** O que aconteceu, por tela (a primeira pergunta). */
const PROBLEMAS: Record<TelaDoSuporte, OpcaoDoSuporte[]> = {
  bancos: [
    { id: 'leu-errado', rotulo: 'Leu errado' }, { id: 'faltou', rotulo: 'Faltou lançamento' }, { id: 'mes', rotulo: 'Mês errado' },
    { id: 'travou', rotulo: 'Travou ao importar' }, { id: 'drive', rotulo: 'Não puxou do Drive' },
  ],
  balancete: [
    { id: 'din-errado', rotulo: 'Dinâmico leu errado' }, { id: 'din-travou', rotulo: 'Travou ao subir o dinâmico' },
    { id: 'razao-errado', rotulo: 'Razão leu errado' }, { id: 'razao-mes', rotulo: 'Razão sem algum mês' },
  ],
  notas: [{ id: 'notas-errado', rotulo: 'Notas lidas errado' }, { id: 'notas-faltaram', rotulo: 'Faltaram notas' }, { id: 'travou', rotulo: 'Travou ao importar' }],
  razao: [{ id: 'razao-errado', rotulo: 'Razão leu errado' }, { id: 'razao-mes', rotulo: 'Razão sem algum mês' }, { id: 'travou', rotulo: 'Travou ao importar' }],
  outra: [{ id: 'leu-errado', rotulo: 'Arquivo lido errado' }, { id: 'travou', rotulo: 'Travou ao importar' }],
};

/** Os problemas que precisam do banco e do mês antes das instruções (as cápsulas seguintes). */
const COM_BANCO_E_MES = new Set(['leu-errado', 'faltou', 'mes', 'drive']);

/** O que a importação fez (a pergunta depois do "Não resolveu"). */
const EFEITOS: OpcaoDoSuporte[] = [
  { id: 'e:nada', rotulo: 'Não leu nada' }, { id: 'e:valores', rotulo: 'Leu valores errados' }, { id: 'e:faltaram', rotulo: 'Faltaram lançamentos' },
  { id: 'e:datas', rotulo: 'Datas ou mês errados' }, { id: 'e:travou', rotulo: 'Travou ou demorou' },
];
/** O arquivo que a pessoa subiu. */
const ARQUIVOS: OpcaoDoSuporte[] = [
  { id: 'a:pdf', rotulo: 'PDF do banco' }, { id: 'a:foto', rotulo: 'Foto ou escaneado' }, { id: 'a:ofx', rotulo: 'OFX' }, { id: 'a:planilha', rotulo: 'Planilha (XLS)' },
];
/** "Todos" numa pergunta de várias respostas (o prefixo + '*'). */
export const TODOS = '*';
/** Entre as respostas de uma pergunta de várias ('m:2026-01|2026-02'). */
export const SEPARADOR = '|';
/**
 * As opções de uma pergunta de várias respostas (Vitor, 21/10/2026: "tem algumas respostas que precisam ser múltiplas ou
 * todas"): as opções, o "Todos" (com mais de uma) e o "Outro" por último (21/10/2026: "colocando a última opção como outro").
 */
const comOutro = (prefixo: string, opcoes: OpcaoDoSuporte[]): OpcaoDoSuporte[] => [
  ...opcoes, ...(opcoes.length > 1 ? [{ id: prefixo + TODOS, rotulo: 'Todos' }] : []), { id: prefixo + OUTRO, rotulo: 'Outro' },
];
/** "a", "a e b", "a, b e c" */
const juntar = (l: readonly string[]) => (l.length <= 1 ? l.join('') : l.slice(0, -1).join(', ') + ' e ' + l[l.length - 1]);

/** O período por extenso ("01/2026 a 08/2026"). */
const periodoDe = (meses: readonly string[]) => (meses.length ? rotuloDoMes(meses[0]) + (meses.length > 1 ? ' a ' + rotuloDoMes(meses[meses.length - 1]) : '') : '');
const empresaDe = (ctx: ContextoDoSuporte) => (ctx.empresa ? (ctx.codigo != null ? ctx.codigo + ' · ' : '') + ctx.empresa : '');

/** Onde a pessoa está, em uma frase (Vitor, 21/10/2026: "Você está na página de tal tal tal…"). */
export function ondeEsta(ctx: ContextoDoSuporte): string {
  const empresa = empresaDe(ctx), periodo = periodoDe(ctx.meses);
  return 'Você está na página ' + (ctx.pagina || ctx.rotuloDaTela) + (empresa ? ', na empresa ' + empresa : '') + (periodo ? ', em ' + periodo : '') + '.';
}

/**
 * O próximo passo da conversa, pelas escolhas até aqui (os ids das cápsulas, na ordem). Prefixos: banco 'b:', mês 'm:',
 * botão 'i:', o que aconteceu 'e:', o arquivo 'a:'; o "Outro" de cada um é o prefixo + 'outro'. Com um banco só (ou um mês
 * só), não pergunta: já vale. Depois do "Não resolveu" (ou do Outro do problema), as perguntas do report, uma por vez.
 */
export function passoDoSuporte(ctx: ContextoDoSuporte, escolhas: readonly string[]): PassoDoSuporte {
  const [problema] = escolhas;
  if (!problema) return { tipo: 'pergunta', texto: 'O que aconteceu?', opcoes: [...PROBLEMAS[ctx.tela], { id: OUTRO, rotulo: 'Outro' }] };
  const banco = escolhido(escolhas, 'b:', ctx.bancos);
  const mes = escolhido(escolhas, 'm:', ctx.meses);
  const pergunta = (prefixo: string, texto: string, opcoes: OpcaoDoSuporte[], aviso?: string): PassoDoSuporte =>
    ({ tipo: 'pergunta', aviso, texto, multipla: true, opcoes: comOutro(prefixo, opcoes) });
  const perguntaBanco = (aviso?: string) => pergunta('b:', 'Qual banco?', ctx.bancos.map(b => ({ id: 'b:' + b, rotulo: b })), aviso);
  const perguntaMes = (aviso?: string) => pergunta('m:', 'Qual mês?', ctx.meses.map(m => ({ id: 'm:' + m, rotulo: rotuloDoMes(m) })), aviso);
  if (problema !== OUTRO && !escolhas.includes(NAO_RESOLVEU)) {
    if (ctx.tela === 'bancos' && COM_BANCO_E_MES.has(problema)) {
      if (banco === undefined) return perguntaBanco();
      if (mes === undefined) return perguntaMes();
    }
    return { tipo: 'instrucoes', aviso: ondeEsta(ctx), passos: instrucoes(ctx, problema, banco || [], mes || []) };
  }
  // as perguntas do report; a primeira depois do Outro do problema diz onde a pessoa está
  const aviso = problema === OUTRO && escolhas.length === 1 ? ondeEsta(ctx) : undefined;
  const botoes = ctx.botoes || [];
  if (botoes.length && !escolhas.some(e => e.startsWith('i:'))) {
    return pergunta('i:', 'Qual dos botões de importação está com problema?', botoes.map(b => ({ id: 'i:' + b, rotulo: b })), aviso);
  }
  if (ctx.tela === 'bancos' && banco === undefined) return perguntaBanco(aviso);
  if (mes === undefined) return perguntaMes(aviso);
  if (!escolhas.some(e => e.startsWith('e:'))) return pergunta('e:', 'O que aconteceu ao importar?', EFEITOS, aviso);
  if (!escolhas.some(e => e.startsWith('a:'))) return pergunta('a:', 'Que arquivo você subiu?', ARQUIVOS);
  return { tipo: 'encaminhar', texto: ENCAMINHAR };
}

/**
 * Os bancos ou os meses escolhidos (vários, separados por '|'; o "Todos" = todas as opções; o "Outro" = nenhum); com uma
 * opção só, ela (sem nenhuma, nada — não pergunta). undefined = falta perguntar.
 */
function escolhido(escolhas: readonly string[], prefixo: string, opcoes: readonly string[]): string[] | undefined {
  const e = escolhas.find(x => x.startsWith(prefixo));
  if (e) {
    const v = e.slice(prefixo.length);
    return v === OUTRO ? [] : v === TODOS ? [...opcoes] : v.split(SEPARADOR).filter(Boolean);
  }
  if (opcoes.length <= 1) return [...opcoes];
  return undefined;
}

/** As instruções: diretas, só os passos (Vitor, 20/10/2026: "seja mais direto, só passa as instruções"). */
function instrucoes(ctx: ContextoDoSuporte, problema: string, bancos: readonly string[], meses: readonly string[]): string[] {
  const banco = bancos.length ? juntar(bancos) : 'o banco';
  const m = meses.length ? juntar(meses.map(rotuloDoMes)) : 'o mês';
  const mes = meses.length === 1 ? meses[0] : undefined;
  const periodo = ctx.meses.length ? rotuloDoMes(ctx.meses[0]) + ' a ' + rotuloDoMes(ctx.meses[ctx.meses.length - 1]) : 'o período da tarefa';
  switch (problema) {
    case 'leu-errado':
    case 'faltou':
      return ctx.tela === 'bancos'
        ? [`Clique no ✓ de ${m} do ${banco} para tirar o importado.`, 'Baixe o extrato em PDF no site do banco (não foto, não print).', `Suba o PDF em ${m} do ${banco}.`]
        : ['Tire o arquivo importado (clique no ✓ dele).', 'Gere o arquivo de novo no sistema de origem, no formato original (PDF, XLS).', 'Suba de novo.'];
    case 'mes':
      return [`Clique no ✓ de ${m} do ${banco} para tirar o importado.`, `Suba em ${m} o extrato que começa e termina nesse mês.`];
    case 'drive':
      return [`Confira se o PDF está no Drive em CONTÁBIL › EXTRATOS › ${mes ? mes.slice(0, 4) : 'ano'} › ${mes ? mes.slice(5) : 'mês'} › BANCÁRIOS › ${bancos.length === 1 ? banco.toUpperCase() : 'BANCO'}.`, `Clique no ícone do Drive de ${m} do ${banco}.`];
    case 'travou':
    case 'din-travou':
      return ['Recarregue a página com Ctrl+F5.', 'Suba um arquivo por vez.', 'Espere a barra do topo terminar antes de clicar de novo (arquivo grande leva alguns segundos).'];
    case 'din-errado':
      return [`No Alterdata, gere o Balancete dinâmico de ${periodo}.`, 'Exporte em XLS.', 'Clique no ✓ do Balancete dinâmico para tirar o importado.', 'Suba o XLS de novo.'];
    case 'razao-errado':
      return ['No Alterdata, exporte o razão da conta em XLS.', 'Suba o XLS de novo em Razões das contas.'];
    case 'razao-mes':
      return [`Exporte o razão com o período inteiro: ${periodo}.`, 'Suba o XLS de novo em Razões das contas.'];
    case 'notas-errado':
      return ['No Alterdata, exporte o relatório de notas em XLS.', 'Suba de novo e escolha Sobrepor o movimento.'];
    case 'notas-faltaram':
      return [`Confira se o relatório do Alterdata cobre ${periodo}.`, 'Suba o arquivo de novo.'];
    default:
      return ['Recarregue a página com Ctrl+F5.', 'Suba o arquivo de novo.'];
  }
}

/** O rótulo de uma escolha (a cápsula como aparece). */
export function rotuloDaEscolha(ctx: ContextoDoSuporte, e: string): string {
  if (e === OUTRO || e.endsWith(':' + OUTRO)) return 'Outro';
  if (e === NAO_RESOLVEU) return 'Não resolveu';
  const prefixo = /^[bmiea]:/.exec(e)?.[0];
  if (!prefixo) return PROBLEMAS[ctx.tela].find(p => p.id === e)?.rotulo || e;
  const v = e.slice(2);
  if (v === TODOS) return 'Todos';
  const um = (x: string) => (prefixo === 'm:' ? rotuloDoMes(x) : prefixo === 'e:' ? EFEITOS.find(o => o.id === 'e:' + x)?.rotulo || x
    : prefixo === 'a:' ? ARQUIVOS.find(o => o.id === 'a:' + x)?.rotulo || x : x);
  return v.split(SEPARADOR).filter(Boolean).map(um).join(', ');
}

/** O caminho da conversa em texto ("Leu errado › Bradesco › 08/2026 › Não resolveu"), para o report. */
export function caminhoDaConversa(ctx: ContextoDoSuporte, escolhas: readonly string[]): string {
  return escolhas.map(e => rotuloDaEscolha(ctx, e)).join(' › ');
}

/**
 * A mensagem do bug, sempre no mesmo formato (Vitor, 21/10/2026: "o sistema monta a mensagem corretamente para que chegue
 * para mim em um padrão"): onde, o problema, os procedimentos, o botão, o banco, o mês, o que aconteceu, o arquivo e o
 * comentário (as linhas sem resposta ficam de fora).
 */
export function mensagemDoBug(ctx: ContextoDoSuporte, escolhas: readonly string[], comentario: string, nomeDoArquivo: string): string {
  const de = (prefixo: string) => { const e = escolhas.find(x => x.startsWith(prefixo)); return e ? rotuloDaEscolha(ctx, e) : ''; };
  const linhas: [string, string][] = [
    ['Página', ctx.pagina || ctx.rotuloDaTela],
    ['Empresa', empresaDe(ctx)],
    ['Período', periodoDe(ctx.meses)],
    ['Problema', escolhas[0] ? rotuloDaEscolha(ctx, escolhas[0]) : ''],
    ['Procedimentos', escolhas.includes(NAO_RESOLVEU) ? 'feitos, não resolveu' : 'não passou por eles'],
    ['Botão', de('i:')],
    ['Banco', de('b:') || (ctx.bancos.length === 1 ? ctx.bancos[0] : '')],
    ['Mês', de('m:') || (ctx.meses.length === 1 ? rotuloDoMes(ctx.meses[0]) : '')],
    ['O que aconteceu', de('e:')],
    ['Arquivo', [de('a:'), nomeDoArquivo].filter(Boolean).join(' · ')],
    ['Comentário', comentario.trim()],
  ];
  return linhas.filter(([, v]) => v).map(([k, v]) => k + ': ' + v).join('\n');
}

/**
 * O nome de um botão de importação da página, sem o mês e o detalhe ("Importar extrato de 08/2026" → "Importar extrato";
 * "Importar o razão dos meses que faltam (cada lançamento cai no seu mês)" → "Importar o razão").
 */
export function nomeDoBotao(rotulo: string): string {
  const t = rotulo.replace(/\s*\([^)]*\)/g, '').replace(/\s+(de|dos?|da)\s+(\d{2}\/\d{4}|todos os meses|meses que faltam).*$/i, '').replace(/\s+/g, ' ').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
}

/** Os dois finais do report (o robô escolhe um). */
export const VEREDITOS = { erro: 'Realmente, isso é erro do sistema', analise: 'Precisa da sua análise' } as const;
export type Veredito = keyof typeof VEREDITOS;

/** O veredito pela última linha do report (null = o report ainda não chegou ou não terminou numa das duas). */
export function vereditoDoReport(texto: string): Veredito | null {
  const fim = sem(texto).replace(/[.\s*_]+$/, '');
  if (fim.endsWith(sem(VEREDITOS.erro))) return 'erro';
  if (fim.endsWith(sem(VEREDITOS.analise))) return 'analise';
  return null;
}
