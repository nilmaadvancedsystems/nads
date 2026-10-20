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
}

export interface OpcaoDoSuporte { id: string; rotulo: string }

export type PassoDoSuporte =
  | { tipo: 'pergunta'; texto: string; opcoes: OpcaoDoSuporte[] }
  /** as instruções; depois, a tela pergunta "Resolveu" / "Não resolveu" */
  | { tipo: 'instrucoes'; passos: string[] }
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
const ENCAMINHAR = 'Anexe o arquivo e conte em uma frase o que está errado. Vai para o suporte.';

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

/** Os problemas que precisam do banco e do mês (as cápsulas seguintes). */
const COM_BANCO_E_MES = new Set(['leu-errado', 'faltou', 'mes', 'drive']);

/**
 * O próximo passo da conversa, pelas escolhas até aqui (os ids das cápsulas, na ordem). Banco: 'b:<nome>'; mês:
 * 'm:<aaaa-mm>'. Com um banco só (ou um mês só), não pergunta: já vale.
 */
export function passoDoSuporte(ctx: ContextoDoSuporte, escolhas: readonly string[]): PassoDoSuporte {
  const [problema] = escolhas;
  if (!problema) return { tipo: 'pergunta', texto: 'O que aconteceu?', opcoes: [...PROBLEMAS[ctx.tela], { id: OUTRO, rotulo: 'Outro' }] };
  if (problema === OUTRO || escolhas.includes(NAO_RESOLVEU)) return { tipo: 'encaminhar', texto: ENCAMINHAR };
  const banco = escolhido(ctx, escolhas, 'b:', ctx.bancos);
  const mes = escolhido(ctx, escolhas, 'm:', ctx.meses);
  if (ctx.tela === 'bancos' && COM_BANCO_E_MES.has(problema)) {
    if (banco === undefined) return { tipo: 'pergunta', texto: 'Qual banco?', opcoes: ctx.bancos.map(b => ({ id: 'b:' + b, rotulo: b })) };
    if (mes === undefined) return { tipo: 'pergunta', texto: 'Qual mês?', opcoes: ctx.meses.map(m => ({ id: 'm:' + m, rotulo: rotuloDoMes(m) })) };
  }
  return { tipo: 'instrucoes', passos: instrucoes(ctx, problema, banco || 'o banco', mes) };
}

/** A escolha de banco ou de mês; com uma opção só, ela; sem nenhuma, '' (não pergunta). undefined = falta perguntar. */
function escolhido(_ctx: ContextoDoSuporte, escolhas: readonly string[], prefixo: string, opcoes: readonly string[]): string | undefined {
  const e = escolhas.find(x => x.startsWith(prefixo));
  if (e) return e.slice(prefixo.length);
  if (opcoes.length <= 1) return opcoes[0] ?? '';
  return undefined;
}

/** As instruções: diretas, só os passos (Vitor, 20/10/2026: "seja mais direto, só passa as instruções"). */
function instrucoes(ctx: ContextoDoSuporte, problema: string, banco: string, mes: string | undefined): string[] {
  const m = mes ? rotuloDoMes(mes) : 'o mês';
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
      return [`Confira se o PDF está no Drive em CONTÁBIL › EXTRATOS › ${mes ? mes.slice(0, 4) : 'ano'} › ${mes ? mes.slice(5) : 'mês'} › BANCÁRIOS › ${banco.toUpperCase()}.`, `Clique no ícone do Drive de ${m} do ${banco}.`];
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

/** O caminho da conversa em texto ("Leu errado › Bradesco › 08/2026 › Não resolveu"), para o report. */
export function caminhoDaConversa(ctx: ContextoDoSuporte, escolhas: readonly string[]): string {
  const todas = PROBLEMAS[ctx.tela];
  return escolhas.map(e => (e === OUTRO ? 'Outro' : e === NAO_RESOLVEU ? 'Não resolveu' : e.startsWith('b:') ? e.slice(2) : e.startsWith('m:') ? rotuloDoMes(e.slice(2)) : todas.find(p => p.id === e)?.rotulo || e)).join(' › ');
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
