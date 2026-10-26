// A janela dos papéis do mês do Cadastro › Empresas (Heverton, 20/10/2026), no padrão da janela das Etiquetas da folha
// do DP: as Etiquetas do mês (o envelope), o Protocolo de tributos e os protocolos do ano, de extratos e da REINF
// (22/10/2026). Em cima, as opções numa grade (rótulo e escolha); embaixo, as empresas (todas marcadas; a caixa do topo marca e desmarca todas) e, no rodapé, o total e Imprimir
// (simplificada em 22/10/2026).
import { Icone, Interruptor, Segmentado, SeletorMes, useJanela } from '@nads/ui';
import { useRef } from 'react';
import type { PapelDoCadastro, VmPapeis } from './usePapeisDoCadastro';

const TITULOS: Record<PapelDoCadastro, string> = {
  etiquetas: 'Etiquetas do mês', protocolo: 'Protocolo de entrega de tributos', extratos: 'Protocolo de extratos', reinf: 'Protocolo da REINF',
};
const PREENCHER: Record<PapelDoCadastro, string> = {
  etiquetas: '', protocolo: 'com as guias já entregues', extratos: 'com os extratos já recebidos', reinf: 'com as REINF já transmitidas',
};
const VAZIOS: Record<PapelDoCadastro, string> = {
  etiquetas: 'Nenhuma empresa na lista (veja a busca e a situação).', protocolo: 'Nenhuma empresa da lista neste grupo.',
  extratos: 'Nenhuma empresa da lista com banco no cadastro.', reinf: 'Nenhuma empresa da lista com REINF no Fiscal ou no DP.',
};

export function JanelaDosPapeis({ vm }: { vm: VmPapeis }) {
  const { fechar } = vm;
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, fechar, !!vm.aberto);
  if (!vm.aberto) return null;
  const etiquetas = vm.aberto === 'etiquetas';
  const reinf = vm.aberto === 'reinf';
  // o que já veio para preencher, ao lado do interruptor
  const jaVeio = vm.doAno
    ? (vm.lendoDoAno ? '(lendo…)' : reinf ? '(' + vm.reinfNoAno + ' feitas no DP no ano)' : '(' + vm.extratosNoAno + (vm.extratosNoAno === 1 ? ' no ano)' : ' no ano)'))
    : vm.carregandoEntregas ? '(lendo…)' : '(' + vm.guiasNoMes + ' no mês)';
  return (
    <div className="modal-overlay" onMouseDown={ev => { if (ev.target === ev.currentTarget) fechar(); }}>
      <div ref={janela} className="modal etq-janela papeis-janela" role="dialog" aria-modal="true" aria-labelledby="papeisTitulo">
        <h3 id="papeisTitulo"><Icone nome={etiquetas ? 'fileText' : 'list'} width={16} height={16} />{TITULOS[vm.aberto]}</h3>
        <form className="etq-corpo" onSubmit={ev => { ev.preventDefault(); vm.imprimir(); }}>
          {/* as opções numa grade, como nos diálogos de impressão (22/10/2026: "organizar e simplificar") */}
          <div className="papeis-opcoes">
            {vm.doAno ? (
              <><span>Ano</span><Segmentado valor={String(vm.ano)} opcoes={vm.anos} onMudar={vm.setAno} /></>
            ) : (
              <><span>Competência</span><SeletorMes valor={vm.competencia} onMudar={vm.setCompetencia} rotulo="Competência" /></>
            )}
            {etiquetas ? (
              <>
                <span>Departamento</span><Segmentado valor={vm.departamento} opcoes={vm.departamentos} onMudar={vm.setDepartamento} />
                <span>Na caixa</span><Segmentado valor={vm.caixa} opcoes={vm.textosDaCaixa} onMudar={vm.setCaixa} />
              </>
            ) : (
              <>
                {vm.aberto === 'protocolo' && <><span>Grupo</span><Segmentado valor={vm.grupo.id} opcoes={vm.grupos} onMudar={vm.setGrupo} /></>}
                <span>Preencher</span>
                <span className="papeis-linha">
                  <Interruptor ligado={vm.preencher} onMudar={vm.alternarPreencher} rotulo={'Preencher ' + PREENCHER[vm.aberto]} />
                  <span>{PREENCHER[vm.aberto]} {vm.preencher && jaVeio}</span>
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
            ) : <p className="fraco">{VAZIOS[vm.aberto]}</p>}
          </div>
          <div className="modal-actions">
            <span className="papeis-total fraco">{etiquetas
              ? vm.quantas + (vm.quantas === 1 ? ' etiqueta' : ' etiquetas') + ' · uma por folha A4 deitada'
              : vm.quantas + (vm.quantas === 1 ? ' empresa' : ' empresas') + (vm.aberto === 'extratos' ? ' · A4 em pé' : ' · A4 deitado')}</span>
            <button type="button" className="btn btn-outline" onClick={fechar}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={!vm.quantas}><Icone nome="printer" width={16} height={16} />Imprimir</button>
          </div>
        </form>
      </div>
    </div>
  );
}
