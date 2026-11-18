// O tutorial do Lançatudo (18/11/2026: "quero que essa tela tenha um tutorial quando abre pela primeira vez, e quero que
// tenha um botão para iniciar o tutorial de novo"). Cada passo acende uma parte da tela (o alvo, por seletor) e explica em
// uma ou duas frases; o primeiro e o último são o cartão no meio (sem alvo). O passo cuja parte não está na tela (o
// "Confirmar" num mês sem sugestão do razão) fica de fora. Abre sozinho na primeira vez neste aparelho; o botão Tutorial do
// alto abre de novo. Aqui só os passos e o "já viu"; a tela (Tutorial.tsx) só desenha.
import type { NomeIcone } from '@nads/ui';

export interface PassoDoTutorial {
  id: string;
  /** o que acender; sem alvo, o cartão no meio da tela */
  alvo?: string;
  titulo: string;
  texto: string;
  icone: NomeIcone;
  /** o que dá para fazer ali, em tópicos curtos */
  topicos?: string[];
}

export const PASSOS_DO_TUTORIAL: readonly PassoDoTutorial[] = [
  { id: 'oi', icone: 'zap', titulo: 'Bem-vindo ao Lançatudo',
    texto: 'O extrato do banco vira lançamentos prontos para o Alterdata. Em poucos passos você vê como.' },
  { id: 'topo', alvo: '[data-tut="lt-topo"]', icone: 'predio', titulo: 'Empresa, mês e banco',
    texto: 'Escolha a empresa, a competência e a conta bancária. Cada banco tem as suas regras.' },
  { id: 'extrato', alvo: '[data-tut="lt-extrato"]', icone: 'upload', titulo: 'O extrato e os comprovantes',
    texto: 'Numa janela só: o extrato e o razão do mês, e os comprovantes. Do computador, do Drive ou do e-mail.',
    topicos: ['O razão ajuda a achar as contas', 'O comprovante diz quem é o cliente ou o fornecedor, e o CPF/CNPJ dele também ajuda'] },
  { id: 'progresso', alvo: '[data-tut="lt-progresso"]', icone: 'checkCircle', titulo: 'Quanto falta',
    texto: 'Quantos lançamentos já têm a conta certa. Quando não faltar nenhum, dá para exportar.' },
  { id: 'filtros', alvo: '[data-tut="lt-filtros"]', icone: 'filtro', titulo: 'Os filtros',
    texto: 'Comece pelos Não conciliados: são os que precisam de você.',
    topicos: ['Conciliados: a conta veio de uma regra, foi aprendida ou escolhida', 'Fora: já está no razão do mês ou foi tirado da exportação'] },
  { id: 'linha', alvo: '.lt-registro tbody.lt-par:not(.lt-no-razao):not(.lt-ignorada)', icone: 'list', titulo: 'Cada lançamento',
    texto: 'A conta devedora (D) em cima e a credora (C) embaixo. O banco é fixo; a outra é a contrapartida.',
    topicos: ['Clique na linha para abrir e trocar a conta, o histórico ou o documento', 'O selo ao lado do nome diz de onde a conta veio: regra, aprendida ou razão'] },
  { id: 'confirmar', alvo: '.lt-registro .lt-selo-confirmar', icone: 'check', titulo: 'Sugerido pelo razão',
    texto: 'O nads achou no razão um lançamento do mesmo dia e valor. Se a conta estiver certa, clique em Confirmar: ele aprende para os próximos meses.' },
  { id: 'regras', alvo: '[data-tut="lt-regras"]', icone: 'settings', titulo: 'As regras',
    texto: 'Ex.: o que tiver TARIFA no histórico vai sempre para a conta de tarifas. A regra pega os próximos meses sozinha.',
    topicos: ['Também ficam aqui as contas que o nads aprendeu'] },
  { id: 'exportar', alvo: '[data-tut="lt-exportar"]', icone: 'upload', titulo: 'Mandar para o Alterdata',
    texto: 'O Importar no Alterdata manda os lançamentos pelo robô. Em Ações, baixe o .xls ou a planilha de conferência.' },
  { id: 'pronto', icone: 'checkCircle', titulo: 'Tudo pronto!',
    texto: 'Para ver de novo, use o botão Tutorial no alto da tela.' },
];

/** Os passos que dá para mostrar: os sem parte e os cuja parte está na tela. */
export function passosNaTela(existe: (alvo: string) => boolean, passos: readonly PassoDoTutorial[] = PASSOS_DO_TUTORIAL): PassoDoTutorial[] {
  return passos.filter(p => !p.alvo || existe(p.alvo));
}

const CHAVE = 'nads-lancatudo|tutorial';

/** já viu (ou pulou) o tutorial neste aparelho; sem armazenamento (janela anônima), conta como visto para não abrir sempre */
export function jaViuOTutorial(): boolean {
  try { return localStorage.getItem(CHAVE) === '1'; } catch { return true; }
}

export function marcarTutorialVisto(): void {
  try { localStorage.setItem(CHAVE, '1'); } catch { /* sem armazenamento */ }
}
