// A Central de documentos como biblioteca (12/11/2026: "retrabalhe completamente a central de documentos"; a escolhida:
// "biblioteca com pastas"; 13/11/2026: "preciso de mais melhoras", "tudo isso"). No alto, as pastas em cartões com o
// ícone e a contagem; embaixo a busca e o mês e a lista por mês de referência: marcar, o ícone do arquivo, o nome (clicar
// abre a visualização, com as setas para o anterior e o próximo), a pasta num selo colorido, a data e as ações (ver e
// baixar, que aparecem ao passar o mouse). Marcar vários (ou "Baixar o mês") junta tudo num .zip. O que o cliente enviou
// aparece como "Recebido": o arquivo fica com o escritório. Só desenha: o estado e as ações vêm de useDocumentos.ts.
import { CampoEscolha, Icone, IconeDeArquivo } from '@nads/ui';
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
        </div>
        <div className="cli-acoes">
          <button type="button" className="btn btn-primary" onClick={enviar}><Icone nome="upload" width={16} height={16} />Enviar documento</button>
        </div>
      </div>

      {/* as pastas em cartões */}
      <nav className="cli-pastas-cartoes" aria-label="Pastas">
        {vm.pastas.map(p => (
          <button key={p.id || 'tudo'} type="button" className={'cli-pasta-cartao t-' + p.tom + (p.ativa ? ' ativa' : '')} aria-current={p.ativa ? 'true' : undefined} onClick={() => vm.escolherPasta(p.id)}>
            <span className="cli-pasta-cartao-ico" aria-hidden="true"><Icone nome={p.icone} width={17} height={17} /></span>
            <span className="cli-pasta-cartao-txt"><b>{p.n}</b><span>{p.rotulo}</span></span>
          </button>
        ))}
      </nav>

      <section className="card cli-biblioteca-lista">
        <div className="cli-biblioteca-filtros">
          <label className="cli-marcar-todos" title="Marcar todos os que abrem">
            <input type="checkbox" checked={vm.todosMarcados} onChange={vm.marcarTodos} aria-label="Marcar todos" />
          </label>
          <label className="cli-busca">
            <Icone nome="search" width={16} height={16} />
            <input type="text" value={vm.busca} onChange={e => vm.mudarBusca(e.target.value)} placeholder="Buscar pelo nome" aria-label="Buscar documento" />
          </label>
          <span className="cli-biblioteca-mes-campo">
            <CampoEscolha rotulo="Mês de referência" valor={vm.mes} opcoes={[{ valor: '', rotulo: 'Todos os meses' }, ...vm.meses]} onMudar={vm.mudarMes} />
          </span>
        </div>

        {vm.grupos.length ? vm.grupos.map(g => (
          <div key={g.mes} className="cli-biblioteca-mes">
            <div className="cli-biblioteca-mes-topo">
              <p className="cli-biblioteca-mes-titulo">{g.titulo}</p>
              {g.abrem > 1 && <button type="button" className="cli-baixar-tudo" disabled={!!vm.juntando} onClick={g.baixarMes} title="Baixar os documentos do mês num .zip"><Icone nome="download" width={15} height={15} />Baixar o mês<span className="cli-baixar-n">{g.abrem}</span></button>}
            </div>
            <ul>
              {g.itens.map(i => (
                <li key={i.chave} className={'cli-biblioteca-item' + (i.marcado ? ' marcado' : '') + (i.novo ? ' novo' : '')}>
                  {i.abre
                    ? <input type="checkbox" className="cli-biblioteca-marca" checked={i.marcado} onChange={() => vm.marcar(i.chave)} aria-label={'Marcar ' + i.nome} />
                    : <span className="cli-biblioteca-marca" aria-hidden="true" />}
                  <IconeDeArquivo formato={i.formato} tamanho={34} />
                  {i.abre ? (
                    <button type="button" className="cli-biblioteca-txt cli-biblioteca-abrir" disabled={vm.vista.abrindo === i.chave} onClick={() => vm.ver(i)} title={'Ver ' + i.nome}>
                      <b>{i.nome}{i.novo && <span className="badge badge-warn cli-biblioteca-novo">Novo</span>}</b>
                      <span className="hint">{i.detalhe}</span>
                    </button>
                  ) : (
                    <span className="cli-biblioteca-txt">
                      <b>{i.nome}</b>
                      <span className="hint">{i.detalhe}</span>
                    </span>
                  )}
                  <span className="cli-biblioteca-pasta cli-so-largo"><span className={'cli-selo-pasta t-' + i.tomDaPasta}>{i.rotuloDaPasta}</span></span>
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

      {/* a barra dos marcados: baixar todos num .zip */}
      {(vm.marcadosN > 0 || vm.juntando) && (
        <div className="cli-barra-marcados" role="region" aria-label="Documentos marcados">
          <b>{vm.juntando || (vm.marcadosN === 1 ? '1 marcado' : vm.marcadosN + ' marcados')}</b>
          {!vm.juntando && <button type="button" className="btn btn-ghost btn-sm" onClick={vm.desmarcar}>Desmarcar</button>}
          <button type="button" className="btn btn-primary btn-sm" disabled={!!vm.juntando} onClick={vm.baixarMarcados}><Icone nome="download" width={16} height={16} />Baixar .zip</button>
        </div>
      )}

      {vm.vista.aberto && <JanelaDoArquivo arquivo={vm.vista.aberto} onBaixar={vm.vista.baixar} onFechar={vm.vista.fechar}
        onAnterior={vm.anterior} onProximo={vm.proximo} posicao={vm.posicao} abrindo={!!vm.vista.abrindo} />}
    </>
  );
}
