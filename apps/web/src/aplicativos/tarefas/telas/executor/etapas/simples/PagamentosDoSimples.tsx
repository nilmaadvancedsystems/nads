// O pagamento do Simples pelo banco na etapa Simples Nacional a recolher (Vitor, 16/10/2026; 19/10/2026: sem a coluna Onde,
// o nome do banco na situação, "Diferença" no lugar de "Juros", sem o Importar no meu Sistema e os botões "Não foi pago" e
// "Ok" nas pendências): embaixo da linha do razão, cada DAS com o pagamento. Só peças que já existem.
import { Icone } from '@nads/ui';
import type { PagamentosDoSimples as Vm } from './usePagamentosDoSimples';

const CLASSE: Record<Vm['obrigacoes'][number]['situacao'], string> = {
  ok: 'badge badge-ok', banco: 'badge badge-warn', aberto: 'badge badge-bad', depois: 'badge badge-neutral',
};

export function PagamentosDoSimples({ vm }: { vm: Vm }) {
  if (!vm.pronto) return null;
  return (
    <div className="imp-bloco">
      <div className="imp-linha">
        <span className="imp-ico"><Icone nome="landmark" /></span>
        <div className="imp-txt"><span><b>Pagamentos do DAS</b><span className="imp-conta">{vm.temExtrato ? 'pelo extrato dos bancos' : 'importe os extratos na Importação para achar os pagamentos'}</span></span></div>
      </div>
      <div className="imp-periodo-linha">
        <div className="table-wrap">
          <table className="table-compact">
            <thead><tr><th>Competência</th><th className="num">DAS</th><th>Vencimento</th><th>Pagamento</th><th className="num">Diferença</th><th>Situação</th></tr></thead>
            <tbody>
              {vm.obrigacoes.map(o => (
                <tr key={o.chave}>
                  <td>{o.rotulo}</td><td className="num">{o.valor}</td><td>{o.vencimento}</td><td>{o.pagamento || '—'}</td>
                  <td className="num">{o.diferenca || '—'}</td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span className={CLASSE[o.situacao]}>{o.textoDaSituacao}</span>
                      {/* a pendência: a pessoa responde para seguir; respondida, o selo e o × para desfazer */}
                      {o.pendencia && (o.resposta ? (
                        <>
                          <span className={'badge ' + (o.resposta === 'ok' ? 'badge-ok' : 'badge-neutral')}>{o.resposta === 'ok' ? 'Ok' : 'Não foi pago'}</span>
                          <button type="button" className="icon-btn icon-btn-sm" title="Desfazer a resposta" aria-label="Desfazer a resposta" onClick={() => vm.desfazer(o.chave)}><Icone nome="x" /></button>
                        </>
                      ) : (
                        <>
                          <button type="button" className="btn btn-outline" onClick={() => vm.responder(o.chave, 'nao-pago')}>Não foi pago</button>
                          <button type="button" className="btn" onClick={() => vm.responder(o.chave, 'ok')}>Ok</button>
                        </>
                      ))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
