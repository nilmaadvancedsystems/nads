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
  /** as marcas numeradas (13/11/2026: "dá para melhorar mais o tutorial"): ①②③ em cima das partes de dentro, explicadas no balão */
  marcas?: { alvo: string; texto: string }[];
}

type Base = PassoDoTutorial & { so?: ModoDoTutorial };

const PASSOS: Base[] = [
  { id: 'oi', capitulo: 'Começo', titulo: 'Bem-vindo à sua Área do Cliente', icone: 'home',
    texto: 'Em um minuto mostramos onde fica cada coisa: as guias, os documentos, os pedidos ao escritório e mais. Dá para pular quando quiser.' },
  { id: 'menu', capitulo: 'Menu', so: 'pc', aba: 'inicio', alvo: '.cli-lateral .cli-menu', titulo: 'O menu', icone: 'menu',
    texto: 'Cada parte da sua empresa tem uma tela. O número (ou a bolinha, com o menu recolhido) avisa o que é novo ou está vencido.' },
  { id: 'abas', capitulo: 'Menu', so: 'celular', aba: 'inicio', alvo: '.cli-abas-baixo', titulo: 'As abas', icone: 'menu',
    texto: 'Embaixo ficam as telas que você mais usa. O número no ícone avisa o que é novo ou está vencido.' },
  { id: 'mais', capitulo: 'Menu', so: 'celular', aba: 'inicio', alvo: '[data-tutorial="mais"]', titulo: 'O resto fica no Mais', icone: 'menu',
    texto: 'No Mais estão o Registro, o Faturamento, os Dados cadastrais, o Fale com o escritório e este tutorial.' },
  { id: 'precisa', capitulo: 'Visão geral', aba: 'inicio', alvo: '.cli-precisa, .cli-tudo-em-dia', titulo: 'O que precisa de você', icone: 'checklist',
    texto: 'A Visão geral começa pelo que pede uma ação sua agora, cada item com o botão certo. Quando estiver tudo em dia, ela avisa.' },
  { id: 'proximos', marcas: [{ alvo: '.cli-inicio-proximos .cli-extrato-linha', texto: 'Toque numa guia para ver, baixar ou copiar o código' }, { alvo: '.cli-inicio-proximos .card-head .btn', texto: 'A agenda completa do mês' }], capitulo: 'Visão geral', aba: 'inicio', alvo: '.cli-inicio-proximos', titulo: 'Os próximos vencimentos', icone: 'calendar',
    texto: 'As guias e as entregas do escritório por dia. Toque numa guia para ver, baixar ou copiar o código.' },
  { id: 'enviar', marcas: [{ alvo: '.cli-v-enviar .cli-envio-tipos', texto: 'Escolha o que é o arquivo' }, { alvo: '.cli-v-enviar .cli-soltar', texto: 'Arraste ou toque para escolher' }], capitulo: 'Visão geral', aba: 'inicio', alvo: '.cli-v-enviar', titulo: 'Mande documentos', icone: 'upload',
    texto: 'Escolha o que é (extrato, nota, comprovante) e arraste ou escolha o arquivo. Ele vai direto para o escritório.' },
  { id: 'guias-numeros', capitulo: 'Guias', aba: 'guias', alvo: '.cli-numeros-guias', titulo: 'As guias do mês', icone: 'recibo',
    texto: 'Quanto há para pagar, o que venceu e o próximo vencimento. Troque o mês no botão do alto.' },
  { id: 'agenda', marcas: [{ alvo: '.cli-agenda-mes .cli-cal-hoje, .cli-agenda-mes .cli-calendario button', texto: 'Toque num dia para ver o que vence nele' }, { alvo: '.cli-agenda-mes .cli-legenda-cal', texto: 'O que cada bolinha quer dizer' }], capitulo: 'Guias', aba: 'guias', alvo: '.cli-agenda-mes', titulo: 'A agenda', icone: 'calendar',
    texto: 'O calendário marca os dias com guia ou entrega. Toque num dia para ver o que vence nele.' },
  { id: 'a-pagar', marcas: [{ alvo: '[data-tutorial="a-pagar"] .cli-linha-guia .cli-g-acoes > :nth-child(1)', texto: 'Ver a guia sem baixar' }, { alvo: '[data-tutorial="a-pagar"] .cli-linha-guia .cli-g-acoes > :nth-child(2)', texto: 'Baixar o PDF (ou copiar o código)' }, { alvo: '[data-tutorial="a-pagar"] .cli-linha-guia .cli-g-acoes > :nth-child(3)', texto: 'Venceu? Peça uma nova aqui' }], capitulo: 'Guias', aba: 'guias', alvo: '[data-tutorial="a-pagar"]', titulo: 'Pagar uma guia', icone: 'download',
    texto: 'Veja a guia, baixe o PDF ou copie o código de barras. Se venceu, peça uma nova: a vencida não passa no banco.' },
  { id: 'pastas', capitulo: 'Documentos', aba: 'documentos', alvo: '.cli-pastas-cartoes', titulo: 'Seus documentos por pasta', icone: 'pastaAberta',
    texto: 'Guias, folha, notas, o que o escritório mandou e o que você enviou. Toque numa pasta para ver só ela.' },
  { id: 'lista', marcas: [{ alvo: '.cli-biblioteca-abrir', texto: 'Toque no nome para ver' }, { alvo: '.cli-biblioteca-filtros .cli-marcar-todos', texto: 'Marque vários para baixar juntos' }, { alvo: '.cli-biblioteca-lista .cli-baixar-tudo', texto: 'Ou o mês inteiro num .zip' }], capitulo: 'Documentos', aba: 'documentos', alvo: '.cli-biblioteca-lista', titulo: 'Ver, baixar ou juntar', icone: 'olho',
    texto: 'Toque no nome para ver sem baixar (as setas passam para o próximo). Marque vários, ou use o Baixar o mês, para levar tudo num .zip.' },
  { id: 'sol-filtros', capitulo: 'Solicitações', aba: 'chamados', alvo: '.cli-sol-cartoes', titulo: 'Seus pedidos ao escritório', icone: 'mensagem',
    texto: 'Cada pedido mostra a situação: aberto, respondido ou concluído. Toque num cartão para filtrar.' },
  { id: 'sol-nova', capitulo: 'Solicitações', aba: 'chamados', alvo: '[data-tutorial="nova-solicitacao"]', titulo: 'Peça o que precisar', icone: 'plus',
    texto: 'Escolha o assunto (admissão, férias, um documento, uma dúvida), escreva e envie. A resposta aparece aqui e no sino.' },
  { id: 'equipe', marcas: [{ alvo: '.cli-reg-equipe .cli-sol-filtros', texto: 'Quem está e quem já saiu' }, { alvo: '.cli-reg-equipe .cli-reg-busca', texto: 'Busque pelo nome, CPF ou matrícula' }, { alvo: '.cli-reg-equipe .cli-reg-pessoa', texto: 'Toque para abrir a ficha' }], capitulo: 'Registro', aba: 'dp', alvo: '.cli-reg-equipe', titulo: 'Sua equipe', icone: 'usuario',
    texto: 'Os funcionários do registro. Toque num nome para ver a ficha, os documentos dele, programar férias ou pedir o desligamento.' },
  { id: 'folha', marcas: [{ alvo: '.cli-reg-folha .cli-baixar-tudo', texto: 'A folha do mês num .zip' }, { alvo: '.cli-reg-folha .chip-f', texto: 'Troque o mês' }], capitulo: 'Registro', aba: 'dp', alvo: '.cli-reg-folha', titulo: 'A folha do mês', icone: 'arquivo',
    texto: 'A folha, os recibos, as férias e as guias do mês, por tipo. Baixe a folha inteira num .zip.' },
  { id: 'busca', capitulo: 'Atalhos', alvo: '[data-tutorial="busca"]', titulo: 'Ache qualquer coisa', icone: 'search',
    texto: 'Busque uma guia, um documento, um pedido ou um funcionário, de qualquer tela. No computador, aperte Ctrl+K.' },
  { id: 'sino', capitulo: 'Atalhos', alvo: '.cli-sino', titulo: 'O sino', icone: 'sino',
    texto: 'Avisa quando uma guia vence, chega documento novo ou o escritório responde. Toque no aviso para ir até ele.' },
  { id: 'empresa', capitulo: 'Atalhos', alvo: '.cli-empresa-troca', titulo: 'Mais de uma empresa?', icone: 'predio',
    texto: 'Abra o link de cada empresa uma vez neste aparelho e troque entre elas por aqui, sem procurar o link de novo.' },
  { id: 'pronto', capitulo: 'Fim', titulo: 'Tudo pronto!', icone: 'checkCircle',
    texto: 'Para ver este tutorial de novo, use o "Ver o tutorial" no menu. Qualquer dúvida, abra um pedido ou fale com o escritório no WhatsApp.' },
];

/** Os passos do jeito (PC ou celular), sem os das telas que a área não tem. */
export function passosDoTutorial(modo: ModoDoTutorial, abas: readonly string[]): PassoDoTutorial[] {
  return PASSOS.filter(p => (!p.so || p.so === modo) && (!p.aba || abas.includes(p.aba)))
    .map(({ so: _so, ...p }) => p);
}

/** O ícone de cada capítulo (o roteiro do começo e o resumo do fim). */
export const ICONE_DO_CAPITULO: Record<string, NomeIcone> = {
  Menu: 'menu', 'Visão geral': 'home', Guias: 'recibo', Documentos: 'pastaAberta', Solicitações: 'mensagem', Registro: 'usuario', Atalhos: 'search',
};

/** Os capítulos do tutorial, na ordem, sem o começo e o fim. */
export function capitulosDoTutorial(passos: readonly PassoDoTutorial[]): string[] {
  return [...new Set(passos.map(p => p.capitulo))].filter(c => c !== 'Começo' && c !== 'Fim');
}
