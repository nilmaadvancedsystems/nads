// O Calendário do mês (Vitor, 13/11/2026: a peça nova do Início novo, "Pode criar"): o nome do mês com ‹ ›, a semana de
// domingo a sábado e os dias; hoje na cor da marca, o dia escolhido com o contorno e os dias marcados (os que têm prazo de
// tarefa) com a bolinha embaixo. Clicar num dia escolhe (de novo, solta). Os dias do mês de antes e do de depois ficam
// apagados e não clicam.
import { BotaoIcone } from './componentes';

const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/** 'aaaa-mm' + n meses */
export function somarMeses(mes: string, n: number): string {
  const [a, m] = mes.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
}

export function CalendarioDoMes({ mes, hoje, marcados = {}, escolhido = null, onDia, onMes, dicaDoMarcado }: {
  /** o mês mostrado, 'aaaa-mm' */
  mes: string;
  /** hoje, 'aaaa-mm-dd' */
  hoje: string;
  /** o dia (1 a 31) → quantos (a bolinha e a dica) */
  marcados?: Record<number, number>;
  /** o dia escolhido, 'aaaa-mm-dd' */
  escolhido?: string | null;
  onDia?: (dia: string | null) => void;
  onMes?: (mes: string) => void;
  /** a dica do dia marcado ("3 tarefas") */
  dicaDoMarcado?: (quantos: number) => string;
}) {
  const [a, m] = mes.split('-').map(Number);
  const primeiro = new Date(Date.UTC(a, m - 1, 1)).getUTCDay();
  const diasNoMes = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const diasNoAnterior = new Date(Date.UTC(a, m - 1, 0)).getUTCDate();
  // 6 semanas sempre: o calendário não muda de altura ao trocar de mês
  const casas = Array.from({ length: 42 }, (_, i) => {
    const n = i - primeiro + 1;
    if (n < 1) return { n: diasNoAnterior + n, fora: true };
    if (n > diasNoMes) return { n: n - diasNoMes, fora: true };
    return { n, fora: false };
  });
  const iso = (n: number) => mes + '-' + String(n).padStart(2, '0');
  return (
    <div className="cal-mes">
      <div className="cal-mes-topo">
        <b>{MESES[m - 1]} de {a}</b>
        {onMes && <>
          <BotaoIcone pequeno icone="chevronLeft" titulo="O mês de antes" onClick={() => onMes(somarMeses(mes, -1))} />
          <BotaoIcone pequeno icone="chevronRight" titulo="O mês seguinte" onClick={() => onMes(somarMeses(mes, 1))} />
        </>}
      </div>
      <div className="cal-mes-grade" role="grid" aria-label={MESES[m - 1] + ' de ' + a}>
        {SEMANA.map(s => <span key={s} className="cal-mes-sem" role="columnheader">{s}</span>)}
        {casas.map((c, i) => {
          if (c.fora) return <span key={i} className="cal-mes-dia fora" aria-hidden="true">{c.n}</span>;
          const dia = iso(c.n);
          const qtd = marcados[c.n] || 0;
          const classe = 'cal-mes-dia' + (dia === hoje ? ' hoje' : '') + (dia === escolhido ? ' escolhido' : '') + (qtd ? ' marcado' : '');
          const dica = qtd ? (dicaDoMarcado ? dicaDoMarcado(qtd) : String(qtd)) : undefined;
          return (
            <button key={i} type="button" className={classe} role="gridcell" aria-pressed={dia === escolhido} aria-current={dia === hoje ? 'date' : undefined}
              title={dica} aria-label={c.n + (dica ? ', ' + dica : '')} disabled={!onDia} onClick={() => onDia?.(dia === escolhido ? null : dia)}>
              {c.n}
            </button>
          );
        })}
      </div>
    </div>
  );
}
