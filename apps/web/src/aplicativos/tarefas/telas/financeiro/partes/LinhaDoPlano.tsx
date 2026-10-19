// Uma conta do plano de contas na árvore (19/10/2026, do Toriba): recuada pelo nível, com a classificação, a descrição, o
// tipo em selo e se está ativa. As que só agrupam (não recebem lançamento) vão em negrito.
import { financeiro } from '@nads/core';

export function LinhaDoPlano({ conta, fundo, aoAbrir }: { conta: financeiro.ContaDoPlano; fundo: number; aoAbrir?: () => void }) {
  return (
    <li>
      <button type="button" className={'fin-conta' + (conta.ativo ? '' : ' fin-conta-inativa')} style={{ paddingLeft: 12 + fundo * 22 }} onClick={aoAbrir} title="Abrir a conta">
        <span className="fin-conta-codigo num">{conta.codigo}</span>
        <span className={'fin-conta-nome' + (conta.movimentavel ? '' : ' fin-conta-grupo')}>{conta.descricao}</span>
        <span className="tarefas-barra-espaco" />
        <span className="badge badge-neutral">{financeiro.rotuloDoTipoDeConta(conta.tipo)}</span>
        {!conta.ativo && <span className="badge badge-warn">Inativa</span>}
      </button>
    </li>
  );
}
