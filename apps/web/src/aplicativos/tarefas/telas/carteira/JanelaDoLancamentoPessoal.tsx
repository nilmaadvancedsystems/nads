// A janela de um lançamento das finanças pessoais (12/11/2026): Entrada ou Saída, a data, a descrição, a categoria e o
// valor. Só a própria pessoa vê (nem o admin), como as Anotações.
import { carteira } from '@nads/core';
import { BotaoFechar, CampoData, Icone, Segmentado, useJanela } from '@nads/ui';
import { useEffect, useRef } from 'react';
import { Propriedade } from '../financeiro/partes/Propriedade';
import { useJanelaDoLancamentoPessoal } from './useCarteiraDaPessoa';

export function JanelaDoLancamentoPessoal({ lancamento, fechar }: { lancamento: carteira.Lancamento | null; fechar: () => void }) {
  const vm = useJanelaDoLancamentoPessoal(lancamento, fechar);
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, fechar);
  const titulo = lancamento ? 'Lançamento' : 'Novo lançamento';
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void vm.salvar(); } };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  });

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div ref={janela} className="modal registro-novo" role="dialog" aria-modal="true" aria-label={titulo}>
        <header className="registro-topo">
          <span className="registro-caminho"><Icone nome="cartao" />Finanças pessoais<Icone nome="chevronRight" /><b>{titulo}</b></span>
          <BotaoFechar onClick={fechar} />
        </header>
        <div className="registro-corpo">
          <div className="registro-props">
            <Propriedade icone="repeat" rotulo="Tipo">
              <Segmentado valor={vm.tipo} opcoes={[{ valor: 'entrada', rotulo: 'Entrada' }, { valor: 'saida', rotulo: 'Saída' }]} onMudar={vm.mudarTipo} />
            </Propriedade>
            <Propriedade icone="calendar" rotulo="Data"><CampoData valor={vm.data} onMudar={vm.setData} rotulo="Data do lançamento" /></Propriedade>
            <Propriedade icone="fileText" rotulo="Descrição">
              <input type="text" autoFocus={!lancamento} value={vm.descricao} maxLength={200} onChange={e => vm.setDescricao(e.target.value)} placeholder="O que foi" aria-label="Descrição" />
            </Propriedade>
            <Propriedade icone="list" rotulo="Categoria">
              <select className="pessoal-select" value={vm.categoria} onChange={e => vm.setCategoria(e.target.value)} aria-label="Categoria">
                {vm.categorias.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Propriedade>
            <Propriedade icone="dinheiro" rotulo="Valor">
              <input type="text" inputMode="decimal" value={vm.valor} onChange={e => vm.setValor(e.target.value)} placeholder="0,00" aria-label="Valor" />
            </Propriedade>
          </div>
          <p className="registro-dica"><Icone nome="lock" />Só você vê as suas finanças.</p>
          {vm.erros.length > 0 && <ul className="registro-erros">{vm.erros.map(e => <li key={e}><Icone nome="alert" />{e}</li>)}</ul>}
        </div>
        <footer className="registro-pe">
          {lancamento && <button type="button" className="btn btn-outline btn-danger" onClick={() => void vm.apagar()}><Icone nome="lixeira" />Apagar</button>}
          <span className="tarefas-barra-espaco" />
          <button type="button" className="btn btn-outline" onClick={fechar}>Cancelar</button>
          <button type="button" className="btn btn-primary" disabled={vm.salvando} onClick={() => void vm.salvar()} title="Gravar (Ctrl+Enter)"><Icone nome="check" />Gravar</button>
        </footer>
      </div>
    </div>
  );
}
