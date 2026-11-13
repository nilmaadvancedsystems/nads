// O Calendário do mês (Vitor, 13/11/2026: a peça nova do Início novo, "Pode criar"): o nome do mês com ‹ ›, a semana de
// domingo a sábado e os dias. Clicar num dia escolhe (de novo, solta). Redesenhado no mesmo dia ("Tem como fazer outro
// calendário mais bonitinho?"), no visual do GitHub e sem animação: os dias em quadradinhos de canto arredondado; hoje cheio
// na cor da marca e o nome do dia da semana em destaque (a semana de hoje num fundo leve saiu: Vitor, 13/11/2026, "Tira esse
// negocio da semana", "Deixa normal"); o dia marcado (prazo de tarefa,
// reunião ou aviso) com o fundo da marca clarinho e até 3 pontinhos (um por evento); os dias que já passaram mais
// apagados; os do mês de antes e do de depois quase sumidos, sem clique. Fora do mês de hoje, o botão volta para ele.
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
  const mesDeHoje = hoje.slice(0, 7) === mes;
  // a casa de hoje na grade: a coluna dela é o dia da semana em destaque
  const casaDeHoje = mesDeHoje ? primeiro + Number(hoje.slice(8, 10)) - 1 : -1;
  return (
    <div className="cal-mes">
      <div className="cal-mes-topo">
        <b>{MESES[m - 1]} <span className="cal-mes-ano">{a}</span></b>
        {onMes && <>
          {!mesDeHoje && <BotaoIcone pequeno icone="calendar" titulo="Voltar para o mês de hoje" onClick={() => onMes(hoje.slice(0, 7))} />}
          <BotaoIcone pequeno icone="chevronLeft" titulo="O mês de antes" onClick={() => onMes(somarMeses(mes, -1))} />
          <BotaoIcone pequeno icone="chevronRight" titulo="O mês seguinte" onClick={() => onMes(somarMeses(mes, 1))} />
        </>}
      </div>
      <div className="cal-mes-grade" role="grid" aria-label={MESES[m - 1] + ' de ' + a}>
        {SEMANA.map((s, i) => (
          <span key={s} className={'cal-mes-sem' + (casaDeHoje >= 0 && casaDeHoje % 7 === i ? ' hoje' : '')} role="columnheader">{s}</span>
        ))}
        {casas.map((c, i) => {
          if (c.fora) return <span key={i} className={'cal-mes-dia fora'} aria-hidden="true">{c.n}</span>;
          const dia = iso(c.n);
          const qtd = marcados[c.n] || 0;
          const classe = 'cal-mes-dia' + (dia === hoje ? ' hoje' : dia < hoje ? ' passou' : '') + (dia === escolhido ? ' escolhido' : '') + (qtd ? ' marcado' : '');
          const dica = qtd ? (dicaDoMarcado ? dicaDoMarcado(qtd) : String(qtd)) : undefined;
          return (
            <button key={i} type="button" className={classe} role="gridcell" aria-pressed={dia === escolhido} aria-current={dia === hoje ? 'date' : undefined}
              title={dica} aria-label={c.n + (dia === hoje ? ', hoje' : '') + (dica ? ', ' + dica : '')} disabled={!onDia} onClick={() => onDia?.(dia === escolhido ? null : dia)}>
              <span className="cal-mes-num">{c.n}</span>
              {qtd > 0 && <span className="cal-mes-pontos" aria-hidden="true">{Array.from({ length: Math.min(qtd, 3) }, (_, k) => <i key={k} />)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
