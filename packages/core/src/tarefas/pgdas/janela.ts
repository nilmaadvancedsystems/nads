// Quando o robô pode entrar no e-CAC (25/11/2026, o dono: "a partir das 23 o ecac é liberado para robôs"). A Receita só
// aceita robô de volume fora do horário das 8h às 23h; nesse horário, só gente ou robô de pouca repetição. E a troca de
// perfil (de um cliente para outro, como procurador) só a cada 30 segundos. Esta trava vale sempre, por cima do horário
// que a Central dos robôs marcar: um horário mais largo na Central não faz o robô entrar de dia.

/** das 23h às 8h, hora de Brasília */
export const JANELA_DO_ECAC = { de: 23 * 60, ate: 8 * 60 } as const;
/** a espera mínima entre duas trocas de perfil (a Receita pede 30 s; o robô usa um pouco mais) */
export const ESPERA_ENTRE_PERFIS_MS = 35_000;

/** o minuto do dia em Brasília */
function minutoEmBrasilia(ms: number): number {
  const p: Record<string, string> = {};
  for (const x of new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms))) p[x.type] = x.value;
  return Number(p.hour) * 60 + Number(p.minute);
}

/** o robô pode entrar no e-CAC agora? */
export function dentroDaJanelaDoEcac(ms: number): boolean {
  const m = minutoEmBrasilia(ms);
  return m >= JANELA_DO_ECAC.de || m < JANELA_DO_ECAC.ate;
}

/** quantos ms até a janela abrir (0 = já está aberta) */
export function esperaAteAJanela(ms: number): number {
  if (dentroDaJanelaDoEcac(ms)) return 0;
  const m = minutoEmBrasilia(ms);
  const segundos = new Date(ms).getUTCSeconds() * 1000 + new Date(ms).getUTCMilliseconds();
  return (JANELA_DO_ECAC.de - m) * 60_000 - segundos;
}
