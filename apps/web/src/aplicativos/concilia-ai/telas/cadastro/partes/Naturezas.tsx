// Cadastro › Configurações › Entradas / Saídas: naturezas de CFOP × contas, com o cartão e as
// linhas de venda à vista/a prazo nas Saídas.
// Origem: conferencia.html #cadCardNfe (~L1165-1169), renderNaturezaDePara (~L2082-2132),
// vendaVistaCard (~L2164), vistaRowCfop (~L2181-2203), "Não vai para o Contábil" (~L2117-2121).
import { Icone, Interruptor } from '@nads/ui';
import { useEffect, useRef } from 'react';
import type { ItemNatureza, SlotVista, useConfiguracoes } from '../useConfiguracoes';
import { CampoVincular, ChipsDeContas } from './VincularConta';

type VM = ReturnType<typeof useConfiguracoes>;
type Naturezas = NonNullable<VM['naturezas']>;

export function Naturezas({ n, entradas, vm }: { n: Naturezas; entradas: boolean; vm: VM }) {
  return (
    <div className="card" id="cadCardNfe">
      <h3 id="cadTitulo">{n.titulo}</h3>
      <div id={entradas ? 'ndpBoxEnt' : 'ndpBoxSai'}>
        {n.falta ? <p className="empty">{n.falta}</p> : (
          <>
            {n.cartaoVista && (
              <div className="vista-card">
                <div className="vista-head" style={{ alignItems: 'center' }}>
                  <p className="vista-tit">{n.cartaoVista.titulo}</p>
                  <Interruptor ligado={n.cartaoVista.ativo} onMudar={vm.alternarVista} rotulo="Vendas à vista e à prazo" />
                </div>
                {n.cartaoVista.semDoc && (
                  <p className="hint" style={{ margin: '8px 0 0', color: 'var(--danger)' }}>As saídas guardadas não têm a coluna CPF/CNPJ. Reimporte as saídas (Importar apenas novas) pro sistema reconhecer as vendas no CPF.</p>
                )}
              </div>
            )}
            {!n.itens.length ? <p className="empty">{n.vazio}</p> : (
              <div className="ndp-list">
                {n.itens.map(it => <Natureza key={it.k} it={it} vm={vm} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Natureza({ it, vm }: { it: ItemNatureza; vm: VM }) {
  return (
    <div className={'ndp-item' + (it.nao ? ' ndp-nao-contabil' : '')}>
      <div className="ndp-natureza">{it.titulo}</div>
      {it.vista && (
        <div className="vista-row">
          {it.vista.slots.map(sl => <Slot key={sl.t} k={it.k} sl={sl} vm={vm} />)}
          <span className="vista-info">{it.vista.info}</span>
        </div>
      )}
      <div className="ndp-contas-row">
        <ChipsDeContas v={it.vinculo} />
        {it.nao ? (
          <span className="vista-pill">
            <span className="vista-pill-txt" style={{ cursor: 'default' }}>Não vai para o Contábil</span>
            <button type="button" className="vista-pill-x" title="Desfazer" aria-label="Desfazer" onClick={() => vm.naoContabil(it.k, false)}>&times;</button>
          </span>
        ) : (
          <CampoVincular v={it.vinculo} rotulo="Adicionar" titulo="Vincular uma conta a esta natureza"
            extra={escondido => it.podeNaoContabil
              ? <button type="button" className="btn ndp-nao-btn" hidden={escondido} onClick={() => vm.naoContabil(it.k, true)}>Não vai para o Contábil</button>
              : null} />
        )}
      </div>
    </div>
  );
}

function Slot({ k, sl, vm }: { k: string; sl: SlotVista; vm: VM }) {
  if (sl.editando) {
    return (
      <span className="vista-edit">
        <CampoVista sl={sl} vm={vm} />
        <button type="button" className="icon-btn icon-btn-sm" title="Salvar (Enter)" aria-label="Salvar" onClick={vm.vista.salvarVista}><Icone nome="check" /></button>
        <button type="button" className="icon-btn icon-btn-sm" title="Cancelar (Esc)" aria-label="Cancelar" onClick={vm.vista.cancelarVista}><Icone nome="x" /></button>
      </span>
    );
  }
  if (sl.valor) {
    return (
      <span className="vista-pill">
        <button type="button" className="vista-pill-txt" title="Alterar" onClick={() => vm.vista.editarVista(k, sl.t)}>{sl.rot} <b>{sl.valorMostrado}</b></button>
        <button type="button" className="vista-pill-x" title="Remover" aria-label="Remover" onClick={() => vm.vista.removerVista(k, sl.t)}>&times;</button>
      </span>
    );
  }
  return <BotaoFalta sl={sl} onClick={() => vm.vista.editarVista(k, sl.t)} />;
}

/** "+ Lançamento …" — o primeiro que falta ganha foco depois do aviso "Preencha os lançamentos". */
function BotaoFalta({ sl, onClick }: { sl: SlotVista; onClick: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!sl.focarAgora || !ref.current) return;
    ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    ref.current.focus();
  }, [sl.focarAgora]);
  return <button ref={ref} type="button" className={'vista-add' + (sl.falta ? ' vista-falta' : '')} onClick={onClick}><Icone nome="plus" />{sl.rot}</button>;
}

function CampoVista({ sl, vm }: { sl: SlotVista; vm: VM }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  return (
    <input ref={ref} type="text" className="vista-inp" inputMode="numeric" maxLength={6} placeholder={sl.sugestao} aria-label={sl.rot}
      value={vm.vista.textoEdit} onChange={ev => vm.vista.digitarVista(ev.target.value)}
      onKeyDown={ev => { if (ev.key === 'Enter') ev.preventDefault(); vm.vista.teclaVista(ev.key); }} />
  );
}
