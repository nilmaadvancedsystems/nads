// A Central de documentos da Área do Cliente (Vitor, 16/10/2026), no layout do protótipo com as peças do nads: o título com
// "Enviar documento" (abre a janela de envio) e "Baixar o mês"; a barra com a busca, a área e o mês; e a tabela do nads com
// o documento, a categoria, a competência, a data de envio, se já foi baixado e as ações (ver e baixar).
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
      titulo: d.nome, texto: d.descricao,
      corpo: (
        <div className="cli-app cli-janela">
          <dl className="cli-dados">
            <dt>Categoria</dt><dd>{vm.rotuloDaArea(d)}</dd>
            <dt>Competência</dt><dd>{vm.competencia(d)}</dd>
            <dt>Enviado em</dt><dd>{vm.enviadoEm(d)}</dd>
            <dt>Formato</dt><dd>{d.formato}</dd>
          </dl>
        </div>
      ),
      botoes: [{ rotulo: 'Baixar', valor: true, variante: 'btn-primary' }, { rotulo: 'Fechar', valor: false, variante: 'btn-outline' }],
    });
    if (baixar) await vm.baixar(d.id);
  };

  const enviar = () => void modal({
    titulo: 'Enviar documento', texto: 'Extratos, notas, comprovantes ou outro documento para o escritório.',
    corpo: <div className="cli-app cli-janela"><Enviar {...props} /></div>,
    botoes: [{ rotulo: 'Fechar', valor: null, variante: 'btn-outline' }],
  });

  return (
    <>
      <div className="cli-titulo">
        <div>
          <h1 className="page-title">Central de documentos</h1>
          <p className="page-desc">Relatórios, certidões e guias que o escritório deixou para você.</p>
        </div>
        <div className="cli-acoes">
          <button type="button" className="btn btn-primary" onClick={enviar}><Icone nome="upload" width={16} height={16} />Enviar documento</button>
          <button type="button" className="btn" disabled={!vm.totalDoLote} onClick={() => void vm.baixarOMes()}
            title={vm.totalDoLote ? 'Baixa os ' + vm.totalDoLote + ' arquivos de ' + vm.mesDoLote + ', um por um' : 'Nenhum documento no mês'}>
            <Icone nome="download" width={16} height={16} />Baixar o mês
          </button>
        </div>
      </div>

      <div className="cli-filtros">
        <input type="text" value={vm.busca} onChange={e => vm.mudarBusca(e.target.value)} placeholder="Buscar documento" aria-label="Buscar documento" />
        <div className="cli-filtros-dir">
          <select value={vm.area} onChange={e => vm.mudarArea(e.target.value)} aria-label="Área">
            <option value="">Todas as áreas</option>
            {vm.areas.map(a => <option key={a.valor} value={a.valor}>{a.rotulo}</option>)}
          </select>
          <select value={vm.mes} onChange={e => vm.mudarMes(e.target.value)} aria-label="Mês">
            <option value="">Todos os meses</option>
            {vm.meses.map(m => <option key={m.valor} value={m.valor}>{m.rotulo}</option>)}
          </select>
        </div>
      </div>

      <div className="table-wrap cli-tabela">
        <table>
          <thead>
            <tr>
              <th>Documento</th><th className="cli-so-largo">Categoria</th><th className="cli-so-largo">Competência</th><th className="cli-so-largo">Data de envio</th>
              <th className="cli-so-largo">Leitura</th><th className="num">Ações</th>
            </tr>
          </thead>
          <tbody>
            {vm.docs.map(d => (
              <tr key={d.id}>
                <td className="wrap">
                  <div className={'cli-doc' + (d.novo ? ' novo' : '')}>
                    <span className={'cli-doc-ico ' + d.area} aria-hidden="true"><Icone nome="fileText" width={18} height={18} /></span>
                    <div><span className="cli-doc-nome">{d.nome}</span><span className="hint">{d.descricao}</span></div>
                  </div>
                </td>
                <td className="cli-so-largo"><span className="cli-selo">{vm.rotuloDaArea(d)}</span></td>
                <td className="cli-so-largo">{vm.competencia(d)}</td>
                <td className="cli-so-largo">{vm.enviadoEm(d)}</td>
                <td className="cli-so-largo">{d.novo ? <span className="cli-leitura novo"><span className="cli-ponto" aria-hidden="true" />Novo</span> : <span className="cli-leitura">Baixado</span>}</td>
                <td className="num">
                  <span className="cli-acoes-linha">
                    <button type="button" className="icon-btn" title="Ver" aria-label={'Ver ' + d.nome} onClick={() => void visualizar(d)}><Icone nome="olho" width={16} height={16} /></button>
                    <button type="button" className="icon-btn" title="Baixar" aria-label={'Baixar ' + d.nome} disabled={vm.baixando === d.id} onClick={() => void vm.baixar(d.id)}><Icone nome="download" width={16} height={16} /></button>
                  </span>
                </td>
              </tr>
            ))}
            {!vm.docs.length && <tr><td colSpan={6}><p className="empty">{vm.total ? 'Nenhum documento com esse filtro.' : 'O escritório ainda não deixou documentos aqui.'}</p></td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
