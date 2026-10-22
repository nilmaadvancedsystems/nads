// A janela dos papéis do mês do Cadastro › Empresas (Heverton, 20/10/2026), no padrão da janela das Etiquetas da folha
// do DP: as Etiquetas do mês (o envelope) e o Protocolo de tributos. Em cima, as opções numa grade (rótulo e escolha);
// embaixo, as empresas (todas marcadas; a caixa do topo marca e desmarca todas) e, no rodapé, o total e Imprimir
// (simplificada em 22/10/2026).
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
          {/* as opções numa grade, como nos diálogos de impressão (22/10/2026: "organizar e simplificar") */}
          <div className="papeis-opcoes">
            <span>Competência</span>
            <SeletorMes valor={vm.competencia} onMudar={vm.setCompetencia} rotulo="Competência" />
            {etiquetas ? (
              <>
                <span>Departamento</span><Segmentado valor={vm.departamento} opcoes={vm.departamentos} onMudar={vm.setDepartamento} />
                <span>Por folha</span><Segmentado valor={String(vm.porPagina)} opcoes={vm.porPaginaOpcoes} onMudar={vm.setPorPagina} />
                <span>Na caixa</span><Segmentado valor={vm.caixa} opcoes={vm.textosDaCaixa} onMudar={vm.setCaixa} />
              </>
            ) : (
              <>
                <span>Grupo</span><Segmentado valor={vm.grupo.id} opcoes={vm.grupos} onMudar={vm.setGrupo} />
                <span>Preencher</span>
                <span className="papeis-linha">
                  <Interruptor ligado={vm.preencher} onMudar={vm.alternarPreencher} rotulo="Preencher com as guias entregues" />
                  <span>com as guias já entregues {vm.preencher && (vm.carregandoEntregas ? '(lendo…)' : '(' + vm.guiasNoMes + (vm.guiasNoMes === 1 ? ' no mês)' : ' no mês)'))}</span>
                </span>
              </>
            )}
          </div>
          <div className="papeis-empresas">
            <label className="papeis-empresas-topo">
              <input type="checkbox" checked={!!vm.empresas.length && vm.quantas === vm.empresas.length}
                ref={el => { if (el) el.indeterminate = vm.quantas > 0 && vm.quantas < vm.empresas.length; }}
                onChange={() => (vm.quantas === vm.empresas.length ? vm.desmarcarTodas() : vm.marcarTodas())} />
              <b>Empresas</b><span className="fraco">{vm.quantas} de {vm.empresas.length} marcadas</span>
            </label>
            {vm.empresas.length ? (
              <ul className="papeis-lista">
                {vm.empresas.map(e => (
                  <li key={e.chave}>
                    <label className="papeis-item">
                      <input type="checkbox" checked={e.marcada} onChange={() => vm.alternar(e.chave)} />
                      <span className="num fraco">{e.codigo ?? '—'}</span>
                      <span className="papeis-nome" title={e.nome}>{e.nome}</span>
                      {etiquetas && e.caixa && <span className="badge badge-neutral">{e.caixa}</span>}
                    </label>
                  </li>
                ))}
              </ul>
            ) : <p className="fraco">{etiquetas ? 'Nenhuma empresa na lista (veja a busca e a situação).' : 'Nenhuma empresa da lista neste grupo.'}</p>}
          </div>
          <div className="modal-actions">
            <span className="papeis-total fraco">{etiquetas
              ? vm.quantas + (vm.quantas === 1 ? ' etiqueta' : ' etiquetas') + ' · ' + vm.paginas + (vm.paginas === 1 ? ' folha A4' : ' folhas A4')
              : vm.quantas + (vm.quantas === 1 ? ' empresa' : ' empresas') + ' · A4 deitado'}</span>
            <button type="button" className="btn btn-outline" onClick={fechar}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={!vm.quantas}><Icone nome="printer" width={16} height={16} />Imprimir</button>
          </div>
        </form>
      </div>
    </div>
  );
}
