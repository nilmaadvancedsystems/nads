// A janela do fornecedor (28/10/2026: "o cadastro de fornecedores do Toriba, no nads"), no desenho da janela da conta do
// plano: a razão social, o nome fantasia, o CNPJ ou CPF, a conta contábil padrão e o ativo. Ctrl+Enter grava.
import { BotaoFechar, Icone, Interruptor, useJanela } from '@nads/ui';
import { useEffect, useRef } from 'react';
import { Propriedade } from './partes/Propriedade';
import { useJanelaDoFornecedor } from './useJanelaDoFornecedor';

export function JanelaDoFornecedor({ id, fechar }: { id?: string; fechar: () => void }) {
  const vm = useJanelaDoFornecedor(id, fechar);
  const titulo = vm.novo ? 'Novo fornecedor' : 'Fornecedor';
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
          <span className="registro-caminho"><Icone nome="predio" />Fornecedores<Icone nome="chevronRight" /><b>{titulo}</b></span>
          <BotaoFechar onClick={fechar} />
        </header>
        <div className="registro-corpo">
          <div className="registro-props">
            <Propriedade icone="predio" rotulo="Razão social">
              <input type="text" autoFocus={vm.novo} value={vm.razaoSocial} onChange={e => vm.setRazaoSocial(e.target.value)} placeholder="Como está no CNPJ" aria-label="Razão social" />
            </Propriedade>
            <Propriedade icone="fileText" rotulo="Nome fantasia">
              <input type="text" value={vm.nomeFantasia} onChange={e => vm.setNomeFantasia(e.target.value)} placeholder="Como aparece nas contas" aria-label="Nome fantasia" />
            </Propriedade>
            <Propriedade icone="hash" rotulo="CNPJ ou CPF">
              <input type="text" inputMode="numeric" value={vm.documento} onChange={e => vm.setDocumento(e.target.value)} onBlur={vm.formatarDocumento} placeholder="Opcional" aria-label="CNPJ ou CPF" />
            </Propriedade>
            <Propriedade icone="list" rotulo="Conta contábil">
              <select className="pessoal-select" value={vm.contaPadrao} onChange={e => vm.setContaPadrao(e.target.value)} aria-label="Conta contábil padrão">
                <option value="">Sem conta</option>
                {vm.contas.map(c => <option key={c.id} value={c.id}>{c.codigo} · {c.descricao}</option>)}
              </select>
            </Propriedade>
            <Propriedade icone="check" rotulo="Ativo"><Interruptor ligado={vm.ativo} onMudar={() => vm.setAtivo(!vm.ativo)} rotulo="Fornecedor ativo" /></Propriedade>
          </div>
          <p className="registro-dica"><Icone nome="list" />A conta contábil vem preenchida quando o fornecedor é escolhido numa conta a pagar.</p>
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
