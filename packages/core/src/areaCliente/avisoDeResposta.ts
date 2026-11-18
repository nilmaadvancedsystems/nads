// O e-mail ao cliente quando o escritório responde ou conclui a solicitação dele (plano do Acessórias, 17/11/2026, ficha
// aviso-de-resposta, parte B; frase do dono: "Seguir"). O e-mail só avisa e aponta para a Área do Cliente: nunca leva o
// texto da resposta (a Área não tem chat; a conversa é pelo WhatsApp). Respostas seguidas da equipe viram um aviso só: o
// robô espera 15 minutos depois da última. A mensagem interna (a nota da equipe) não conta. O robô da nuvem manda
// (robo/aviso-de-resposta.js), travado como o Mandei. Só a lógica.

/** quantos minutos esperar depois da última resposta, para juntar as seguidas num aviso só */
export const ESPERA_DO_AVISO_MIN = 15;

export interface ChamadoParaAvisar {
  situacao: string;
  mensagens: readonly { de: string; em: string; interna?: boolean }[];
  /** o instante da resposta já avisada (ISO); sem = nunca avisou */
  avisoEnviadoEm?: string;
  /** a conclusão já avisada (ISO) */
  avisoConclusaoEm?: string;
}

/**
 * Precisa avisar o cliente agora? 'resposta' = a última mensagem que o cliente vê é da equipe, mais nova que o último
 * aviso, e já passaram 15 minutos; 'conclusao' = o pedido foi concluído e a conclusão ainda não foi avisada (sem resposta
 * nova para avisar junto). null = não.
 */
export function precisaAvisar(c: ChamadoParaAvisar, agora: Date, esperaMin = ESPERA_DO_AVISO_MIN): 'resposta' | 'conclusao' | null {
  if (c.situacao !== 'respondido' && c.situacao !== 'concluido') return null;
  const visiveis = c.mensagens.filter(m => !m.interna && typeof m.em === 'string');
  const ultima = visiveis[visiveis.length - 1];
  const espera = esperaMin * 60_000;
  if (ultima && ultima.de === 'escritorio' && (!c.avisoEnviadoEm || ultima.em > c.avisoEnviadoEm)) {
    return agora.getTime() - Date.parse(ultima.em) >= espera ? 'resposta' : null;
  }
  if (c.situacao === 'concluido' && !c.avisoConclusaoEm) return 'conclusao';
  return null;
}

/** O e-mail curto (o texto é do NADS): o título do pedido e o link da Área, sem a resposta. */
export function emailDoAviso(titulo: string, link: string, tipo: 'resposta' | 'conclusao', assinatura = 'Nilma Contabilidade'): { assunto: string; corpo: string } {
  const t = String(titulo || 'o seu pedido').trim().slice(0, 120);
  const frase = tipo === 'resposta' ? 'O escritório respondeu o seu pedido' : 'O escritório concluiu o seu pedido';
  return {
    assunto: (tipo === 'resposta' ? 'Respondemos o seu pedido: ' : 'Concluímos o seu pedido: ') + t,
    corpo: ['Olá,', '', frase + ' "' + t + '".', '', 'Para ver, abra a Área do Cliente:', link, '',
      'Este e-mail é só um aviso: a resposta fica na Área do Cliente.', '', assinatura].join('\n'),
  };
}
