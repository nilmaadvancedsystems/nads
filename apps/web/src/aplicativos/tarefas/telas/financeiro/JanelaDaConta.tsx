// A janela da conta do plano de contas (19/10/2026), no desenho da Nova nota: a classificação (4.1.01), a descrição, o tipo,
// a conta pai e dois interruptores (ativa; recebe lançamento). Com `id`, abre a conta para alterar. Ctrl+Enter grava.
import { financeiro } from '@nads/core';
import { BotaoFechar, Icone, Interruptor, useJanela } from '@nads/ui';
import { useEffect, useRef } from 'react';
import { Propriedade } from './partes/Propriedade';
import { useJanelaDaConta } from './useJanelaDaConta';

export function JanelaDaConta({ id, pai, fechar }: { id?: string; pai?: string; fechar: () => void }) {
  const vm = useJanelaDaConta(id, pai, fechar);
  const titulo = vm.novo ? 'Nova conta' : 'Conta';
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
          <span className="registro-caminho"><Icone nome="list" />Plano de contas<Icone nome="chevronRight" /><b>{titulo}</b></span>
          <BotaoFechar onClick={fechar} />
        </header>
        <div className="registro-corpo">
          <div className="registro-props">
            <Propriedade icone="hash" rotulo="Classificação">
              <input type="text" autoFocus={vm.novo} value={vm.codigo} onChange={e => vm.setCodigo(e.target.value)} placeholder="Como 4.1.01" aria-label="Classificação da conta" />
            </Propriedade>
            <Propriedade icone="fileText" rotulo="Descrição">
              <input type="text" value={vm.descricao} onChange={e => vm.setDescricao(e.target.value)} placeholder="Nome da conta" aria-label="Descrição da conta" />
            </Propriedade>
            <Propriedade icone="checklist" rotulo="Tipo">
              <select className="pessoal-select" value={vm.tipo} onChange={e => vm.setTipo(e.target.value as financeiro.TipoDeConta)} aria-label="Tipo da conta">
                {financeiro.TIPOS_DE_CONTA.map(t => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
              </select>
            </Propriedade>
            <Propriedade icone="list" rotulo="Conta pai">
              <select className="pessoal-select" value={vm.pai} onChange={e => vm.setPai(e.target.value)} aria-label="Conta pai">
                <option value="">Nenhuma (conta de cima)</option>
                {vm.pais.map(c => <option key={c.id} value={c.id}>{c.codigo} · {c.descricao}</option>)}
              </select>
            </Propriedade>
            <Propriedade icone="check" rotulo="Ativa"><Interruptor ligado={vm.ativo} onMudar={() => vm.setAtivo(!vm.ativo)} rotulo="Conta ativa" /></Propriedade>
            <Propriedade icone="dinheiro" rotulo="Recebe lançamento"><Interruptor ligado={vm.movimentavel} onMudar={() => vm.setMovimentavel(!vm.movimentavel)} rotulo="A conta recebe lançamento" /></Propriedade>
          </div>
          {vm.erros.length > 0 && <ul className="registro-erros">{vm.erros.map(e => <li key={e}><Icone nome="alert" />{e}</li>)}</ul>}
        </div>
        <footer className="registro-pe">
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
