// As novidades em teste (Vitor, 13/11/2026: "Em toda aplicação, voce vai mandar para desenvolvedor, aprovando, vc
// disponibiliza para todos"). O que é novo aparece primeiro só para quem está com o modo desenvolvedor ligado. Os outros
// continuam no de antes, sem mudança nenhuma. Só o Vitor aprova: aprovada, a novidade passa a `aprovada: true` e vale para
// todos. Depois, numa limpeza, o código de antes sai junto com a entrada daqui.
import { modoDesenvolvedor, useModoDesenvolvedor } from './modoDesenvolvedor';

export const NOVIDADES = {
  /** o Início repaginado (13/11/2026: só no modo desenvolvedor "até eu testar tudo"; aprovado no mesmo dia, para todos: "pode tirar
   *  do modo desenvolvedor e publicar para todos os usuarios, a nova versao do inicio!") */
  'inicio-novo': { desde: '13/11/2026', aprovada: true },
  /** o Administrativo, só para o Diretor e o Dono (13/11/2026: a entrada de clientes no escritório, "desenvolve o prototipo") */
  administrativo: { desde: '13/11/2026', aprovada: false },
  /** a situação da tarefa não se escolhe mais (13/11/2026: "remove em todas, situacao nao deve ser setada"): só o selo e os botões de quem faz */
  'tarefa-sem-situacao': { desde: '13/11/2026', aprovada: false },
  /** o sino de cobrar a tarefa delegada e o Responder cobrança de quem faz (13/11/2026: "Adiciona um icone de sino, nas tarefas delegadas");
   *  aprovado no mesmo dia, para todos ("Aprova para todos") */
  'cobrar-tarefa': { desde: '13/11/2026', aprovada: true },
  /** a cobrança nas Notificações do Início ("Fulano cobrou atualização da tarefa X") e, no Cobrada de Minhas tarefas, quem cobrou e
   *  quando ao passar o mouse (16/11/2026: "faça aparecer em notificações que houve uma cobrança e em minhas tarefas a tarefa ficar
   *  com alguma simbologia que foi cobrada"); e a janela grande da cobrança, que só sai respondendo ou pedindo mais 5 ou 10 minutos
   *  com justificativa, e o andamento para quem cobrou (16/11/2026: "faça uma bela popup") */
  'cobranca-notificada': { desde: '16/11/2026', aprovada: false },
  /** o Enviar vários meses da Importação importa ao soltar os extratos, sem o botão Enviar (16/11/2026: "Ja importe com todos marcados") */
  'importar-ao-soltar': { desde: '16/11/2026', aprovada: false },
  /** o extrato arrastado até a célula do mês da Importação entra naquele mês (16/11/2026: "Da a opção de arrastar, até o campo do mes, o extrato tbm") */
  'arrastar-no-mes': { desde: '16/11/2026', aprovada: false },
  /** a janela do e-mail principal e a entrada pelo e-mail (16/11/2026: "mande uma requisição a todos os usuarios ao atualizarem o
   *  sistema, de colocar o email principal que eles usam"; "se o usuario for logar, peça o email, ao inves do usuario"); aprovada
   *  para todos no mesmo dia ("Pode publicar"): obrigatória, só para quem entra pelo nome@nilma.local */
  'email-principal': { desde: '16/11/2026', aprovada: true },
  /** o print colado com Ctrl+V nos Detalhes vira anexo, com a miniatura embaixo do campo (16/11/2026: "Coloca a opção de colar
   *  print, nos detalhes, para requerer os pagamentos") */
  'colar-print': { desde: '16/11/2026', aprovada: false },
  /** o Em Lote no seletor de competência da Visão geral da empresa, o mesmo do cabeçalho da Importação (16/11/2026: "Coloca o
   *  iniciar em lote nessa tela tb"); aprovada para todos no mesmo dia ("pode publicar na versão original") */
  'em-lote-na-empresa': { desde: '16/11/2026', aprovada: true },
  /** a comissão escondida (16/11/2026): quem tem uma % própria registra a comissão sem ver o valor; a % fica num lugar do banco
   *  que nenhuma tela lê e o robô da nuvem calcula; o Financeiro vê o valor, sem o do serviço; aprovada para todos com o Ihul!
   *  (23/11/2026: "Pode lançar o ihul na versão final, ocultando TUDO sobre comissões") */
  'comissao-oculta': { desde: '16/11/2026', aprovada: true },
  /** o valor de cada serviço comissionado, definido pelo Financeiro, e a quantidade na comissão (23/11/2026: "O valor que nao foi
   *  inputado no financeiro, o usuario coloca manual, mas deixa configurado no financeiro"; "Adiciona quantidade tambem") */
  'comissao-quantidade': { desde: '23/11/2026', aprovada: true },
  /** a Entrega na tarefa nova delegada ao office boy (16/11/2026: "quando for delegado para o officeboy, a opcao 'entrega' que vai
   *  jogar direto no modulo de entregas"): marcada, nenhuma tarefa é criada; o pedido vai para Entregas › Solicitações */
  'entrega-do-office-boy': { desde: '16/11/2026', aprovada: false },
  /** a conversa de cada feedback (16/11/2026: "preciso de um chat onde eu possa responder os feedbacks, para entender mais,
   *  fazendo perguntas"): o Perguntar na janela do feedback do admin; quem mandou responde na janela grande e no balão (só aparece
   *  depois que o admin pergunta); aprovada para todos no mesmo dia ("Aprova para todos") */
  'conversa-feedback': { desde: '16/11/2026', aprovada: true },
  /** a Tela de Insights, só Diretor e admin (18/11/2026: "a Tela de Insights eu quero"; "Todos os seis"): os números do escritório
   *  em seis painéis, um por página no menu lateral, e a visão de cada pessoa (o Modo TV saiu: "remove o modo tv"); o robô do PC
   *  monta os números (Robôs › Ajustes › Tela de Insights) */
  insights: { desde: '18/11/2026', aprovada: true }, // aprovada em 19/11/2026 (o dono: "publica para admin e diretor"): só admin e Diretor veem
  /** o Lançatudo (17/11/2026: "desenvolver um Mister dentro do nads"): o extrato do banco em lançamentos para o Alterdata, com as
   *  regras de cada empresa; só o Contábil e o admin */
  lancatudo: { desde: '17/11/2026', aprovada: false },
  /** o Arquivo físico (19/11/2026: "preciso montar no nads um controle do arquivo físico do escritório"): as caixas e os envelopes,
   *  a busca, a retirada e a devolução, o descarte pelo prazo e as etiquetas com QR; aprovada para todo o escritório no mesmo dia ("Liberar para todos") */
  'arquivo-fisico': { desde: '19/11/2026', aprovada: true },
  /** Delegadas por mim reestruturada (uma tabela só, sem cortes) e o Por pessoa: os números de quem recebe as tarefas (23/11/2026: "Dá uma
   *  reestruturada nesse painel de delegadas por mim, quero tambem uma opção de ver dados de tarefas delegadas por usuario, quanto tempo tá
   *  demorando, etc, dados uteis para mim"); aprovada para todos no mesmo dia ("Sim, liberar") */
  'delegadas-por-pessoa': { desde: '23/11/2026', aprovada: true },
  /** a tarefa que veio de uma etapa em Minhas tarefas e Concluídas: o nome da etapa com o período embaixo, e no Cliente o código em
   *  destaque e o nome ao lado (23/11/2026: "Deixa mais bonitinho essa apresentacao, de empresa, periodo e tarefa"); na Delegadas
   *  por mim, vem junto com a 'delegadas-por-pessoa'; aprovada para todos no mesmo dia ("Sim, liberar") */
  'titulo-da-etapa': { desde: '23/11/2026', aprovada: true },
  /** o ShadersCI (23/11/2026: "Vamos buildar um aplicativo chamado ShadersCI … uma abinha de lançamentos onde o usuario lance, adicione,
   *  remova, edite … copie e cole com o botao direito"): a aba de lançamentos do SCI, com os planos padrão 90113 e 90011; só o Contábil
   *  e o admin; os lançamentos ficam só no navegador */
  shadersci: { desde: '23/11/2026', aprovada: false },
  /** Outros colaboradores nas Tarefas (24/11/2026: "os seniores, diretores e donos, conseguem ver as tarefas dos juniores e plenos …
   *  apenas visualizar"): as tarefas delegadas para os Juniores e Plenos, por pessoa, só para ver */
  'outros-colaboradores': { desde: '24/11/2026', aprovada: false },
  /** a ferramenta nads → SCI (23/11/2026, docs/sci): as planilhas de importação do nads viram a planilha que o SCI importa,
   *  sem banco ("é só um intermediador entre o NADS e SCI"); nas Ferramentas, só no modo desenvolvedor até o teste no SCI */
  sci: { desde: '23/11/2026', aprovada: false },
  /** o Controle contábil (23/11/2026: a planilha "CONTROLE CONTÁBIL 2026" do Fernando no nads): o mês feito de cada empresa no ano,
   *  a situação e a pendência; o Contábil e o admin no modo desenvolvedor, e o Fernando também fora dele ("Fernando primeiro") */
  'controle-contabil': { desde: '23/11/2026', aprovada: false },
} satisfies Record<string, { desde: string; aprovada: boolean }>;

export type IdNovidade = keyof typeof NOVIDADES;

/** A pessoa vê a novidade? (aprovada, todos; ainda em teste, só com o modo desenvolvedor ligado) */
export function novidadeLigada(id: IdNovidade, dev = modoDesenvolvedor()): boolean {
  const n: { aprovada: boolean } = NOVIDADES[id];
  return n.aprovada || dev;
}

/** O mesmo, numa tela (acompanha o modo desenvolvedor) */
export function useNovidade(id: IdNovidade): boolean {
  const [dev] = useModoDesenvolvedor();
  return novidadeLigada(id, dev);
}
