// O "Arquivar agora" na barra do Drive: o botão (que vira "Organizando 45%" enquanto o arquivador trabalha — pelo
// botão ou a organização das 9h) abre um painel curto: se o PC do arquivador está ligado, a organização em andamento (a
// fase e a barra), o pedido (os números quando termina), as rodadas de hoje somadas e o Organizar agora.
import { Icone, MenuSuspenso, type NomeIcone } from '@nads/ui';
import { useArquivadorDoDrive } from './useArquivadorDoDrive';

const ICONES: Record<string, NomeIcone> = { pendente: 'clock', aguardando: 'clock', processando: 'girar', concluido: 'checkCircle', erro: 'alert', cancelado: 'x' };

function Numeros({ numeros }: { numeros: { valor: number; rotulo: string; aviso: boolean }[] }) {
  return (
    <div className="arquivador-numeros">
      {numeros.map(n => <div key={n.rotulo} className={'arquivador-numero' + (n.aviso ? ' aviso' : '')}><b>{n.valor}</b><span>{n.rotulo}</span></div>)}
    </div>
  );
}

export function BotaoDoArquivador() {
  const vm = useArquivadorDoDrive();
  if (!vm.visivel) return null;
  const p = vm.pedido;
  const r = vm.rotina;
  return (
    <MenuSuspenso icone="arquivo" rotulo={vm.rotulo} className={'btn btn-outline arquivador-btn' + (vm.ocupado ? ' ocupado' : '')} direita largura={360}
      dica="Organizar agora a pasta Claudio Secretario (cada arquivo vai para a pasta do cliente), como a organização das 9h" titulo="Arquivar"
      conteudo={() => (
        <div className="arquivador-painel">
          <p className={'arquivador-pc' + (vm.ligado ? ' ligado' : '')}><span className="arquivador-ponto" aria-hidden="true" />{vm.pc}</p>
          {r && (
            <section className="arquivador-pedido processando">
              <header className="arquivador-pedido-topo">
                <Icone nome="girar" />
                <b>{r.titulo}</b>
                {r.pct != null && <span className="arquivador-pct">{r.pct}%</span>}
              </header>
              <p className="arquivador-detalhe">{r.detalhe}</p>
              <span className="tarefas-barra larga andando"><span style={{ width: (r.pct ?? 8) + '%' }} /></span>
              {r.etapa && <p className="arquivador-etapa">{r.etapa}</p>}
              {vm.hoje && (
                <>
                  <p className="arquivador-etapa">Até agora hoje ({vm.hoje.rodadas} {vm.hoje.rodadas === 1 ? 'rodada' : 'rodadas'}):</p>
                  <Numeros numeros={vm.hoje.numeros} />
                </>
              )}
            </section>
          )}
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
                  <Numeros numeros={p.resultado.numeros} />
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
          {!r && vm.hoje && (
            <section className="arquivador-hoje">
              <p className="arquivador-etapa">Hoje ({vm.hoje.rodadas} {vm.hoje.rodadas === 1 ? 'rodada' : 'rodadas'}):</p>
              <Numeros numeros={vm.hoje.numeros} />
            </section>
          )}
          {vm.podePedir && (
            <button type="button" className="btn btn-primary arquivador-largo" disabled={vm.pedindo} onClick={() => void vm.pedir()}>
              {vm.pedindo ? <span className="btn-spinner" aria-hidden="true" /> : <Icone nome="arquivo" />}Organizar agora
            </button>
          )}
          {vm.podePedir && <p className="arquivador-nota">{vm.notaAoPedir}{vm.exemplos ? ' (Exemplo: nada sai daqui.)' : ''}</p>}
        </div>
      )} />
  );
}
