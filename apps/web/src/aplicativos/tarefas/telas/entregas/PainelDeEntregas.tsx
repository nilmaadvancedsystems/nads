// Entregas › Painel (16/10/2026: "quero integrar no app … o entregas, só que preciso que fique tudo no visual igual"): a
// barra do nads (a competência, a busca, a situação e Nova entrega), os números do mês nos painéis coloridos e os clientes
// do Entregas na lista do Cadastro, cada um com a situação da entrega mais nova do mês. A linha abre as entregas do cliente.
import { Esqueleto, Icone, MenuSuspenso, useCarregando } from '@nads/ui';
import { JanelaDoCliente } from './JanelaDoCliente';
import { JanelaNovaEntrega } from './JanelaNovaEntrega';
import { usePainelDeEntregas } from './usePainelDeEntregas';

export function PainelDeEntregas() {
  const vm = usePainelDeEntregas();
  useCarregando(vm.carregando);
  return (
    <section className="ent-tela">
      {vm.nova && <JanelaNovaEntrega fechar={() => vm.setNova(false)} />}
      {vm.aberta && <JanelaDoCliente linha={vm.aberta} competencia={vm.competencia} fechar={() => vm.setAberta(null)} />}

      <div className="tarefas-barra-topo">
        <MenuSuspenso icone="calendar" rotulo={vm.rotuloCompetencia} titulo="Competência" dica="Trocar a competência"
          itens={vm.competencias.map(c => ({ rotulo: c.rotulo, marcado: c.valor === vm.competencia, onClick: () => vm.setCompetencia(c.valor) }))} />
        <label className="busca-curta">
          <Icone nome="search" />
          <input type="text" placeholder="Buscar cliente" aria-label="Buscar cliente (nome, código ou CNPJ)" value={vm.busca}
            onChange={e => vm.setBusca(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') vm.setBusca(''); }} />
        </label>
        <MenuSuspenso rotulo={vm.rotuloDoFiltro} titulo="Situação" className={'btn btn-outline' + (vm.filtro !== 'com_entrega' ? ' ativo' : '')}
          itens={vm.filtros.map(f => ({ rotulo: f.rotulo, marcado: f.valor === vm.filtro, onClick: () => vm.setFiltro(f.valor) }))} />
        <span className="tarefas-barra-espaco" />
        {vm.exemplos && <span className="badge badge-neutral">Exemplos</span>}
        <button type="button" className="btn btn-primary" onClick={() => vm.setNova(true)}><Icone nome="plus" />Nova entrega</button>
      </div>
      {vm.erro && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erro}</p>}

      {vm.carregando ? <Esqueleto linhas={6} numeros={4} /> : (
        <>
          <div className="stat-grid dp-numeros ent-numeros">
            {vm.numeros.map(n => (
              <div key={n.rotulo} className={'stat painel-numero painel-' + n.tom} title={n.dica}>
                <span className="painel-numero-icone" aria-hidden="true"><Icone nome={n.icone} /></span>
                <p className="stat-label">{n.rotulo}</p>
                <p className="stat-value num">{n.valor}</p>
              </div>
            ))}
          </div>
          {!vm.linhas.length ? <p className="empty">Nenhum cliente com esse filtro.</p> : (
            <div className="table-wrap">
              <table className="tabela-empresas cad-lista ent-lista">
                <thead><tr><th>Cód.</th><th>Cliente</th><th>Situação</th><th>Última</th><th>Documentos</th></tr></thead>
                <tbody>
                  {vm.linhas.map(x => (
                    <tr key={x.l.chave} className="linha-abre" tabIndex={0} title="Abrir as entregas do cliente" onClick={() => vm.setAberta(x.l)} onKeyDown={e => { if (e.key === 'Enter') vm.setAberta(x.l); }}>
                      <td className="num fraco">{x.codigo || (x.l.cliente ? '—' : 'avulso')}</td>
                      <td><span className="cad-empresa-nome">{x.nome}</span></td>
                      <td><span className={'badge badge-' + x.situacao.tom}>{x.situacao.rotulo}</span></td>
                      <td className="fraco"><span className="ent-corta" title={x.detalhe}>{x.detalhe}</span></td>
                      <td><span className="ent-corta" title={x.documentos}>{x.documentos || <span className="fraco">—</span>}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
