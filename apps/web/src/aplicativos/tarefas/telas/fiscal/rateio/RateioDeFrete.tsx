// Fiscal › Rateio de frete (Heverton, 22/10/2026: a planilha "RATEIO - FRETE"): em cima, Da nota ou Digitar, a empresa,
// a competência, Entradas ou Saídas e a nota; o cartão com a nota, o total dos produtos, o frete e o desconto (editáveis);
// a tabela do rateio (tributação, valor, %, frete, desconto e base, com os totais) e, clicando numa linha, o frete dela
// pelos NCMs. Só as peças do catálogo (Segmentado, Seleção, MenuSuspenso, Campo de texto, Cartão, Tabela padrão, Linhas
// especiais, Alerta, Vazio, Esqueleto, Dados em linhas, Botão).
import { Alerta, Esqueleto, Icone, MenuSuspenso, Segmentado, useCarregando, Vazio } from '@nads/ui';
import { useRateioDeFrete, type VmRateioDeFrete } from './useRateioDeFrete';

const brl = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + '%';

export function RateioDeFrete() {
  const vm = useRateioDeFrete();
  useCarregando(vm.carregando);
  const daNota = vm.fonte === 'nota';
  return (
    <section className="rateio-frete">
      <div className="tarefas-barra-topo">
        <Segmentado valor={vm.fonte} onMudar={vm.setFonte} opcoes={[{ valor: 'nota', rotulo: 'Da nota (SIEG)' }, { valor: 'manual', rotulo: 'Digitar' }]} />
        {daNota && (
          <>
            <select className="select-compact" value={vm.codigo} onChange={e => vm.setCodigo(e.target.value)} aria-label="Empresa">
              <option value="">Escolha a empresa</option>
              {vm.empresas.map(e => <option key={e.codigo} value={e.codigo}>{e.codigo} · {e.nome}</option>)}
            </select>
            <MenuSuspenso icone="calendar" rotulo={vm.rotuloCompetencia} titulo="Competência" dica="Trocar a competência"
              itens={vm.competencias.map(c => ({ rotulo: c.rotulo, marcado: c.valor === vm.competencia, onClick: () => vm.setCompetencia(c.valor) }))} />
            <Segmentado valor={vm.lado} onMudar={vm.setLado} opcoes={[{ valor: 'recebidas', rotulo: 'Entradas' }, { valor: 'emitidas', rotulo: 'Saídas' }]} />
          </>
        )}
      </div>
      {vm.exemplos && daNota && <p className="hint drive-aviso">Dados de exemplo: a NF-e T502 das entradas tem os números da planilha (600 tributado, 400 com ST e 500 de frete).</p>}

      {daNota && !vm.codigo ? (
        <Vazio icone="caminhao" titulo="Escolha a empresa" texto="Depois a competência, Entradas ou Saídas e a nota: o total dos produtos, o frete e o desconto vêm do XML do SIEG. Sem XML, use Digitar." />
      ) : daNota && vm.carregando ? <Esqueleto linhas={6} /> : daNota && (vm.semXml || !vm.notas.length) ? (
        <Vazio icone="recibo" titulo="Nenhuma NF-e com itens"
          texto={vm.semXml ? 'Os XMLs de ' + vm.rotuloCompetencia + ' ainda não foram baixados do SIEG para esta empresa (o "Baixar XMLs do SIEG" na rotina do Fiscal). Ou use Digitar.' : 'Nenhuma NF-e ' + (vm.lado === 'recebidas' ? 'de entrada' : 'de saída') + ' com itens em ' + vm.rotuloCompetencia + '.'}>
          <button type="button" className="btn btn-outline" onClick={() => vm.setFonte('manual')}>Digitar os valores</button>
        </Vazio>
      ) : (
        <>
          <section className="card">
            <h3>{daNota ? (vm.nota ? vm.nota.titulo : 'A nota') : 'Os valores'}</h3>
            <div className="rateio-frete-cabeca">
              {daNota && (
                <div className="field rateio-frete-nota">
                  <label htmlFor="rateio-nota">Nota ({vm.notas.length})</label>
                  <select id="rateio-nota" value={vm.chave} onChange={e => vm.setChave(e.target.value)}>
                    <option value="">Escolha a nota</option>
                    {vm.notas.map(n => <option key={n.chave} value={n.chave}>{n.rotulo}{n.comFrete ? ' · com frete' : ''}</option>)}
                  </select>
                </div>
              )}
              {vm.nota && (
                <dl className="ent-dados">
                  <div><dt>Data</dt><dd>{vm.nota.data}</dd></div>
                  <div><dt>Emitente</dt><dd>{vm.nota.emitente}</dd></div>
                  <div><dt>Destinatário</dt><dd>{vm.nota.destinatario}</dd></div>
                  <div><dt>Valor da nota</dt><dd className="num">R$ {brl(vm.nota.valor)} · {vm.nota.itens} {vm.nota.itens === 1 ? 'item' : 'itens'}</dd></div>
                </dl>
              )}
              {(!daNota || vm.nota) && (
                <div className="rateio-frete-campos">
                  <div className="field"><label htmlFor="rateio-total">Total dos produtos</label><input id="rateio-total" type="text" inputMode="decimal" className="num" value={vm.total} onChange={e => vm.setTotal(e.target.value)} placeholder={daNota ? '' : 'A soma das linhas'} /></div>
                  <div className="field"><label htmlFor="rateio-frete">Valor do frete</label><input id="rateio-frete" type="text" inputMode="decimal" className="num" value={vm.frete} onChange={e => vm.setFrete(e.target.value)} placeholder="0,00" /></div>
                  <div className="field"><label htmlFor="rateio-desconto">Desconto</label><input id="rateio-desconto" type="text" inputMode="decimal" className="num" value={vm.desconto} onChange={e => vm.setDesconto(e.target.value)} placeholder="0,00" /></div>
                  {daNota && vm.mudouValores && <button type="button" className="btn btn-ghost" onClick={vm.voltarValores}>Voltar aos da nota</button>}
                </div>
              )}
            </div>
          </section>

          {vm.avisos.map(a => <Alerta key={a} naLinha titulo="Confira" texto={a} />)}

          {!daNota && <Digitar vm={vm} />}

          {daNota && !vm.nota ? null : !vm.linhas.length ? (
            !daNota ? null : <Vazio compacto texto="A nota não tem itens com valor." />
          ) : (
            <section className="card">
              <div className="card-head">
                <h3>Rateio</h3>
                {daNota && <Segmentado valor={vm.agrupar} onMudar={vm.setAgrupar} opcoes={[{ valor: 'tributacao', rotulo: 'Por tributação' }, { valor: 'cfop', rotulo: 'Por CFOP' }]} />}
              </div>
              <TabelaDoRateio vm={vm} />
              {daNota && <p className="hint rateio-frete-dica">Clique numa linha para ver o frete dela pelos NCMs.</p>}
            </section>
          )}

          {vm.ncms && (
            <section className="card">
              <h3>{vm.grupoAberto} · pelos NCMs</h3>
              <div className="table-wrap">
                <table className="table-compact">
                  <thead><tr><th>NCM</th><th className="num">Valor</th><th className="num">IPI</th><th className="num">%</th><th className="num">Frete</th><th className="num">Desconto</th><th className="num">Base de cálculo</th></tr></thead>
                  <tbody>
                    {vm.ncms.linhas.map(l => (
                      <tr key={l.rotulo}>
                        <td><b>{l.rotulo}</b></td><td className="num">{brl(l.valor)}</td><td className="num">{brl(l.ipi)}</td><td className="num">{pct(l.pct)}</td>
                        <td className="num">{brl(l.frete)}</td><td className="num">{brl(l.desconto)}</td><td className="num"><b>{brl(l.base)}</b></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr><td><b>Total</b></td><td className="num"><b>{brl(vm.ncms.soma.valor)}</b></td><td className="num"><b>{brl(vm.ncms.soma.ipi)}</b></td><td className="num"><b>{pct(vm.ncms.soma.pct)}</b></td>
                      <td className="num"><b>{brl(vm.ncms.soma.frete)}</b></td><td className="num"><b>{brl(vm.ncms.soma.desconto)}</b></td><td className="num"><b>{brl(vm.ncms.soma.base)}</b></td></tr>
                  </tfoot>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </section>
  );
}

function TabelaDoRateio({ vm }: { vm: VmRateioDeFrete }) {
  const r = vm.rateio;
  const daNota = vm.fonte === 'nota';
  return (
    <div className="table-wrap">
      <table className="table-compact">
        <thead>
          <tr><th>{daNota && vm.agrupar === 'cfop' ? 'CFOP' : 'Tributação'}</th><th className="num">Valor</th><th className="num">IPI</th><th className="num">%</th><th className="num">Frete</th><th className="num">Desconto</th><th className="num">Base de cálculo</th></tr>
        </thead>
        <tbody>
          {vm.linhas.map(l => (
            <tr key={l.id} className={daNota && vm.aberto === l.id ? 'linha-atual' : undefined} onClick={daNota ? () => vm.abrir(l.id) : undefined} style={daNota ? { cursor: 'pointer' } : undefined}>
              <td>{daNota && <Icone nome="chevronRight" width={14} height={14} />} <b>{l.rotulo}</b>{l.detalhe && <span className="fraco"> · {l.detalhe}</span>}</td>
              <td className="num">{brl(l.valor)}</td><td className="num">{brl(l.ipi)}</td><td className="num">{pct(l.pct)}</td>
              <td className="num">{brl(l.frete)}</td><td className="num">{brl(l.desconto)}</td><td className="num"><b>{brl(l.base)}</b></td>
            </tr>
          ))}
          {r.foraDaLista && (
            <tr className="fraco">
              <td>Fora da lista (o total menos as linhas)</td><td className="num">{brl(r.foraDaLista.valor)}</td><td className="num" /><td className="num">{pct((r.foraDaLista.valor * 100) / r.total)}</td>
              <td className="num">{brl(r.foraDaLista.frete)}</td><td className="num">{brl(r.foraDaLista.desconto)}</td><td className="num" />
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr>
            <td><b>Total</b></td><td className="num"><b>{brl(r.total)}</b></td><td className="num"><b>{brl(r.soma.ipi)}</b></td><td className="num"><b>{pct(r.foraDaLista ? 100 : r.soma.pct)}</b></td>
            <td className="num"><b>{brl(r.frete)}</b></td><td className="num"><b>{brl(r.desconto)}</b></td><td className="num"><b>{brl(r.soma.base)}</b></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function Digitar({ vm }: { vm: VmRateioDeFrete }) {
  return (
    <section className="card">
      <h3>As tributações</h3>
      <div className="table-wrap">
        <table className="table-compact">
          <thead><tr><th>Tributação (ou CFOP, NCM)</th><th className="num">Valor</th><th className="num">IPI</th><th /></tr></thead>
          <tbody>
            {vm.digitadas.map((l, i) => (
              <tr key={i}>
                <td><input type="text" aria-label={'Tributação da linha ' + (i + 1)} placeholder={i === 0 ? 'Ex.: 2102' : 'Ex.: 2403'} value={l.rotulo} onChange={e => vm.mudarDigitada(i, 'rotulo', e.target.value)} /></td>
                <td className="num"><input type="text" inputMode="decimal" className="num" aria-label={'Valor da linha ' + (i + 1)} placeholder="0,00" value={l.valor} onChange={e => vm.mudarDigitada(i, 'valor', e.target.value)} /></td>
                <td className="num"><input type="text" inputMode="decimal" className="num" aria-label={'IPI da linha ' + (i + 1)} placeholder="0,00" value={l.ipi} onChange={e => vm.mudarDigitada(i, 'ipi', e.target.value)} /></td>
                <td><button type="button" className="icon-btn" title="Tirar a linha" aria-label={'Tirar a linha ' + (i + 1)} onClick={() => vm.tirarLinha(i)}><Icone nome="x" width={16} height={16} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rateio-frete-acoes"><button type="button" className="btn btn-outline" onClick={vm.novaLinha}><Icone nome="plus" width={16} height={16} />Nova linha</button></div>
    </section>
  );
}
