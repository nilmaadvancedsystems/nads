// Fiscal › Tabelas da Reforma (22/11/2026: a fase 2 das calculadoras da Receita): para classificar o produto e conferir a
// nota — o cClassTrib (com o CST, a redução, o crédito de quem compra e a base legal), os CST e as alíquotas de referência
// de hoje, das tabelas oficiais da calculadora da Receita. A barra (a busca e o CST); as abas cClassTrib | CST. Só as peças
// do catálogo: busca curta, Menu suspenso, Segmentado, Stat, Cartão, Tabela padrão, Vazio.
import { Icone, MenuSuspenso, Segmentado, Stat, Vazio } from '@nads/ui';
import { useTabelasDaReforma, type AbaDaReforma } from './useTabelasDaReforma';

const pct = (n: number | undefined) => (n ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '%';

export function TabelasDaReforma() {
  const vm = useTabelasDaReforma();
  const abas: { valor: AbaDaReforma; rotulo: string }[] = [
    { valor: 'cclasstrib', rotulo: 'cClassTrib (' + vm.classificacoes.length + ')' },
    { valor: 'cst', rotulo: 'CST (' + vm.csts.length + ')' },
  ];
  return (
    <section className="fc">
      <div className="tarefas-barra-topo fc-topo">
        <label className="busca-curta">
          <Icone nome="search" width={16} height={16} />
          <input type="text" placeholder="Código ou palavra (200003, alimentação, art. 125)" aria-label="Buscar na tabela" autoComplete="off"
            value={vm.busca} onChange={e => vm.setBusca(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') vm.setBusca(''); }} />
        </label>
        <MenuSuspenso rotulo={vm.cst ? 'CST ' + vm.cst : 'Todos os CST'} titulo="CST" className={'btn btn-outline' + (vm.cst ? ' ativo' : '')}
          itens={[{ rotulo: 'Todos os CST', marcado: !vm.cst, onClick: () => vm.setCst('') },
            ...vm.csts.map(c => ({ rotulo: c.codigo + ' · ' + c.descricao, marcado: vm.cst === c.codigo, onClick: () => vm.setCst(c.codigo) }))]} />
      </div>

      <div className="stat-grid">
        {vm.aliquotas ? (
          <>
            <Stat rotulo="CBS de referência hoje" valor={pct(vm.aliquotas.CBS)} />
            <Stat rotulo="IBS da UF de referência hoje" valor={pct(vm.aliquotas.IBSUF)} />
            <Stat rotulo="IBS do município de referência hoje" valor={pct(vm.aliquotas.IBSMun)} />
          </>
        ) : <Stat rotulo="Alíquotas de referência" valor="na nota" />}
        <Stat rotulo="Classificações vigentes" valor={String(vm.total)} />
      </div>
      <p className="hint">Tabelas oficiais da calculadora da Receita ({vm.fonte}). {vm.descricaoDoBanco}</p>

      <Segmentado valor={vm.aba} onMudar={vm.setAba} opcoes={abas} />
      {vm.aba === 'cst' ? (
        <div className="card fc-cartao">
          <div className="table-wrap">
            <table className="table-compact">
              <thead><tr><th>CST</th><th>Descrição</th><th>Grupos no XML</th></tr></thead>
              <tbody>
                {vm.csts.map(c => (
                  <tr key={c.codigo + c.inicio}>
                    <td><b>{c.codigo}</b></td>
                    <td className="wrap">{c.descricao}</td>
                    <td className="wrap">{Object.keys(c.grupos).join(', ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : !vm.classificacoes.length ? (
        <div className="card fc-cartao"><Vazio icone="fileSearch" titulo="Nenhuma classificação encontrada" texto="Tente o código (o começo serve: 200 traz o CST 200) ou outra palavra." /></div>
      ) : (
        <div className="card fc-cartao">
          <div className="table-wrap">
            <table className="table-compact">
              <thead><tr><th>cClassTrib</th><th>Descrição</th><th>CST</th><th>Redução</th><th>Quem compra</th><th>Base legal</th><th>Pede</th></tr></thead>
              <tbody>
                {vm.classificacoes.map(c => (
                  <tr key={c.codigo + c.inicio}>
                    <td><b>{c.codigo}</b></td>
                    <td className="wrap">{c.descricao}<span className="hint" style={{ display: 'block', margin: 0 }}>{c.tipoAliquota}{c.anexo ? ' · Anexo ' + c.anexo + ' da LC 214' : ''}</span></td>
                    <td title={vm.descricaoDoCst.get(c.cst) || ''}>{c.cst}</td>
                    <td className="wrap">{vm.textoDaReducao(c)}</td>
                    <td className="wrap">{vm.textoDoCredito(c)}</td>
                    <td className="wrap">{c.fundamentacao.join('; ') || '—'}</td>
                    <td>{c.nomenclatura}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
