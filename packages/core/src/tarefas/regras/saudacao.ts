// A saudação do Início novo, no lugar do título (Vitor, 13/11/2026: "Fica variando, as frases, vai mudando: Bom dia, Vitor /
// Boa tarde, Vitor / Boa noite, Vitor / Segunda feira: Como foi o final de semana Vitor? / Perto do aniversário… Melhor mês
// do ano chegou! / Mensagens personalizadas"). E "Só que não pela atualização, pode ser em diferentes turnos": a frase é
// escolhida por pessoa, dia e turno (manhã, tarde, noite), então recarregar a página no mesmo turno mostra a mesma frase.

export type Turno = 'manha' | 'tarde' | 'noite';

/** O turno da hora: manhã das 5h ao meio-dia, tarde até as 18h, noite o resto. */
export function turnoDe(hora: number): Turno {
  if (hora >= 5 && hora < 12) return 'manha';
  if (hora >= 12 && hora < 18) return 'tarde';
  return 'noite';
}

const POR_TURNO: Record<Turno, string> = { manha: 'Bom dia, {nome}', tarde: 'Boa tarde, {nome}', noite: 'Boa noite, {nome}' };

/**
 * As mensagens personalizadas: entram no sorteio com as do turno. {nome} vira o primeiro nome; turno: só naquele turno.
 * Para ampliar, é só pôr mais uma linha aqui.
 */
export const FRASES_PERSONALIZADAS: readonly { texto: string; turno?: Turno }[] = [
  { texto: 'Bom te ver por aqui, {nome}' },
  { texto: 'Bora fazer o dia render, {nome}?', turno: 'manha' },
  { texto: 'Café tomado, {nome}? Vamos lá', turno: 'manha' },
  { texto: 'Metade do dia já foi, {nome}. Vamos com tudo', turno: 'tarde' },
  { texto: 'Ainda por aqui, {nome}? Não esquece de descansar', turno: 'noite' },
];

/** O aniversário ('aaaa-mm-dd', 'mm-dd' ou 'dd/mm') como 'mm-dd'; '' quando não dá para ler. */
export function mesEDia(aniversario: string | null | undefined): string {
  const a = (aniversario || '').trim();
  let m = /^(?:\d{4}-)?(\d{2})-(\d{2})$/.exec(a);
  if (m) return m[1] + '-' + m[2];
  m = /^(\d{2})\/(\d{2})(?:\/\d{4})?$/.exec(a);
  return m ? m[2] + '-' + m[1] : '';
}

/** Um número fixo para o texto (o mesmo texto dá sempre o mesmo número). */
function numeroDe(texto: string): number {
  let h = 0;
  for (let i = 0; i < texto.length; i++) h = (Math.imul(h, 31) + texto.charCodeAt(i)) >>> 0;
  return h;
}

const dataLocal = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

/** As frases que valem agora para a pessoa (a do aniversário, sozinha, no próprio dia). */
export function frasesDaSaudacao(nome: string, agora: Date, aniversario?: string | null): string[] {
  const primeiro = nome.trim().split(/[ .]/)[0] || nome;
  const com = (t: string) => t.replace('{nome}', primeiro);
  const niver = mesEDia(aniversario);
  const hoje = dataLocal(agora).slice(5);
  if (niver && niver === hoje) return [com('Feliz aniversário, {nome}!')];
  const turno = turnoDe(agora.getHours());
  const daHora = com(POR_TURNO[turno]);
  // as especiais aparecem mais (duas vezes na lista): a segunda-feira e o mês do aniversário
  const especiais = [
    ...(agora.getDay() === 1 ? [com('Como foi o final de semana, {nome}?')] : []),
    ...(niver && niver.slice(0, 2) === hoje.slice(0, 2) ? [com('Melhor mês do ano chegou, {nome}!')] : []),
  ];
  const personalizadas = FRASES_PERSONALIZADAS.filter(f => !f.turno || f.turno === turno).map(f => com(f.texto));
  return [...especiais, daHora, ...especiais, daHora, ...personalizadas];
}

/**
 * A saudação de agora: uma das frases, escolhida pela pessoa (quem), pelo dia e pelo turno, e mais nada; recarregar no
 * mesmo turno dá a mesma frase. troca: soma ao número (o "Outra frase" do ⚡, para testar); simulando: começa pela primeira
 * frase (a especial, quando tem: a segunda-feira ou o aniversário simulados aparecem logo) e a troca anda uma a uma.
 */
export function saudacao(o: { nome: string; quem: string; agora: Date; aniversario?: string | null; troca?: number; simulando?: boolean }): string {
  const frases = frasesDaSaudacao(o.nome, o.agora, o.aniversario);
  if (o.simulando) return frases[(o.troca || 0) % frases.length];
  const n = numeroDe(o.quem + '|' + dataLocal(o.agora) + '|' + turnoDe(o.agora.getHours())) + (o.troca || 0);
  return frases[n % frases.length];
}
