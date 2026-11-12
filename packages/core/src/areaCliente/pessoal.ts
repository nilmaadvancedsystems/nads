// O Registro da Área do Cliente (12/11/2026: "a função de registro, onde o cliente vai ter acesso aos funcionários
// registrados, folha de pagamento, férias e afins"; "ele vai identificar os funcionários por arquivos enviados via gmail ou
// salvos no drive"). Duas fontes, as duas já no escritório:
//   - os funcionários: as guias do FGTS Digital de cada mês ("Detalhe da Guia Emitida", que traz cada trabalhador com o
//     nome, o CPF, a matrícula e a remuneração); quem está na guia do mês mais novo está ativo;
//   - os documentos do DP: os PDFs da pasta DEPARTAMENTO PESSOAL da empresa no Drive (a lista dpArquivos, a mesma do
//     DP › Envios): a folha, os recibos, o pró-labore, as férias, as rescisões, o FGTS, o INSS e o cartão de ponto. O
//     dono de um arquivo sai pelo nome dele (o cartão de ponto "Elisene.xlsx", o "RECIBO DE FERIAS - JOAO DA SILVA").
// Funções puras: o robô (robo/area-cliente.js, pelo robo/gerado) monta o espelho com elas; a tela lê o espelho.
import type { GuiaDoFgts } from '../tarefas/regras/fgts';

export type CategoriaDoDp = 'folha' | 'recibo' | 'pro-labore' | 'ferias' | 'decimo-terceiro' | 'rescisao' | 'admissao' | 'fgts' | 'inss' | 'ponto' | 'outro';

export const ROTULO_DA_CATEGORIA_DP: Record<CategoriaDoDp, string> = {
  folha: 'Folha de pagamento', recibo: 'Recibos de pagamento', 'pro-labore': 'Pró-labore', ferias: 'Férias', 'decimo-terceiro': '13º salário',
  rescisao: 'Rescisões', admissao: 'Admissões', fgts: 'FGTS', inss: 'INSS', ponto: 'Cartão de ponto', outro: 'Outros documentos',
};

/** A ordem em que o cliente vê as categorias do mês (a folha primeiro, as guias depois). */
export const ORDEM_DAS_CATEGORIAS_DP: CategoriaDoDp[] = ['folha', 'recibo', 'pro-labore', 'ferias', 'decimo-terceiro', 'rescisao', 'admissao', 'ponto', 'fgts', 'inss', 'outro'];

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim();

/** O arquivo é do DP? (a pasta começa em DEPARTAMENTO PESSOAL; a lista do mês às vezes traz pasta do Contábil ou do Fiscal) */
export function ehDoDp(pasta: string): boolean {
  return /^departamento pessoal\b/.test(norm(pasta));
}

/** O que é o documento, pelo nome e pela pasta. A ordem importa: "Recibo de Pró Labore" é pró-labore, não recibo. */
export function categoriaDoArquivoDp(nome: string, pasta: string): CategoriaDoDp {
  const t = norm(pasta.replace(/^departamento pessoal/i, '') + ' / ' + nome);
  if (/rescis|\btrct\b|aviso previo|seguro desemprego/.test(t)) return 'rescisao';
  if (/ferias/.test(t)) return 'ferias';
  if (/decimo terceiro|\b13[oº°]? ?sal|\b13o\b/.test(t)) return 'decimo-terceiro';
  if (/pro ?labore|recibo socio|\bsocio\b/.test(t)) return 'pro-labore';
  if (/admiss|contrato de (trabalho|experiencia)|ficha de registro|registro de empregado/.test(t)) return 'admissao';
  if (/cartao de ponto|folha de ponto|\bponto\b/.test(t)) return 'ponto';
  if (/\bfgts\b|\bgrrf\b/.test(t)) return 'fgts';
  if (/\binss\b|\bdarf\b|dctfweb|\bgps\b/.test(t)) return 'inss';
  if (/recibo|holerite|contracheque|recibo mensal/.test(t)) return 'recibo';
  if (/\bfolha\b/.test(t)) return 'folha';
  return 'outro';
}

/** Um funcionário do registro: o que o cliente vê (o CPF mascarado). Cargo, admissão e férias vêm quando o DP informar. */
export interface FuncionarioDoRegistro {
  /** estável e sem o CPF (um resumo dele) */
  id: string;
  nome: string;
  /** '***.456.789-**' */
  cpf: string;
  matricula: string;
  /** a remuneração do mês mais novo em que aparece (a base do FGTS) */
  remuneracao: number;
  /** a primeira competência em que aparece nas guias ('aaaa-mm') */
  desde: string;
  /** a última competência em que aparece */
  ultimo: string;
  /** está na guia do mês mais novo */
  ativo: boolean;
}

/** O que vai para o espelho: os funcionários, a competência da guia mais nova e a soma das remunerações dos ativos. */
export interface ResumoDoPessoal {
  funcionarios: FuncionarioDoRegistro[];
  competencia: string;
  total: number;
  atualizadoEm: string;
}

/** Um documento do DP no espelho (os bytes vão em pedaços, em documentos/{id}~{n}). */
export interface DocumentoDoDp {
  tipo: 'dp';
  id: string;
  nome: string;
  categoria: CategoriaDoDp;
  /** 'aaaa-mm' */
  competencia: string;
  tamanho: number;
  /** o id do funcionário dono do arquivo ('' = da empresa toda) */
  funcionario: string;
  /** quantos pedaços tem o arquivo (0 = grande demais: pedir ao escritório) */
  partes: number;
}

const soDigitos = (s: string) => s.replace(/\D/g, '');

/** '123.456.789-09' → '***.456.789-**' (o que o cliente vê). */
export function mascararCpf(cpf: string): string {
  const d = soDigitos(cpf);
  return d.length === 11 ? '***.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-**' : '';
}

/** Um resumo curto e estável do CPF (o id do funcionário no espelho, sem expor o número). */
export function idDoFuncionario(cpf: string): string {
  let h = 5381;
  for (const c of soDigitos(cpf)) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0;
  return 'f' + h.toString(36);
}

/** O nome como gente escreve: "JOAO DA SILVA" → "João da Silva" fica com o que veio (só arruma os espaços). */
const nomeLimpo = (s: string) => s.replace(/\s+/g, ' ').trim();

/**
 * Os funcionários pelas guias do FGTS (de vários meses; a mesma guia, pelo número, conta uma vez). Cada CPF uma vez:
 * o nome e a remuneração do mês mais novo em que aparece; ativo = está no mês mais novo de todas as guias. Os ativos
 * primeiro, por nome.
 */
export function registroDasGuias(todas: readonly GuiaDoFgts[]): { funcionarios: FuncionarioDoRegistro[]; competencia: string; total: number } {
  // a mesma guia (o número) vinda de dois lugares (o robô do FGTS e o Drive) conta uma vez
  const guias = [...new Map(todas.map((g, i) => [g.numero || 'sem-numero-' + i, g])).values()];
  const competencia = guias.reduce((m, g) => (g.competencia > m ? g.competencia : m), '');
  const porCpf = new Map<string, { nome: string; matricula: string; remuneracao: number; desde: string; ultimo: string; cpf: string; doMes: number }>();
  for (const g of guias) {
    for (const t of g.trabalhadores) {
      const cpf = soDigitos(t.cpf);
      if (cpf.length !== 11) continue;
      const a = porCpf.get(cpf);
      if (!a) { porCpf.set(cpf, { nome: nomeLimpo(t.nome), matricula: t.matricula, remuneracao: t.base, desde: g.competencia, ultimo: g.competencia, cpf, doMes: g.competencia === competencia ? t.base : 0 }); continue; }
      if (g.competencia < a.desde) a.desde = g.competencia;
      if (g.competencia >= a.ultimo) { a.ultimo = g.competencia; a.nome = nomeLimpo(t.nome) || a.nome; a.matricula = t.matricula || a.matricula; a.remuneracao = t.base; }
      // na mesma competência, duas guias (a mensal e uma complementar): a remuneração do mês soma
      if (g.competencia === competencia) a.doMes = Math.round((a.doMes + t.base) * 100) / 100;
    }
  }
  const funcionarios = [...porCpf.values()].map(a => ({
    id: idDoFuncionario(a.cpf), nome: a.nome, cpf: mascararCpf(a.cpf), matricula: a.matricula,
    remuneracao: a.ultimo === competencia ? a.doMes || a.remuneracao : a.remuneracao, desde: a.desde, ultimo: a.ultimo, ativo: a.ultimo === competencia,
  })).sort((x, y) => Number(y.ativo) - Number(x.ativo) || x.nome.localeCompare(y.nome));
  const total = Math.round(funcionarios.filter(f => f.ativo).reduce((s, f) => s + f.remuneracao, 0) * 100) / 100;
  return { funcionarios, competencia, total };
}

const palavras = (s: string) => norm(s).split(' ').filter(p => p.length > 2 && !['das', 'dos', 'del'].includes(p));

/**
 * De quem é o arquivo (o id do funcionário, ou '' = da empresa). O nome do arquivo tem o primeiro nome do funcionário e,
 * quando outro funcionário tem o mesmo primeiro nome, também o último ("Elisene.xlsx", "Recibo de Férias - João Silva").
 * Dois donos possíveis: nenhum (melhor não mostrar o documento de um para o outro).
 */
export function donoDoArquivo(nome: string, funcionarios: readonly Pick<FuncionarioDoRegistro, 'id' | 'nome'>[]): string {
  const doArquivo = new Set(palavras(nome.replace(/\.[a-z0-9]{2,5}$/i, '')));
  const achados = funcionarios.filter(f => {
    const p = palavras(f.nome);
    if (!p.length || !doArquivo.has(p[0])) return false;
    const xara = funcionarios.some(o => o.id !== f.id && palavras(o.nome)[0] === p[0]);
    return !xara || (p.length > 1 && doArquivo.has(p[p.length - 1]));
  });
  return achados.length === 1 ? achados[0].id : '';
}

/** Os documentos de um mês, por categoria, na ordem que o cliente vê. */
export function documentosPorCategoria<T extends Pick<DocumentoDoDp, 'categoria' | 'nome'>>(docs: readonly T[]): { categoria: CategoriaDoDp; rotulo: string; documentos: T[] }[] {
  return ORDEM_DAS_CATEGORIAS_DP
    .map(categoria => ({ categoria, rotulo: ROTULO_DA_CATEGORIA_DP[categoria], documentos: docs.filter(d => d.categoria === categoria).sort((a, b) => a.nome.localeCompare(b.nome)) }))
    .filter(g => g.documentos.length);
}

/** Os meses que têm documento, o mais novo primeiro. */
export const mesesDosDocumentosDp = (docs: readonly Pick<DocumentoDoDp, 'competencia'>[]): string[] => [...new Set(docs.map(d => d.competencia))].sort().reverse();
