// As certidões da empresa na Área do Cliente (plano do Acessórias, 18/11/2026, ficha certidoes; frase do dono: "Pular os
// contatos" / seguir). O robô do PC publica a última certidão de cada órgão da pasta que o arquivador já usa,
// <ano>\<cód> - nome\SOCIETÁRIO\CERTIDÕES\<ÓRGÃO>, com a validade lida do nome do arquivo ("VENC dd-mm-aaaa.pdf" ou
// "dd-mm-aaaa.pdf", o padrão do arquivador): a validade do PDF ganha da digitada. O cliente baixa na Central de documentos
// (a pasta Certidões) e o sino avisa a que vence em até 15 dias. Emitir a certidão sozinho fica fora. Só a lógica.

/** quantos dias antes de vencer o sino avisa */
export const AVISO_DA_CERTIDAO_DIAS = 15;

/** O nome do órgão para o cliente, pela pasta (MUNICIPAL, ESTADUAL, FEDERAL/UNIÃO, TRABALHISTA, FGTS). */
export function orgaoDaCertidao(pasta: string): string {
  const p = String(pasta || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
  if (p === 'FEDERAL' || p === 'UNIAO' || p === 'RECEITA FEDERAL') return 'Federal';
  if (p === 'ESTADUAL') return 'Estadual';
  if (p === 'MUNICIPAL') return 'Municipal';
  if (p === 'TRABALHISTA' || p === 'CNDT') return 'Trabalhista';
  if (p === 'FGTS' || p === 'CRF') return 'FGTS';
  return p ? p.charAt(0) + p.slice(1).toLowerCase() : 'Certidão';
}

/** A validade pelo nome ("VENC 15-12-2026.pdf", "15-12-2026.pdf", "VENC 15.12.2026"): 'aaaa-mm-dd', ou null. */
export function validadeDaCertidao(nome: string): string | null {
  const m = /(?:^|VENC(?:IMENTO|\.)?\s*)(\d{2})[.\-/](\d{2})[.\-/](20\d{2})/i.exec(String(nome || '').trim());
  if (!m) return null;
  const iso = m[3] + '-' + m[2] + '-' + m[1];
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return d.getDate() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 ? iso : null;
}

/** A última certidão de cada órgão: a de validade mais longe (sem validade no nome, a mais nova pela data do arquivo). */
export function ultimaPorOrgao<T extends { orgao: string; nome: string; modificadoEm: string }>(arquivos: readonly T[]): (T & { validoAte: string | null })[] {
  const porOrgao = new Map<string, T & { validoAte: string | null }>();
  for (const a of arquivos) {
    const c = { ...a, validoAte: validadeDaCertidao(a.nome) };
    const atual = porOrgao.get(a.orgao);
    const melhor = !atual
      || (c.validoAte ?? '') > (atual.validoAte ?? '')
      || ((c.validoAte ?? '') === (atual.validoAte ?? '') && c.modificadoEm > atual.modificadoEm);
    if (melhor) porOrgao.set(a.orgao, c);
  }
  return [...porOrgao.values()].sort((x, y) => x.orgao.localeCompare(y.orgao, 'pt-BR'));
}

/** O aviso do sino: a certidão vencida ou que vence em até 15 dias ('aaaa-mm-dd' de hoje). */
export function certidaoParaAvisar(validoAte: string | null | undefined, hoje: string): 'vencida' | 'vencendo' | null {
  if (!validoAte || !/^\d{4}-\d{2}-\d{2}$/.test(validoAte)) return null;
  if (validoAte < hoje) return 'vencida';
  const dias = Math.round((Date.parse(validoAte + 'T00:00:00Z') - Date.parse(hoje + 'T00:00:00Z')) / 864e5);
  return dias <= AVISO_DA_CERTIDAO_DIAS ? 'vencendo' : null;
}
