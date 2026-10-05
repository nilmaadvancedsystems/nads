// O "Arquivar agora" na barra do Drive: o botão (que vira "Organizando 45%" enquanto o arquivador trabalha) abre um
// painel com o PC do arquivador, o pedido (a barra, a etapa e os últimos passos), Organizar agora e Cancelar.
import { Icone, MenuSuspenso } from '@nads/ui';
import { useArquivadorDoDrive } from './useArquivadorDoDrive';

export function BotaoDoArquivador() {
  const vm = useArquivadorDoDrive();
  if (!vm.visivel) return null;
  const p = vm.pedido;
  return (
    <MenuSuspenso icone="arquivo" rotulo={vm.rotulo} className={'btn btn-outline arquivador-btn' + (vm.ocupado ? ' ocupado' : '')} direita largura={400}
      dica="Organizar agora a pasta Claudio Secretario (cada arquivo vai para a pasta do cliente), como a organização das 9h" titulo="Arquivar"
      conteudo={() => (
        <div className="arquivador-painel">
          <p className={'arquivador-pc' + (vm.ligado ? ' ligado' : '')}><span className="arquivador-ponto" aria-hidden="true" />{vm.pc}</p>
          {p && (
            <div className={'arquivador-pedido ' + p.status}>
              <b>{p.titulo}</b>
              <span className="fraco">{p.detalhe}</span>
              {p.status === 'processando' && (
                <>
                  {p.etapa && <span className="arquivador-etapa">{p.etapa}{p.pct != null && <b>{p.pct}%</b>}</span>}
                  <span className="tarefas-barra larga andando"><span style={{ width: (p.pct ?? 5) + '%' }} /></span>
                </>
              )}
              {p.passos.length > 0 && (
                <ol className="arquivador-passos">
                  {p.passos.map((l, i) => <li key={i} className={l.sub ? 'sub' : undefined}><span className="fraco">{l.hora}</span>{l.texto}</li>)}
                </ol>
              )}
              {p.podeCancelar && <button type="button" className="btn btn-outline" onClick={() => vm.cancelar(p.id)}>Cancelar o pedido</button>}
            </div>
          )}
          {!vm.ocupado && (
            <div className="arquivador-pe">
              <p className="fraco">Organiza agora a pasta Claudio Secretario, do jeito da organização das 9h: cada arquivo vai para a pasta do cliente.{vm.exemplos ? ' (Exemplo: nada sai daqui.)' : ''}</p>
              <button type="button" className="btn btn-primary" disabled={vm.pedindo} onClick={() => void vm.pedir()}>
                {vm.pedindo ? <span className="btn-spinner" aria-hidden="true" /> : <Icone nome="arquivo" />}Organizar agora
              </button>
            </div>
          )}
        </div>
      )} />
  );
}
