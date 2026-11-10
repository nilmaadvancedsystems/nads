// A tela própria de cada etapa (Vitor, 06/10/2026: as ferramentas que abriam em iframe viram telas da Tarefa).
// O id vem da rotina (packages/core: Etapa.tela); cada tela é ViewModel + View na pasta dela. As ferramentas que eram
// aplicativos à parte (Vitor, 06/11/2026) moram em tarefas/etapas e abrem por aqui, cada uma na etapa dela.
import type { tarefas } from '@nads/core';
import { Adiantamento } from './adiantamento/Adiantamento';
import { RelatorioBancario } from './bancos/RelatorioBancario';
import { ChequeEspecial } from './cheque/ChequeEspecial';
import { Bens } from './bens/Bens';
import { Clientes } from './clientes/Clientes';
import { Emprestimos } from './emprestimos/Emprestimos';
import { Fornecedores } from './fornecedores/Fornecedores';
import { Salarios } from './salarios/Salarios';
import { ProLabore } from './prolabore/ProLabore';
import { Honorarios } from './honorarios/Honorarios';
import { Simples } from './simples/Simples';
import { Resultado } from './resultado/Resultado';
import { AdiantamentoSalarial } from './adiantamentosalarial/AdiantamentoSalarial';
import { LcdprDaEtapa } from './lcdpr/LcdprDaEtapa';
import { ImportacaoDaEtapa } from './importacao/ImportacaoDaEtapa';
import { ConciliacaoCaixa } from './caixabancos/ConciliacaoCaixa';
import { ConferenciaFiscal } from './conferencia/ConferenciaFiscal';
import { CreditorDaEtapa } from './creditor/CreditorDaEtapa';
import { CartoesDaEtapa } from './cartoes/CartoesDaEtapa';
import { VendasNoCartao } from './vendas/VendasNoCartao';

export function TelaDaEtapa({ id }: { id: tarefas.TelaDaEtapa }) {
  switch (id) {
    case 'importacao': return <ImportacaoDaEtapa />;
    case 'importacao-fiscal': return <ImportacaoDaEtapa fiscal />;
    case 'conferencia-fiscal': return <ConferenciaFiscal />;
    case 'creditor': return <CreditorDaEtapa />;
    case 'cartoes': return <CartoesDaEtapa />;
    case 'vendas-cartao': return <VendasNoCartao />;
    case 'bancos': return <RelatorioBancario />;
    case 'cheque-especial': return <ChequeEspecial />;
    case 'clientes': return <Clientes />;
    case 'fornecedores': return <Fornecedores />;
    case 'adiantamento-fornecedores': return <Adiantamento />;
    case 'adiantamento-clientes': return <Adiantamento lado="clientes" />;
    case 'bens': return <Bens />;
    case 'emprestimos': return <Emprestimos />;
    case 'salarios': return <Salarios />;
    case 'pro-labore': return <ProLabore />;
    case 'honorarios': return <Honorarios />;
    case 'simples': return <Simples />;
    case 'resultado': return <Resultado />;
    case 'conciliacao-caixa': return <ConciliacaoCaixa />;
    case 'adiantamento-salarial': return <AdiantamentoSalarial />;
    case 'lcdpr': return <LcdprDaEtapa />;
  }
}
