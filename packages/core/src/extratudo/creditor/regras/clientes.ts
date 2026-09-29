// A conta de cada cliente vem do balancete (pedido do escritório, 2026-09-29): os apps do contábil já
// importam o extrato e o balancete no banco, e no balancete estão as contas dos clientes — não precisa
// mais do arquivo do sistema. O banco manda (valor e cliente); daqui sai só a conta:
//   1. a conta aprendida do cliente (conciliado antes; a pessoa confirmou), que sempre vence;
//   2. a conta de cliente do balancete com o mesmo nome do sacado, quando só uma parece;
//   3. sem nenhuma: a pessoa informa a conta (e ela fica aprendida quando o arquivo é baixado).
import { nomeNorm } from '../../../formatos';
import type { Titulo } from '../tipos';
import { contaAprendida, type ClientesAprendidos } from './aprendizado';
import type { BalanceteDaEmpresa, ContaDoBalancete } from './balancete';
import type { Cruzamento } from './cruzamento';

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

/** Mesmo nome? Um contém o outro (o banco corta o nome do sacado e acrescenta "-TAI1"), com 6+ letras. */
export function mesmoNomeDeCliente(sacado: string, conta: string): boolean {
  const x = semVazias(sacado.replace(/\s-\s?[a-z0-9]{2,4}$/i, '')), y = semVazias(conta);
  if (x.length < 6 || y.length < 6) return false;
  return x.includes(y) || y.includes(x);
}

export function cruzarPeloBalancete(titulos: Titulo[], clientes: readonly ContaDoBalancete[], aprendidos: ClientesAprendidos): Cruzamento[] {
  return titulos.map((t): Cruzamento => {
    const base = { tituloId: t.id, valorBanco: t.valor, valorSistema: null };
    const linha = (contrapartida: string, cliente: string) => ({ linha: 0, nf: t.nf, cliente, contrapartida, historico: '', valor: t.valor });
    const aprendida = contaAprendida(aprendidos, t.sacado);
    if (aprendida) {
      const doBalancete = clientes.find(c => c.codigo === aprendida.conta);
      return { ...base, situacao: 'ok', linha: linha(aprendida.conta, doBalancete?.nome || aprendida.nome), nota: 'Conta aprendida do cliente.', aprendida: true };
    }
    const parecidas = clientes.filter(c => mesmoNomeDeCliente(t.sacado, c.nome));
    const codigos = [...new Set(parecidas.map(c => c.codigo))];
    if (codigos.length === 1) return { ...base, situacao: 'ok', linha: linha(parecidas[0].codigo, parecidas[0].nome), nota: '' };
    const nota = codigos.length > 1
      ? 'Mais de uma conta parecida no balancete: ' + parecidas.map(c => c.codigo + ' ' + c.nome).join(' · ') + '. Informe a conta.'
      : 'Cliente sem conta no balancete. Informe a conta (fica aprendida).';
    return { ...base, situacao: 'nao-encontrada', linha: null, nota };
  });
}
