// O "Arquivar agora" na barra do Drive: o botão (que vira "Organizando 45%" enquanto o arquivador trabalha) abre um
// painel curto: se o PC do arquivador está ligado, o pedido (a etapa e a barra enquanto organiza; os números quando
// termina: arquivados, clientes e sem cliente) e o Organizar agora. Sem o log da rotina (Vitor, 05/10/2026: "que
// negócio terrível").
import { Icone, MenuSuspenso, type NomeIcone } from '@nads/ui';
import { useArquivadorDoDrive } from './useArquivadorDoDrive';

const ICONES: Record<string, NomeIcone> = { pendente: 'clock', aguardando: 'clock', processando: 'girar', concluido: 'checkCircle', erro: 'alert', cancelado: 'x' };

export function BotaoDoArquivador() {
  const vm = useArquivadorDoDrive();
  if (!vm.visivel) return null;
  const p = vm.pedido;
  return (
    <MenuSuspenso icone="arquivo" rotulo={vm.rotulo} className={'btn btn-outline arquivador-btn' + (vm.ocupado ? ' ocupado' : '')} direita largura={360}
      dica="Organizar agora a pasta Claudio Secretario (cada arquivo vai para a pasta do cliente), como a organização das 9h" titulo="Arquivar"
      conteudo={() => (
        <div className="arquivador-painel">
          <p className={'arquivador-pc' + (vm.ligado ? ' ligado' : '')}><span className="arquivador-ponto" aria-hidden="true" />{vm.pc}</p>
          {p && (
            <section className={'arquivador-pedido ' + p.status}>
              <header className="arquivador-pedido-topo">
                <Icone nome={ICONES[p.status] || 'arquivo'} />
                <b>{p.titulo}</b>
                {p.pct != null && <span className="arquivador-pct">{p.pct}%</span>}
              </header>
              <p className="arquivador-detalhe">{p.detalhe}</p>
              {p.status === 'processando' && (
                <>
                  <span className="tarefas-barra larga andando"><span style={{ width: (p.pct ?? 5) + '%' }} /></span>
                  {p.etapa && <p className="arquivador-etapa">{p.etapa}</p>}
                </>
              )}
              {p.resultado && (p.resultado.vazio ? <p className="arquivador-detalhe">Não havia nada novo para arquivar.</p> : (
                <>
                  <div className="arquivador-numeros">
                    {p.resultado.numeros.map(n => (
                      <div key={n.rotulo} className={'arquivador-numero' + (n.aviso ? ' aviso' : '')}><b>{n.valor}</b><span>{n.rotulo}</span></div>
                    ))}
                  </div>
                  {p.resultado.clientes.length > 0 && (
                    <ul className="arquivador-clientes">
                      {p.resultado.clientes.map(c => <li key={c.chave}><span>{c.rotulo}</span><b>{c.n}</b></li>)}
                      {p.resultado.maisClientes > 0 && <li className="fraco">e mais {p.resultado.maisClientes} {p.resultado.maisClientes === 1 ? 'cliente' : 'clientes'}</li>}
                    </ul>
                  )}
                </>
              ))}
              {p.semResultado && <p className="arquivador-detalhe">A rotina não gerou relatório novo (nada para arquivar).</p>}
              {p.podeCancelar && <button type="button" className="btn btn-outline arquivador-largo" onClick={() => vm.cancelar(p.id)}>Cancelar o pedido</button>}
            </section>
          )}
          {!vm.ocupado && (
            <button type="button" className="btn btn-primary arquivador-largo" disabled={vm.pedindo} onClick={() => void vm.pedir()}>
              {vm.pedindo ? <span className="btn-spinner" aria-hidden="true" /> : <Icone nome="arquivo" />}Organizar agora
            </button>
          )}
          {!vm.ocupado && <p className="arquivador-nota">Cada arquivo da pasta Claudio Secretario vai para a pasta do cliente, como na organização das 9h.{vm.exemplos ? ' (Exemplo: nada sai daqui.)' : ''}</p>}
        </div>
      )} />
  );
}
