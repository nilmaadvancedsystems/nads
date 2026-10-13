// O 13º salário nas Obrigações do DP (Vitor, 13/10/2026: "pode ser um botão do lado de agrupamento… em novembro ou
// dezembro… muda a lista como um on/off"): com o interruptor ligado, esta lista entra no lugar da do mês — novembro
// mostra a 1ª parcela (recibos e folha), dezembro a 2ª (recibos, folha, S-1200, S-1210, S-1299, DCTFWeb e DARF), com
// os filtros das Obrigações. A bolinha marca a etapa como feita (quem e quando); clicar de novo desfaz.
import { baixarBytes, Esqueleto, Icone, Interruptor } from '@nads/ui';
import { useDecimoTerceiro, type DeFora, type EstadoDoDecimo } from './useDecimoTerceiro';

const MARCA: Record<EstadoDoDecimo, string> = { 'a-fazer': '', feita: '✓', parada: '!' };

export function DecimoNaLista({ desligar, ...fora }: DeFora & { desligar: () => void }) {
  const vm = useDecimoTerceiro(fora);
  const feitas = fora.parcela === '1' ? vm.primeiraFeitas : vm.segundaFeitas;
  return (
    <section className="card dp-lista">
      <div className="dp-lista-topo">
        <h3 className="dp-titulo">13º salário · {fora.parcela === '1' ? '1ª parcela' : '2ª parcela'}</h3>
        <span className="badge badge-neutral">{vm.linhas.length}</span>
        {vm.faltam > 0 ? <span className="hint">{vm.faltam} {vm.faltam === 1 ? 'falta' : 'faltam'} · {feitas} de {vm.total} feitos</span> : <span className="hint">tudo feito</span>}
        <span className="tarefas-barra-espaco" />
        <button type="button" className="btn btn-outline" onClick={() => { const x = vm.exportar(); baixarBytes(x.bytes, x.nome, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); }}>
          <Icone nome="download" />Exportar Excel
        </button>
        <span className="hint">13º salário</span>
        <Interruptor ligado onMudar={desligar} rotulo="Voltar para as obrigações do mês" />
      </div>
      {vm.carregando ? <Esqueleto linhas={8} /> : vm.linhas.length === 0 ? <p className="hint dp-vazio">Nenhum cliente com esses filtros.</p> : (
        <div className="table-wrap">
          <table className="dp-tabela dp-tabela-13">
            <thead>
              <tr className="dp-cabeca-grupo">
                <th colSpan={3} />
                {vm.gruposDeColunas.map(g => <th key={g.rotulo} colSpan={g.colunas} className="dp-ob-grupo dp-ob-primeira">{g.rotulo}</th>)}
                <th />
              </tr>
              <tr>
                <th>Cód.</th><th>Cliente</th><th>Responsável</th>
                {vm.colunas.map(col => <th key={col.chave} className={'dp-ob' + (vm.primeiras.has(col.chave) ? ' dp-ob-primeira' : '')} title={col.nome}>{col.rotulo}</th>)}
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {vm.linhas.map(c => {
                const pronta = fora.parcela === '1' ? c.primeira : c.segunda;
                const alguma = c.marcas.some(m => m.estado === 'feita');
                return (
                  <tr key={c.codigo} className={'dp-linha' + (pronta ? ' feita' : '')}>
                    <td className="num fraco">{c.codigo}</td>
                    <td className="dp-cliente"><span className="dp-cliente-nome" title={c.nome}>{c.nome}</span></td>
                    <td>{c.temResponsavel ? c.responsavelNome : <span className="fraco">—</span>}</td>
                    {c.marcas.map(m => (
                      <td key={m.chave} className={'dp-ob' + (vm.primeiras.has(m.chave) ? ' dp-ob-primeira' : '')}>
                        <button type="button" className={'dp-marca ' + m.estado} disabled={vm.carregando} onClick={() => vm.alternar(c.codigo, m.etapa)}
                          title={m.nome + ': ' + (m.estado === 'feita' ? 'feita por ' + m.quem + ' (clique para desfazer)' : 'clique quando fizer')}
                          aria-label={m.nome + ' de ' + c.nome + (m.estado === 'feita' ? ': feita' : ': a fazer')} aria-pressed={m.estado === 'feita'}>
                          {MARCA[m.estado]}
                        </button>
                      </td>
                    ))}
                    <td><span className={'badge ' + (pronta ? 'badge-ok' : alguma ? 'badge-warn' : 'badge-neutral')}>{pronta ? 'Concluído' : alguma ? 'Em andamento' : 'Não iniciado'}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
