// A janela do lançamento do caixa (19/10/2026), no desenho da Nova nota: a data, Entrada ou Saída, a descrição, o valor, a
// conta do plano e as observações. Com `id`, abre o lançamento para alterar (e dá o Excluir). Ctrl+Enter grava.
import { BotaoFechar, CampoData, Icone, Segmentado, useJanela } from '@nads/ui';
import { useEffect, useRef } from 'react';
import { Propriedade } from './partes/Propriedade';
import { useJanelaDoLancamento } from './useJanelaDoLancamento';

export function JanelaDoLancamento({ id, valor, fechar }: { id?: string; valor?: number; fechar: () => void }) {
  const vm = useJanelaDoLancamento(id, valor, fechar);
  const titulo = vm.novo ? 'Novo lançamento' : 'Lançamento';
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, fechar);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void vm.salvar(); } };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  });
  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div ref={janela} className="modal registro-novo" role="dialog" aria-modal="true" aria-label={titulo}>
        <header className="registro-topo">
          <span className="registro-caminho"><Icone nome="dinheiro" />Caixa<Icone nome="chevronRight" /><b>{titulo}</b></span>
          <BotaoFechar onClick={fechar} />
        </header>
        <div className="registro-corpo">
          <div className="registro-props">
            <Propriedade icone="calendar" rotulo="Data"><CampoData valor={vm.data} onMudar={vm.setData} rotulo="Data do lançamento" /></Propriedade>
            <Propriedade icone="repeat" rotulo="Tipo">
              <Segmentado valor={vm.tipo} opcoes={[{ valor: 'E', rotulo: 'Entrada' }, { valor: 'S', rotulo: 'Saída' }]} onMudar={vm.setTipo} />
            </Propriedade>
            <Propriedade icone="fileText" rotulo="Descrição">
              <input type="text" autoFocus={vm.novo} value={vm.descricao} onChange={e => vm.setDescricao(e.target.value)} placeholder="O que foi" aria-label="Descrição do lançamento" />
            </Propriedade>
            <Propriedade icone="dinheiro" rotulo="Valor">
              <input type="text" inputMode="decimal" value={vm.valor} onChange={e => vm.setValor(e.target.value)} placeholder="0,00" aria-label="Valor do lançamento" />
            </Propriedade>
            <Propriedade icone="list" rotulo="Conta">
              <select className="pessoal-select" value={vm.conta} onChange={e => vm.setConta(e.target.value)} aria-label="Conta do plano de contas">
                <option value="">Sem conta</option>
                {vm.contas.map(c => <option key={c.id} value={c.id}>{c.codigo} · {c.descricao}</option>)}
              </select>
            </Propriedade>
            <Propriedade icone="mensagem" rotulo="Observações">
              <textarea className="nf-texto" rows={2} value={vm.observacoes} onChange={e => vm.setObservacoes(e.target.value)} placeholder="Opcional" aria-label="Observações" />
            </Propriedade>
          </div>
          {vm.existente && (
            <p className="registro-dica">
              <Icone nome="clock" />
              {vm.existente.origem === 'toriba' ? 'Veio do Toriba' + (vm.existente.toribaId != null ? ' (ID ' + vm.existente.toribaId + ')' : '') + '. ' : ''}
              {vm.existente.atualizadoPor ? 'Alterado por ' + vm.existente.atualizadoPor + '.' : vm.existente.criadoPor ? 'Criado por ' + vm.existente.criadoPor + '.' : ''}
            </p>
          )}
          {vm.erros.length > 0 && <ul className="registro-erros">{vm.erros.map(e => <li key={e}><Icone nome="alert" />{e}</li>)}</ul>}
        </div>
        <footer className="registro-pe">
          {!vm.novo && <button type="button" className="btn btn-outline btn-danger" disabled={vm.salvando} onClick={() => void vm.excluir()}><Icone nome="lixeira" />Excluir</button>}
          <span className="tarefas-barra-espaco" />
          <button type="button" className="btn btn-outline" onClick={fechar}>Cancelar</button>
          <button type="button" className="btn btn-primary" disabled={vm.salvando} onClick={() => void vm.salvar()} title="Gravar (Ctrl+Enter)">
            {vm.salvando ? <span className="btn-spinner" aria-hidden="true" /> : <Icone nome="check" />}Gravar
          </button>
        </footer>
      </div>
    </div>
  );
}
