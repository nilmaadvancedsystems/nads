// O tutorial guiado da Área do Cliente (13/11/2026: "quero um tutorial tanto no modo pc e no modo celular bem guiado,
// explicando tudo passo a passo"). Cada passo abre a tela dele, acende uma parte (o alvo, por seletor) e explica em duas
// frases; o primeiro e o último são o cartão do meio (sem alvo). No PC o menu é a lateral e a busca é o campo do topo;
// no celular, a barra de baixo, o "Mais" e a lupa. Aqui só a regra: os passos de cada jeito, sem os das telas que a
// área não tem (sem a Central, sem o Registro). A tela (partes/Tutorial.tsx) só desenha.
import type { NomeIcone } from '@nads/ui';

export type ModoDoTutorial = 'pc' | 'celular';

export interface PassoDoTutorial {
  id: string;
  /** a aba que precisa estar aberta; sem ela, fica onde está */
  aba?: string;
  /** o que acender (o primeiro seletor que existir na tela); sem alvo, o cartão no meio da tela */
  alvo?: string;
  titulo: string;
  texto: string;
  icone: NomeIcone;
  /** o capítulo (a barra de progresso é dividida por eles): Menu, Visão geral, Guias, Documentos, Solicitações, Registro, Atalhos */
  capitulo: string;
  /**
   * o que dá para fazer ali, em tópicos curtos no balão (15/11/2026: sem os números em cima da tela, como nos tours do
   * Slack e do Asana: um passo acende uma parte só). O alvo de cada um fica para o teste de que a parte existe.
   */
  marcas?: { alvo: string; texto: string }[];
  /** está no tour de boas-vindas (o curto, que abre sozinho na primeira vez); os outros ficam no "?" de cada tela */
  boasVindas?: true;
  /** o que tocar antes de acender (15/11/2026): a aba de dentro da tela (a Folha, as Férias do Registro) */
  clicar?: string;
}

type Base = PassoDoTutorial & { so?: ModoDoTutorial };

// (15/11/2026: "melhora o tutorial") o balão mais curto: uma frase e os tópicos; os passos novos (as férias, o custo da
// folha, o Faturamento, os Dados cadastrais e o Fale com o escritório); o "clicar" abre a aba de dentro da tela (a Folha,
// as Férias) antes de acender a parte.
// (15/11/2026: "procura exemplos de tutorias em sites famosos, e use como base") o tour de boas-vindas ficou com 4
// passos (os tours de 3 a 4 passos são os mais concluídos, pelos números da Chameleon), só o essencial: o menu, o que
// precisa de você, pagar uma guia e pedir algo ao escritório. O resto de cada tela fica no "?" ao lado do título, que a
// pessoa abre quando quer (a ajuda puxada, não empurrada, como recomenda a Nielsen Norman Group). A busca e o sino
// entram no "?" da Visão geral; a troca de empresa, no dos Dados cadastrais.
// (16/11/2026: "muita informação") as telas ficaram mais enxutas: a guia com um botão e o "⋯"; os textos e as marcas
// acompanham.
const PASSOS: Base[] = [
  { id: 'oi', capitulo: 'Começo', titulo: 'Bem-vindo à sua Área do Cliente', icone: 'home',
    texto: 'Quatro passos rápidos para você se achar: o menu, as guias a pagar, a tela das guias e os pedidos ao escritório.' },
  { id: 'menu', boasVindas: true, capitulo: 'Menu', so: 'pc', aba: 'inicio', alvo: '.cli-lateral .cli-menu', titulo: 'O menu', icone: 'menu',
    texto: 'Cada parte da sua empresa tem uma tela. O número avisa o que é novo ou venceu.' },
  { id: 'abas', boasVindas: true, capitulo: 'Menu', so: 'celular', aba: 'inicio', alvo: '.cli-abas-baixo', titulo: 'As abas', icone: 'menu',
    texto: 'Embaixo ficam as telas que você mais usa; o resto fica no Mais. O número avisa o que é novo ou venceu.' },
  // (17/11/2026: a tela inicial virou "Guias e documentos", sem o "Precisa de você" e sem as próximas guias)
  { id: 'precisa', boasVindas: true, capitulo: 'Guias e documentos', aba: 'inicio', alvo: '.cli-ini-guias', titulo: 'As guias a pagar', icone: 'recibo',
    texto: 'A que venceu vem primeiro: peça uma nova. As outras, é só baixar.' },
  { id: 'proximos', capitulo: 'Guias e documentos', aba: 'inicio', alvo: '.cli-ini-docs', titulo: 'Os documentos', icone: 'pastaAberta',
    texto: 'O que o escritório mandou por último. Todos ficam no Ver todos.' },
  { id: 'enviar', capitulo: 'Guias e documentos', aba: 'inicio', alvo: '.cli-ini-enviar', titulo: 'Mande documentos', icone: 'upload',
    texto: 'Extrato, nota ou comprovante: o arquivo vai direto para o escritório.' },
  { id: 'guias-numeros', capitulo: 'Guias', aba: 'guias', alvo: '.cli-numeros-guias', titulo: 'As guias do mês', icone: 'recibo',
    texto: 'O total a pagar no mês e o que venceu (ou o próximo vencimento). Troque o mês no botão do alto.' },
  { id: 'agenda', capitulo: 'Guias', aba: 'guias', alvo: '.cli-agenda-mes', titulo: 'A agenda', icone: 'calendar',
    texto: 'Os dias com guia a pagar, vencida ou paga.',
    marcas: [{ alvo: '.cli-agenda-mes .cli-cal-hoje, .cli-agenda-mes .cli-calendario button', texto: 'Toque num dia para ver o que vence nele' }, { alvo: '.cli-agenda-mes .cli-legenda-cal', texto: 'O que cada bolinha quer dizer' }] },
  { id: 'a-pagar', boasVindas: true, capitulo: 'Guias', aba: 'guias', alvo: '[data-tutorial="a-pagar"]', titulo: 'Pagar uma guia', icone: 'download',
    texto: 'Cada guia com o que dá para fazer com ela.',
    marcas: [{ alvo: '[data-tutorial="a-pagar"] .cli-linha-guia .cli-g-acoes > :nth-child(1)', texto: 'Baixe a guia. Venceu? Peça uma nova: a vencida não passa no banco' }, { alvo: '[data-tutorial="a-pagar"] .cli-linha-guia .cli-gu-mais', texto: 'No ⋯: ver a guia sem baixar ou copiar o código' }] },
  { id: 'pastas', capitulo: 'Documentos', aba: 'documentos', alvo: '.cli-pastas-cartoes', titulo: 'Seus documentos por pasta', icone: 'pastaAberta',
    texto: 'Toque numa pasta para ver só os documentos dela.' },
  { id: 'lista', capitulo: 'Documentos', aba: 'documentos', alvo: '.cli-biblioteca-lista', titulo: 'Ver, baixar ou juntar', icone: 'olho',
    texto: 'Seus documentos, do mais novo para o mais antigo.',
    marcas: [{ alvo: '.cli-biblioteca-abrir', texto: 'Toque no nome para ver sem baixar' }, { alvo: '.cli-biblioteca-filtros .cli-marcar-todos', texto: 'Marque vários para baixar num .zip' }, { alvo: '.cli-biblioteca-lista .cli-baixar-tudo', texto: 'Ou o mês inteiro de uma vez' }] },
  { id: 'sol-filtros', capitulo: 'Solicitações', aba: 'chamados', alvo: '.cli-sc-filtros', titulo: 'Seus pedidos ao escritório', icone: 'mensagem',
    texto: 'Cada pedido com a situação: aberto, respondido ou concluído. As abas filtram.' },
  { id: 'sol-nova', boasVindas: true, capitulo: 'Solicitações', aba: 'chamados', alvo: '[data-tutorial="nova-solicitacao"]', titulo: 'Peça o que precisar', icone: 'plus',
    texto: 'Admissão, férias, um documento ou uma dúvida: escolha o assunto e escreva. A resposta chega aqui e no sino.' },
  { id: 'equipe', capitulo: 'RH', aba: 'dp', clicar: '.cli-fat-abas [data-aba="equipe"]', alvo: '.cli-reg-equipe', titulo: 'Sua equipe', icone: 'equipe',
    texto: 'Os funcionários do registro.',
    marcas: [{ alvo: '.cli-reg-equipe .cli-sol-filtros', texto: 'Quem está e quem já saiu' }, { alvo: '.cli-reg-equipe .cli-reg-busca', texto: 'Busque pelo nome, CPF ou matrícula' }, { alvo: '.cli-reg-equipe .cli-eq-cartao', texto: 'Toque para abrir a ficha: documentos, férias, desligamento' }] },
  { id: 'ferias', capitulo: 'RH', aba: 'dp', clicar: '.cli-fat-abas [data-aba="ferias"]', alvo: '.cli-fe', titulo: 'As férias da equipe', icone: 'calendar',
    texto: 'Quem precisa tirar férias, a vencida primeiro.',
    marcas: [{ alvo: '.cli-fe-linha .cli-eq-ferias', texto: 'Em dia, vence logo ou vencida' }, { alvo: '.cli-fe-linha .btn', texto: 'Marque os dias no calendário e mande ao escritório' }] },
  { id: 'custo', capitulo: 'RH', aba: 'dp', clicar: '.cli-fat-abas [data-aba="folha"]', alvo: '.cli-cf', titulo: 'Quanto custa a folha', icone: 'barChart',
    texto: 'O total do mês, os salários, o FGTS e o líquido pago; os descontos em Ver detalhes. Toque num mês do gráfico para comparar.' },
  { id: 'folha', capitulo: 'RH', aba: 'dp', clicar: '.cli-fat-abas [data-aba="folha"]', alvo: '.cli-reg-folha', titulo: 'Os documentos da folha', icone: 'arquivo',
    texto: 'A folha, os recibos, as férias e as guias do mês, por tipo.',
    marcas: [{ alvo: '.cli-reg-folha .cli-baixar-tudo', texto: 'O mês inteiro num .zip' }, { alvo: '.cli-reg-folha .chip-f', texto: 'Troque o mês' }] },
  { id: 'fat-mes', capitulo: 'Administrativo', aba: 'faturamento', alvo: '.cli-numeros-fat', titulo: 'O que você vendeu', icone: 'barChart',
    texto: 'O faturamento do mês pelas notas emitidas, comparado com o mês anterior. Embaixo, a venda dia a dia.' },
  { id: 'fat-topo', capitulo: 'Administrativo', aba: 'faturamento', alvo: '.cli-titulo-fat .cli-acoes', titulo: 'Outro mês ou a planilha', icone: 'calendar',
    texto: 'Troque o mês do painel ou baixe tudo numa planilha do Excel.' },
  { id: 'cadastro', capitulo: 'Administrativo', aba: 'empresa', alvo: '.cli-fl', titulo: 'Os dados da empresa', icone: 'predio',
    texto: 'CNPJ, inscrições, endereço e sócios, prontos para copiar.',
    marcas: [{ alvo: '.cli-fl-lista', texto: 'Passe o mouse (ou toque) num dado para copiar' }, { alvo: '.cli-fl .cli-fi-pe .cli-link-mini', texto: 'Algum dado mudou? Avise aqui' }] },
  { id: 'contato', capitulo: 'Administrativo', aba: 'contato', alvo: '.cli-contato-destaque', titulo: 'Fale com o escritório', icone: 'atendimento',
    texto: 'O WhatsApp e o e-mail do escritório; mais embaixo, o contato de cada setor.',
    marcas: [{ alvo: '.cli-contato-destaque .cli-sc-whats', texto: 'Abre a conversa no WhatsApp' }] },
  { id: 'busca', capitulo: 'Atalhos', aba: 'inicio', alvo: '[data-tutorial="busca"]', titulo: 'Ache qualquer coisa', icone: 'search',
    texto: 'Uma guia, um documento, um pedido ou um funcionário, de qualquer tela. No computador, Ctrl+K.' },
  { id: 'sino', capitulo: 'Atalhos', aba: 'inicio', alvo: '.cli-sino', titulo: 'O sino', icone: 'sino',
    texto: 'Avisa quando uma guia vence, chega documento novo ou o escritório responde.' },
  { id: 'empresa', capitulo: 'Administrativo', aba: 'empresa', alvo: '.cli-empresa-troca', titulo: 'Mais de uma empresa?', icone: 'predio',
    texto: 'Abriu o link de outra empresa neste aparelho? Troque entre elas por aqui.' },
  { id: 'pronto', capitulo: 'Fim', titulo: 'Tudo pronto!', icone: 'checkCircle',
    texto: 'Em cada tela, o ? ao lado do título mostra como usar aquela tela. Este começo fica no "Ver o tutorial" do menu.' },
];

/** Os passos do jeito (PC ou celular), sem os das telas que a área não tem. */
function doJeito(modo: ModoDoTutorial, abas: readonly string[]): PassoDoTutorial[] {
  return PASSOS.filter(p => (!p.so || p.so === modo) && (!p.aba || abas.includes(p.aba)))
    .map(({ so: _so, ...p }) => p);
}

/** O tour de boas-vindas: o cartão do começo, os passos essenciais e o cartão do fim. */
export function passosDoTutorial(modo: ModoDoTutorial, abas: readonly string[]): PassoDoTutorial[] {
  return doJeito(modo, abas).filter(p => !p.alvo || p.boasVindas);
}

/**
 * Só os passos de uma tela (15/11/2026: o "?" ao lado do título de cada tela), sem o cartão do começo e do fim, sem os do
 * menu e sem os atalhos do topo.
 */
export function passosDaTela(modo: ModoDoTutorial, abas: readonly string[], aba: string): PassoDoTutorial[] {
  return doJeito(modo, abas).filter(p => p.aba === aba && !!p.alvo && p.capitulo !== 'Menu');
}

/** Todos os passos com parte (para o teste de que cada parte existe na tela). */
export function todosOsPassos(modo: ModoDoTutorial, abas: readonly string[]): PassoDoTutorial[] {
  return doJeito(modo, abas).filter(p => !!p.alvo);
}

/** O ícone de cada capítulo (o roteiro do começo e o resumo do fim). */
export const ICONE_DO_CAPITULO: Record<string, NomeIcone> = {
  Menu: 'menu', 'Guias e documentos': 'home', Guias: 'recibo', Documentos: 'pastaAberta', Solicitações: 'mensagem', RH: 'equipe', Administrativo: 'predio', Atalhos: 'search',
};

/** Os capítulos do tutorial, na ordem, sem o começo e o fim. */
export function capitulosDoTutorial(passos: readonly PassoDoTutorial[]): string[] {
  return [...new Set(passos.map(p => p.capitulo))].filter(c => c !== 'Começo' && c !== 'Fim');
}
