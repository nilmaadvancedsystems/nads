// A Central de documentos da Área do Cliente (Vitor, 16/10/2026), no layout do protótipo com as peças do nads: o título com
// "Enviar documento" (abre a janela de envio) e "Baixar o mês"; a barra com a busca, a área e o mês; e a tabela do nads com
// o documento, a categoria, a competência, a data de envio, se já foi baixado e as ações (ver e baixar).
// Versão D: o ícone desenhado de cada tipo de arquivo (PDF, planilha, XML, ZIP, DOC, imagem), o selo só no que falta baixar, a busca com a lupa.
import { Icone, useRetorno } from '@nads/ui';
import type { DocumentoDoCliente } from '../dados/areaCliente';
import { IconeDeArquivo } from '../partes/IconeDeArquivo';
import { Vazio } from '../partes/Vazio';
import { useJanelaDeEnvio } from './JanelaDeEnvio';
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
            <dt>Formato</dt><dd>{d.formato === 'XLSX' ? 'Planilha (XLSX)' : d.formato === 'DOCX' ? 'Documento do Word (DOCX)' : d.formato}</dd>
          </dl>
        </div>
      ),
      botoes: [{ rotulo: 'Baixar', valor: true, variante: 'btn-primary' }, { rotulo: 'Fechar', valor: false, variante: 'btn-outline' }],
    });
    if (baixar) await vm.baixar(d.id);
  };

  const enviar = useJanelaDeEnvio(props);

  return (
    <>
      <div className="cli-titulo">
        <div>
          <h1 className="page-title">Central de documentos</h1>
          <p className="page-desc">Relatórios, certidões, declarações e guias que o escritório deixou para você.</p>
        </div>
        <div className="cli-acoes">
          <button type="button" className="btn btn-primary" onClick={enviar}><Icone nome="upload" width={16} height={16} />Enviar documento</button>
          <button type="button" className="btn" disabled={!vm.totalDoLote} onClick={() => void vm.baixarOMes()}
            title={vm.totalDoLote ? 'Baixa os ' + vm.totalDoLote + ' arquivos de ' + vm.mesDoLote + ', um por um' : 'Nenhum documento no mês'}>
            <Icone nome="download" width={16} height={16} />Baixar o mês
          </button>
        </div>
      </div>

      <div className="card cli-filtros">
        <label className="cli-busca">
          <Icone nome="search" width={16} height={16} />
          <input type="text" value={vm.busca} onChange={e => vm.mudarBusca(e.target.value)} placeholder="Buscar documento" aria-label="Buscar documento" />
        </label>
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
                  <div className="cli-doc">
                    <IconeDeArquivo formato={d.formato} tamanho={36} />
                    <div><b>{d.nome}</b><span className="hint">{d.descricao}</span></div>
                  </div>
                </td>
                <td className="cli-so-largo">{vm.rotuloDaArea(d)}</td>
                <td className="cli-so-largo">{vm.competencia(d)}</td>
                <td className="cli-so-largo cli-suave">{vm.enviadoEm(d)}</td>
                <td className="cli-so-largo">{d.novo ? <span className="badge badge-warn">Não baixado</span> : <span className="cli-suave">Baixado</span>}</td>
                <td className="num">
                  <span className="cli-acoes-linha">
                    <button type="button" className="icon-btn" title="Ver" aria-label={'Ver ' + d.nome} onClick={() => void visualizar(d)}><Icone nome="olho" width={16} height={16} /></button>
                    <button type="button" className="icon-btn" title="Baixar" aria-label={'Baixar ' + d.nome} disabled={vm.baixando === d.id} onClick={() => void vm.baixar(d.id)}><Icone nome="download" width={16} height={16} /></button>
                  </span>
                </td>
              </tr>
            ))}
            {!vm.docs.length && (
              <tr className="cli-sem-passar"><td colSpan={6}>
                {vm.total
                  ? <Vazio icone="search" titulo="Nenhum documento com esse filtro" acao={{ rotulo: 'Limpar os filtros', onClick: vm.limpar }} />
                  : <Vazio icone="pastaAberta" titulo="Nenhum documento ainda" texto="Quando o escritório deixar um documento, ele aparece aqui." />}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
