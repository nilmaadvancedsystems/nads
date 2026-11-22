// "Não tive movimento" (plano do Acessórias, Documentos do cliente; o dono, 22/11/2026: "vamos continuar e terminar as
// funcionalidades", escolhido "Documentos do cliente"). No aviso "Falta mandar" do sino, o cliente diz que não houve
// movimento no mês. O site manda pela caixa que o cliente já usa (areaClienteChamados) um pedido marcado (o título
// "SEM MOVIMENTO" e o texto "semmovimento:aaaa-mm"), sem regra nova; o robô do PC confere o link e marca
// documentosMensal.semMovimento das empresas do link naquele mês (a régua para de cobrar e o aviso some). Só o mês
// anterior e o atual valem (um pedido torto não apaga a cobrança de um ano atrás). Robô antigo: vira um chamado comum,
// que a equipe lê. Só a lógica.

export const TITULO_DO_PEDIDO_DE_SEM_MOVIMENTO = 'SEM MOVIMENTO';
const PREFIXO = 'semmovimento:';
const COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;

/** O pedido que o site manda (sem o token e a hora); null se a competência for torta. */
export function pedidoDeSemMovimento(competencia: string): { tipo: 'documento'; titulo: string; texto: string } | null {
  return COMPETENCIA.test(competencia) ? { tipo: 'documento', titulo: TITULO_DO_PEDIDO_DE_SEM_MOVIMENTO, texto: PREFIXO + competencia } : null;
}

/** A competência do pedido "sem movimento" que chegou na caixa; '' quando é um chamado comum ou outro pedido marcado. */
export function competenciaDoPedidoDeSemMovimento(p: { tipo?: unknown; titulo?: unknown; texto?: unknown } | null | undefined): string {
  if (!p || p.tipo !== 'documento' || p.titulo !== TITULO_DO_PEDIDO_DE_SEM_MOVIMENTO || typeof p.texto !== 'string') return '';
  const t = p.texto.trim();
  const c = t.startsWith(PREFIXO) ? t.slice(PREFIXO.length) : '';
  return COMPETENCIA.test(c) ? c : '';
}

/** O mês vale para o "sem movimento": o anterior ou o atual de hoje. */
export function competenciaAceitaNoSemMovimento(competencia: string, hoje: Date): boolean {
  const mes = (d: number) => { const x = new Date(hoje.getFullYear(), hoje.getMonth() + d, 1); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0'); };
  return competencia === mes(0) || competencia === mes(-1);
}
