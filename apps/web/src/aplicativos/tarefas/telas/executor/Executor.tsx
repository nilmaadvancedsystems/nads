// O executor: tela cheia, uma etapa por vez. Em cima, a empresa, a competência e as etapas; no meio,
// a ferramenta da etapa e as objeções comuns; embaixo, Interromper e Próximo.
import { Alerta, Icone, MarcaN, useCarregando } from '@nads/ui';
import { Navigate, useParams } from 'react-router';
import { BASE } from '../../casca/navegacao';
import { JanelaInterromper } from './partes/JanelaInterromper';
import { Objecoes } from './partes/Objecoes';
import { useExecutor } from './useExecutor';

export function Executor() {
  const { empresa: rota = '', competencia = '' } = useParams();
  const vm = useExecutor(rota, competencia);
  useCarregando(vm.carregando || vm.conferindo);
  if (!vm.empresa) return <Navigate to={BASE} replace />;

  return (
    <div className="executor">
      <header className="executor-topo">
        <span className="brand-mark" aria-hidden="true"><MarcaN /></span>
        <div className="executor-quem">
          <strong>{vm.empresa.codigo != null ? vm.empresa.codigo + ' · ' : ''}{vm.empresa.nome}</strong>
          <span className="hint">{vm.rotuloCompetencia} · Contábil</span>
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={vm.sair}><Icone nome="x" />Sair</button>
      </header>

      <ol className="executor-etapas" aria-label="Etapas">
        {vm.etapas.map(e => (
          <li key={e.id} className={'executor-passo ' + e.situacao + (e.atual ? ' atual' : '')} aria-current={e.atual ? 'step' : undefined}>
            <span className="executor-bolinha">{e.situacao === 'feita' || e.situacao === 'dispensada' ? <Icone nome="check" /> : e.n}</span>
            <span className="executor-passo-nome">{e.nome}</span>
          </li>
        ))}
      </ol>

      {vm.carregando ? <p className="empty">Carregando…</p> : !vm.etapa ? (
        <div className="executor-fim">
          <Icone nome="checkCircle" />
          <h2>Tudo pronto em {vm.rotuloCompetencia}</h2>
          <p className="hint">Todas as etapas desta empresa estão concluídas.</p>
          <button type="button" className="btn btn-primary" onClick={vm.sair}>Voltar às empresas</button>
        </div>
      ) : (
        <>
          <div className="executor-cabeca">
            <p className="page-eyebrow">Etapa {vm.n} de {vm.total}</p>
            <h1 className="page-title">{vm.etapa.nome}</h1>
            <p className="page-desc">{vm.etapa.descricao}</p>
            {vm.interrompidaAntes && (
              <p className="hint">Parada antes por {vm.interrompidaAntes.por}: {vm.etapa.objecoes.find(o => o.id === vm.interrompidaAntes?.objecao)?.texto || vm.interrompidaAntes.observacao || 'outro motivo'}.</p>
            )}
          </div>
          <div className="executor-corpo">
            <div className="executor-ferramenta">
              {vm.ferramenta?.embutir ? (
                <iframe key={vm.ferramenta.url} src={vm.ferramenta.url} title={vm.ferramenta.nome} />
              ) : vm.ferramenta ? (
                <div className="gh-blank">
                  <Icone nome="link" />
                  <h4>{vm.ferramenta.nome}</h4>
                  <p>Esta etapa abre em outra aba.</p>
                  <a className="btn btn-primary" href={vm.ferramenta.url} target="_blank" rel="noreferrer">Abrir {vm.ferramenta.nome}</a>
                </div>
              ) : (
                <div className="gh-blank">
                  <Icone nome="checklist" />
                  <h4>Feito no sistema</h4>
                  <p>Faça esta etapa no Alterdata e clique em Próximo.</p>
                </div>
              )}
            </div>
            <Objecoes etapa={vm.etapa} destacar={!!vm.aviso} onResolver={vm.resolver} />
          </div>
          <footer className="executor-rodape">
            <div className="executor-aviso">{vm.aviso && <Alerta titulo="Ainda não dá para seguir" texto={vm.aviso} />}</div>
            <button type="button" className="btn btn-outline" onClick={vm.abrirInterromper}>Interromper</button>
            <button type="button" className="btn btn-primary" disabled={vm.conferindo} onClick={() => { void vm.proximo(); }}>
              {vm.conferindo ? <><span className="btn-spinner" />Conferindo…</> : <>Próximo<Icone nome="arrowDown" style={{ transform: 'rotate(-90deg)' }} /></>}
            </button>
          </footer>
          {vm.interrompendo && <JanelaInterromper etapa={vm.etapa} onInterromper={vm.interromper} onCancelar={vm.fecharInterromper} />}
        </>
      )}
    </div>
  );
}
