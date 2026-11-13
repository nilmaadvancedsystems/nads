// As Tarefas e os Documentos do Início novo (o print de My tasks): um cartão por grupo (Atrasadas, Hoje, Amanhã, Esta semana,
// Mais adiante, Sem prazo; nos Documentos, também os Concluídos), cada um com a tabela: a caixinha (concluir), a tarefa, o
// prazo, a situação, a prioridade, o cliente (no lugar de Team) e a pessoa. Qual lista das Tarefas (Minhas, Delegadas por mim,
// Concluídas) vem da barra lateral padrão da casca ("Menu lateral padrão nads!"); a busca, as pílulas e o cliente vêm da busca
// do alto (uma busca só na tela); aqui ficam a prioridade, a pessoa e a planilha. O ViewModel é o da Central
// (useCentralDeTarefas), com os grupos do print e, nos Documentos, todos os documentos delegados juntos.
import { tarefas } from '@nads/core';
import { Icone, LogoExcel, MenuSuspenso, Vazio } from '@nads/ui';
import { MenuDeFiltro } from '../../dp/MenuDeFiltro';
import { SeloDaPrioridade, SeloDoStatus } from '../../delegador/partes/SelosDaTarefa';
import { useCentralDeTarefas, type AbaDaCentral } from '../../delegador/useCentralDeTarefas';
import type { PessoaComFoto } from '../useInicioNovo';
import { Foto } from './PainelDoInicio';

const TOM: Record<string, 'warn' | 'info' | 'neutral' | 'ok'> = { pendente: 'warn', andamento: 'info', pausada: 'neutral', concluida: 'ok', cancelada: 'neutral' };
export function ListaDoInicio({ documentos = false, lista: qual = 'minhas', busca, filtrar, abrir, comFoto }: {
  documentos?: boolean; lista?: AbaDaCentral; busca: string; filtrar: (t: tarefas.delegadas.TarefaDelegada) => boolean;
  abrir: (id: string) => void; comFoto: (p: { uid: string; nome: string }) => PessoaComFoto;
}) {
  const vm = useCentralDeTarefas(qual, { agenda: true, documentos, semDocumentos: !documentos, busca, filtrar });
  return (
    <section className="ini-lista">
      <div className="tarefas-barra-topo">
        {!vm.abaVazia && (
          <>
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
          {g.rotulo && <div className="card-head"><h3>{g.rotulo}</h3></div>}
          <div className="table-wrap">
            <table className="table-compact ini-tabela">
              <thead>
                <tr><th aria-label="Concluir" /><th>Tarefa</th><th>Prazo</th><th>Situação</th><th>Prioridade</th><th>Cliente</th><th>{documentos ? vm.colunaDaPessoa : vm.aba === 'minhas' ? 'Quem delegou' : 'Responsável'}</th></tr>
              </thead>
              <tbody>
                {g.linhas.map(l => {
                  // os documentos (o envio e o requerer) não concluem pela caixinha: o requerer termina quando quem pediu confere e o
                  // envio quando quem recebeu confirma, na janela (13/11/2026)
                  const concluir = tarefas.delegadas.pedeDocumentos(l) ? undefined : l.acoes?.find(a => a.id === 'concluir');
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
                      <td title={l.clientes}>{l.cliente || '—'}{(l.maisClientes ?? 0) > 0 && <span className="fraco"> +{l.maisClientes}</span>}</td>
                      <td>
                        {vm.aba === 'minhas' || documentos ? l.pessoa
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
