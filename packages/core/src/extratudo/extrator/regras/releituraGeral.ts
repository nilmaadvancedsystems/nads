// A releitura dos extratos de todas as empresas (10/11/2026: "eu quero que a correção de um bug valha para todas as empresas").
// Antes, o extrato guardado só era relido com o leitor novo quando alguém abria aquela empresa; a empresa que ninguém abria
// ficava com a leitura velha. Aqui, a parte pura: as leituras novas (já feitas, por arquivo) entram na empresa com as mesmas
// proteções da releitura automática — não perde mês, não troca uma leitura que fechava com o saldo do banco por uma que não
// fecha — e o resumo diz o que foi relido, o que ficou como estava e por quê.
import type { ArquivoLido, EmpresaExtrator } from '../tipos';
import { relerExtrato, releituraPerderiaMes, releituraPioraOSaldo } from './importacao';

/** O que a releitura fez numa empresa. */
export interface ReleituraDaEmpresa {
  empresa: EmpresaExtrator;
  /** quantos extratos foram trocados pela leitura nova (ou saíram, quando eram fatura ou outro documento) */
  relidos: number;
  /** os que ficaram com a leitura de antes, e o motivo */
  mantidos: { nome: string; motivo: string }[];
  /** os relidos cuja leitura nova não fecha com o saldo que o banco imprime */
  naoFecham: string[];
}

/**
 * Aplica as leituras novas (arquivoId → leitura) sobre a empresa — a versão mais nova dela, pega na hora de gravar (outra pessoa
 * pode ter importado alguma coisa enquanto os PDFs baixavam). A leitura com erro de leitura não entra aqui: quem chama tenta de
 * novo depois, em vez de marcar o arquivo como relido.
 */
export function aplicarReleituras(e: EmpresaExtrator, lidos: ReadonlyMap<string, ArquivoLido>, agora: Date): ReleituraDaEmpresa {
  let empresa = e;
  let relidos = 0;
  const mantidos: { nome: string; motivo: string }[] = [];
  const naoFecham: string[] = [];
  for (const [id, lido] of lidos) {
    const a = empresa.arquivos.find(x => x.id === id);
    if (!a) continue;
    if (releituraPerderiaMes(a, lido)) { mantidos.push({ nome: a.nome, motivo: 'a leitura nova perderia um mês' }); continue; }
    if (releituraPioraOSaldo(a, lido)) { mantidos.push({ nome: a.nome, motivo: 'a leitura nova deixaria de fechar com o saldo do banco' }); continue; }
    empresa = relerExtrato(empresa, id, lido, agora);
    relidos++;
    if (lido.conferenciaPeloSaldo?.naoFecham) naoFecham.push(a.nome);
  }
  return { empresa, relidos, mantidos, naoFecham };
}
