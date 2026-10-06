// A tela própria de cada etapa (Vitor, 06/10/2026: as ferramentas que abriam em iframe viram telas da Tarefa).
// O id vem da rotina (packages/core: Etapa.tela); cada tela é ViewModel + View na pasta dela.
import type { tarefas } from '@nads/core';
import { RelatorioBancario } from './bancos/RelatorioBancario';
import { Clientes } from './clientes/Clientes';

export function TelaDaEtapa({ id }: { id: tarefas.TelaDaEtapa }) {
  switch (id) {
    case 'bancos': return <RelatorioBancario />;
    case 'clientes': return <Clientes />;
  }
}
