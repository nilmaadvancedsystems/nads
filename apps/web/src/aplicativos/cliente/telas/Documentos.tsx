// A Central de documentos da Área do Cliente (Vitor, 16/10/2026, do protótipo): os documentos que o escritório deixou
// (com a busca, a área e o mês; os novos com o selo), visualizar (a janela com os dados do documento) e baixar; embaixo, o
// enviar documentos ao escritório (extratos, notas, comprovantes) com os recibos.
import { Icone, useRetorno } from '@nads/ui';
import type { DocumentoDoCliente } from '../dados/areaCliente';
import { Enviar } from './Enviar';
import { useDocumentos } from './useDocumentos';
import type { DaCasca } from './useAreaCliente';

export function Documentos(props: DaCasca) {
  const vm = useDocumentos(props);
  const { modal } = useRetorno();

  const visualizar = async (d: DocumentoDoCliente) => {
    const baixar = await modal({
      icone: 'fileText', titulo: d.nome, texto: d.descricao,
      corpo: (
        <div className="cli-app cli-janela">
          <dl className="cli-dados">
            <dt>Área</dt><dd>{vm.rotuloDaArea(d)}</dd>
            {d.competencia && <><dt>Referente a</dt><dd>{vm.referente(d).replace('referente a ', '')}</dd></>}
            <dt>Enviado em</dt><dd>{vm.enviadoEm(d)}</dd>
            <dt>Formato</dt><dd>{d.formato}</dd>
            <dt>Situação</dt><dd>{d.novo ? 'Ainda não baixado' : 'Já baixado'}</dd>
          </dl>
        </div>
      ),
      botoes: [{ rotulo: 'Baixar', valor: true, variante: 'btn-primary' }, { rotulo: 'Fechar', valor: false, variante: 'btn-outline' }],
    });
    if (baixar) await vm.baixar(d.id);
  };

  return (
    <>
      <section className="card">
        <div className="card-head">
          <h3>Documentos do escritório {vm.novos > 0 && <span className="badge badge-warn">{vm.novos} {vm.novos === 1 ? 'novo' : 'novos'}</span>}</h3>
          {vm.filtrando && <button type="button" className="btn btn-ghost" onClick={vm.limpar}>Limpar filtros</button>}
        </div>
        <div className="cli-filtros" style={{ marginBottom: 12 }}>
          <input type="text" value={vm.busca} onChange={e => vm.mudarBusca(e.target.value)} placeholder="Buscar documento" aria-label="Buscar documento" />
          <select value={vm.area} onChange={e => vm.mudarArea(e.target.value)} aria-label="Área">
            <option value="">Todas as áreas</option>
            {vm.areas.map(a => <option key={a.valor} value={a.valor}>{a.rotulo}</option>)}
          </select>
          <select value={vm.mes} onChange={e => vm.mudarMes(e.target.value)} aria-label="Mês">
            <option value="">Todos os meses</option>
            {vm.meses.map(m => <option key={m.valor} value={m.valor}>{m.rotulo}</option>)}
          </select>
        </div>
        {vm.docs.length ? (
          <ul>
            {vm.docs.map(d => (
              <li key={d.id} className="cli-linha">
                <div className="cli-linha-txt">
                  <b>{d.nome}</b> {d.novo && <span className="badge badge-warn">Novo</span>}
                  <p className="hint">{[vm.rotuloDaArea(d), vm.referente(d), 'enviado em ' + vm.enviadoEm(d)].filter(Boolean).join(' · ')}</p>
                </div>
                <div className="cli-linha-dir">
                  <button type="button" className="icon-btn" title="Ver os dados" aria-label={'Ver ' + d.nome} onClick={() => void visualizar(d)}><Icone nome="olho" width={16} height={16} /></button>
                  <button type="button" className="btn" disabled={vm.baixando === d.id} onClick={() => void vm.baixar(d.id)}><Icone nome="download" width={16} height={16} />Baixar</button>
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="empty">{vm.total ? 'Nenhum documento com esse filtro.' : 'O escritório ainda não deixou documentos aqui.'}</p>}
      </section>

      <Enviar {...props} />
    </>
  );
}
