// O plano de contas em árvore, como o eContador mostra para escolher a conta (17/11/2026: "quero que abra o plano de contas
// assim como no econtador"): a classificação, a descrição recuada pelo nível (as sintéticas em negrito, abrem e fecham) e o
// código reduzido. A busca (código, classificação ou parte do nome) mostra as contas que casam e os grupos de cima delas.
import type { ContaDoPlano } from '../../empresas/cadastro/tipos';
import { normalizarTexto } from '../../formatos';

export interface LinhaDoPlano {
  codigo: string;
  nome: string;
  classificacao: string;
  /** 1 = o grupo de cima (Ativo, Passivo…) */
  nivel: number;
  sintetica: boolean;
  /** os códigos dos grupos de cima, do mais alto ao mais perto */
  pais: string[];
  /** tem contas debaixo (a sintética que abre e fecha) */
  temFilhos: boolean;
}

/**
 * As contas na ordem do plano, com o nível e os grupos de cima. O nível vem da classificação ("1.1.1.02" = 4); sem ela, a
 * sintética abre um grupo debaixo da sintética anterior e a analítica fica debaixo da última sintética.
 */
export function linhasDoPlano(contas: readonly ContaDoPlano[]): LinhaDoPlano[] {
  const ordenadas = [...contas].sort((a, b) => a.ordem - b.ordem);
  const comClassificacao = ordenadas.some(c => !!c.classificacao);
  const pilha: { codigo: string; nivel: number; classificacao: string }[] = [];
  const linhas: LinhaDoPlano[] = [];
  for (const c of ordenadas) {
    const classificacao = c.classificacao || '';
    let nivel: number;
    if (comClassificacao && classificacao) {
      nivel = classificacao.split('.').length;
      while (pilha.length && !(classificacao.startsWith(pilha[pilha.length - 1].classificacao + '.') && pilha[pilha.length - 1].nivel < nivel)) pilha.pop();
    } else if (c.sintetica) {
      // sem classificação: a sintética seguida de outra sintética desce um nível; depois de analíticas, volta para o topo
      const ultima = linhas[linhas.length - 1];
      if (!ultima || !ultima.sintetica) pilha.length = 0;
      nivel = pilha.length + 1;
    } else {
      nivel = pilha.length + 1;
    }
    linhas.push({ codigo: c.codigo, nome: c.nome, classificacao, nivel, sintetica: !!c.sintetica, pais: pilha.map(p => p.codigo), temFilhos: false });
    if (c.sintetica) pilha.push({ codigo: c.codigo, nivel, classificacao });
  }
  const comFilhos = new Set(linhas.flatMap(l => l.pais));
  return linhas.map(l => (comFilhos.has(l.codigo) ? { ...l, temFilhos: true } : l));
}

/**
 * As linhas que aparecem: com busca, as que casam (código, classificação ou as palavras do nome) e os grupos de cima delas,
 * tudo aberto; sem busca, as que não estão debaixo de um grupo fechado.
 */
export function linhasVisiveisDoPlano(linhas: readonly LinhaDoPlano[], busca: string, fechados: ReadonlySet<string>): LinhaDoPlano[] {
  const q = busca.trim();
  if (!q) return linhas.filter(l => !l.pais.some(p => fechados.has(p)));
  const palavras = normalizarTexto(q).split(' ').filter(Boolean);
  const casa = (l: LinhaDoPlano) => l.codigo.startsWith(q) || (!!l.classificacao && l.classificacao.startsWith(q))
    || (palavras.length > 0 && palavras.every(p => normalizarTexto(l.nome).includes(p)));
  const mostrar = new Set<string>();
  for (const l of linhas) if (casa(l)) { mostrar.add(l.codigo); for (const p of l.pais) mostrar.add(p); }
  return linhas.filter(l => mostrar.has(l.codigo));
}

/** Os grupos que começam fechados: do 3º nível para baixo (o Ativo, o Circulante e o Disponível ficam abertos). */
export function gruposFechadosNoInicio(linhas: readonly LinhaDoPlano[], abertoAte = 2): Set<string> {
  return new Set(linhas.filter(l => l.temFilhos && l.nivel > abertoAte).map(l => l.codigo));
}
