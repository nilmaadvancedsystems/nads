// O envio do mês ao cliente pelo Mandei (11/11/2026). O que a pessoa marcou no "+" de Clientes e de Fornecedores vai num
// ticket só, como fazia a etapa Fechar a competência (Vitor, 16/10/2026: "um envio só"). Ela saiu em 27/10 e o Envio das
// duas etapas ficou escondido: o que era marcado não ia a lugar nenhum. Agora o Envio volta nas duas, com os dois lados.
// Cada lado guarda no mês o que já foi mandado (DocClientes.enviado, a assinatura): mudou depois, manda de novo, e só o
// lado que mudou vai no ticket novo (o que já foi não se repete).
import { OPCOES_PADRAO, type ItemDoTicket } from '../../mandei';
import { assinaturaDoEnvio, conferidosQuePassam, razaoComPendencia, type DocClientes, type MarcaDoCliente } from './index';
import { chaveDoItem, itensEscolhidos, linhasParaOTicket, rotuloDoItem, type LadoDaConta } from './razao';
import { reais } from '../../formatos';

/** Um lado do mês: as marcas deste mês e as do anterior (os conferidos que passam). */
export interface LadoDoMes { lado: LadoDaConta; doc: DocClientes; anterior: DocClientes | null }

/** Uma conta que vai ser questionada: conferida pelo razão, com pendência e com linha marcada no "+". */
export interface QuestaoDoMes { lado: LadoDaConta; codigo: string; marca: MarcaDoCliente }

/** O que vai ser questionado de um lado: as contas conferidas (as deste mês e as que passaram do anterior) com linha no "+". */
export function questoesDoLado(l: LadoDoMes): QuestaoDoMes[] {
  const contas = { ...conferidosQuePassam(l.anterior, l.doc), ...l.doc.contas };
  return Object.entries(contas)
    .filter(([, m]) => !!m.razao && razaoComPendencia(m.razao, m.baixas) && itensEscolhidos(m.razao, m.perguntar).length > 0)
    .map(([codigo, marca]) => ({ lado: l.lado, codigo, marca }));
}

export interface EnvioDoMes {
  questoes: QuestaoDoMes[];
  /** a assinatura de cada lado ('' = nada para questionar nele) */
  assinaturas: Record<LadoDaConta, string>;
  /** os lados com marcação ainda não mandada (ou mudada depois de mandar) */
  faltam: LadoDaConta[];
}

export function envioDoMes(lados: readonly LadoDoMes[]): EnvioDoMes {
  const assinaturas: Record<LadoDaConta, string> = { clientes: '', fornecedores: '' };
  const questoes: QuestaoDoMes[] = [];
  const faltam: LadoDaConta[] = [];
  for (const l of lados) {
    const q = questoesDoLado(l);
    questoes.push(...q);
    assinaturas[l.lado] = assinaturaDoEnvio(q.map(x => ({ codigo: x.codigo, perguntar: itensEscolhidos(x.marca.razao, x.marca.perguntar).map(chaveDoItem) })));
    if (assinaturas[l.lado] && l.doc.enviado !== assinaturas[l.lado]) faltam.push(l.lado);
  }
  return { questoes, assinaturas, faltam };
}

/** O nome curto do que vai ser perguntado numa conta: "NF 9971 · Pagamento 20/08/2026". */
export const perguntasDaQuestao = (q: QuestaoDoMes) => itensEscolhidos(q.marca.razao, q.marca.perguntar).map(rotuloDoItem).join(' · ');

/**
 * O ticket do mês: só as contas dos lados que faltam mandar. 'aaaa-mm' e o rótulo do mês ("08/2026"). Com os dois lados,
 * o título de cada item diz se é cliente ou fornecedor.
 */
export function ticketDoMes(envio: EnvioDoMes, mes: string, rotuloMes: string): { assunto: string; mensagem: string; itens: ItemDoTicket[] } {
  const vao = envio.questoes.filter(q => envio.faltam.includes(q.lado));
  const lados = new Set(vao.map(q => q.lado));
  const doisLados = lados.size > 1;
  const quem = doisLados ? 'clientes e fornecedores' : lados.has('fornecedores') ? 'fornecedores' : 'clientes';
  return {
    assunto: 'Saldos em aberto — ' + rotuloMes,
    mensagem: 'Na conferência de ' + rotuloMes + ', estes saldos de ' + quem + ' ficaram em aberto. Pode nos dizer o que aconteceu com cada um?',
    itens: vao.map(q => ({
      id: q.lado + '-' + q.codigo,
      titulo: (doisLados ? (q.lado === 'clientes' ? 'Cliente: ' : 'Fornecedor: ') : '') + q.marca.nome,
      valor: reais(Math.abs(q.marca.saldo)), opcoes: OPCOES_PADRAO,
      linhas: linhasParaOTicket(q.marca.razao, q.marca.saldo, mes, q.marca.perguntar, q.lado, q.marca.baixas),
    })),
  };
}
