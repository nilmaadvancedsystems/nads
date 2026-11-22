// O registro das alterações sensíveis (plano do Acessórias, ficha E20; o dono, 22/11/2026: "pode fazer tudo"): quem mudou o
// quê nos usuários e nos acessos (cargo, papéis, ativar, excluir, criar, trocar o e-mail, liberar e revogar computador). Vai
// na coleção auditoria, que o nads e os robôs já usam (sem regra nova); ninguém edita nem apaga. A tela fica nas
// Configurações › Admin › Registro de alterações. O detalhe nunca leva senha, código nem CPF/CNPJ. Só a lógica.

export type AcaoDoRegistro =
  | 'usuario-criado' | 'usuario-cargo' | 'usuario-papeis' | 'usuario-ativado' | 'usuario-desativado' | 'usuario-excluido' | 'usuario-email'
  | 'acesso-liberado' | 'acesso-recusado' | 'acesso-revogado';

export const ROTULO_DO_REGISTRO: Record<AcaoDoRegistro, string> = {
  'usuario-criado': 'Criou a conta', 'usuario-cargo': 'Mudou o cargo', 'usuario-papeis': 'Mudou os papéis',
  'usuario-ativado': 'Ativou a conta', 'usuario-desativado': 'Desativou a conta', 'usuario-excluido': 'Excluiu a conta',
  'usuario-email': 'Trocou o e-mail', 'acesso-liberado': 'Liberou um computador', 'acesso-recusado': 'Recusou um computador',
  'acesso-revogado': 'Revogou um computador',
};

export const MAIOR_DETALHE = 300;

/** Tira do texto as sequências de 11 ou 14 dígitos (CPF e CNPJ, com ou sem pontuação) e os códigos de 6 dígitos. */
export function semDadoSensivel(texto: string): string {
  return String(texto || '')
    .replace(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g, '[CNPJ]')
    .replace(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g, '[CPF]')
    .replace(/(?<!\d)\d{6}(?!\d)/g, '[código]');
}

/** A linha que vai para a auditoria. */
export function linhaDoRegistro(acao: AcaoDoRegistro, quem: { email: string; nome: string }, detalhe: string, agora: Date): { acao: AcaoDoRegistro; detalhe: string; feitoPor: string; feitoPorNome: string; quando: string; origem: 'nads' } {
  return { acao, detalhe: semDadoSensivel(detalhe).trim().slice(0, MAIOR_DETALHE), feitoPor: quem.email, feitoPorNome: quem.nome, quando: agora.toISOString(), origem: 'nads' };
}

/** Uma linha da auditoria para a tela (a de qualquer origem: o nads, os robôs e o Entregas). */
export interface LinhaDaAuditoria { id: string; acao: string; rotulo: string; detalhe: string; por: string; quando: string; origem: string; sensivel: boolean }

export function linhaDaAuditoria(id: string, x: unknown): LinhaDaAuditoria | null {
  const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
  const txt = (v: unknown) => (typeof v === 'string' ? v : '');
  const acao = txt(o.acao);
  const quando = txt(o.quando) || (o.quando && typeof o.quando === 'object' && typeof (o.quando as { toDate?: () => Date }).toDate === 'function' ? (o.quando as { toDate: () => Date }).toDate().toISOString() : '');
  if (!acao || !quando) return null;
  const sensivel = acao in ROTULO_DO_REGISTRO;
  return { id, acao, rotulo: sensivel ? ROTULO_DO_REGISTRO[acao as AcaoDoRegistro] : acao.replace(/_/g, ' '), detalhe: txt(o.detalhe).slice(0, MAIOR_DETALHE), por: txt(o.feitoPorNome) || txt(o.feitoPor) || '—', quando, origem: txt(o.origem) || 'entregas', sensivel };
}
