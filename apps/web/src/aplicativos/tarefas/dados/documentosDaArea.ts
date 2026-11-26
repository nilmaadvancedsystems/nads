// A seção Documentos da Área do Cliente refeita (26/11/2026: "quero que esse modulo seja completamente refeito… o mais
// bonito e de facil entendimento possivel"): o que os clientes mandaram (Recebidos) e o que a equipe mandou ao cliente pela
// tela (Enviados). Funções puras, testadas em documentosDaArea.test.ts.
import { areaCliente as ac, type entregas as e } from '@nads/core';
import type { RecebidoDoCliente } from './areaCliente';

export type FiltroDosRecebidos = 'novos' | 'todos' | ac.TipoDeEnvio | 'recusados';

/** "novo" = chegou nos últimos 7 dias e não foi recusado */
const NOVO_MS = 7 * 24 * 36e5;

export function ehNovo(r: RecebidoDoCliente, agora: Date): boolean {
  const t = Date.parse(r.recebidoEm);
  return !r.recusa && Number.isFinite(t) && agora.getTime() - t <= NOVO_MS;
}

/** o rótulo curto do filtro (as pílulas do mesmo tamanho; 26/11/2026: "ta tudo um maior que o outro") */
const CURTO: Record<string, string> = { extrato: 'Extratos', nota: 'Notas', comprovante: 'Comprovantes', outro: 'Outros' };

/** Os filtros dos recebidos, na ordem da barra, com a contagem. */
export function filtrosDosRecebidos(lista: readonly RecebidoDoCliente[], agora: Date, recusados: ReadonlySet<string>): { valor: FiltroDosRecebidos; rotulo: string; conta: number }[] {
  const recusado = (r: RecebidoDoCliente) => !!r.recusa || recusados.has(r.id);
  return [
    { valor: 'novos', rotulo: 'Novos', conta: lista.filter(r => ehNovo(r, agora) && !recusados.has(r.id)).length },
    { valor: 'todos', rotulo: 'Todos', conta: lista.length },
    ...ac.TIPOS_DE_ENVIO.map(t => ({ valor: t.valor as FiltroDosRecebidos, rotulo: CURTO[t.valor] ?? t.rotulo, conta: lista.filter(r => r.tipo === t.valor).length })),
    { valor: 'recusados', rotulo: 'Recusados', conta: lista.filter(recusado).length },
  ];
}

/** Os recebidos do filtro, do mais novo ao mais velho. */
export function recebidosDoFiltro(lista: readonly RecebidoDoCliente[], filtro: FiltroDosRecebidos, agora: Date, recusados: ReadonlySet<string>): RecebidoDoCliente[] {
  const recusado = (r: RecebidoDoCliente) => !!r.recusa || recusados.has(r.id);
  return lista
    .filter(r => filtro === 'todos' ? true : filtro === 'novos' ? ehNovo(r, agora) && !recusados.has(r.id) : filtro === 'recusados' ? recusado(r) : r.tipo === filtro)
    .slice().sort((a, b) => b.recebidoEm.localeCompare(a.recebidoEm));
}

/** O filtro inicial: os novos quando há algum, senão todos. */
export const filtroInicial = (lista: readonly RecebidoDoCliente[], agora: Date): FiltroDosRecebidos => (lista.some(r => ehNovo(r, agora)) ? 'novos' : 'todos');

/** Um arquivo que a equipe mandou ao cliente pela tela (o envio com a marca da Área do Cliente). */
export interface EnviadoAoCliente {
  id: string;
  nome: string;
  codigo: string;
  area: ac.AreaDoEscritorio;
  criadoEm: string;
  situacao: 'fila' | 'pronto' | 'erro';
  erro: string;
}

/** Os meus envios que foram para a Área do Cliente, do mais novo ao mais velho. */
export function enviadosAoCliente(envios: readonly e.EnvioFeito[]): EnviadoAoCliente[] {
  const out: EnviadoAoCliente[] = [];
  for (const x of envios) {
    const c = x.cliente || '';
    if (!c.startsWith(ac.MARCA_DO_ENVIO_AO_CLIENTE)) continue;
    const area = ac.AREAS_DO_ESCRITORIO.find(a => a.valor === c.slice(ac.MARCA_DO_ENVIO_AO_CLIENTE.length))?.valor;
    if (!area) continue;
    out.push({ id: x.id, nome: x.nome, codigo: x.codigo || '', area, criadoEm: x.criadoEm, situacao: x.status === 'pronto' ? 'pronto' : x.status === 'erro' ? 'erro' : 'fila', erro: x.erro });
  }
  return out.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

/** O rótulo da área ("Departamento Pessoal"). */
export const rotuloDaArea = (a: ac.AreaDoEscritorio) => ac.AREAS_DO_ESCRITORIO.find(x => x.valor === a)?.rotulo ?? a;

// ---------- o Enviar ao cliente adivinha a empresa e a área pelo arquivo (26/11/2026, o dono pela sessão do SCI: "ele tem
// que detectar isso automatico, cliente e setor") ----------
// A pessoa ainda pode trocar. A área pelo nome do arquivo; a empresa pelo CNPJ lido do PDF (o da empresa com Área do
// Cliente) ou, sem ele, pelo código ou pelo nome da empresa no nome do arquivo.

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** As palavras que dizem a área, na ordem em que valem (a primeira que bate). */
const AREAS_PELO_NOME: readonly [ac.AreaDoEscritorio, RegExp][] = [
  ['dp', /holerite|contracheque|folha|fgts|ferias|rescis|admiss|demiss|13o|decimo|esocial|inss|pro.?labore|sefip|caged|rais|dirf/],
  ['fiscal', /\bdas\b|pgdas|simples nacional|darf|\bdae\b|\bdam\b|icms|\biss\b|sped|efd|\bnf-?e\b|nfc-?e|sintegra|dctf|\bgia\b|apuracao|livro fiscal/],
  ['contabil', /balancete|balanco|\bdre\b|razao|diario|demonstra|contab|ecd|ecf|lalur|extrato banc/],
  ['societario', /contrato social|alteracao|cnpj|cartao cnpj|alvara|certidao|\bcnd\b|procuracao|honorario|nfs-?e|ata\b|estatuto|junta|inscricao/],
];

/** A área pelo nome do arquivo; null quando o nome não diz. */
export function areaPeloNome(nome: string): ac.AreaDoEscritorio | null {
  const n = semAcento(nome.replace(/\.[a-z0-9]+$/i, '').replace(/[_]+/g, ' '));
  return AREAS_PELO_NOME.find(([, re]) => re.test(n))?.[0] ?? null;
}

/** Os CNPJs (só números) que aparecem no texto. */
export function cnpjsDoTexto(texto: string): string[] {
  const achados = texto.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g) ?? [];
  return [...new Set(achados.map(c => c.replace(/\D/g, '')).filter(c => c.length === 14))];
}

/**
 * A empresa do arquivo, entre as que podem receber: pelo CNPJ do PDF (o primeiro que for de uma delas; o CNPJ básico, os 8
 * primeiros, também vale para a filial), senão pelo código no começo do nome ("292 - extrato.pdf") ou pelo nome da empresa
 * no nome do arquivo. null quando não dá para dizer.
 */
export function empresaDoArquivo<T extends { codigo: number; nome: string }>(
  empresas: readonly T[], nomeDoArquivo: string, cnpjs: readonly string[], cnpjDoCodigo: ReadonlyMap<number, string>,
): T | null {
  const doc = (e: T) => (cnpjDoCodigo.get(e.codigo) || '').replace(/\D/g, '');
  for (const c of cnpjs) {
    const exata = empresas.find(e => doc(e) === c);
    if (exata) return exata;
    const basico = empresas.filter(e => doc(e).length === 14 && doc(e).slice(0, 8) === c.slice(0, 8));
    if (basico.length === 1) return basico[0];
  }
  const n = semAcento(nomeDoArquivo);
  const cod = /^\s*(\d{1,5})\s*[-_ ]/.exec(n)?.[1];
  if (cod) { const e = empresas.find(x => String(x.codigo) === cod); if (e) return e; }
  // o nome da empresa sem o "LTDA"/"ME"/"EIRELI", com pelo menos 2 palavras ou 6 letras, dentro do nome do arquivo
  const chave = (s: string) => semAcento(s).replace(/\b(ltda|me|epp|eireli|s\/?a|ss|mei|e)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
  const arquivo = ' ' + chave(nomeDoArquivo) + ' ';
  const pelos = empresas.filter(e => { const k = chave(e.nome); return k.length >= 6 && arquivo.includes(' ' + k + ' '); });
  return pelos.length === 1 ? pelos[0] : null;
}
