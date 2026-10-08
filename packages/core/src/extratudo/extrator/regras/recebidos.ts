// Os extratos que chegam por e-mail (Vitor, 08/10/2026: "quero que isso aconteça com o contábil, ele já jogue o extrato
// para o nads"): o robô do Gmail guarda o arquivo com o banco e a conta que leu do texto; aqui, em qual linha (conta) da
// tarefa de extratos ele entra. Pelo banco (o id do robô vira a marca do Cadastro) e, com duas contas do mesmo banco,
// pelo número da conta. Uma só linha boa → ela; senão a pessoa escolhe.
import { nomeNorm } from '../../../formatos';

/** Um extrato que chegou por e-mail e ainda não foi importado. */
export interface ExtratoRecebido {
  id: string;
  /** o nome do arquivo no e-mail */
  nome: string;
  /** aaaa-mm (o mês do e-mail, pelo robô) */
  competencia: string;
  /** os bancos que o robô leu no extrato (ids do robô: bb, sicoob, mercadopago…) */
  bancos: string[];
  /** agência e conta lidas do texto (quando deu) */
  contas: { agencia: string; conta: string }[];
  /** quando chegou (ISO) e de quem */
  em: string;
  remetente: string;
}

/** Uma linha (conta) da tarefa de extratos. */
export interface LinhaParaRecebido { id: string; nome: string; marca?: string; numeroConta?: string }

/** O id do banco no robô → a marca no Cadastro (os outros são iguais). */
const DO_ROBO: Record<string, string> = { bb: 'banco-do-brasil', mercadopago: 'mercado-pago' };

const digitos = (v: unknown) => String(v || '').replace(/\D/g, '').replace(/^0+/, '');

/** Em qual linha o extrato recebido entra: { linha } quando é uma só; senão as candidatas (a pessoa escolhe). */
export function linhaDoRecebido(r: ExtratoRecebido, linhas: readonly LinhaParaRecebido[]): { linha: string | null; candidatas: string[] } {
  const reais = linhas.filter(l => l.id !== 'banco');
  if (!reais.length) return { linha: linhas.length === 1 ? linhas[0].id : null, candidatas: linhas.map(l => l.id) };
  const marcas = r.bancos.map(b => DO_ROBO[b] || b);
  const doBanco = marcas.length
    ? reais.filter(l => marcas.includes(l.marca || '') || marcas.some(m => nomeNorm(l.nome).includes(nomeNorm(m.replace(/-/g, ' ')))))
    : reais;
  let candidatas = doBanco.length ? doBanco : reais;
  // duas contas do mesmo banco: a do número da conta lido no extrato (pelo fim do número, sem o dígito às vezes)
  if (candidatas.length > 1 && r.contas.length) {
    const lidas = r.contas.map(c => digitos(c.conta)).filter(c => c.length >= 4);
    const pelaConta = candidatas.filter(l => {
      const n = digitos(l.numeroConta);
      return n.length >= 4 && lidas.some(c => c === n || c.slice(0, -1) === n || n.slice(0, -1) === c || c.endsWith(n) || n.endsWith(c));
    });
    if (pelaConta.length) candidatas = pelaConta;
  }
  return { linha: candidatas.length === 1 ? candidatas[0].id : null, candidatas: candidatas.map(l => l.id) };
}
