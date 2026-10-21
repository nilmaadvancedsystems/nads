// Cadastro › Configurações › Entradas / Saídas: naturezas de CFOP × contas, com o cartão e as
// linhas de venda à vista/a prazo nas Saídas.
// Origem: conferencia.html #cadCardNfe (~L1165-1169), renderNaturezaDePara (~L2082-2132),
// vendaVistaCard (~L2164), vistaRowCfop (~L2181-2203), "Não vai para o Contábil" (~L2117-2121).
import { BotaoFechar, Icone, Interruptor, useJanela, Vazio } from '@nads/ui';
import { useEffect, useRef, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { ItemNatureza, NotaDaNatureza, SlotVista, useConfiguracoes } from '../useConfiguracoes';
import { CampoVincular, ChipsDeContas } from './VincularConta';

type VM = ReturnType<typeof useConfiguracoes>;
type Naturezas = NonNullable<VM['naturezas']>;

export function Naturezas({ n, entradas, vm }: { n: Naturezas; entradas: boolean; vm: VM }) {
  const comNotas = n.itens.find(it => it.notas);
  return (
    <div className="card" id="cadCardNfe">
      <h3 id="cadTitulo">{n.titulo}</h3>
      <div id={entradas ? 'ndpBoxEnt' : 'ndpBoxSai'}>
        {n.falta ? <Vazio compacto icone="alert" texto={n.falta} /> : (
          <>
            {n.cartaoVista && (
              <div className="vista-card">
                <div className="vista-head" style={{ alignItems: 'center' }}>
                  <div>
                    <p className="vista-tit">Separar vendas à vista e a prazo</p>
                    {/* o que o liga/desliga faz (Vitor, 13/10/2026: "pouco intuitivo") */}
                    <p className="hint" style={{ margin: '4px 0 0' }}>
                      {n.cartaoVista.ativo
                        ? 'Ligado: cada venda tem dois códigos de lançamento, à vista (consumidor, CPF) e a prazo (empresa, CNPJ).'
                        : 'Desligado: todas as vendas usam um só lançamento. Ligue para separar à vista (CPF) e a prazo (CNPJ).'}
                    </p>
                  </div>
                  <Interruptor ligado={n.cartaoVista.ativo} onMudar={vm.alternarVista} rotulo="Separar vendas à vista e a prazo" />
                </div>
                {n.cartaoVista.semDoc && (
                  <p className="hint" style={{ margin: '8px 0 0', color: 'var(--danger)' }}>As saídas guardadas não têm a coluna CPF/CNPJ. Reimporte as saídas (Importar apenas novas) pro sistema reconhecer as vendas no CPF.</p>
                )}
              </div>
            )}
            {!n.itens.length ? <Vazio compacto icone="search" texto={n.vazio} /> : (
              <div className="ndp-list">
                {n.itens.map(it => <Natureza key={it.k} it={it} vm={vm} />)}
              </div>
            )}
            {comNotas?.notas && <JanelaDasNotas it={comNotas} notas={comNotas.notas} fechar={vm.fecharNotas} />}
          </>
        )}
      </div>
    </div>
  );
}

/** O nome de cada linha da natureza (Conta contábil, Lançamento): a coluna da esquerda. */
const ROTULO: CSSProperties = { width: 150, flex: 'none', fontSize: 13, color: 'var(--ink-muted)' };
const LINHA: CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 8 };

function Natureza({ it, vm }: { it: ItemNatureza; vm: VM }) {
  return (
    <div className={'ndp-item' + (it.nao ? ' ndp-nao-contabil' : '')}>
      {/* o total do CFOP no canto direito, maior e em negrito (Vitor, 14/10/2026) */}
      <div className="ndp-natureza ndp-natureza-row">
        <span>{it.titulo}{it.semConta && <span className="ponto-vermelho" title="Falta a conta contábil: vincule uma conta ou marque Não vai para o Contábil" aria-label="Falta a conta contábil" />}</span>
        {/* embaixo do total, o "Ver notas" (Vitor, 21/10/2026): abre as notas deste CFOP logo abaixo */}
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span className="num" style={{ fontSize: 18, fontWeight: 700, whiteSpace: 'nowrap' }} title="O total das notas deste CFOP">{it.total}</span>
          <button type="button" className="btn" onClick={() => vm.verNotas(it.k)}>Ver notas ({it.qtdNotas})</button>
        </span>
      </div>
      {/* a conta contábil (a que a conferência compara com o balancete) e, com as vendas separadas, o código do lançamento
          à vista e a prazo — cada um com o nome na frente, para não confundir um com o outro (Vitor, 13/10/2026) */}
      <div style={LINHA}>
        <span style={ROTULO}>Conta contábil{it.semConta && <b className="ext-neg" style={{ marginLeft: 6, fontWeight: 600 }}>falta</b>}</span>
      {/* ocupa o resto da linha: o campo de busca aberto cresce e a lista das contas cabe (Vitor, 14/10/2026: "Bugado",
          a lista abria da largura do campo, com o nome espremido e o Vincular cortado) */}
      <div className="ndp-contas-row" style={{ flex: '1 1 320px', minWidth: 0 }}>
        <ChipsDeContas v={it.vinculo} />
        {it.nao ? (
          <span className="vista-pill">
            <span className="vista-pill-txt" style={{ cursor: 'default' }}>Não vai para o Contábil</span>
            <button type="button" className="vista-pill-x" title="Desfazer" aria-label="Desfazer" onClick={() => vm.naoContabil(it.k, false)}>&times;</button>
          </span>
        ) : (
          <CampoVincular v={it.vinculo} rotulo="Vincular conta" titulo="Vincular a conta contábil desta natureza (a que a conferência compara com o balancete)"
            extra={escondido => it.podeNaoContabil
              ? <button type="button" className="btn ndp-nao-btn" hidden={escondido} onClick={() => vm.naoContabil(it.k, true)}>Não vai para o Contábil</button>
              : null} />
        )}
      </div>
      </div>
      {it.vista && (
        <div style={LINHA}>
          <span style={ROTULO}>Código do lançamento</span>
          <div className="vista-row" style={{ margin: 0 }}>
            {it.vista.slots.map(sl => <Slot key={sl.t} k={it.k} sl={sl} vm={vm} />)}
            <span className="vista-info">{it.vista.info}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/** As notas do CFOP numa janela por cima da tela (Vitor, 21/10/2026: "abra em popup"), na tabela da Consulta; o Esc fecha. */
function JanelaDasNotas({ it, notas, fechar }: { it: ItemNatureza; notas: NotaDaNatureza[]; fechar: () => void }) {
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, fechar);
  return createPortal(
    <div className="modal-overlay pessoal-fundo" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div ref={janela} className="pessoal-janela" role="dialog" aria-modal="true" aria-label={'Notas de ' + it.titulo}
        style={{ flexDirection: 'column', width: 'min(960px, 96vw)', height: 'auto', maxHeight: '88vh' }}>
        <header className="pessoal-topo">
          <h2>{it.titulo}</h2>
          <span className="num" style={{ marginLeft: 'auto', fontWeight: 700, whiteSpace: 'nowrap' }}>{notas.length} {notas.length === 1 ? 'nota' : 'notas'} · {it.total}</span>
          <BotaoFechar onClick={fechar} />
        </header>
        <div style={{ overflow: 'auto', padding: 16 }}>
          <TabelaDasNotas notas={notas} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** As notas do CFOP, na tabela da Consulta. */
function TabelaDasNotas({ notas }: { notas: NotaDaNatureza[] }) {
  return (
    <div className="table-wrap">
      <table className="cons-tabela">
        <thead>
          <tr><th>Data</th><th>Nota</th><th>Participante</th><th>CFOP</th><th>Lançamento</th><th className="num">Valor (R$)</th></tr>
        </thead>
        <tbody>
          {notas.map((n, i) => (
            <tr key={i}>
              <td className="cons-data">{n.data}</td>
              <td className="cons-mut">{n.numero}</td>
              <td className="cons-nome" title={n.nome}>{n.nome}</td>
              <td className="cons-mut">{n.cfop}</td>
              <td className="cons-mut">{n.lanc || '—'}</td>
              <td className="num cons-valor">{n.valor}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
