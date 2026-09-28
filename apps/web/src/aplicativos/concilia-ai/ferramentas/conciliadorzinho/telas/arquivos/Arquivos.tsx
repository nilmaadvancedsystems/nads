// Etapa Arquivos: "Tudo certo" (conciliadorZINHO.html #step-4 ~L660).
import { conciliadorzinho as cz } from '@nads/core';
import { baixarArquivo, baixarBytes, Icone, Segmentado, Stat } from '@nads/ui';
import { AcoesDoTopo } from '../../../../../../comum/topo';
import { useArquivos, type ArquivoPronto } from './useArquivos';

function baixar(a: ArquivoPronto) {
  if (a.bytes) baixarBytes(a.bytes, a.nome, a.tipo);
  else if (a.texto != null) baixarArquivo(a.texto, a.nome, a.tipo);
}

const valor = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function CartaoDownload({ titulo, resumo, rotuloXls, xls, csv }: { titulo: string; resumo: string; rotuloXls: string; xls: () => ArquivoPronto; csv: () => ArquivoPronto }) {
  return (
    <div className="card">
      <div className="card-head"><h3>{titulo}</h3><span className="hint">{resumo}</span></div>
      <div className="import-box-row">
        <button className="btn btn-primary" type="button" onClick={() => baixar(xls())}><Icone nome="download" />{rotuloXls}</button>
        <button className="btn btn-outline" type="button" onClick={() => baixar(csv())}><Icone nome="download" />Exportar como CSV</button>
      </div>
    </div>
  );
}

export function Arquivos() {
  const vm = useArquivos();
  const n = vm.numeros;
  return (
    <section>
      <AcoesDoTopo>
        <button className="btn btn-outline" type="button" onClick={vm.novoProcesso}><Icone nome="repeat" />Novo processo</button>
      </AcoesDoTopo>

      <div className="stat-grid">
        <Stat rotulo="Lançamentos aprovados" valor={n.aprovadas} />
        <Stat rotulo="Com nota encontrada" valor={n.casadas} cor="saida" />
        <Stat rotulo="Sem nota (p/ caixa)" valor={n.semNota} cor="entrada" />
        <Stat rotulo="Bandeiras conciliadas" valor={n.bandeiras} />
      </div>
      <p className="parity">
        <Icone nome="checkCircle" />
        <span>Bruto: <strong className="num">{cz.brl(n.bruto)}</strong> · Taxas: <strong className="num">{cz.brl(n.taxas)}</strong> · paridade 1:1 confirmada por bandeira {vm.paridade}.</span>
      </p>

      <h3 className="painel-titulo" style={{ margin: '24px 0 4px' }}>Por bandeira</h3>
      <p className="hint" style={{ marginBottom: 12 }}>Cartões, taxas e notas encontradas.</p>
      {vm.bandeiras.map(b => <CartaoDownload key={b.id} titulo={b.rotulo} resumo={b.resumo} rotuloXls="Baixar arquivo conciliado (Excel 97-2003)" xls={b.xls} csv={b.csv} />)}

      <h3 className="painel-titulo" style={{ margin: '24px 0 4px' }}>Vendas sem cartão</h3>
      <p className="hint" style={{ marginBottom: 12 }}>Não bateram com nenhum cartão. Separadas por mês.</p>
      {vm.saidas.length
        ? vm.saidas.map(sd => <CartaoDownload key={sd.chave} titulo={sd.rotulo} resumo={sd.resumo} rotuloXls="Baixar arquivo de saídas (Excel 97-2003)" xls={sd.xls} csv={sd.csv} />)
        : <p className="hint">Nenhuma venda ficou de fora — todas bateram com algum lançamento de cartão.</p>}

      {vm.previa && (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-head"><h3>Prévia do arquivo</h3><span className="hint">{vm.previa.contagem}</span></div>
          {vm.abas.length > 1 && <Segmentado valor={vm.aba || ''} opcoes={vm.abas} onMudar={v => vm.setAba(v as cz.IdBandeira)} />}
          <div className="table-wrap">
            <table>
              <thead><tr><th>Devedora</th><th>Credora</th><th>Data</th><th className="num">Valor</th><th>Histórico</th><th>Complemento</th><th>Nota</th></tr></thead>
              <tbody>
                {vm.previa.linhas.map((l, i) => (
                  <tr key={i}>
                    <td>{l.devedora}</td>
                    <td>{l.credora}</td>
                    <td>{l.data}</td>
                    <td className="num" style={l.tipo === 'Taxa' ? { color: 'var(--danger)', fontWeight: 600 } : undefined}>{valor(l.valor)}</td>
                    <td>{l.historico}</td>
                    <td className="wrap">{l.complemento} {l.tipo === 'Bruto' && <span className={'badge ' + (l.casou ? 'badge-ok' : 'badge-neutral')}>{l.casou ? 'com nota' : 'sem nota'}</span>}</td>
                    <td>{l.nota || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="hint" style={{ marginTop: 16 }}>{vm.nota}</p>
    </section>
  );
}
