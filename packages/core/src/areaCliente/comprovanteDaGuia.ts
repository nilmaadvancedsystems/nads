// "Já paguei: mandar o comprovante" na guia da Área do Cliente (plano do Acessórias, 17/11/2026, ficha comprovante-da-guia,
// parte A; frase do dono: "pode ir fazendo"). O cliente manda o comprovante pela mesma caixa do envio (areaClienteEnvios),
// com o tipo "comprovante" e o nome do arquivo começando pelo prefixo da guia ("Comprovante FGTS 10-2026 - "). A linha da
// guia mostra "Comprovante enviado em dd/mm" quando o recibo volta pelo espelho.
// Isso NÃO marca a guia como paga: o robô ainda não liga o arquivo à guia (a parte B, ficha 2A.9). Sem regra nova: o nome
// livre até 200 caracteres cabe na caixa que já existe. Só a lógica (sem tela e sem banco).
import type { GuiaDoCliente } from './guias';
import type { ReciboDeEnvio } from './envios';

/** o nome do arquivo na caixa do envio tem no máximo 200 caracteres (a regra do banco) */
export const MAIOR_NOME_DO_ENVIO = 200;

/** "Comprovante FGTS 10-2026 - " (a sigla crua da guia; "Guia" na outra). */
export function prefixoDoComprovante(g: Pick<GuiaDoCliente, 'tipo' | 'competencia' | 'tributo'>): string {
  const [ano, mes] = g.competencia.split('-');
  // a DARF leva o tributo ("Comprovante DARF INSS 10-2026 - "), para a do INSS e a do IRRF do mês não se confundirem
  return 'Comprovante ' + (g.tipo === 'outra' ? 'Guia' : g.tipo) + (g.tipo === 'DARF' && g.tributo ? ' ' + g.tributo : '') + ' ' + mes + '-' + ano + ' - ';
}

/** O prefixo + o nome do arquivo, cortado para caber em 200 caracteres sem perder a extensão. */
export function nomeComPrefixo(prefixo: string, nomeDoArquivo: string): string {
  const ext = /\.[^.\s]{1,10}$/.exec(nomeDoArquivo)?.[0] ?? '';
  const base = ext ? nomeDoArquivo.slice(0, -ext.length) : nomeDoArquivo;
  return (prefixo + base).slice(0, Math.max(0, MAIOR_NOME_DO_ENVIO - ext.length)) + ext;
}

/** O comprovante mais novo que o cliente mandou para esta guia (pelo prefixo), ou null. */
export function comprovanteDaGuia(g: Pick<GuiaDoCliente, 'tipo' | 'competencia' | 'tributo'>, envios: readonly ReciboDeEnvio[]): ReciboDeEnvio | null {
  const prefixo = prefixoDoComprovante(g);
  const deles = envios.filter(e => e.tipo === 'comprovante' && e.nome.startsWith(prefixo));
  return deles.reduce<ReciboDeEnvio | null>((mais, e) => (!mais || e.recebidoEm > mais.recebidoEm ? e : mais), null);
}

// A parte B (plano do Acessórias, 18/11/2026, ficha comprovante-da-guia; frase do dono: "Seguir"): o inverso do prefixo.
// O robô grava no areaClienteRecebidos de que guia é o comprovante e avisa no painel; a equipe vê a guia em Recebidos.
// Não marca a guia como paga (isso é a ficha guia-paga-confirmada).
const DO_PREFIXO = /^Comprovante (FGTS|DAS|DAE|DAM|Guia|DARF)(?: (\S.{0,29}?))? (\d{2})-(\d{4}) - /;

/** A guia do nome do comprovante ("Comprovante DARF INSS 10-2026 - pix.pdf" -> DARF INSS, 2026-10); null sem o prefixo. */
export function guiaDoComprovante(nome: string): Pick<GuiaDoCliente, 'tipo' | 'competencia' | 'tributo'> | null {
  const m = DO_PREFIXO.exec(String(nome || ''));
  if (!m) return null;
  const mes = Number(m[3]);
  if (mes < 1 || mes > 12) return null;
  const tipo = (m[1] === 'Guia' ? 'outra' : m[1]) as GuiaDoCliente['tipo'];
  // só a DARF leva o tributo; nas outras, um texto no meio é nome torto
  if (m[2] && tipo !== 'DARF') return null;
  return { tipo, competencia: m[4] + '-' + m[3], ...(m[2] ? { tributo: m[2] } : {}) };
}

/** "Comprovante do FGTS 10/2026", "Comprovante da DARF INSS 10/2026" (a linha da equipe em Recebidos). */
export function rotuloDoComprovante(g: Pick<GuiaDoCliente, 'tipo' | 'competencia' | 'tributo'>): string {
  const [ano, mes] = g.competencia.split('-');
  const nome = g.tipo === 'DARF' ? 'da DARF' + (g.tributo ? ' ' + g.tributo : '') : g.tipo === 'outra' ? 'da guia' : 'do ' + g.tipo;
  return 'Comprovante ' + nome + ' ' + mes + '/' + ano;
}
