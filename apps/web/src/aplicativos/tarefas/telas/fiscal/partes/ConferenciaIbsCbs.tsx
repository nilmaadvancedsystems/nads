// O IBS/CBS das notas pela calculadora oficial da Receita (21/11/2026), na aba "IBS/CBS" do Fiscal › SIEG. O robô do
// SIEG confere cada NF-e/NFC-e do mês depois do "Baixar XMLs" (o grupo IBSCBS: CST, cClassTrib, base, alíquotas,
// valores e o leiaute) e grava no resumo do mês (siegNotas.ibsCbs). Aqui só se desenha: as notas emitidas e as recebidas
// que não batem com a calculadora, campo a campo.
import { formatos, tarefas as t } from '@nads/core';
import { Alerta, Vazio } from '@nads/ui';

const plural = (q: number, um: string, varios: string) => q + ' ' + (q === 1 ? um : varios);

/** quantas notas divergentes no mês (o número na aba) */
export const divergentesIbsCbs = (c: t.sieg.ConferenciaIbsCbs | null): number => (c ? c.emitidas.divergentes + c.recebidas.divergentes : 0);

/** A aba inteira: sem conferência, o aviso; com ela, as emitidas e depois as recebidas. */
export function AbaIbsCbs({ c, rotuloCompetencia }: { c: t.sieg.ConferenciaIbsCbs | null; rotuloCompetencia: string }) {
  if (!c) {
    return (
      <div className="card fc-cartao">
        <Vazio icone="recibo" titulo={'O IBS/CBS de ' + rotuloCompetencia + ' ainda não foi conferido'}
          texto="A conferência pela calculadora da Receita sai junto com o Baixar XMLs, quando a calculadora do servidor está no ar." />
      </div>
    );
  }
  const vazio = (n: t.sieg.ContagemIbsCbs) => !n.conferidas && !n.semGrupo && !n.naoConferidas;
  if (vazio(c.emitidas) && vazio(c.recebidas)) {
    return <div className="card fc-cartao"><Vazio icone="recibo" titulo="Nenhuma NF-e ou NFC-e de 2026 em diante neste mês" texto="A conferência do IBS/CBS vale para as notas a partir de 2026." /></div>;
  }
  return (
    <div className="card fc-cartao">
      <LadoIbsCbs c={c} lado="emitida" />
      <LadoIbsCbs c={c} lado="recebida" />
      {c.cortadas > 0 && <p className="hint">Mais {c.cortadas} notas com divergência ficaram fora da lista (o limite do resumo).</p>}
    </div>
  );
}

/** Um lado (as emitidas ou as recebidas): o aviso verde quando tudo confere, ou a tabela das diferenças. */
function LadoIbsCbs({ c, lado }: { c: t.sieg.ConferenciaIbsCbs; lado: t.sieg.LadoDaNota }) {
  const n = lado === 'emitida' ? c.emitidas : c.recebidas;
  if (!n.conferidas && !n.semGrupo && !n.naoConferidas) return null;
  const oQue = lado === 'emitida' ? 'emitidas' : 'recebidas';
  const detalhe = [
    plural(n.conferidas, 'nota conferida', 'notas conferidas'),
    n.semGrupo ? n.semGrupo + ' sem o grupo IBSCBS' : '',
    n.naoConferidas ? n.naoConferidas + ' que a calculadora não conferiu' : '',
  ].filter(Boolean).join(' · ') + ' (calculadora da Receita ' + c.versao + ', ' + formatos.dataHora(c.em) + ').';
  if (!n.divergentes) return <Alerta naLinha tom="ok" titulo={'O IBS/CBS das notas ' + oQue + ' confere com a calculadora da Receita'} texto={detalhe} />;
  const notas = c.notas.filter(x => x.lado === lado);
  const linhas = notas.flatMap(x => x.divergencias.map((d, i) => ({ nota: x, d, primeira: i === 0 })));
  return (
    <>
      <Alerta naLinha titulo={plural(n.divergentes, 'nota ' + lado, 'notas ' + oQue) + ' com o IBS/CBS diferente da calculadora da Receita'}
        texto={detalhe + (lado === 'emitida' ? ' Corrija o cadastro do produto (cClassTrib e CST) no emissor do cliente.' : ' Confira o crédito com o fornecedor.')} />
      <div className="table-wrap table-compact">
        <table>
          <thead><tr><th>Nota</th><th className="num">Item</th><th>O que</th><th>Na nota</th><th>A calculadora</th></tr></thead>
          <tbody>
            {linhas.slice(0, 80).map(({ nota, d, primeira }, i) => (
              <tr key={nota.chave + '|' + i}>
                <td className="wrap">{primeira ? <><b>{nota.nome || '—'}</b><span className="hint" style={{ display: 'block', margin: 0 }}>{nota.tipo} · nº {nota.numero} · {nota.data}</span></> : null}</td>
                <td className="num">{d.item || 'nota'}</td>
                <td className="wrap">{d.campo}</td>
                <td className="wrap">{d.naNota}</td>
                <td className="wrap">{d.calculadora}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {linhas.length > 80 && <p className="hint">E mais {linhas.length - 80} diferenças.</p>}
    </>
  );
}
