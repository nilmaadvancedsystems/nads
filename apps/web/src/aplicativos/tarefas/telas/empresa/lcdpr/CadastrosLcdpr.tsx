// As listas do LCDPR (Categorias, Regras de NCM, Plano de contas e as Tabelas de apoio do lcdpr.html) no desenho da lista
// do Cadastro: uma lista só tem a barra de cima (quantas, a busca, o "+ Novo") e a tabela; várias (as Tabelas de apoio)
// viram cartões lado a lado. Clicar na linha abre a janela do item; remover está na janela, com o Desfazer no aviso.
import type { lcdpr } from '@nads/core';
import { Alerta, BotaoFechar, Icone, MenuSuspenso, useJanela, type NomeIcone } from '@nads/ui';
import { useEffect, useRef, type ReactNode } from 'react';
import { useCadastrosLcdpr } from './useCadastrosLcdpr';

type Vm = ReturnType<typeof useCadastrosLcdpr>;
type Lista = Vm['listas'][number];

function Tabela({ l }: { l: Lista }) {
  return (
    <div className="table-wrap">
      <table className="cad-lista lcdpr-cadastro">
        <thead><tr>{l.colunas.map(c => <th key={c.id} className={c.numerico ? 'num' : undefined}>{c.rotulo}</th>)}</tr></thead>
        <tbody>
          {l.linhas.map(x => (
            <tr key={x.indice} className="linha-abre" tabIndex={0} title="Abrir" onClick={() => l.abrir(x.indice)} onKeyDown={e => { if (e.key === 'Enter') l.abrir(x.indice); }}>
              {x.celulas.map((v, k) => (
                <td key={l.colunas[k].id} className={l.colunas[k].numerico ? 'num' : undefined}>
                  {l.colunas[k].longo ? <span className={'lcdpr-corta' + (k > 0 ? ' largo' : '')} title={v}>{v || <span className="fraco">—</span>}</span> : v || <span className="fraco">—</span>}
                </td>
              ))}
            </tr>
          ))}
          {!l.linhas.length && <tr><td colSpan={l.colunas.length} className="empty">{l.vazio}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function Busca({ l }: { l: Lista }) {
  return (
    <label className="busca-curta">
      <Icone nome="search" />
      <input type="text" placeholder={l.placeholderBusca} aria-label={l.placeholderBusca} value={l.busca}
        onChange={e => l.setBusca(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') l.setBusca(''); }} />
    </label>
  );
}

function Propriedade({ icone, rotulo, children }: { icone: NomeIcone; rotulo: string; children: ReactNode }) {
  return (
    <div className="registro-prop">
      <span className="registro-prop-nome"><Icone nome={icone} />{rotulo}</span>
      <div className="registro-prop-valor">{children}</div>
    </div>
  );
}

function JanelaDoItem({ vm }: { vm: Vm }) {
  const j = vm.janela;
  // revisão da UI, 16/10/2026: Esc, foco preso e o foco de volta pela peça useJanela (antes, um Esc à mão por janela)
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, vm.fecharJanela, !!j);
  // Ctrl+Enter salva
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void vm.salvarJanela(); }
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  });
  if (!j) return null;
  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) vm.fecharJanela(); }}>
      <div ref={janela} className="modal registro-novo" role="dialog" aria-modal="true" aria-label={j.titulo}>
        <header className="registro-topo">
          <span className="registro-caminho"><Icone nome="dinheiro" />LCDPR<Icone nome="chevronRight" /><b>{j.titulo}</b></span>
          <BotaoFechar onClick={vm.fecharJanela} />
        </header>
        <div className="registro-corpo">
          <div className="registro-props">
            {j.campos.map((c, k) => (
              <Propriedade key={c.id} icone={c.icone} rotulo={c.rotulo}>
                {c.tipo === 'tipoConta' ? (
                  <MenuSuspenso rotulo={j.tiposDeConta.find(t => t.valor === c.valor)?.rotulo || c.valor || 'Escolher'} className={'btn btn-ghost registro-escolha' + (c.valor ? '' : ' vazio')} titulo={c.rotulo} largura={200}
                    itens={j.tiposDeConta.map(t => ({ rotulo: t.rotulo, marcado: t.valor === c.valor, onClick: () => j.mudar(c.id, t.valor) }))} />
                ) : c.tipo === 'imovel' ? (
                  <MenuSuspenso rotulo={j.imoveis.find(t => t.valor === c.valor)?.rotulo || c.valor || 'Escolher'} className={'btn btn-ghost registro-escolha' + (c.valor ? '' : ' vazio')} titulo={c.rotulo} largura={320}
                    itens={j.imoveis.map(t => ({ rotulo: t.rotulo, marcado: t.valor === c.valor, onClick: () => j.mudar(c.id, t.valor) }))} />
                ) : (
                  <input type="text" value={c.valor} inputMode={c.tipo === 'numero' ? 'numeric' : undefined} aria-label={c.rotulo} placeholder="Vazio" autoComplete="off" autoFocus={k === 0}
                    onChange={e => j.mudar(c.id, e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void vm.salvarJanela(); } }} />
                )}
              </Propriedade>
            ))}
          </div>
          {j.variaveis && <p className="registro-dica">{vm.variaveis}</p>}
        </div>
        <footer className="registro-pe">
          {!j.novo && <button type="button" className="btn btn-danger" onClick={() => void vm.removerJanela()}><Icone nome="x" />Remover</button>}
          <span className="tarefas-barra-espaco" />
          <button type="button" className="btn btn-outline" onClick={vm.fecharJanela}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={() => void vm.salvarJanela()} title="Salvar (Ctrl+Enter)">
            <Icone nome={j.novo ? 'plus' : 'check'} />{j.novo ? 'Criar' : 'Salvar'}
          </button>
        </footer>
      </div>
    </div>
  );
}

export function CadastrosLcdpr({ listas }: { listas: readonly lcdpr.ListaDoLcdpr[] }) {
  const vm = useCadastrosLcdpr(listas);
  const sozinha = vm.listas.length === 1 ? vm.listas[0] : null;
  return (
    <>
      <JanelaDoItem vm={vm} />
      {vm.removidos && (
        <Alerta tom="ok" titulo={vm.removidos} onFechar={vm.esquecerRemocoes}>
          <div className="btn-row"><button type="button" className="btn" onClick={() => void vm.desfazerRemocoes()}><Icone nome="girar" />Desfazer</button></div>
        </Alerta>
      )}
      {vm.exemplos && <p className="registro-dica nf-exemplos"><Icone nome="alert" />Dados de exemplo: nada do que mudar aqui vai para o banco.</p>}
      {vm.erro && <p className="registro-dica registro-dica-erro nf-exemplos"><Icone nome="alert" />{vm.erro}</p>}

      {sozinha ? (
        <>
          <div className="tarefas-barra-topo">
            <span className="tarefas-contador"><Icone nome="list" /><b>{sozinha.contagem}</b> {sozinha.rotuloContagem}</span>
            <span className="tarefas-barra-espaco" />
            <Busca l={sozinha} />
            <button type="button" className="btn btn-primary" disabled={!vm.carregada || !!vm.erro} onClick={sozinha.criar}><Icone nome="plus" />{sozinha.novo}</button>
          </div>
          {sozinha.variaveis && <p className="registro-dica nf-exemplos">{vm.variaveis} {sozinha.id === 'ncmRules' ? 'Vale a primeira regra cujo NCM casa: a ordem importa.' : ''}</p>}
          <Tabela l={sozinha} />
        </>
      ) : (
        <div className="cad-grade lcdpr-grade">
          {vm.listas.map(l => (
            <div key={l.id} className="card">
              <div className="card-head">
                <h3>{l.titulo} <span className="badge badge-neutral">{l.contagem}</span></h3>
                <button type="button" className="btn" disabled={!vm.carregada || !!vm.erro} onClick={l.criar}><Icone nome="plus" />{l.novo}</button>
              </div>
              <Tabela l={l} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
