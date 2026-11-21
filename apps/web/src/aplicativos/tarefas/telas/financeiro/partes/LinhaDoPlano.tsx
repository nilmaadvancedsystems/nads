// Uma conta do plano de contas na árvore (19/10/2026, do Toriba): recuada pelo nível, com a classificação e a descrição.
// O visual (19/11/2026: "quero que fique visualmente bonito"): cada grupo de cima (Ativo, Passivo…) abre um bloco com a cor
// do tipo e o selo dele; as contas de dentro herdam a cor só na linha-guia do recuo, sem repetir o selo em toda linha. As que
// só agrupam (não recebem lançamento) vão em negrito; a seta da direita aparece ao passar o mouse.
import { financeiro } from '@nads/core';
import { Icone } from '@nads/ui';

export function LinhaDoPlano({ conta, fundo, aoAbrir }: { conta: financeiro.ContaDoPlano; fundo: number; aoAbrir?: () => void }) {
  const raiz = conta.pai === null;
  return (
    <li className={'fin-plano-linha fin-tipo-' + conta.tipo.toLowerCase() + (raiz ? ' fin-plano-raiz' : '')}>
      <button type="button" className={'fin-conta' + (conta.ativo ? '' : ' fin-conta-inativa')} onClick={aoAbrir} title="Abrir a conta">
        {fundo > 0 && <span className="fin-conta-recuo" style={{ width: fundo * 22 }} aria-hidden="true" />}
        <span className="fin-conta-codigo num">{conta.codigo}</span>
        <span className={'fin-conta-nome' + (conta.movimentavel ? '' : ' fin-conta-grupo')}>{conta.descricao}</span>
        <span className="tarefas-barra-espaco" />
        {!conta.ativo && <span className="badge badge-warn">Inativa</span>}
        {raiz && <span className="fin-tipo-selo">{financeiro.rotuloDoTipoDeConta(conta.tipo)}</span>}
        <Icone nome="chevronRight" className="fin-conta-abrir" width={16} height={16} />
      </button>
    </li>
  );
}
