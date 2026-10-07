// A tela própria de cada etapa (Vitor, 06/10/2026: as ferramentas que abriam em iframe viram telas da Tarefa).
// O id vem da rotina (packages/core: Etapa.tela); cada tela é ViewModel + View na pasta dela.
import type { tarefas } from '@nads/core';
import { Adiantamento } from './adiantamento/Adiantamento';
import { RelatorioBancario } from './bancos/RelatorioBancario';
import { Bens } from './bens/Bens';
import { Clientes } from './clientes/Clientes';
import { Emprestimos } from './emprestimos/Emprestimos';
import { Fornecedores } from './fornecedores/Fornecedores';
import { Salarios } from './salarios/Salarios';
import { ProLabore } from './prolabore/ProLabore';
import { Honorarios } from './honorarios/Honorarios';

export function TelaDaEtapa({ id }: { id: tarefas.TelaDaEtapa }) {
  switch (id) {
    case 'bancos': return <RelatorioBancario />;
    case 'clientes': return <Clientes />;
    case 'fornecedores': return <Fornecedores />;
    case 'adiantamento-fornecedores': return <Adiantamento />;
    case 'adiantamento-clientes': return <Adiantamento lado="clientes" />;
    case 'bens': return <Bens />;
    case 'emprestimos': return <Emprestimos />;
    case 'salarios': return <Salarios />;
    case 'pro-labore': return <ProLabore />;
    case 'honorarios': return <Honorarios />;
  }
}
