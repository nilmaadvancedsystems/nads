// A janela dos papéis do mês do Cadastro › Empresas (Heverton, 20/10/2026), no padrão da janela das Etiquetas da folha
// do DP: as Etiquetas do mês (o envelope) e o Protocolo de tributos. Em cima, o que sai impresso; embaixo, as empresas
// (todas marcadas; dá para desmarcar) e Imprimir.
import { Icone, Interruptor, Segmentado, SeletorMes, useJanela } from '@nads/ui';
import { useRef } from 'react';
import type { VmPapeis } from './usePapeisDoCadastro';

export function JanelaDosPapeis({ vm }: { vm: VmPapeis }) {
  const { fechar } = vm;
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, fechar, !!vm.aberto);
  if (!vm.aberto) return null;
  const etiquetas = vm.aberto === 'etiquetas';
  return (
    <div className="modal-overlay" onMouseDown={ev => { if (ev.target === ev.currentTarget) fechar(); }}>
      <div ref={janela} className="modal etq-janela papeis-janela" role="dialog" aria-modal="true" aria-labelledby="papeisTitulo">
        <h3 id="papeisTitulo"><Icone nome={etiquetas ? 'fileText' : 'list'} width={16} height={16} />{etiquetas ? 'Etiquetas do mês' : 'Protocolo de entrega de tributos'}</h3>
        <form className="etq-corpo" onSubmit={ev => { ev.preventDefault(); vm.imprimir(); }}>
          <p className="etq-dica">{etiquetas
            ? 'A etiqueta do envelope: a faixa com a logo e o movimento, o código, o nome, a caixa e o departamento.'
            : 'Uma linha por empresa do grupo, com as colunas dos tributos para preencher à mão. Ligado, o que o Entregas já entregou na competência vem preenchido (o valor, a data e se foi por e-mail).'}</p>
          <div className="etq-campo">
            <span>{etiquetas ? 'Movimento (competência)' : 'Referência (competência)'}</span>
            <SeletorMes valor={vm.competencia} onMudar={vm.setCompetencia} rotulo="Competência" />
          </div>
          {etiquetas ? (
            <>
              <div className="etq-campo"><span>Departamento</span><Segmentado valor={vm.departamento} opcoes={vm.departamentos} onMudar={vm.setDepartamento} /></div>
              <div className="etq-campo"><span>Quantas por página</span><Segmentado valor={String(vm.porPagina)} opcoes={vm.porPaginaOpcoes} onMudar={vm.setPorPagina} /></div>
              <div className="etq-campo"><span>O texto da caixa</span><Segmentado valor={vm.caixa} opcoes={vm.textosDaCaixa} onMudar={vm.setCaixa} /></div>
            </>
          ) : (
            <>
              <div className="etq-campo"><span>Grupo (o regime no Cadastro)</span><Segmentado valor={vm.grupo.id} opcoes={vm.grupos} onMudar={vm.setGrupo} /></div>
              <div className="papeis-linha">
                <Interruptor ligado={vm.preencher} onMudar={vm.alternarPreencher} rotulo="Preencher com as guias entregues" />
                <span>Preencher com as guias entregues {vm.preencher && (vm.carregandoEntregas ? '(lendo…)' : '(' + vm.guiasNoMes + (vm.guiasNoMes === 1 ? ' entrega no mês)' : ' entregas no mês)'))}</span>
              </div>
            </>
          )}
          <div className="papeis-empresas">
            <div className="papeis-empresas-topo">
              <b>Empresas</b><span className="gh-counter">{vm.quantas} de {vm.empresas.length}</span>
              <span className="tarefas-barra-espaco" />
              <button type="button" className="btn btn-ghost" onClick={vm.marcarTodas}>Marcar todas</button>
              <button type="button" className="btn btn-ghost" onClick={vm.desmarcarTodas}>Desmarcar</button>
            </div>
            {vm.empresas.length ? (
              <ul className="papeis-lista">
                {vm.empresas.map(e => (
                  <li key={e.chave}>
                    <label className="papeis-item">
                      <input type="checkbox" checked={e.marcada} onChange={() => vm.alternar(e.chave)} />
                      <span className="num fraco">{e.codigo ?? '—'}</span>
                      <span className="papeis-nome">{e.nome}</span>
                      {etiquetas && e.caixa && <span className="badge badge-neutral">{e.caixa}</span>}
                    </label>
                  </li>
                ))}
              </ul>
            ) : <p className="fraco">{etiquetas ? 'Nenhuma empresa na lista (veja a busca e a situação).' : 'Nenhuma empresa da lista neste grupo.'}</p>}
          </div>
          <p className="hint etq-total">{etiquetas
            ? vm.quantas + (vm.quantas === 1 ? ' etiqueta' : ' etiquetas') + ' em ' + vm.paginas + (vm.paginas === 1 ? ' página' : ' páginas') + ' A4 (nenhuma cortada)'
            : vm.quantas + (vm.quantas === 1 ? ' empresa' : ' empresas') + ' no protocolo (A4 deitado)'}</p>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={fechar}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={!vm.quantas}><Icone nome="printer" width={16} height={16} />Imprimir</button>
          </div>
        </form>
      </div>
    </div>
  );
}
