// O "Agendar" ao lado do Disparar dos lotes do DP e do Fiscal (plano do Acessórias, 17/11/2026, ficha
// E17-envio-agendado-por-setor; frase do dono: "Seguir"). Só desenha: o dia e a hora (de Brasília) e o Confirmar, que
// devolve os dois para a VM conferir (tarefas.erroDoAgendamento) e pedir o disparo com a hora marcada.
import { Icone } from '@nads/ui';
import { useState } from 'react';

export function AgendarEnvio({ agendar, desabilitado }: { agendar: (data: string, hora: string) => void; desabilitado: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [data, setData] = useState('');
  const [hora, setHora] = useState('08:00');
  if (!aberto) {
    return (
      <button type="button" className="btn btn-outline" disabled={desabilitado} title="Escolher o dia e a hora em que o robô manda" onClick={() => setAberto(true)}>
        <Icone nome="clock" />Agendar
      </button>
    );
  }
  return (
    <span className="agendar-envio" role="group" aria-label="Agendar o envio">
      <input type="date" className="input" aria-label="Dia do envio" value={data} onChange={e => setData(e.target.value)} />
      <input type="time" className="input" aria-label="Hora do envio (Brasília)" value={hora} onChange={e => setHora(e.target.value)} />
      <button type="button" className="btn btn-primary" disabled={desabilitado || !data || !hora} onClick={() => { agendar(data, hora); setAberto(false); }}>Agendar</button>
      <button type="button" className="btn btn-ghost" onClick={() => setAberto(false)}>Voltar</button>
    </span>
  );
}
