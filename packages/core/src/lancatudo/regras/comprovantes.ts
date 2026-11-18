// Os comprovantes no Lançatudo (18/11/2026: "quero a opção de adicionar comprovantes, não só extratos"; "com os comprovantes
// tem como saber o cliente e afins, de maneira mais fácil; ele também precisa puxar os comprovantes do drive"). O comprovante
// (o Pix, a TED, o boleto pago, a guia) é lido: a data, o valor, quem recebeu (ou quem pagou, no recebido) e o CPF/CNPJ. Ele
// casa com a linha do extrato pelo valor e pela data (até 3 dias), e o CPF/CNPJ e o nome dele ajudam a achar a conta: as
// regras de favorecido e as contas aprendidas olham também o comprovante. Do PDF só ficam esses dados; o arquivo fica no Drive
// (ou no computador de quem enviou).
import { normalizarTexto } from '../../formatos';
import type { ItemDeTexto } from '../../extratudo/extrator/regras/extrato';

export type TipoDeComprovante = 'pix' | 'transferencia' | 'boleto' | 'guia' | 'outro';

export interface ComprovanteDoLancatudo {
  id: string;
  /** o nome do arquivo */
  nome: string;
  /** o arquivo no Drive (sem = veio do computador) */
  driveId?: string;
  /** 'aaaa-mm-dd' ('' = não achou) */
  data: string;
  /** centavos, sempre positivo (0 = não achou) */
  valor: number;
  /** quem recebeu (no pago) ou quem pagou (no recebido) */
  favorecido: string;
  /** o CPF/CNPJ do favorecido, só dígitos ('' = não achou) */
  documento: string;
  tipo: TipoDeComprovante;
  /** o comprovante é de dinheiro que entrou (o Pix recebido, o crédito) */
  recebido?: boolean;
  /** a linha do extrato escolhida pela pessoa (vale mais que o casamento automático) */
  linha?: string;
  /** ISO e quem pôs */
  em: string;
  por: string;
}

export type ComprovanteLido = Pick<ComprovanteDoLancatudo, 'data' | 'valor' | 'favorecido' | 'documento' | 'tipo' | 'recebido'>;

/** O texto do PDF (ou do OCR) em linhas: os pedaços da mesma altura, da esquerda para a direita. */
export function textoEmLinhas(paginas: readonly (readonly ItemDeTexto[])[]): string {
  const out: string[] = [];
  for (const p of paginas) {
    const linhas: { y: number; itens: ItemDeTexto[] }[] = [];
    for (const i of p) {
      if (!i.texto.trim()) continue;
      const l = linhas.find(x => Math.abs(x.y - i.y) <= 3);
      if (l) l.itens.push(i); else linhas.push({ y: i.y, itens: [i] });
    }
    linhas.sort((a, b) => b.y - a.y);
    for (const l of linhas) out.push(l.itens.sort((a, b) => a.x - b.x).map(i => i.texto.trim()).join(' ').replace(/\s+/g, ' '));
  }
  return out.join('\n');
}

const VALOR = /R\$\s*(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2})/;
const DATA = /(?<!\d)(\d{2})\/(\d{2})\/(\d{4})(?!\d)/;
const DOC = /(?<![\d*])(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|\d{3}\.?\d{3}\.?\d{3}-?\d{2})(?![\d*])/g;
/** minúsculas e sem acento, do mesmo tamanho do original (para recortar o nome pela posição) */
const baixa = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** o rótulo de quem recebe (no pago); "para" e "destino" só no começo da linha */
const RECEBEDOR = /\b(favorecido|destinatario|beneficiario|recebedor|quem recebeu|conta destino|conta creditada|cedente)\b|^(para|destino)\b/;
/** o rótulo de quem paga; "de" e "origem" só no começo da linha */
const PAGADOR = /\b(pagador|quem pagou|remetente|conta origem|conta debitada|sacado)\b|^(de|origem)\b/;
/** o que não é nome (os rótulos que vêm na linha do nome ou logo depois) */
const ROTULO = /^(nome|razao social|cpf|cnpj|documento|instituicao|banco|agencia|conta|chave|tipo|valor|data|id|autenticacao|codigo)\b/;

const centavos = (s: string) => Math.round(Number(s.replace(/\./g, '').replace(',', '.')) * 100);

function tipoDoTexto(t: string): TipoDeComprovante {
  if (/\b(darf|das|gps|gare|dae|fgts|grrf|guia)\b/.test(t)) return 'guia';
  if (/\bpix\b/.test(t)) return 'pix';
  if (/\b(boleto|codigo de barras|linha digitavel|titulo)\b/.test(t)) return 'boleto';
  if (/\b(ted|doc|transferencia|tef)\b/.test(t)) return 'transferencia';
  return 'outro';
}

/** O valor: o da linha com o rótulo mais forte (valor pago, valor total…), senão o primeiro R$ do comprovante. */
function valorDoTexto(linhas: string[], norm: string[]): number {
  const rotulos = [/valor (pago|total|do pagamento|cobrado|da transferencia|do pix|transferido|debitado)/, /\bvalor\b/];
  for (const r of rotulos) {
    for (let i = 0; i < linhas.length; i++) {
      if (!r.test(norm[i]) || /\b(desconto|juros|multa|tarifa)\b/.test(norm[i])) continue;
      const m = VALOR.exec(linhas[i]) || (linhas[i + 1] ? VALOR.exec(linhas[i + 1]) : null) || /(\d{1,3}(?:\.\d{3})*,\d{2})/.exec(linhas[i]);
      if (m) return Math.abs(centavos(m[1]));
    }
  }
  const m = VALOR.exec(linhas.join('\n'));
  return m ? Math.abs(centavos(m[1])) : 0;
}

/** A data do pagamento (não o vencimento nem a emissão), senão a primeira do comprovante. */
function dataDoTexto(linhas: string[], norm: string[]): string {
  const iso = (m: RegExpExecArray) => m[3] + '-' + m[2] + '-' + m[1];
  const rotulos = [/data (do|de) (pagamento|debito|transferencia|transacao|efetivacao|credito)|pago em|realizad[oa] em|efetivad[oa] em/, /\bdata\b/];
  for (const r of rotulos) {
    for (let i = 0; i < linhas.length; i++) {
      if (!r.test(norm[i]) || /vencimento|emissao|documento|nascimento/.test(norm[i])) continue;
      const m = DATA.exec(linhas[i]) || (linhas[i + 1] ? DATA.exec(linhas[i + 1]) : null);
      if (m) return iso(m);
    }
  }
  for (let i = 0; i < linhas.length; i++) {
    if (/vencimento/.test(norm[i])) continue;
    const m = DATA.exec(linhas[i]);
    if (m) return iso(m);
  }
  return '';
}

/** O nome que vem depois do rótulo na mesma linha, ou nas linhas de baixo (pulando os rótulos e os números). */
function nomeDepois(linhas: string[], bx: string[], i: number, rotulo: RegExp): string {
  const limpa = (s: string) => s.replace(DOC, ' ').replace(/\b(cpf|cnpj)\b.*$/i, '').replace(/^[\s:.\-–]+|[\s:.\-–]+$/g, '').replace(/\s+/g, ' ').trim();
  const ehNome = (s: string) => {
    const n = normalizarTexto(s);
    return /[a-z]{3}/.test(n) && !ROTULO.test(n) && !RECEBEDOR.test(n) && !PAGADOR.test(n) && !/\d{3}/.test(s);
  };
  const tiraRotulo = (s: string) => s.replace(/^\s*(nome|raz[aã]o social)\s*[:\-–]?\s*/i, '');
  // na mesma linha: o que vem depois do rótulo ("Favorecido: JOÃO DA SILVA")
  const m = rotulo.exec(bx[i]);
  if (m) {
    const r = limpa(tiraRotulo(linhas[i].slice(m.index + m[0].length).replace(/^\s*[:\-–]?\s*/, '')));
    if (r && ehNome(r)) return r;
  }
  for (let j = i + 1; j < Math.min(linhas.length, i + 5); j++) {
    if (RECEBEDOR.test(bx[j]) || PAGADOR.test(bx[j])) break;
    const r = limpa(tiraRotulo(linhas[j]));
    if (r && ehNome(r)) return r;
  }
  return '';
}

/** O primeiro CPF/CNPJ inteiro (sem *) entre as linhas de..até. */
function documentoEntre(linhas: string[], de: number, ate: number): string {
  for (let j = de; j < ate; j++) {
    const m = linhas[j].match(DOC);
    if (m) return m[0].replace(/\D/g, '');
  }
  return '';
}

/**
 * Lê o comprovante pelo texto em linhas (textoEmLinhas). O favorecido é quem está do lado de quem recebe (favorecido,
 * destinatário, beneficiário, recebedor, "para"); no Pix recebido, quem pagou. Sem achar o valor, null (não é comprovante).
 */
export function lerComprovante(texto: string): ComprovanteLido | null {
  const linhas = texto.split('\n').map(l => l.trim()).filter(Boolean);
  const norm = linhas.map(l => normalizarTexto(l));
  const bx = linhas.map(baixa);
  const tudo = norm.join(' ');
  const valor = valorDoTexto(linhas, norm);
  if (!valor) return null;
  const recebido = /\b(pix recebido|transferencia recebida|ted recebida|voce recebeu|recebimento de pix|credito recebido)\b/.test(tudo);
  const lado = recebido ? PAGADOR : RECEBEDOR;
  const outro = recebido ? RECEBEDOR : PAGADOR;
  let favorecido = '';
  let documento = '';
  for (let i = 0; i < linhas.length; i++) {
    if (!lado.test(bx[i])) continue;
    // o pedaço deste lado: até o rótulo do outro lado
    let fim = linhas.length;
    for (let j = i + 1; j < linhas.length; j++) if (outro.test(bx[j]) && !lado.test(bx[j])) { fim = j; break; }
    const nome = nomeDepois(linhas, bx, i, lado);
    const doc = documentoEntre(linhas, i, fim);
    if (nome || doc) { favorecido = nome; documento = doc; break; }
  }
  // sem os rótulos: o CPF/CNPJ que não está do lado de quem paga
  if (!documento) {
    let doOutro = false;
    for (let i = 0; i < linhas.length; i++) {
      if (outro.test(bx[i])) doOutro = true;
      else if (lado.test(bx[i])) doOutro = false;
      const m = linhas[i].match(DOC);
      if (!m || doOutro) continue;
      documento = m[0].replace(/\D/g, '');
      break;
    }
  }
  return { data: dataDoTexto(linhas, norm), valor, favorecido: favorecido.toUpperCase().slice(0, 80), documento, tipo: tipoDoTexto(tudo), ...(recebido ? { recebido: true } : {}) };
}

const dias = (a: string, b: string) => Math.abs((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 86400000);

/**
 * Cada comprovante na sua linha do extrato: a escolhida pela pessoa; senão a de mesmo valor com a data mais perto (até 3
 * dias; o boleto pago na sexta cai na segunda), no sentido do comprovante quando ele diz. Uma linha, um comprovante.
 * Devolve a chave da linha → o comprovante.
 */
export function casarComprovantes(linhas: readonly { chave: string; data: string; valor: number }[], comprovantes: readonly ComprovanteDoLancatudo[]): Map<string, ComprovanteDoLancatudo> {
  const out = new Map<string, ComprovanteDoLancatudo>();
  const chaves = new Set(linhas.map(l => l.chave));
  for (const c of comprovantes) if (c.linha && chaves.has(c.linha) && !out.has(c.linha)) out.set(c.linha, c);
  const usados = new Set([...out.values()].map(c => c.id));
  const pares: { chave: string; c: ComprovanteDoLancatudo; d: number }[] = [];
  for (const c of comprovantes) {
    if (usados.has(c.id) || !c.valor) continue;
    for (const l of linhas) {
      if (Math.abs(l.valor) !== c.valor || out.has(l.chave)) continue;
      if (c.recebido !== undefined && (l.valor > 0) !== !!c.recebido) continue;
      const d = c.data ? dias(c.data, l.data) : 0;
      if (d <= 3) pares.push({ chave: l.chave, c, d });
    }
  }
  pares.sort((a, b) => a.d - b.d);
  for (const p of pares) {
    if (out.has(p.chave) || usados.has(p.c.id)) continue;
    out.set(p.chave, p.c);
    usados.add(p.c.id);
  }
  return out;
}

/** O texto que as regras de favorecido olham: o histórico do banco, o nome e o CPF/CNPJ do comprovante. */
export function textoParaAsRegras(historicoDoBanco: string, c: Pick<ComprovanteDoLancatudo, 'favorecido' | 'documento'> | undefined): string {
  return c ? [historicoDoBanco, c.favorecido, c.documento].filter(Boolean).join(' ') : historicoDoBanco;
}

/**
 * O texto de onde sai a chave do que o nads aprende: o CPF/CNPJ do comprovante na frente (vale mais que o nome); sem ele, só
 * o histórico do banco (a chave não muda só porque chegou um comprovante sem documento).
 */
export function textoParaAprender(historicoDoBanco: string, c: Pick<ComprovanteDoLancatudo, 'documento'> | undefined): string {
  return c?.documento ? c.documento + ' ' + historicoDoBanco : historicoDoBanco;
}
