// "Meus envios" (Drive › Enviar ▾): o que a pessoa mandou para o Claudio Secretário nos últimos 30 dias e onde cada
// arquivo foi parar depois do arquivamento. Arquivado: "Abrir a pasta" leva o Explorador até a pasta do cliente.
import { Icone } from '@nads/ui';
import { useEffect } from 'react';
import type { VmEnvio } from './useEnvioAoSecretario';

export function MeusEnvios({ vm, abrirDestino }: { vm: VmEnvio; abrirDestino: (codigo: string, subpasta: string) => boolean }) {
  useEffect(() => {
    if (!vm.vendoMeus) return;
    const esc = (ev: KeyboardEvent) => { if (ev.key === 'Escape' && !ev.defaultPrevented) { ev.preventDefault(); vm.fecharMeus(); } };
    window.addEventListener('keydown', esc, true);
    return () => window.removeEventListener('keydown', esc, true);
  }, [vm.vendoMeus, vm]);
  if (!vm.vendoMeus) return null;
  return (
    <div className="modal-overlay" onMouseDown={ev => { if (ev.target === ev.currentTarget) vm.fecharMeus(); }}>
      <div className="modal envio-janela meus-envios" role="dialog" aria-modal="true" aria-labelledby="meusTitulo">
        <h3 id="meusTitulo"><Icone nome="upload" />Meus envios ao Claudio Secretário</h3>
        <div className="envio-corpo">
          <p className="envio-dica">Os últimos 30 dias. Depois de cada rodada do arquivamento, aparece aqui para onde cada arquivo foi.</p>
          {!vm.meusCarregados ? <p className="fraco">Lendo…</p> : !vm.meus.length ? <p className="fraco">Você ainda não mandou nenhum arquivo.</p> : (
            <ul className="meus-lista">
              {vm.meus.map(x => (
                <li key={x.id} className={'meus-' + x.situacao.tom}>
                  <Icone nome={x.situacao.tom === 'ok' ? 'checkCircle' : x.situacao.tom === 'aviso' ? 'alert' : 'clock'} className="meus-ico" />
                  <div className="meus-texto">
                    <b title={x.nome}>{x.nome}</b>
                    <span className="fraco">{x.quando}</span>
                    <span>{x.situacao.texto}</span>
                  </div>
                  {x.arquivamento?.situacao === 'arquivado' && x.arquivamento.codigo && (
                    <button type="button" className="btn btn-outline btn-sm"
                      onClick={() => { if (abrirDestino(x.arquivamento?.codigo || '', x.arquivamento?.subpasta || '')) vm.fecharMeus(); }}>
                      <Icone nome="pasta" />Abrir a pasta
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {vm.exemplos && <p className="hint">Dados de exemplo: os envios são de mentira.</p>}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={vm.fecharMeus}>Fechar</button>
          <button type="button" className="btn btn-primary" onClick={() => { vm.fecharMeus(); vm.abrir(); }}><Icone nome="upload" />Enviar mais</button>
        </div>
      </div>
    </div>
  );
}
