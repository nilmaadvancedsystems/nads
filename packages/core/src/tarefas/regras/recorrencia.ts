// A tarefa recorrente (Vitor, 18/11/2026: "ao criar a tarefa, colocar ela recorrente, se cair em um dia nao util, colocar no proximo
// dia util"). A tarefa guarda de quanto em quanto tempo ela se repete e a data planejada (a âncora, sem o ajuste do dia útil); o
// prazo é a âncora levada ao próximo dia útil (sábado, domingo, feriado e ponto facultativo de Taiobeiras não são úteis; o meio
// expediente é). Concluída, nasce a próxima: a âncora anda um período (no mês e no ano, o mesmo dia do mês da primeira, ou o
// último dia do mês quando ele não tem esse dia) e o prazo vai de novo para o dia útil. Só a lógica (sem tela e sem banco).
import { feriadoDoDia } from './feriados';

export type Repeticao = 'diaria' | 'semanal' | 'quinzenal' | 'mensal' | 'anual';

export interface Recorrencia {
  repete: Repeticao;
  /** a data planejada desta ocorrência, 'aaaa-mm-dd' (antes do ajuste para o dia útil) */
  ancora: string;
  /** no mês e no ano: o dia do mês da primeira (31 continua 31 nos meses que têm) */
  dia: number;
}

export const REPETICOES: readonly { valor: Repeticao; rotulo: string }[] = [
  { valor: 'diaria', rotulo: 'Todo dia útil' },
  { valor: 'semanal', rotulo: 'Toda semana' },
  { valor: 'quinzenal', rotulo: 'A cada 15 dias' },
  { valor: 'mensal', rotulo: 'Todo mês' },
  { valor: 'anual', rotulo: 'Todo ano' },
];

export const rotuloDaRepeticao = (r: Repeticao): string => REPETICOES.find(x => x.valor === r)?.rotulo || '';

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const dois = (n: number) => String(n).padStart(2, '0');
const paraIso = (d: Date) => d.getFullYear() + '-' + dois(d.getMonth() + 1) + '-' + dois(d.getDate());
const deIso = (iso: string) => { const m = ISO.exec(iso); return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null; };

/** O dia 'aaaa-mm-dd' é útil? Não: sábado, domingo, feriado e ponto facultativo. O meio expediente é útil. */
export function ehDiaUtil(iso: string): boolean {
  const d = deIso(iso);
  if (!d) return false;
  if (d.getDay() === 0 || d.getDay() === 6) return false;
  const f = feriadoDoDia(iso);
  return !f || f.tipo === 'meio-expediente';
}

/** O próprio dia, se for útil; senão, o próximo dia útil. */
export function proximoDiaUtil(iso: string): string {
  const d = deIso(iso);
  if (!d) return iso;
  for (let i = 0; i < 40 && !ehDiaUtil(paraIso(d)); i++) d.setDate(d.getDate() + 1);
  return paraIso(d);
}

/** A recorrência que começa num prazo ('aaaa-mm-dd'). */
export function novaRecorrencia(repete: Repeticao, prazo: string): Recorrencia | null {
  const d = deIso(prazo);
  return d ? { repete, ancora: prazo, dia: d.getDate() } : null;
}

const ultimoDia = (ano: number, mes0: number) => new Date(ano, mes0 + 1, 0).getDate();

/** A próxima ocorrência: a âncora um período adiante e o prazo dela (o próximo dia útil). */
export function proximaOcorrencia(r: Recorrencia): { recorrencia: Recorrencia; prazo: string } | null {
  const d = deIso(r.ancora);
  if (!d) return null;
  if (r.repete === 'diaria') {
    // todo dia útil: o dia útil seguinte ao prazo desta
    d.setDate(d.getDate() + 1);
    const prox = proximoDiaUtil(paraIso(d));
    return { recorrencia: { ...r, ancora: prox }, prazo: prox };
  }
  if (r.repete === 'semanal' || r.repete === 'quinzenal') d.setDate(d.getDate() + (r.repete === 'semanal' ? 7 : 14));
  else {
    const ano = d.getFullYear() + (r.repete === 'anual' ? 1 : 0);
    const mes0 = d.getMonth() + (r.repete === 'mensal' ? 1 : 0);
    const n = new Date(ano, mes0, 1);
    n.setDate(Math.min(r.dia, ultimoDia(n.getFullYear(), n.getMonth())));
    d.setTime(n.getTime());
  }
  const ancora = paraIso(d);
  return { recorrencia: { ...r, ancora }, prazo: proximoDiaUtil(ancora) };
}
