// A janela Empresa nova (Vitor, 07/10/2026; refeita em 14/10/2026: "repensar essa aba de cadastro de empresas… pode usar
// o Notion como base"), no jeito do "Create record" do Attio com as propriedades do Notion: o CNPJ em destaque no topo (a
// Receita preenche o resto), o cartão do que a Receita disse, as propriedades em linhas (o nome, o código do ERP, o
// regime) e, no rodapé, "Cadastrar outra", Cancelar e Cadastrar (Ctrl+Enter). Cadastrar grava e abre a janela da empresa.
import { BotaoAcao, Icone, Interruptor, MenuSuspenso, type NomeIcone } from '@nads/ui';
import { useEffect, type ReactNode } from 'react';
import { useNovaEmpresa } from './useNovaEmpresa';

const dataBr = (iso: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : iso; };

/** uma propriedade, como no Notion: o ícone e o nome à esquerda, o valor ocupando o resto */
function Propriedade({ icone, rotulo, children }: { icone: NomeIcone; rotulo: string; children: ReactNode }) {
  return (
    <div className="registro-prop">
      <span className="registro-prop-nome"><Icone nome={icone} />{rotulo}</span>
      <div className="registro-prop-valor">{children}</div>
    </div>
  );
}

export function JanelaNovaEmpresa({ fechar }: { fechar: () => void }) {
  const vm = useNovaEmpresa(fechar);
  const r = vm.receita;

  // Esc fecha (menos com o menu do regime aberto); Ctrl+Enter cadastra
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('.registro-novo .popover')) fechar();
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void vm.cadastrar(); }
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  });

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div className="modal registro-novo" role="dialog" aria-modal="true" aria-label="Empresa nova">
        <header className="registro-topo">
          <span className="registro-caminho"><Icone nome="briefcase" />Cadastro<Icone nome="chevronRight" /><b>Empresa nova</b></span>
          <button type="button" className="icon-btn icon-btn-sm" onClick={fechar} aria-label="Fechar" title="Fechar (Esc)"><Icone nome="x" /></button>
        </header>

        <div className="registro-corpo">
          {/* o CNPJ em destaque: a Receita preenche o nome e, no Simples ou no MEI, o regime */}
          <div className={'registro-busca' + (vm.avisoReceita ? ' com-erro' : '')}>
            <Icone nome="search" />
            <input type="text" inputMode="numeric" value={vm.cnpj} onChange={e => vm.setCnpj(e.target.value)} placeholder="CNPJ da empresa" autoFocus aria-label="CNPJ"
              onKeyDown={e => { if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) void vm.buscar(); }} />
            <BotaoAcao className="btn btn-ghost" carregando={vm.consultando} textoCarregando="Buscando…" disabled={vm.cnpj.replace(/\D/g, '').length !== 14} onClick={() => { void vm.buscar(); }}>
              Buscar na Receita
            </BotaoAcao>
          </div>
          {vm.avisoReceita
            ? <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.avisoReceita}</p>
            : !r && <p className="registro-dica">Com o CNPJ, a Receita preenche o nome e o regime. Sem CNPJ, preencha abaixo.</p>}

          {r && (
            <div className="registro-receita">
              <div className="registro-receita-topo">
                <b>{r.razaoSocial}</b>
                <span className={'badge ' + (vm.receitaAtiva ? 'badge-ok' : 'badge-bad')}>{r.situacao || '—'}</span>
              </div>
              <span className="fraco">{[r.fantasia, r.municipio ? r.municipio + '/' + r.uf : '', r.abertura ? 'aberta em ' + dataBr(r.abertura) : ''].filter(Boolean).join(' · ')}</span>
              {r.cnae && <span className="fraco">{r.cnae} {r.cnaeDescricao}</span>}
            </div>
          )}

          <div className="registro-props">
            <Propriedade icone="fileText" rotulo="Nome">
              <input type="text" value={vm.nome} onChange={e => vm.setNome(e.target.value)} placeholder="Razão social" autoComplete="off" aria-label="Nome" />
            </Propriedade>
            <Propriedade icone="hash" rotulo="Código no ERP">
              <input type="text" inputMode="numeric" value={vm.codigo} onChange={e => vm.setCodigo(e.target.value.replace(/[^0-9]/g, ''))} placeholder="Vazio" aria-label="Código no ERP" />
            </Propriedade>
            <Propriedade icone="scale" rotulo="Regime">
              <MenuSuspenso rotulo={vm.regime || 'Escolher'} className={'btn btn-ghost registro-escolha' + (vm.regime ? '' : ' vazio')} titulo="Regime" largura={200}
                itens={vm.regimes.map(x => ({ rotulo: x, marcado: x === vm.regime, onClick: () => vm.setRegime(x) }))} />
              {vm.regimeDaReceita && <span className="fraco registro-origem">pela Receita</span>}
              {r && !r.regime && !vm.regime && <span className="fraco registro-origem">fora do Simples: Presumido ou Real</span>}
            </Propriedade>
          </div>

          {vm.erros.length > 0 && <ul className="registro-erros">{vm.erros.map(e => <li key={e}><Icone nome="alert" />{e}</li>)}</ul>}
        </div>

        <footer className="registro-pe">
          <Interruptor ligado={vm.outra} rotulo="Cadastrar outra" onMudar={() => vm.setOutra(!vm.outra)} />
          <span className="registro-pe-rotulo">{vm.feita ? <><Icone nome="checkCircle" />{vm.feita} cadastrada</> : 'Cadastrar outra'}</span>
          <span className="tarefas-barra-espaco" />
          <button type="button" className="btn btn-outline" onClick={fechar}>Cancelar</button>
          <button type="button" className="btn btn-primary" disabled={vm.salvando} onClick={() => void vm.cadastrar()} title="Cadastrar (Ctrl+Enter)">
            {vm.salvando ? <span className="btn-spinner" aria-hidden="true" /> : <Icone nome="plus" />}Cadastrar
          </button>
        </footer>
      </div>
    </div>
  );
}
