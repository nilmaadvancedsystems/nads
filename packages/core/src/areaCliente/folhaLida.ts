// A folha de verdade no Registro da Área do Cliente (13/11/2026: "vamos fazer isso", depois da pesquisa sobre de onde
// puxar a folha real em vez de estimar tudo pelas guias do FGTS). Duas leituras dos PDFs que o DP já salva na pasta
// DEPARTAMENTO PESSOAL da empresa (o mesmo texto com posição que o robô já tira das guias do FGTS):
//   - o holerite ("Demonstrativo de Pagamento de Salário", no "Folha de pagamento MM-AAAA.pdf" e no "Recibo de
//     Salário.pdf"): por funcionário, o cargo, a admissão, as rubricas (proventos e descontos), o líquido, as bases e o
//     FGTS do mês, a marca "Férias Vencidas" e os afastamentos das observações;
//   - a "Previsão - Vencimento de Férias": os períodos aquisitivos de cada um, os dias de direito, gozados e a gozar e
//     até quando conceder.
// Depois, registroComAFolha e historicoComAFolha juntam isso ao que as guias do FGTS já davam. O CPF do holerite só serve
// para achar a pessoa (idDoFuncionario) e não sai daqui; o motivo do afastamento (dado de saúde) também não.
// Funções puras: o robô (robo/area-cliente.js, pelo robo/gerado) lê o PDF e chama; a tela só lê o espelho.
import { idDoFuncionario, type FuncionarioDoRegistro, type PeriodoDeFerias } from './pessoal';
import type { MesDaFolha } from './dp';

/** Um pedaço de texto do PDF com a posição (o formato do itensDoPdf). */
export interface PedacoDaFolha { texto: string; x: number; y: number; largura?: number }

export interface RubricaDoHolerite {
  codigo: string;
  descricao: string;
  /** '220:00', '7,94 %', '15,00' ('' quando não tem) */
  referencia: string;
  valor: number;
  tipo: 'provento' | 'desconto';
}

export interface AfastamentoLido {
  /** 'aaaa-mm-dd' */
  de: string;
  ate: string;
  /** só para quem lê o PDF (atestado, auxílio-doença…): dado de saúde, não vai ao espelho */
  motivo: string;
}

/** Um holerite lido (uma pessoa num mês). */
export interface HoleriteLido {
  /** o código da empresa no sistema da folha ('00288'), ou '' */
  empresa: string;
  /** 'aaaa-mm' */
  competencia: string;
  matricula: string;
  nome: string;
  /** só os dígitos; serve para achar a pessoa e não sai do robô */
  cpf: string;
  cargo: string;
  /** 'aaaa-mm-dd', ou '' */
  admissao: string;
  rubricas: RubricaDoHolerite[];
  proventos: number;
  descontos: number;
  liquido: number;
  salarioBase: number;
  baseInss: number;
  baseFgts: number;
  fgts: number;
  baseIrrf: number;
  inss: number;
  irrf: number;
  feriasVencidas: boolean;
  afastamentos: AfastamentoLido[];
  /** os proventos menos os descontos dão o líquido do documento (a leitura das colunas está certa) */
  confere: boolean;
}

/** A "Previsão - Vencimento de Férias" de uma empresa. */
export interface FeriasDaFolha {
  empresa: string;
  /** a data do relatório ('aaaa-mm-dd', o "até dd/mm/aaaa") */
  dataBase: string;
  funcionarios: { matricula: string; nome: string; admissao: string; periodos: PeriodoDeFerias[] }[];
}

// ------------------------------------------------------------------------------------------------------------ ajudantes
const DINHEIRO = /^-?\d{1,3}(?:\.\d{3})*,\d{2}$|^-?\d+,\d{2}$/;
const valor = (s: string) => Number(s.replace(/\./g, '').replace(',', '.'));
const centavos = (n: number) => Math.round(n * 100) / 100;
const isoDe = (d: string) => d.slice(6, 10) + '-' + d.slice(3, 5) + '-' + d.slice(0, 2);
const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const nomeLimpo = (s: string) => s.replace(/\s+/g, ' ').trim();
const chaveDoNome = (s: string) => sem(s).toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
const semZeros = (m: string) => m.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
const centro = (p: PedacoDaFolha) => p.x + (p.largura ?? 0) / 2;

interface Linha { y: number; pedacos: PedacoDaFolha[]; texto: string }

/** Os pedaços de uma página → as linhas (de cima para baixo; a mesma altura com 2 pontos de folga). */
function linhasDe(pedacos: readonly PedacoDaFolha[]): Linha[] {
  const linhas: { y: number; pedacos: PedacoDaFolha[] }[] = [];
  for (const p of [...pedacos].filter(i => i.texto.trim()).sort((a, b) => b.y - a.y)) {
    const l = linhas.find(x => Math.abs(x.y - p.y) <= 2);
    if (l) l.pedacos.push(p); else linhas.push({ y: p.y, pedacos: [p] });
  }
  return linhas.map(l => {
    const ps = l.pedacos.sort((a, b) => a.x - b.x);
    return { y: l.y, pedacos: ps, texto: nomeLimpo(ps.map(p => p.texto).join(' ')) };
  });
}

// ------------------------------------------------------------------------------------------------------------ o holerite
const TITULO = /(demonstrativo|recibo) de pagamento/i;
/** o que não é a folha mensal (o adiantamento, as férias e o 13º têm recibo próprio e contariam duas vezes) */
const OUTRO_PROCESSO = /adiantamento|f[ée]rias|13[ºo°]|d[ée]cimo|rescis/i;
const DESCONTO_PELO_NOME = /\binss\b|\birrf\b|imposto de renda|desconto|vale|adiantamento|empr[ée]stimo|consignad|falta|contribui|pens[ãa]o|plano de sa|seguro|atraso/i;

/** O bloco de uma via do holerite → o holerite, ou null quando falta o essencial (mês, pessoa, líquido). */
function holeriteDoBloco(linhas: readonly Linha[]): HoleriteLido | null {
  const texto = linhas.map(l => l.texto).join('\n');
  const corrido = texto.replace(/\s+/g, ' ');
  const ref = /Ref\.?\s*:?\s*(\d{2})\/(\d{4})/i.exec(corrido);
  const pessoa = /(\d{1,6})\s+([^\d:]+?)\s+CPF\s*:?\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/.exec(corrido);
  if (!ref || !pessoa || Number(ref[1]) < 1 || Number(ref[1]) > 12) return null;
  const cpf = pessoa[3].replace(/\D/g, '');
  const empresa = /(?:^|\n)\s*(\d{3,6})\s*-/.exec(texto)?.[1] ?? '';
  const cargo = nomeLimpo(new RegExp('CPF\\s*:?\\s*' + pessoa[3].replace(/[.-]/g, '\\$&') + '\\s+(.+?)\\s+C[óo]digo\\s+Descri', 'i').exec(corrido)?.[1] ?? '');

  // as colunas: Vencimentos e Descontos pelo cabeçalho da tabela (o valor de cada rubrica cai embaixo de uma delas)
  const cab = linhas.findIndex(l => /vencimentos/i.test(l.texto) && /descontos/i.test(l.texto));
  const xDe = (re: RegExp) => { const p = cab >= 0 ? linhas[cab].pedacos.find(x => re.test(x.texto)) : undefined; return p ? centro(p) : null; };
  const xVenc = xDe(/vencimentos/i), xDesc = xDe(/descontos/i);
  const rubricas: RubricaDoHolerite[] = [];
  for (const l of linhas.slice(cab >= 0 ? cab + 1 : 0)) {
    const m = /^(\d{3,4})\s+(.+)$/.exec(l.texto);
    if (!m || /CPF/i.test(l.texto)) continue;
    const ultimo = [...l.pedacos].reverse().find(p => DINHEIRO.test(p.texto.trim()) || DINHEIRO.test(p.texto.trim().split(/\s+/).pop() ?? ''));
    const resto = m[2];
    const v = /^(.*?)\s*(-?[\d.]+,\d{2})$/.exec(resto);
    if (!v || !ultimo) continue;
    const r = /^(.*?)(?:\s+([\d.:,]+(?:\s*%)?|%))?$/.exec(v[1].trim());
    const descricao = nomeLimpo(r?.[1] ?? v[1]);
    if (!descricao || /^c[óo]digo/i.test(descricao)) continue;
    const xv = centro(ultimo);
    const tipo: RubricaDoHolerite['tipo'] = xVenc != null && xDesc != null
      ? (Math.abs(xv - xDesc) < Math.abs(xv - xVenc) ? 'desconto' : 'provento')
      : (DESCONTO_PELO_NOME.test(descricao) ? 'desconto' : 'provento');
    rubricas.push({ codigo: m[1], descricao, referencia: nomeLimpo(r?.[2] ?? ''), valor: valor(v[2]), tipo });
  }
  if (!rubricas.length) return null;

  const somaDe = (t: RubricaDoHolerite['tipo']) => centavos(rubricas.filter(x => x.tipo === t).reduce((s, x) => s + x.valor, 0));
  // os totais: a linha (que não é rubrica) com um valor embaixo de Vencimentos e outro embaixo de Descontos; sem as
  // colunas, os dois valores logo antes da "Admissão"
  let totais: [number, number] | null = null;
  if (xVenc != null && xDesc != null) {
    for (const l of linhas.slice(cab + 1)) {
      if (/^\d{3,4}\s/.test(l.texto)) continue;
      const din = l.pedacos.filter(p => DINHEIRO.test(p.texto.trim()));
      const v = din.find(p => Math.abs(centro(p) - xVenc) < 40), d = din.find(p => Math.abs(centro(p) - xDesc) < 40);
      if (din.length === 2 && v && d) { totais = [valor(v.texto.trim()), valor(d.texto.trim())]; break; }
    }
  }
  if (!totais) {
    const t = /([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+[^\d]{0,40}?Admiss[ãa]o/i.exec(corrido);
    if (t) totais = [valor(t[1]), valor(t[2])];
  }
  const liq = /Valor\s+L[íi]quido\s*:?\s*([\d.]+,\d{2})/i.exec(corrido);
  const proventos = totais ? totais[0] : somaDe('provento');
  const descontos = totais ? totais[1] : somaDe('desconto');
  const liquido = liq ? valor(liq[1]) : centavos(proventos - descontos);
  const confere = Math.abs(somaDe('provento') - proventos) < 0.02 && Math.abs(somaDe('desconto') - descontos) < 0.02 && Math.abs(proventos - descontos - liquido) < 0.02;

  const bases = /Sal[áa]rio\s+Base\s+Sal\.?\s*Contr[\s\S]{0,160}?((?:[\d.]+,\d{2}\s+){4}[\d.]+,\d{2})/i.exec(corrido)?.[1].split(/\s+/).map(valor) ?? [];
  const admissao = /Admiss[ãa]o\s*:?[\s\S]{0,120}?(\d{2}\/\d{2}\/\d{4})/i.exec(corrido)?.[1];
  const afastamentos: AfastamentoLido[] = [];
  const obs = /Observa[çc][õo]es\s*:?([\s\S]*?)(?:\d[\d.]*,\d{2}\s+\d[\d.]*,\d{2}|Admiss|$)/i.exec(corrido)?.[1] ?? '';
  for (const a of obs.matchAll(/([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ ]{2,40}?)\s+de\s+(\d{2}\/\d{2}\/\d{4})\s+at[ée]\s+(\d{2}\/\d{2}\/\d{4})/gi)) {
    afastamentos.push({ de: isoDe(a[2]), ate: isoDe(a[3]), motivo: nomeLimpo(a[1]) });
  }
  const soma = (re: RegExp) => centavos(rubricas.filter(x => x.tipo === 'desconto' && re.test(x.descricao)).reduce((s, x) => s + x.valor, 0));
  return {
    empresa, competencia: ref[2] + '-' + ref[1], matricula: pessoa[1], nome: nomeLimpo(pessoa[2]), cpf, cargo: cargo.slice(0, 80),
    admissao: admissao ? isoDe(admissao) : '', rubricas, proventos, descontos, liquido,
    salarioBase: bases[0] ?? 0, baseInss: bases[1] ?? 0, baseFgts: bases[2] ?? 0, fgts: bases[3] ?? 0, baseIrrf: bases[4] ?? 0,
    inss: soma(/\binss\b/i), irrf: soma(/\birrf\b|imposto de renda/i),
    feriasVencidas: /f[ée]rias\s+vencidas/i.test(corrido), afastamentos, confere,
  };
}

/**
 * Os holerites de um PDF (as páginas com os pedaços de texto). Cada "Demonstrativo de Pagamento" é uma via; a segunda via
 * da mesma pessoa no mesmo mês conta uma vez, e a via ao lado (duas por página) é ignorada. O recibo de adiantamento, de
 * férias, de 13º ou de rescisão fica de fora (já tem o próprio documento).
 */
export function holeritesDasPaginas(paginas: readonly (readonly PedacoDaFolha[])[]): HoleriteLido[] {
  const vistos = new Map<string, HoleriteLido>();
  for (const pagina of paginas) {
    // duas vias lado a lado: só a da esquerda
    const titulos = pagina.filter(p => TITULO.test(p.texto)).sort((a, b) => a.x - b.x);
    const corte = titulos.length > 1 && titulos[titulos.length - 1].x - titulos[0].x > 100 ? titulos[titulos.length - 1].x - 5 : Infinity;
    const linhas = linhasDe(pagina.filter(p => p.x < corte));
    const inicios = linhas.map((l, i) => (TITULO.test(l.texto) ? i : -1)).filter(i => i >= 0);
    inicios.forEach((ini, k) => {
      if (OUTRO_PROCESSO.test(linhas[ini].texto)) return;
      const h = holeriteDoBloco(linhas.slice(ini, inicios[k + 1] ?? linhas.length));
      if (!h) return;
      const chave = [h.empresa, h.competencia, semZeros(h.matricula), h.cpf].join('|');
      if (!vistos.has(chave)) vistos.set(chave, h);
    });
  }
  return [...vistos.values()];
}

// ---------------------------------------------------------------------------------------------------------- as férias
const DATA = '(\\d{2}\\/\\d{2}\\/\\d{4})';

/** A "Previsão - Vencimento de Férias" de um PDF, ou null quando o PDF é outro. */
export function feriasDasPaginas(paginas: readonly (readonly PedacoDaFolha[])[]): FeriasDaFolha | null {
  const corrido = paginas.map(p => linhasDe(p).map(l => l.texto).join(' ')).join(' ').replace(/\s+/g, ' ');
  if (!/Previs[ãa]o\s*-?\s*(?:de\s+)?Vencimento\s+de\s+F[ée]rias/i.test(corrido)) return null;
  const empresa = /\(\s*(\d{3,6})\s*\)/.exec(corrido)?.[1] ?? '';
  const ate = new RegExp('F[ée]rias\\s+at[ée]\\s+' + DATA, 'i').exec(corrido)?.[1];
  const cabecalhos = [...corrido.matchAll(new RegExp('(?:^|\\s)(\\d{3,6})\\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .\'\\-]*?)\\s+' + DATA + '\\s+' + DATA + '\\s+' + DATA, 'g'))];
  const funcionarios = cabecalhos.map((c, k) => {
    const trecho = corrido.slice(c.index! + c[0].length, cabecalhos[k + 1]?.index ?? corrido.length);
    const periodos = [...trecho.matchAll(new RegExp(DATA + '\\s+a\\s+' + DATA + '\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)\\s+' + DATA, 'g'))]
      .map(p => ({ inicio: isoDe(p[1]), fim: isoDe(p[2]), faltas: Number(p[3]), gozados: Number(p[4]), direito: Number(p[5]), aGozar: Number(p[6]), concederAte: isoDe(p[7]) }));
    return { matricula: c[1], nome: nomeLimpo(c[2]), admissao: isoDe(c[3]), periodos };
  }).filter(f => f.periodos.length);
  return { empresa, dataBase: ate ? isoDe(ate) : '', funcionarios };
}

// ------------------------------------------------------------------------------------------------------------- a junção
/**
 * Os funcionários das guias do FGTS completados com a folha: de cada um, o holerite mais novo dá o cargo, a admissão, o
 * salário base, o líquido, a marca de férias vencidas e o afastamento que ainda vale; a previsão de férias dá os
 * períodos (pela empresa e matrícula do holerite, ou pelo nome). Quem está no holerite e não nas guias entra também
 * (ativo quando o holerite é do mês mais novo). As guias continuam dizendo quem está ativo.
 */
export function registroComAFolha(
  reg: { funcionarios: FuncionarioDoRegistro[]; competencia: string; total: number },
  holerites: readonly HoleriteLido[],
  ferias: readonly FeriasDaFolha[] = [],
): { funcionarios: FuncionarioDoRegistro[]; competencia: string; total: number } {
  if (!holerites.length && !ferias.length) return reg;
  const maisNovo = new Map<string, HoleriteLido>();
  for (const h of holerites) {
    if (h.cpf.length !== 11) continue;
    const id = idDoFuncionario(h.cpf);
    const a = maisNovo.get(id);
    if (!a || h.competencia > a.competencia) maisNovo.set(id, h);
  }
  const competencia = [reg.competencia, ...[...maisNovo.values()].map(h => h.competencia)].reduce((m, c) => (c > m ? c : m), '');
  const porId = new Map(reg.funcionarios.map(f => [f.id, { ...f }]));
  for (const [id, h] of maisNovo) {
    if (!porId.has(id)) {
      porId.set(id, { id, nome: h.nome, cpf: '***.' + h.cpf.slice(3, 6) + '.' + h.cpf.slice(6, 9) + '-**', matricula: h.matricula, remuneracao: h.baseFgts || h.proventos,
        desde: h.competencia, ultimo: h.competencia, ativo: h.competencia >= competencia });
    }
    const f = porId.get(id)!;
    if (h.competencia > f.ultimo) { f.ultimo = h.competencia; if (h.competencia >= competencia) f.ativo = true; }
    if (h.cargo) f.cargo = h.cargo;
    if (h.admissao) { f.admissao = h.admissao; f.desde = h.admissao.slice(0, 7); }
    if (h.salarioBase) f.salarioBase = h.salarioBase;
    f.liquido = h.liquido;
    f.feriasVencidas = h.feriasVencidas;
    const inicioDoMes = h.competencia + '-01';
    const vale = [...h.afastamentos].filter(a => a.ate >= inicioDoMes).sort((a, b) => b.ate.localeCompare(a.ate))[0];
    if (vale) { f.afastadoDe = vale.de; f.afastadoAte = vale.ate; } else { delete f.afastadoDe; delete f.afastadoAte; }
    f.fonte = 'folha';
  }
  // as férias: pela empresa + matrícula do holerite; senão pelo nome (só quando um nome só bate)
  const idPorMatricula = new Map<string, string>();
  for (const [id, h] of maisNovo) idPorMatricula.set(semZeros(h.empresa) + '|' + semZeros(h.matricula), id);
  const lista = [...porId.values()];
  for (const r of ferias) {
    for (const x of r.funcionarios) {
      let id = idPorMatricula.get(semZeros(r.empresa) + '|' + semZeros(x.matricula));
      if (!id) {
        const mesmos = lista.filter(f => chaveDoNome(f.nome) === chaveDoNome(x.nome));
        if (mesmos.length === 1) id = mesmos[0].id;
      }
      const f = id ? porId.get(id) : undefined;
      if (!f) continue;
      f.periodosDeFerias = x.periodos.filter(p => p.aGozar > 0).map(p => ({ inicio: p.inicio, fim: p.fim, direito: p.direito, gozados: p.gozados, aGozar: p.aGozar, concederAte: p.concederAte }));
      if (!f.admissao && x.admissao) { f.admissao = x.admissao; f.desde = x.admissao.slice(0, 7); }
    }
  }
  const funcionarios = [...porId.values()].sort((x, y) => Number(y.ativo) - Number(x.ativo) || x.nome.localeCompare(y.nome));
  const total = centavos(funcionarios.filter(f => f.ativo).reduce((s, f) => s + f.remuneracao, 0));
  return { funcionarios, competencia, total };
}

/**
 * O histórico da folha (pelas guias) com os números dos holerites: no mês que tem holerite, os proventos, os descontos,
 * o líquido, o INSS e o IRRF descontados e quantos holerites; o mês sem guia e com holerite entra pela base e o FGTS do
 * holerite. Os últimos 12 meses, o mais velho primeiro.
 */
export function historicoComAFolha(historico: readonly MesDaFolha[], holerites: readonly HoleriteLido[]): MesDaFolha[] {
  const porMes = new Map(historico.map(m => [m.competencia, { ...m }]));
  const vistos = new Set<string>();
  const somas = new Map<string, { proventos: number; descontos: number; liquido: number; inss: number; irrf: number; base: number; fgts: number; n: number }>();
  for (const h of holerites) {
    const chave = h.competencia + '|' + h.cpf;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    const s = somas.get(h.competencia) ?? { proventos: 0, descontos: 0, liquido: 0, inss: 0, irrf: 0, base: 0, fgts: 0, n: 0 };
    s.proventos += h.proventos; s.descontos += h.descontos; s.liquido += h.liquido; s.inss += h.inss; s.irrf += h.irrf;
    s.base += h.baseFgts; s.fgts += h.fgts; s.n++;
    somas.set(h.competencia, s);
  }
  for (const [competencia, s] of somas) {
    const m = porMes.get(competencia) ?? { competencia, base: centavos(s.base), fgts: centavos(s.fgts), funcionarios: s.n };
    porMes.set(competencia, { ...m, proventos: centavos(s.proventos), descontos: centavos(s.descontos), liquido: centavos(s.liquido), inss: centavos(s.inss), irrf: centavos(s.irrf), holerites: s.n });
  }
  return [...porMes.values()].sort((a, b) => a.competencia.localeCompare(b.competencia)).slice(-12);
}
