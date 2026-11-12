// A Central de documentos como biblioteca (12/11/2026: "retrabalhe completamente a central de documentos"; a escolhida:
// "biblioteca com pastas"). À esquerda as pastas com a contagem (no celular, uma fila de botões que rola); à direita a
// busca e o mês e a lista por mês de referência, no estilo extrato: o ícone do arquivo, o nome com o detalhe, a pasta, a
// data e as ações (ver na janela de visualização e baixar). O que o cliente enviou aparece como "Recebido": o arquivo fica
// com o escritório. Só desenha: o estado e as ações vêm de useDocumentos.ts.
import { Icone, IconeDeArquivo } from '@nads/ui';
import { JanelaDoArquivo } from '../partes/JanelaDoArquivo';
import { Vazio } from '../partes/Vazio';
import { useJanelaDeEnvio } from './JanelaDeEnvio';
import { useDocumentos } from './useDocumentos';
import type { DaCasca } from './useAreaCliente';

export function Documentos(props: DaCasca) {
  const vm = useDocumentos(props);
  const enviar = useJanelaDeEnvio(props);
  return (
    <>
      <div className="cli-titulo">
        <div>
          <h1 className="page-title">Central de documentos</h1>
          <p className="hint cli-titulo-sub">{vm.total ? vm.total + (vm.total === 1 ? ' documento' : ' documentos') + ' seus e do escritório' : 'Seus documentos e os do escritório'}</p>
        </div>
        <div className="cli-acoes">
          <button type="button" className="btn btn-primary" onClick={enviar}><Icone nome="upload" width={16} height={16} />Enviar documento</button>
        </div>
      </div>

      <div className="cli-biblioteca">
        <nav className="cli-pastas" aria-label="Pastas">
          {vm.pastas.map(p => (
            <button key={p.id || 'tudo'} type="button" className={'cli-pasta' + (p.ativa ? ' ativa' : '')} aria-current={p.ativa ? 'true' : undefined} onClick={() => vm.escolherPasta(p.id)}>
              <Icone nome={p.icone} width={16} height={16} />
              <span>{p.rotulo}</span>
              <b>{p.n}</b>
            </button>
          ))}
        </nav>

        <section className="card cli-biblioteca-lista">
          <div className="cli-biblioteca-filtros">
            <label className="cli-busca">
              <Icone nome="search" width={16} height={16} />
              <input type="text" value={vm.busca} onChange={e => vm.mudarBusca(e.target.value)} placeholder="Buscar pelo nome" aria-label="Buscar documento" />
            </label>
            <select value={vm.mes} onChange={e => vm.mudarMes(e.target.value)} aria-label="Mês de referência">
              <option value="">Todos os meses</option>
              {vm.meses.map(m => <option key={m.valor} value={m.valor}>{m.rotulo}</option>)}
            </select>
          </div>

          {vm.grupos.length ? vm.grupos.map(g => (
            <div key={g.mes} className="cli-biblioteca-mes">
              <p className="cli-biblioteca-mes-titulo">{g.titulo}</p>
              <ul>
                {g.itens.map(i => (
                  <li key={i.chave} className="cli-biblioteca-item">
                    <IconeDeArquivo formato={i.formato} tamanho={34} />
                    <span className="cli-biblioteca-txt">
                      <b>{i.nome}{i.novo && <span className="badge badge-warn cli-biblioteca-novo">Novo</span>}</b>
                      <span className="hint">{i.detalhe}</span>
                    </span>
                    <span className="cli-biblioteca-pasta cli-so-largo">{i.rotuloDaPasta}</span>
                    <span className="cli-biblioteca-data cli-so-largo">{i.quando}</span>
                    <span className="cli-biblioteca-acoes">
                      {i.abre ? (
                        <>
                          <button type="button" className="icon-btn" title="Ver" aria-label={'Ver ' + i.nome} disabled={vm.vista.abrindo === i.chave} onClick={() => vm.ver(i)}><Icone nome="olho" width={16} height={16} /></button>
                          <button type="button" className="icon-btn" title="Baixar" aria-label={'Baixar ' + i.nome} disabled={vm.baixando === i.chave} onClick={() => vm.baixar(i)}><Icone nome="download" width={16} height={16} /></button>
                        </>
                      ) : <span className="cli-biblioteca-recebido"><Icone nome="check" width={14} height={14} />Recebido</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )) : vm.total ? (
            <Vazio icone="search" titulo="Nada com esse filtro" acao={{ rotulo: 'Limpar os filtros', onClick: vm.limpar }} />
          ) : (
            <Vazio icone="pastaAberta" titulo="Nenhum documento ainda" texto="As guias, a folha e o que você enviar ao escritório aparecem aqui." />
          )}
        </section>
      </div>
      {vm.vista.aberto && <JanelaDoArquivo arquivo={vm.vista.aberto} onBaixar={vm.vista.baixar} onFechar={vm.vista.fechar} />}
    </>
  );
}
