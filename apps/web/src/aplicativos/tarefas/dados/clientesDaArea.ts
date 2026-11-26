// A seção Clientes do módulo Área do Cliente refeito (26/11/2026: "quero que esse modulo seja completamente refeito para
// suportar e gerenciar de maneira mais simples e coerente a area do cliente como está hoje, preciso que seja o mais bonito
// e de facil entendimento possivel"): quem tem acesso, numa lista só. Antes o link, a senha e a logo de cada empresa
// ficavam escondidos no Cadastro › janela da empresa. Aqui ficam as regras puras: juntar as empresas do cadastro com os
// links, as pessoas, as logos e as guias abertas; os filtros com a contagem; e a lista da pasta DO ESCRITÓRIO no mapa do
// Drive. Sem tela e sem banco (testado em clientesDaArea.test.ts).
import { areaCliente as ac, type entregas as e } from '@nads/core';
import type { LeituraDaGuia, LinkDaEmpresa, LogoDaEmpresa, PessoaComSenha } from './areaCliente';

/** Uma empresa na lista dos Clientes. */
export interface ClienteDaArea {
  codigo: number;
  nome: string;
  /** o token do link ('' = sem link) */
  token: string;
  /** ISO: de quando é o link ('' sem link) */
  linkDesde: string;
  /** o data URL da logo ('' = sem) */
  logo: string;
  /** as pessoas com senha cadastradas (ativas) */
  pessoas: number;
  /** o link pede senha */
  exigeSenha: boolean;
  /** quantas guias o cliente abriu pelo link (as dos últimos 4 meses que o banco guarda) */
  guiasAbertas: number;
  /** ISO: a última guia aberta ('' = nenhuma) */
  ultimaAtividade: string;
}

export type FiltroDosClientes = 'todas' | 'com' | 'sem' | 'senha' | 'nunca';

/** Os filtros na ordem da barra. */
export const FILTROS_DOS_CLIENTES: readonly { valor: FiltroDosClientes; rotulo: string }[] = [
  { valor: 'todas', rotulo: 'Todas' },
  { valor: 'com', rotulo: 'Com acesso' },
  { valor: 'sem', rotulo: 'Sem acesso' },
  { valor: 'senha', rotulo: 'Exige senha' },
  { valor: 'nunca', rotulo: 'Nunca abriu' },
];

/** Tem link e o cliente nunca abriu uma guia por ele. */
export const nuncaAbriu = (c: ClienteDaArea) => !!c.token && c.guiasAbertas === 0;

export function passaNoFiltro(c: ClienteDaArea, f: FiltroDosClientes): boolean {
  switch (f) {
    case 'com': return !!c.token;
    case 'sem': return !c.token;
    case 'senha': return !!c.token && c.exigeSenha;
    case 'nunca': return nuncaAbriu(c);
    default: return true;
  }
}

/**
 * Junta tudo numa lista, pelo nome: todas as empresas do cadastro com código, e também os links de códigos que não estão
 * mais no cadastro (têm acesso: precisam aparecer em "quem tem acesso").
 */
export function montarClientes(dados: {
  empresas: readonly { codigo: number | null; nome: string }[];
  links: readonly LinkDaEmpresa[];
  logos: readonly LogoDaEmpresa[];
  pessoas: readonly PessoaComSenha[];
  leituras: readonly LeituraDaGuia[];
  exigeSenha: (token: string) => boolean;
}): ClienteDaArea[] {
  const nomes = new Map<number, string>();
  for (const e of dados.empresas) if (e.codigo != null && !nomes.has(e.codigo)) nomes.set(e.codigo, e.nome);
  for (const l of dados.links) if (!nomes.has(l.codigo)) nomes.set(l.codigo, 'Empresa ' + l.codigo);
  const linkDe = new Map(dados.links.map(l => [l.codigo, l]));
  const logoDe = new Map(dados.logos.map(l => [l.codigo, l.logo]));
  const pessoasDe = new Map<number, number>();
  for (const p of dados.pessoas) if (p.ativo) pessoasDe.set(p.codigo, (pessoasDe.get(p.codigo) ?? 0) + 1);
  const leiturasDe = new Map<string, { vezes: number; ultima: string }>();
  for (const l of dados.leituras) {
    const ja = leiturasDe.get(l.token) ?? { vezes: 0, ultima: '' };
    const quando = l.ultimaEm || l.primeiraEm;
    leiturasDe.set(l.token, { vezes: ja.vezes + 1, ultima: quando > ja.ultima ? quando : ja.ultima });
  }
  return [...nomes].map(([codigo, nome]) => {
    const link = linkDe.get(codigo);
    const token = link?.token ?? '';
    const lidas = token ? leiturasDe.get(token) : undefined;
    return {
      codigo, nome, token,
      linkDesde: link?.atualizadoEm ?? '',
      logo: logoDe.get(codigo) ?? '',
      pessoas: pessoasDe.get(codigo) ?? 0,
      exigeSenha: token ? dados.exigeSenha(token) : false,
      guiasAbertas: lidas?.vezes ?? 0,
      ultimaAtividade: lidas?.ultima ?? '',
    };
  }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR') || a.codigo - b.codigo);
}

/** Quantas empresas em cada filtro. */
export function contarFiltros(lista: readonly ClienteDaArea[]): Record<FiltroDosClientes, number> {
  const conta: Record<FiltroDosClientes, number> = { todas: 0, com: 0, sem: 0, senha: 0, nunca: 0 };
  for (const c of lista) for (const f of FILTROS_DOS_CLIENTES) if (passaNoFiltro(c, f.valor)) conta[f.valor]++;
  return conta;
}

const simples = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** O filtro e a busca (pelo código ou pelo nome; todas as palavras). */
export function clientesDoFiltro(lista: readonly ClienteDaArea[], filtro: FiltroDosClientes, busca: string): ClienteDaArea[] {
  const palavras = simples(busca.trim()).split(/\s+/).filter(Boolean);
  return lista.filter(c => passaNoFiltro(c, filtro) && palavras.every(p => simples(c.codigo + ' ' + c.nome).includes(p)));
}

/** "42 com acesso · 12 exigem senha" */
export function resumoDosClientes(conta: Record<FiltroDosClientes, number>): string {
  return conta.com + ' com acesso · ' + conta.senha + (conta.senha === 1 ? ' exige senha' : ' exigem senha');
}

/** A coluna Senha: "Exige senha · 2 pessoas", "Abre sem senha" ou '' (sem link). */
export function textoDaSenha(c: ClienteDaArea): string {
  if (!c.token) return '';
  if (!c.exigeSenha) return 'Abre sem senha';
  return 'Exige senha · ' + c.pessoas + (c.pessoas === 1 ? ' pessoa' : ' pessoas');
}

// ---------- os documentos do escritório (a pasta <ano>\<cód> - nome\ÁREA DO CLIENTE\DO ESCRITÓRIO, ficha documentos-do-escritorio) ----------

/** Um arquivo da pasta DO ESCRITÓRIO, como o cliente vê em "Do escritório". */
export interface DocumentoNoDrive { id: string; nome: string; area: ac.AreaDoEscritorio; rotuloDaArea: string; modificadoEm: string; tamanho: number }

const PASTA_DA_AREA = 'ÁREA DO CLIENTE';
const mesmoNome = (a: string, b: string) => simples(a).trim() === simples(b).trim();

/** A pasta da empresa no mapa do ano, pelo código. */
export const pastaDaEmpresaNoMapa = (clientes: readonly e.PastaDeCliente[], codigo: number) => clientes.find(c => c.codigo === String(codigo)) ?? null;

/** A pasta DO ESCRITÓRIO dentro da pasta da empresa (o id), ou '' se ainda não existe no mapa. */
export function pastaDoEscritorio(itens: readonly e.ItemDoDrive[], pastaDaEmpresa: string): string {
  const area = itens.find(x => x.t === 'd' && x.p === pastaDaEmpresa && mesmoNome(x.n, PASTA_DA_AREA));
  if (!area) return '';
  return itens.find(x => x.t === 'd' && x.p === area.i && mesmoNome(x.n, ac.PASTA_DO_ESCRITORIO))?.i ?? '';
}

/** Os arquivos da pasta DO ESCRITÓRIO (com os das subpastas), a área pela subpasta de cima; o mais novo primeiro. */
export function documentosDoEscritorioNoDrive(itens: readonly e.ItemDoDrive[], pastaDaEmpresa: string): DocumentoNoDrive[] {
  const raiz = pastaDoEscritorio(itens, pastaDaEmpresa);
  if (!raiz) return [];
  const porId = new Map(itens.map(x => [x.i, x]));
  /** a subpasta logo abaixo de DO ESCRITÓRIO pela qual o item está ('' = solto); null = fora da pasta */
  function subpastaDe(item: e.ItemDoDrive): string | null {
    let atual = item;
    let sub = '';
    for (let passos = 0; passos < 30; passos++) {
      if (atual.p === raiz) return sub;
      const pai = porId.get(atual.p);
      if (!pai) return null;
      if (pai.p === raiz) sub = pai.n;
      atual = pai;
    }
    return null;
  }
  const lista: DocumentoNoDrive[] = [];
  for (const x of itens) {
    if (x.t === 'd') continue;
    const sub = subpastaDe(x);
    if (sub == null) continue;
    const area = ac.areaDaSubpasta(sub);
    lista.push({ id: x.i, nome: x.n, area, rotuloDaArea: ac.AREAS_DO_ESCRITORIO.find(a => a.valor === area)?.rotulo ?? area, modificadoEm: x.m ?? '', tamanho: x.s ?? 0 });
  }
  return lista.sort((a, b) => b.modificadoEm.localeCompare(a.modificadoEm) || a.nome.localeCompare(b.nome, 'pt-BR'));
}
