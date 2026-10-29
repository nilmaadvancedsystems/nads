// Os selos da tarefa delegada (28/10/2026): o status no selo suave com a bolinha na cor da legenda do Toriba (Pendente
// amarelo, Em andamento azul, Concluída verde, Cancelada cinza) e a prioridade (Urgente vermelho, Alta amarelo; Normal e
// Baixa só no texto, para a lista não virar um mar de selos).
const SELO_DO_TOM = { warn: 'badge-warn', info: 'badge-info', ok: 'badge-ok', neutral: 'badge-neutral' } as const;

export function SeloDoStatus({ rotulo, tom }: { rotulo: string; tom: keyof typeof SELO_DO_TOM }) {
  return <span className={'badge badge-suave tdl-status ' + SELO_DO_TOM[tom]}>{rotulo}</span>;
}

export function SeloDaPrioridade({ valor, rotulo }: { valor: 'baixa' | 'normal' | 'alta' | 'urgente'; rotulo: string }) {
  if (valor === 'urgente') return <span className="badge badge-suave badge-bad">{rotulo}</span>;
  if (valor === 'alta') return <span className="badge badge-suave badge-warn">{rotulo}</span>;
  return <span className={valor === 'baixa' ? 'fraco' : undefined}>{rotulo}</span>;
}
