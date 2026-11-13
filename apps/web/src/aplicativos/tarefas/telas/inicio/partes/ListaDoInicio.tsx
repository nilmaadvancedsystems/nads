// Minhas tarefas e Documentos do Início novo (o print de My tasks): um cartão por grupo (Atrasadas, Hoje, Amanhã, Esta
// semana, Mais adiante, Sem prazo), cada um com a tabela: o círculo (concluir), a tarefa, o prazo, a situação, a
// prioridade, o cliente (no lugar de Team) e o responsável. Em cima, quais (Minhas, Delegadas por mim, Concluídas; nos
// Documentos, Recebidos, Enviados, Concluídos), a busca e os filtros. O ViewModel é o da Central (useCentralDeTarefas), com
// os grupos do print e, nos Documentos, só os documentos delegados.
import { Icone, LogoExcel, MenuSuspenso, Segmentado, Vazio } from '@nads/ui';
import { MenuDeFiltro } from '../../dp/MenuDeFiltro';
import { SeloDaPrioridade, SeloDoStatus } from '../../delegador/partes/SelosDaTarefa';
import { useCentralDeTarefas, type AbaDaCentral } from '../../delegador/useCentralDeTarefas';
import type { PessoaComFoto } from '../useInicioNovo';
import { Foto } from './PainelDoInicio';

const TOM: Record<string, 'warn' | 'info' | 'neutral' | 'ok'> = { pendente: 'warn', andamento: 'info', pausada: 'neutral', concluida: 'ok', cancelada: 'neutral' };
const ROTULO_DOS_DOCUMENTOS: Record<AbaDaCentral, string> = { minhas: 'Recebidos', delegadas: 'Enviados', concluidas: 'Concluídos' };

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
          {g.rotulo && <div className="card-head"><h3>{g.rotulo} <span className="fraco num">({g.linhas.length})</span></h3></div>}
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
                        {concluir
                          ? <button type="button" className="icon-btn icon-btn-sm" title="Concluir" aria-label={'Concluir ' + l.titulo} onClick={() => vm.fazerAcao(l.id, concluir.status)}><Icone nome="checkCircle" /></button>
                          : <span className={'icon-btn icon-btn-sm' + (l.status.valor === 'concluida' ? ' cor-entrada' : ' fraco')} aria-hidden="true"><Icone nome={l.status.valor === 'concluida' ? 'check' : 'checkCircle'} /></span>}
                      </td>
                      <td><button type="button" className="ini-abrir" onClick={e => { e.stopPropagation(); abrir(l.id); }}><span className="fraco num">{l.numero}</span> {l.titulo}</button></td>
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
