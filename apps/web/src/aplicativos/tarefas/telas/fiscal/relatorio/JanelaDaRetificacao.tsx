// A janela da retificação do Relatório do Fiscal (16/11/2026: "um botão parecido com o do 13º salário do DP"; escolhido o
// quadro de retificação do protocolo; 17/11/2026: "queria que fosse uma opção [que] abra uma tela flutuante que possa ser
// colocado o valor"): o botão Retificação no topo da tabela abre esta janela, e ligar o Retif. de uma empresa também (com a
// linha dela em destaque). Uma linha por retificação (as empresas com o Retif. ligado e as que entram pelo + Retificação),
// com a referência (o mês retificado), as guias em R$, as conferências, a entrega e a situação; a lixeira tira a linha. O
// Excel leva o quadro; a impressora da barra imprime o protocolo com ele. Os dados e as ações vêm do useRelatorioGeral
// (vm.retificacao).
import { tarefas as t } from '@nads/core';
import { baixarBytes, Icone, LogoExcel, useJanela } from '@nads/ui';
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { useColunasAjustaveis } from '../../../../../comum/ColunasAjustaveis';
import { Bolinha, Entrega, Valor } from './PartesDoRelatorio';
import type { RegimeDoRelatorio, VmRelatorio } from './useRelatorioGeral';

export function JanelaDaRetificacao({ vm, regime }: { vm: VmRelatorio; regime: RegimeDoRelatorio }) {
  const r = vm.retificacao;
  const g = vm.grupo;
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, r.fechar);
  const [empresa, setEmpresa] = useState('');
  const [referencia, setReferencia] = useState('');
  const col = useColunasAjustaveis('fiscal-ret-' + g.id, [
    { id: 'cod', padrao: 44 }, { id: 'cliente', padrao: 200 }, { id: 'ref', padrao: 78 },
    ...vm.guias.map(c => ({ id: c.id, padrao: 74 })), ...g.marcas.map(m => ({ id: m.id, padrao: 32 })),
    { id: 'ent', padrao: 68 }, { id: 'sit', padrao: 36 }, ...(vm.podeGravar ? [{ id: 'tirar', padrao: 40 }] : []),
  ], 'cliente');
  const feitas = r.linhas.length - r.faltam;
  const listaId = 'fr-ret-empresas-' + g.id;
  // a empresa que acabou de ser ligada: o cursor já no primeiro valor dela
  useEffect(() => {
    if (r.destaque == null || !janela.current) return;
    const campo = janela.current.querySelector<HTMLInputElement>('tr.fr-ret-destaque td.fr-ret-primeiro input');
    if (campo) { campo.scrollIntoView({ block: 'nearest' }); campo.focus(); }
  }, [r.destaque]);
  function adicionar(e: FormEvent) {
    e.preventDefault();
    if (r.adicionar(empresa, referencia)) { setEmpresa(''); setReferencia(''); }
  }
  const competencia = vm.competencias.find(c => c.valor === vm.competencia)?.rotulo ?? vm.competencia;
  return (
    // data-entrada-propria (17/11/2026: "tá travando muito para abrir"): a janela larga não cresce do botão nem traz as
    // linhas em cascata; aparece de uma vez, só o fundo escurece
    <div className="modal-overlay" data-entrada-propria="" onMouseDown={ev => { if (ev.target === ev.currentTarget) r.fechar(); }}>
      <div ref={janela} className={'modal fr-ret-janela fr-regime-' + regime} role="dialog" aria-modal="true" aria-labelledby="frRetTitulo">
        <div className="fr-ret-cabeca">
          <h3 id="frRetTitulo"><Icone nome="fileText" width={16} height={16} />Retificação · {g.rotulo} · {competencia}</h3>
          <span className="fr-andamento-txt hint">{!r.linhas.length ? 'Nenhuma retificação' : r.faltam ? <><b>{feitas}</b> de {r.linhas.length} entregues · {r.faltam} {r.faltam === 1 ? 'falta' : 'faltam'}</> : <b>Tudo entregue</b>}</span>
          <span className="tarefas-barra-espaco" />
          <button type="button" className="icon-btn" title="Exportar o quadro para o Excel" aria-label="Exportar o quadro de retificação para o Excel" disabled={!r.linhas.length}
            onClick={() => { const x = r.exportar(); baixarBytes(x.bytes, x.nome, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); }}>
            <LogoExcel />
          </button>
          <button type="button" className="icon-btn" onClick={r.fechar} title="Fechar" aria-label="Fechar a janela da retificação"><Icone nome="x" /></button>
        </div>
        {vm.podeGravar && (
          <form className="fr-ret-novo" onSubmit={adicionar}>
            <input type="text" list={listaId} value={empresa} onChange={e => setEmpresa(e.target.value)} placeholder="Empresa (código ou nome)" aria-label="Empresa da retificação" className="fr-ret-empresa" autoFocus={r.destaque == null} />
            <datalist id={listaId}>{r.empresas.map(x => <option key={x} value={x} />)}</datalist>
            <input type="text" value={referencia} onChange={e => setReferencia(e.target.value)} placeholder={r.referenciaPadrao} aria-label="Referência: o mês retificado (mm/aaaa)" title="O mês retificado (mm/aaaa); vazio, o da competência" className="fr-ret-ref num" />
            <button type="submit" className="btn btn-sm btn-outline" disabled={!r.cabe || !empresa.trim()} title={r.cabe ? 'Pôr a empresa no quadro de retificação' : 'O quadro já está cheio'}>
              <Icone nome="plus" />Retificação
            </button>
          </form>
        )}
        {!r.linhas.length ? <p className="hint dp-vazio">Nenhuma retificação neste mês: ligue o Retif. da empresa na tabela{vm.podeGravar ? ' ou use o + Retificação' : ''}.</p> : (
          <div className="fr-rola fr-ret-rola">
            <table className={'fr-tabela fr-ret fr-grupo-' + g.id} style={{ ...col.tabela, '--fr-cod': col.largura('cod') + 'px' } as CSSProperties}>
              <colgroup>
                <col className="fr-c-cod" style={col.col('cod')} /><col className="fr-c-cliente" style={col.col('cliente')} /><col className="fr-c-ref" style={col.col('ref')} />
                {vm.guias.map(c => <col key={c.id} className="fr-c-guia" style={col.col(c.id)} />)}
                {g.marcas.map(m => <col key={m.id} className="fr-c-mk" style={col.col(m.id)} />)}
                <col className="fr-c-ent" style={col.col('ent')} /><col className="fr-c-sit" style={col.col('sit')} />
                {vm.podeGravar && <col className="fr-c-tirar" style={col.col('tirar')} />}
              </colgroup>
              <thead>
                <tr className="fr-grupos">
                  <th rowSpan={2} className="fr-num fr-cabeca">Cód.{col.alca('cod')}</th><th rowSpan={2} className="fr-cabeca">Cliente{col.alca('cliente')}</th>
                  <th rowSpan={2} className="fr-centro fr-cabeca" title="O mês retificado">Referência{col.alca('ref')}</th>
                  <th colSpan={vm.guias.length} className="fr-g fr-centro">Guias (R$)</th>
                  <th colSpan={g.marcas.length} className="fr-g fr-centro">Conferências</th>
                  <th colSpan={2} className="fr-g fr-centro">Entrega</th>
                  {vm.podeGravar && <th rowSpan={2} className="fr-g fr-cabeca"><span className="sr-only">Tirar</span></th>}
                </tr>
                <tr>
                  {vm.guias.map((c, i) => <th key={c.id} className={'fr-num' + (i === 0 ? ' fr-g' : '')} title={c.nome}>{c.rotulo}{col.alca(c.id)}</th>)}
                  {g.marcas.map((m, i) => <th key={m.id} className={'fr-centro' + (i === 0 ? ' fr-g' : '')} title={m.dica}>{m.rotulo}{col.alca(m.id)}</th>)}
                  <th className="fr-centro fr-g">Entregue{col.alca('ent')}</th><th className="fr-centro" title="Situação">Sit.{col.alca('sit')}</th>
                </tr>
              </thead>
              <tbody>
                {r.linhas.map(l => {
                  const x = l.retificacao;
                  const de = l.nome + ' (' + (x.referencia || 'sem referência') + ')';
                  const classe = [l.situacao === 'concluida' ? 'fr-feita' : '', l.codigo != null && l.codigo === r.destaque ? 'fr-ret-destaque' : ''].filter(Boolean).join(' ');
                  return (
                    <tr key={l.chave} className={classe || undefined}>
                      <td className="fr-num fr-cod">{l.codigo ?? ''}</td>
                      <td className="fr-cliente"><span title={l.nome + (l.ligada ? ' · Retif. ligado na tabela' : '')}>{l.nome}</span></td>
                      <td className="fr-centro">
                        <Valor estreito valor={x.referencia} molde="mm/aaaa" rotulo={'Referência da retificação de ' + l.nome} pode={vm.podeGravar} aoSalvar={v => r.mudarReferencia(l.chave, v)} />
                      </td>
                      {vm.guias.map((c, i) => (
                        <td key={c.id} className={i === 0 ? 'fr-g fr-ret-primeiro' : undefined}>
                          <Valor estreito zeroComoTraco valor={x.valores[c.id] || ''} rotulo={c.nome + ' da retificação de ' + de} pode={vm.podeGravar} aoSalvar={v => r.mudarValor(l.chave, c.id, v)} />
                        </td>
                      ))}
                      {g.marcas.map((m, i) => {
                        const mk = x.marcas[m.id] || '';
                        return (
                          <td key={m.id} className={'fr-centro' + (i === 0 ? ' fr-g' : '')}>
                            <Bolinha estado={mk === 'ok' ? 'feita' : mk === 'na' ? 'nao-tem' : 'a-fazer'} pode={vm.podeGravar} clicar={() => r.virarMarca(l.chave, m.id)}
                              dica={m.dica + ' da retificação de ' + de + ': ' + (mk === 'ok' ? 'conferido' : mk === 'na' ? 'não se aplica' : 'falta') + ' (clique: OK → não se aplica → em branco)'} />
                          </td>
                        );
                      })}
                      <td className="fr-g fr-centro"><Entrega valor={x.entregue} pode={vm.podeGravar} rotulo={'Entrega da retificação de ' + de} aoMudar={(e: t.EntregaDoControle) => r.mudarEntrega(l.chave, e)} /></td>
                      <td className="fr-centro"><span className={'fr-sit ' + l.situacao} title={l.rotuloSituacao} aria-label={l.rotuloSituacao}>{l.situacao === 'concluida' && <Icone nome="check" width={11} height={11} />}</span></td>
                      {vm.podeGravar && (
                        <td className="fr-g fr-centro">
                          <button type="button" className="icon-btn fr-ret-tirar" onClick={() => r.remover(l.chave)}
                            title={'Tirar a retificação de ' + de + ' do quadro' + (l.ligada ? ' (desliga o Retif. da empresa)' : '')} aria-label={'Tirar a retificação de ' + de}>
                            <Icone nome="lixeira" width={14} height={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="modal-actions">
          <span className="hint fr-ret-dica">Os valores ficam guardados ao sair do campo; a impressora da barra imprime o protocolo com este quadro.</span>
          <button type="button" className="btn btn-primary" onClick={r.fechar}>Pronto</button>
        </div>
      </div>
    </div>
  );
}
