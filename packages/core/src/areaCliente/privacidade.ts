// O aceite da política de privacidade na Área do Cliente (plano do Acessórias, ficha 3.2 aceite-lgpd; o dono, 22/11/2026:
// "pode fazer tudo"). No primeiro acesso (e a cada versão nova da política), o cliente lê e concorda; o aceite fica
// registrado no banco por link e versão (areaClienteAceites, regra nova: o cliente só cria) e neste aparelho. O texto é
// jurídico: o escritório aprova antes de ligar (POLITICA_LIGADA). Até lá, a janela não aparece. Só a lógica.

/** Liga a janela do aceite (só depois de o escritório aprovar o texto abaixo). */
export const POLITICA_LIGADA = false;

/** A versão da política: mudou o texto, muda a versão, e todos aceitam de novo. */
export const VERSAO_DA_POLITICA = '2026-11-22';

/** O texto da política (RASCUNHO a aprovar pelo escritório; um parágrafo por item). */
export const TEXTO_DA_POLITICA: readonly { titulo: string; texto: string }[] = [
  { titulo: 'Quem cuida dos seus dados', texto: 'A Nilma Contabilidade trata os dados da sua empresa e das pessoas ligadas a ela (sócios e funcionários) para prestar os serviços de contabilidade, fiscal e departamento pessoal que você contratou.' },
  { titulo: 'Que dados usamos', texto: 'Os documentos que você manda (extratos, notas, comprovantes), os dados cadastrais da empresa e dos sócios e, para a folha, os dados dos funcionários que a lei exige. Na Área do Cliente, guardamos também o registro de quando você abre as guias e os documentos.' },
  { titulo: 'Para que usamos', texto: 'Para fazer a contabilidade, apurar e gerar os impostos, cumprir as obrigações da empresa com a Receita Federal, o eSocial, o Estado e a Prefeitura, e falar com você sobre o serviço. A base é o contrato de prestação de serviços e o cumprimento de obrigações legais (Lei 13.709/2018, art. 7º, II e V).' },
  { titulo: 'Com quem compartilhamos', texto: 'Com os órgãos públicos, quando a lei manda, e com os serviços de tecnologia que guardam os arquivos e o sistema para nós, sempre com acesso restrito. Não vendemos nem cedemos seus dados para propaganda.' },
  { titulo: 'Por quanto tempo guardamos', texto: 'Pelo tempo do contrato e, depois, pelos prazos que a lei pede para os documentos fiscais, contábeis e trabalhistas.' },
  { titulo: 'Seus direitos', texto: 'Você pode pedir para ver, corrigir ou atualizar os dados, saber com quem foram compartilhados e tirar dúvidas pelo WhatsApp ou pelo e-mail do escritório. Alguns dados não podem ser apagados enquanto a lei obrigar a guardá-los.' },
];

/** Precisa mostrar a janela? (o aceite guardado é a versão aceita; '' ou outra versão = precisa) */
export function precisaAceitar(versaoAceita: string | null | undefined, versao = VERSAO_DA_POLITICA, ligada = POLITICA_LIGADA): boolean {
  return ligada && versaoAceita !== versao;
}

/** O registro que o site grava em areaClienteAceites (sem a hora: o banco põe). */
export function pedidoDeAceite(token: string, versao = VERSAO_DA_POLITICA): { token: string; versao: string } | null {
  return /^[0-9a-f]{40}$/.test(token) && versao.length <= 20 ? { token, versao } : null;
}
