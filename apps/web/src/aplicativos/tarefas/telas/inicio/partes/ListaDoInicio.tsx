// Minhas tarefas e Documentos do Início novo (o print de My tasks): um cartão por grupo (Atrasadas, Hoje, Amanhã, Esta
// semana, Mais adiante, Sem prazo), cada um com a tabela: a caixinha (concluir), a tarefa, o prazo, a situação, a
// prioridade, o cliente (no lugar de Team) e o responsável. Em cima, quais (Minhas, Delegadas por mim, Concluídas; nos
// Documentos, Recebidos, Enviados, Concluídos), a busca e os filtros (a prioridade, o cliente e a pessoa). O ViewModel é o da Central (useCentralDeTarefas), com
// os grupos do print e, nos Documentos, só os documentos delegados.
import { Icone, LogoExcel, MenuSuspenso, Segmentado, Vazio } from '@nads/ui';
import { useState } from 'react';
import { MenuDeFiltro } from '../../dp/MenuDeFiltro';
import { SeloDaPrioridade, SeloDoStatus } from '../../delegador/partes/SelosDaTarefa';
import { useCentralDeTarefas, type AbaDaCentral } from '../../delegador/useCentralDeTarefas';
import type { PessoaComFoto } from '../useInicioNovo';
import { Foto } from './PainelDoInicio';

const TOM: Record<string, 'warn' | 'info' | 'neutral' | 'ok'> = { pendente: 'warn', andamento: 'info', pausada: 'neutral', concluida: 'ok', cancelada: 'neutral' };
const ROTULO_DOS_DOCUMENTOS: Record<AbaDaCentral, string> = { minhas: 'Recebidos', delegadas: 'Enviados', concluidas: 'Concluídos' };

/** o filtro por cliente (Vitor, 13/11/2026: "Coloca filtro por cliente"): o menu com a busca, como o cliente da comissão */
function FiltroDeCliente({ valor, mudar, opcoes }: { valor: string; mudar: (v: string) => void; opcoes: readonly string[] }) {
  const [q, setQ] = useState('');
  const achados = (q.trim() ? opcoes.filter(o => o.toLowerCase().includes(q.trim().toLowerCase())) : opcoes).slice(0, 80);
  const escolher = (fechar: () => void, v: string) => { fechar(); mudar(v); setQ(''); };
  return (
    <MenuSuspenso rotulo={valor ? 'Cliente: ' + valor : 'Cliente'} className={'btn btn-outline ini-filtro-cliente' + (valor ? ' ativo' : '')} titulo="Filtrar pelo cliente" flutuante largura={380}
      conteudo={fechar => (
        <>
          <label className="busca-curta larga">
            <Icone nome="search" />
            <input type="text" placeholder="Buscar pelo nome ou código" aria-label="Buscar o cliente" value={q} onChange={e => setQ(e.target.value)}
              ref={el => { if (el && document.activeElement !== el) setTimeout(() => el.focus(), 0); }}
              onKeyDown={e => { if (e.key === 'Enter' && achados.length === 1) escolher(fechar, achados[0]); }} />
          </label>
          <div className="menu-busca-lista">
            <button type="button" className="popover-item" role="menuitemcheckbox" aria-checked={!valor} onClick={() => escolher(fechar, '')}>
              <span className="popover-marca">{!valor && <Icone nome="check" />}</span><span className="popover-texto">Todos os clientes</span>
            </button>
            {achados.map(o => (
              <button key={o} type="button" className="popover-item" role="menuitemcheckbox" aria-checked={o === valor} onClick={() => escolher(fechar, o)}>
                <span className="popover-marca">{o === valor && <Icone nome="check" />}</span><span className="popover-texto">{o}</span>
              </button>
            ))}
            {!achados.length && <p className="hint">Nenhum cliente com essa busca.</p>}
          </div>
        </>
      )} />
  );
}

export function ListaDoInicio({ documentos = false, abrir, comFoto }: { documentos?: boolean; abrir: (id: string) => void; comFoto: (p: { uid: string; nome: string }) => PessoaComFoto }) {
  const vm = useCentralDeTarefas('minhas', { agenda: true, documentos });
  return (
    <section className="ini-lista">
      <div className="tarefas-barra-topo">
        <Segmentado valor={vm.aba} onMudar={vm.mudarAba}
          opcoes={vm.abas.map(a => ({ valor: a.id, rotulo: (documentos ? ROTULO_DOS_DOCUMENTOS[a.id] : a.rotulo) + (a.qtd ? ' (' + a.qtd + ')' : '') }))} />
        {!vm.abaVazia && (
          <>
            <label className="busca-curta">
              <Icone nome="search" />
              <input type="text" placeholder="Buscar por número, título ou cliente" aria-label="Buscar nesta lista" value={vm.busca}
                onChange={e => vm.setBusca(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') vm.setBusca(''); }} />
            </label>
            <MenuDeFiltro rotulo="Prioridade" valor={vm.prioridade} mudar={vm.setPrioridade} todos="Todas as prioridades" opcoes={vm.opcoesDePrioridade} />
            {vm.clientes.length > 0 && <FiltroDeCliente valor={vm.cliente} mudar={vm.setCliente} opcoes={vm.clientes} />}
            {vm.pessoas.length > 0 && <MenuDeFiltro rotulo={vm.colunaDaPessoa} valor={vm.quem} mudar={vm.setQuem} todos="Todas as pessoas" opcoes={vm.pessoas} />}
            {vm.algumFiltro && <button type="button" className="btn btn-ghost dp-limpar" onClick={vm.limparFiltros}><Icone nome="x" />Limpar</button>}
          </>
        )}
        <span className="tarefas-barra-espaco" />
        {!vm.abaVazia && (
          <MenuSuspenso rotulo={<LogoExcel />} semSeta className="icon-btn" titulo="Exportar a lista" dica="Exportar a lista" direita
            itens={[
              { rotulo: 'Planilha do Excel (.xlsx)', icone: 'relatorio', desabilitado: !vm.podeExportar, onClick: () => vm.exportar('xlsx') },
              { rotulo: 'Texto separado (.csv)', icone: 'relatorio', desabilitado: !vm.podeExportar, onClick: () => vm.exportar('csv') },
            ]} />
        )}
      </div>
      {vm.erro && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erro}</p>}
      {!vm.carregando && !vm.temLinhas && (
        <section className="card">
          <Vazio icone={vm.abaVazia ? 'checkCircle' : 'search'} titulo={documentos && vm.abaVazia ? 'Nenhum documento delegado' : vm.vazio.titulo} texto={documentos && vm.abaVazia ? 'Os pedidos de documentos que você recebe ou envia aparecem aqui.' : vm.vazio.texto}>
            {!vm.abaVazia && <button type="button" className="btn btn-outline" onClick={vm.limparFiltros}>Limpar os filtros</button>}
          </Vazio>
        </section>
      )}
      {vm.grupos.map(g => (
        <section key={g.id} className="card ini-grupo">
          {g.rotulo && <div className="card-head"><h3>{g.rotulo}</h3></div>}
          <div className="table-wrap">
            <table className="table-compact ini-tabela">
              <thead>
                <tr><th aria-label="Concluir" /><th>Tarefa</th><th>Prazo</th><th>Situação</th><th>Prioridade</th><th>Cliente</th><th>{vm.aba === 'minhas' ? 'Quem delegou' : 'Responsável'}</th></tr>
              </thead>
              <tbody>
                {g.linhas.map(l => {
                  const concluir = l.acoes?.find(a => a.id === 'concluir');
                  return (
                    <tr key={l.id} className="ini-tr" onClick={() => abrir(l.id)} title="Abrir a tarefa">
                      <td className="ini-marca" onClick={e => e.stopPropagation()}>
                        {/* a Caixinha da etapa (o catálogo): vazia conclui; a concluída fica marcada (Vitor, 13/11/2026: "Melhora esse check") */}
                        {concluir
                          ? <button type="button" className="subnav-caixa vazia" title="Concluir" aria-label={'Concluir ' + l.titulo} onClick={() => vm.fazerAcao(l.id, concluir.status)} />
                          : <span className={'subnav-caixa ' + (l.status.valor === 'concluida' ? 'marcada' : 'vazia')} aria-hidden="true">{l.status.valor === 'concluida' && <Icone nome="check" />}</span>}
                      </td>
                      <td><button type="button" className="ini-abrir" onClick={e => { e.stopPropagation(); abrir(l.id); }}>{l.titulo}</button></td>
                      <td className={l.atrasada ? 'tdl-atrasada' : undefined}>{l.prazoCurto || '—'}</td>
                      <td><SeloDoStatus rotulo={l.status.rotulo} tom={TOM[l.status.valor] || 'neutral'} /></td>
                      <td><SeloDaPrioridade valor={l.prioridade.valor} rotulo={l.prioridade.rotulo} /></td>
                      <td title={l.clientes}>{l.cliente || '—'}{l.maisClientes ? <span className="fraco"> +{l.maisClientes}</span> : null}</td>
                      <td>
                        {vm.aba === 'minhas' ? l.pessoa
                          : <span className="ini-pessoa"><Foto p={comFoto(l.responsavel)} />{l.responsavel.nome}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </section>
  );
}
