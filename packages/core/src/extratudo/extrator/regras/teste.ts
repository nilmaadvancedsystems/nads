// Dados de TESTE para ver o protótipo (pedido do Vitor, 2026-09-29): um extrato e um razão inventados
// para a competência, que entram pelo mesmo caminho de um arquivo de verdade. O razão vem quase igual
// ao extrato, com diferenças de propósito (uma que falta, uma com valor diferente, uma a mais e uma
// duplicada), para a conferência ter o que mostrar. O nome do arquivo diz TESTE, para dar para achar e
// excluir depois.
import type { ArquivoLido, Lado, Lancamento } from '../tipos';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/** [dia, centavos (+ entrou, − saiu), histórico] */
const MOVIMENTO: readonly [number, number, string][] = [
  [2, 1250000, 'PIX RECEBIDO CLIENTE ALFA LTDA'],
  [3, -345090, 'PAGTO BOLETO FORNECEDOR BETA'],
  [5, -89900, 'TARIFA PACOTE DE SERVICOS'],
  [8, 780000, 'TED RECEBIDA GAMA COMERCIO'],
  [10, -1200000, 'PAGTO FOLHA SALARIOS'],
  [12, -45210, 'DEBITO ENERGIA ELETRICA'],
  [15, 560050, 'PIX RECEBIDO CLIENTE DELTA'],
  [18, -230000, 'PAGTO DARF SIMPLES NACIONAL'],
  [20, 99000, 'DEPOSITO EM DINHEIRO'],
  [22, -150075, 'PAGTO BOLETO ALUGUEL'],
  [25, 410000, 'PIX RECEBIDO CLIENTE EPSILON'],
  [28, -32000, 'TARIFA TED'],
];

function data(competencia: string, dia: number): string {
  const [ano, mes] = competencia.split('-').map(Number);
  const ultimo = new Date(ano, mes, 0).getDate();
  return competencia + '-' + String(Math.min(dia, ultimo)).padStart(2, '0');
}

export function rotuloDaCompetencia(competencia: string): string {
  return MESES[Number(competencia.slice(5, 7)) - 1] + '/' + competencia.slice(0, 4);
}

/** O arquivo de teste de um lado ('aaaa-mm'). */
export function arquivoDeTeste(lado: Lado, competencia: string): ArquivoLido {
  const extrato: Lancamento[] = MOVIMENTO.map(([dia, valor, historico]) => ({ data: data(competencia, dia), valor, historico }));
  const rotulo = rotuloDaCompetencia(competencia);
  if (lado === 'banco') return { nome: 'TESTE - Extrato ' + rotulo + '.pdf', lancamentos: extrato, erro: null };
  const razao: Lancamento[] = extrato
    .filter((_, i) => i !== 5) // falta: a energia elétrica não foi lançada
    .map((l, i) => (i === 7 ? { ...l, valor: l.valor + 1000 } : l)); // diferente: R$ 10,00 a mais
  razao.push({ data: data(competencia, 26), valor: -18000, historico: 'PAGTO SEGURO (SO NO SISTEMA)' }); // a mais
  razao.push({ ...razao[0] }); // duplicada
  return { nome: 'TESTE - Razao ' + rotulo + '.xlsx', lancamentos: razao, erro: null };
}
