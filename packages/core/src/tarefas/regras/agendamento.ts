// O envio agendado dos lotes do DP e do Fiscal (plano do Acessórias, 17/11/2026, ficha E17-envio-agendado-por-setor;
// frase do dono: "Seguir"). A pessoa prepara o lote e escolhe o dia e a hora; o robô só dispara depois dela. Cada setor no
// seu lote: juntar setores num e-mail continua fora (o dono, 11/11/2026: "os gmails sejam separados por setor").
// A hora é a de Brasília, gravada com o fuso ('2026-11-20T08:00:00-03:00'): o robô compara com Date.parse, sem depender do
// fuso da máquina. O Brasil não tem mais horário de verão, então o fuso é sempre -03:00. Só a lógica.

/** o agendamento vale de 10 minutos a 30 dias à frente */
export const AGENDAR_DEPOIS_DE_MIN = 10;
export const AGENDAR_ATE_DIAS = 30;

/** 'aaaa-mm-dd' + 'hh:mm' (em Brasília) → '2026-11-20T08:00:00-03:00'; '' se a data ou a hora estiverem tortas. */
export function agendadoParaIso(data: string, hora: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) return '';
  const iso = data + 'T' + hora + ':00-03:00';
  return Number.isNaN(Date.parse(iso)) ? '' : iso;
}

/** O que está errado no agendamento ('' = pode): no passado, cedo demais ou longe demais. */
export function erroDoAgendamento(iso: string, agora: Date): string {
  const quando = Date.parse(iso);
  if (!iso || Number.isNaN(quando)) return 'Escolha o dia e a hora do envio.';
  if (quando <= agora.getTime()) return 'Esse horário já passou.';
  if (quando < agora.getTime() + AGENDAR_DEPOIS_DE_MIN * 60_000) return 'Agende para pelo menos ' + AGENDAR_DEPOIS_DE_MIN + ' minutos a partir de agora (ou use Enviar).';
  if (quando > agora.getTime() + AGENDAR_ATE_DIAS * 864e5) return 'Agende para no máximo ' + AGENDAR_ATE_DIAS + ' dias à frente.';
  return '';
}

/** O lote ainda espera a hora marcada? (o robô pula até lá) */
export function aindaAgendado(agendadoPara: unknown, agora: number): boolean {
  return typeof agendadoPara === 'string' && Date.parse(agendadoPara) > agora;
}

/**
 * A guia que vence antes do envio agendado (o aviso da tela), pelo vencimento lido 'dd/mm/aaaa' (ou 'dd-mm-aaaa'): o vencimento mais cedo
 * que cai num dia anterior ao do envio, ou null.
 */
export function venceAntesDoEnvio(iso: string, vencimentos: readonly string[]): string | null {
  const dia = iso.slice(0, 10);
  const antes = vencimentos
    .map(v => /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(String(v || '').trim()))
    .filter((m): m is RegExpExecArray => !!m)
    .map(m => ({ texto: m[1] + '/' + m[2] + '/' + m[3], iso: m[3] + '-' + m[2] + '-' + m[1] }))
    .filter(v => v.iso < dia)
    .sort((a, b) => a.iso.localeCompare(b.iso));
  return antes[0]?.texto ?? null;
}

/** "sex., 20/11 às 08:00" (o selo do lote agendado). */
export function rotuloDoAgendamento(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return '';
  const semana = ['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.'][new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getDay()];
  return semana + ', ' + m[3] + '/' + m[2] + ' às ' + m[4] + ':' + m[5];
}
