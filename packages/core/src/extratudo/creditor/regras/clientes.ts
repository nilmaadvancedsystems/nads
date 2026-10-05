// A conta de cada cliente vem do balancete (pedido do escritório, 2026-09-29): os apps do contábil já
// importam o extrato e o balancete no banco, e no balancete estão as contas dos clientes — não precisa
// mais do arquivo do sistema. O banco manda (valor e cliente); daqui sai só a conta:
//   0. a conta da NF no relatório de Saídas importado na Tarefa, quando ele traz a conta (vence tudo);
//   1. a conta aprendida do cliente (conciliado antes; a pessoa confirmou);
//   2. a conta de cliente do balancete com o mesmo nome do sacado, quando só uma parece;
//   3. sem nenhuma: a pessoa informa a conta (e ela fica aprendida quando o arquivo é baixado).
import { nomeNorm } from '../../../formatos';
import type { Titulo } from '../tipos';
import { contaAprendida, type ClientesAprendidos } from './aprendizado';
import type { BalanceteDaEmpresa, ContaDoBalancete } from './balancete';
import type { Cruzamento } from './cruzamento';
import { chaveNf } from './numeros';
import type { ContaDaNota } from './saidas';

/** Sintética que abre as contas de clientes ("CLIENTES", "DUPLICATAS A RECEBER", "CONTAS A RECEBER"). */
const SECAO_CLIENTES = /\bclientes?\b|duplicatas? a receber|contas? a receber/;

/**
 * As contas analíticas de clientes: as que vêm abaixo de uma sintética de clientes, até a próxima
 * sintética. Sem a marcação de sintética (só sobrou o plano), não dá para saber a seção: valem todas.
 */
export function contasDeClientes(b: BalanceteDaEmpresa): ContaDoBalancete[] {
  if (!b.contas.some(c => c.sintetica)) return b.contas;
  const saida: ContaDoBalancete[] = [];
  let naSecao = false;
  for (const c of b.contas) {
    if (c.sintetica) { naSecao = SECAO_CLIENTES.test(nomeNorm(c.nome)); continue; }
    if (naSecao) saida.push(c);
  }
  return saida;
}

const PALAVRAS_VAZIAS = new Set(['ltda', 'me', 'epp', 'eireli', 'sa', 's', 'a', 'de', 'da', 'do', 'das', 'dos', 'e', 'cia']);
const semVazias = (n: string) => nomeNorm(n).split(' ').filter(p => p && !PALAVRAS_VAZIAS.has(p)).join(' ');

const palavrasDoNome = (n: string) => semVazias(n).split(' ').filter(Boolean);
/** "TAI1", "PA3", "AL2": código de filial que o banco e o plano põem no fim do nome */
const ehFilial = (p: string) => /^[a-z]{1,4}\d{1,2}$/.test(p);
/** Mesma palavra, ou uma é o começo da outra (o banco corta: "TAIOB" = "TAIOBEIRAS", "PA" = "PALM"). */
const mesmaPalavra = (a: string, b: string) => a === b || (!ehFilial(a) && !ehFilial(b) && Math.min(a.length, b.length) >= 2 && (a.startsWith(b) || b.startsWith(a)));

/**
 * Quanto o nome do sacado parece o nome da conta (0 a 1): as palavras que batem sobre as do nome mais
 * comprido. Antes bastava um nome conter o outro, e a conta "SUPERMERCADO A E E" batia com todo
 * supermercado (292, 2026-09-29). Filial diferente ("-TAI1" × "PA3") não é o mesmo cliente: 0.
 */
export function semelhancaDeNome(sacado: string, conta: string): number {
  let a = palavrasDoNome(sacado), b = palavrasDoNome(conta);
  const fa = a.filter(ehFilial), fb = b.filter(ehFilial);
  if (fa.length && fb.length && !fa.some(x => fb.includes(x))) return 0;
  // só um lado diz a filial: ela não conta ("ARAUJO E SA LTDA -TAI1" = "ARAUJO E SA LTDA")
  if (!fa.length || !fb.length) { a = a.filter(p => !ehFilial(p)); b = b.filter(p => !ehFilial(p)); }
  if (!a.length || !b.length) return 0;
  const livres = [...b];
  let bate = 0;
  for (const p of a) {
    const i = livres.findIndex(q => mesmaPalavra(p, q));
    if (i >= 0) { bate++; livres.splice(i, 1); }
  }
  return bate / Math.max(a.length, b.length);
}

/** Parecido o bastante para ser o mesmo cliente. */
export const SEMELHANCA_MINIMA = 0.6;
export function mesmoNomeDeCliente(sacado: string, conta: string): boolean {
  return semelhancaDeNome(sacado, conta) >= SEMELHANCA_MINIMA;
}

export function cruzarPeloBalancete(titulos: Titulo[], clientes: readonly ContaDoBalancete[], aprendidos: ClientesAprendidos, porNf?: ReadonlyMap<string, readonly ContaDaNota[]>): Cruzamento[] {
  return titulos.map((t): Cruzamento => {
    const base = { tituloId: t.id, valorBanco: t.valor, valorSistema: null };
    const linha = (contrapartida: string, cliente: string) => ({ linha: 0, nf: t.nf, cliente, contrapartida, historico: '', valor: t.valor });
    // a NF está no relatório de Saídas com a conta: é ela, mesmo com o nome diferente (na 292, o banco diz SUPERMERCADOS
    // BOA COMPRA -TAI1 e a NF 9889 diz CIRO VERNER: a mesma raiz de CNPJ, a filial com a razão social). A mesma NF com
    // mais de uma conta: o nome do cliente desempata; sem desempate, segue pelo balancete
    const daNf = porNf?.get(chaveNf(t.nf)) || [];
    const doCliente = daNf.length > 1 ? daNf.filter(n => mesmoNomeDeCliente(t.sacado, n.nome)) : daNf;
    const daNota = doCliente.length === 1 ? doCliente[0] : null;
    if (daNota) {
      const doBalancete = clientes.find(c => c.codigo === daNota.conta);
      return { ...base, situacao: 'ok', linha: linha(daNota.conta, doBalancete?.nome || daNota.nome), nota: 'Conta pelo relatório de Saídas (NF ' + chaveNf(t.nf) + ').', pelaSaida: true };
    }
    // a conta mais parecida vence; empate no topo (o mesmo nome em mais de uma conta) pergunta
    const notas = clientes.map(c => ({ c, n: semelhancaDeNome(t.sacado, c.nome) })).filter(x => x.n >= SEMELHANCA_MINIMA);
    const topo = Math.max(0, ...notas.map(x => x.n));
    const parecidas = notas.filter(x => x.n === topo).map(x => x.c);
    const codigos = [...new Set(parecidas.map(c => c.codigo))];
    const aprendida = contaAprendida(aprendidos, t.sacado);
    // Cliente com várias filiais de nome igual (no 292: MEDEIROS E MOURA em 4 contas): a conta
    // aprendida é guardada pelo nome, então não decide sozinha — vira a sugestão.
    if (codigos.length > 1) {
      const sugestao = aprendida && codigos.includes(aprendida.conta) ? ' Da última vez: ' + aprendida.conta + '.' : '';
      return {
        ...base, situacao: 'nao-encontrada', linha: null,
        nota: 'O cliente tem ' + codigos.length + ' contas com esse nome no balancete (uma por filial). Escolha a desta NF.' + sugestao,
        opcoes: parecidas.map(c => ({ codigo: c.codigo, nome: c.nome })),
      };
    }
    if (aprendida) {
      const doBalancete = clientes.find(c => c.codigo === aprendida.conta);
      return { ...base, situacao: 'ok', linha: linha(aprendida.conta, doBalancete?.nome || aprendida.nome), nota: 'Conta aprendida do cliente.', aprendida: true };
    }
    if (codigos.length === 1) return { ...base, situacao: 'ok', linha: linha(parecidas[0].codigo, parecidas[0].nome), nota: topo < 1 ? 'Pelo nome parecido: ' + parecidas[0].nome + '.' : '' };
    return { ...base, situacao: 'nao-encontrada', linha: null, nota: 'Cliente sem conta com esse nome no balancete. Informe a conta (fica aprendida).' };
  });
}
