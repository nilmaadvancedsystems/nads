// A parte Impostos do Faturamento e impostos da Área do Cliente (23/11/2026; o dono: "a planilha da defis so que em dados
// para o cliente"; "impostos entram dentro do faturamento"; "consegue melhorar isso?"): os números do ano, o quadro mês
// a mês (o faturamento, a folha e cada imposto das guias, com as células vazias apagadas, o total em destaque e o mês em andamento) e a planilha. Só desenha.
import { LogoExcel } from '@nads/ui';
import { Vazio } from '../partes/Vazio';
import { useImpostos } from './useImpostos';
import type { DaCasca } from './useAreaCliente';

const Valor = ({ v, forte }: { v: string | null; forte?: boolean }) => (v ? (forte ? <b>{v}</b> : <>{v}</>) : <span className="cli-imp-vazio" aria-label="sem valor">·</span>);

export function ImpostosDoAno(props: DaCasca) {
  const vm = useImpostos(props);
  return (
    <>
      <div className="cli-impostos-topo">
        <span className="chip-row" role="radiogroup" aria-label="Ano" style={{ margin: 0 }}>
          {vm.anos.map(a => <button key={a} type="button" role="radio" aria-checked={a === vm.ano} className={'chip-f' + (a === vm.ano ? ' on' : '')} onClick={() => vm.setAno(a)}>{a}</button>)}
        </span>
        <span className="cli-imp-espaco" />
        {vm.temDado && <button type="button" className="btn cli-botao-excel" onClick={vm.baixar}><LogoExcel />Baixar impostos do ano</button>}
      </div>
      {!vm.temDado ? <section className="card"><Vazio icone="recibo" titulo={'Nada de ' + vm.ano + ' ainda'} texto="Quando o escritório mandar as guias, a folha e as notas do ano, o quadro aparece aqui." /></section> : (
        <>
          <div className="cli-numeros cli-numeros-fat cli-imp-numeros">
            <div className="cli-numero cli-numero-principal"><span className="cli-sobre">Impostos das guias no ano</span><span className="cli-numero-valor menor">{vm.numeros.impostos}</span><span className="hint"><b>{vm.numeros.porcento}</b> do faturamento</span></div>
            <div className="cli-numero"><span className="cli-sobre">Faturamento no ano</span><span className="cli-numero-valor menor">{vm.numeros.faturamento}</span><span className="hint">pelas notas emitidas</span></div>
            <div className="cli-numero"><span className="cli-sobre">Folha no ano</span><span className="cli-numero-valor menor">{vm.numeros.folha}</span><span className="hint">a base do FGTS</span></div>
          </div>

          <section className="card">
            <div className="card-head"><h3>Mês a mês</h3><span className="hint cli-imp-aviso">O valor das guias que o escritório emitiu (pela competência), não o que foi pago.{vm.variasEmpresas ? ' As empresas deste acesso somadas.' : ''}</span></div>
            {/* no celular, um mês por linha: só o total e o %; tocar abre o detalhe (a tabela larga não cabe) */}
            <ul className="cli-imp-lista">
              {vm.linhas.map(l => (
                <li key={l.competencia} className={l.emAndamento ? 'cli-imp-agora' : undefined}>
                  <details>
                    <summary className="cli-imp-lista-topo">
                      <span className="cli-imp-mes">{l.mes}{l.emAndamento && <span className="cli-imp-tag">em andamento</span>}</span>
                      <span className="cli-imp-lista-total">{l.total ?? <span className="cli-imp-vazio">sem guias</span>}{l.porcento && <span className="cli-imp-lista-pct">{l.porcento}</span>}</span>
                    </summary>
                    <dl className="cli-imp-lista-detalhe">
                      <dt>Faturamento</dt><dd>{l.faturamento ?? '—'}</dd>
                      <dt>Folha</dt><dd>{l.folha ?? '—'}</dd>
                      {vm.colunas.map((c, i) => l.impostos[i] && <div key={c} className="cli-imp-par"><dt>{c}</dt><dd>{l.impostos[i]}</dd></div>)}
                    </dl>
                  </details>
                </li>
              ))}
              <li className="cli-imp-lista-soma">
                <div className="cli-imp-lista-topo"><span>Total {vm.ano}</span><span className="cli-imp-lista-total">{vm.totais.total}<span className="cli-imp-lista-pct">{vm.totais.porcento}</span></span></div>
              </li>
            </ul>
            <div className="table-wrap cli-imp-tabela">
              <table className="table-compact cli-impostos">
                <thead>
                  <tr>
                    <th>Mês</th><th className="num">Faturamento</th><th className="num cli-imp-divisa">Folha</th>
                    {vm.colunas.map(c => <th key={c} className="num">{c}</th>)}
                    <th className="num cli-imp-total">Total</th><th className="num">% do fat.</th>
                  </tr>
                </thead>
                <tbody>
                  {vm.linhas.map(l => (
                    <tr key={l.competencia} className={l.emAndamento ? 'cli-imp-agora' : undefined}>
                      <td className="cli-imp-mes">{l.mes}{l.emAndamento && <span className="cli-imp-tag">em andamento</span>}</td>
                      <td className="num"><Valor v={l.faturamento} /></td>
                      <td className="num cli-imp-divisa"><Valor v={l.folha} /></td>
                      {l.impostos.map((v, i) => <td key={i} className="num"><Valor v={v} /></td>)}
                      <td className="num cli-imp-total"><Valor v={l.total} forte /></td>
                      <td className="num cli-imp-pct">{l.porcento ?? <span className="cli-imp-vazio">·</span>}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total {vm.ano}</td><td className="num">{vm.totais.faturamento}</td><td className="num cli-imp-divisa">{vm.totais.folha}</td>
                    {vm.totais.impostos.map((v, i) => <td key={i} className="num">{v}</td>)}
                    <td className="num cli-imp-total">{vm.totais.total}</td><td className="num">{vm.totais.porcento}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
