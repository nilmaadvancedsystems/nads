// Cadastro › Plano de contas: a barra de cima (empresa ▾, quantas contas, de onde veio, busca, Grupo ▾,
// "Importar ▾") e a lista, com o recuo da classificação, as sintéticas em negrito e onde cada conta é usada.
import { Icone, MenuSuspenso, useCarregando } from '@nads/ui';
import { useRef } from 'react';
import { TrocarEmpresa } from '../partes/TrocarEmpresa';
import { usePlanoDeContas } from './usePlanoDeContas';

export function PlanoDeContas({ rota }: { rota: string }) {
  const vm = usePlanoDeContas(rota);
  const arquivo = useRef<HTMLInputElement>(null);
  useCarregando(vm.carregando);
  const escolherArquivo = () => arquivo.current?.click();
  return (
    <section>
      <input ref={arquivo} type="file" accept=".xls,.xlsx,.csv,.txt,.ods" hidden
        onChange={e => { const f = e.target.files?.[0] || null; e.target.value = ''; void vm.importarArquivo(f); }} />
      <div className="tarefas-barra-topo">
        <TrocarEmpresa empresa={vm.empresa} rota={rota} pagina="plano" />
        {vm.plano && (
          <span className="tarefas-contador" title={vm.resumo.analiticas + ' recebem lançamento'}>
            <Icone nome="list" /><b>{vm.resumo.total.toLocaleString('pt-BR')}</b> contas
          </span>
        )}
        {vm.plano && <span className="cad-origem">importado {vm.origem}</span>}
        <span className="tarefas-barra-espaco" />
        {vm.plano && (
          <>
            <label className="busca-curta">
              <Icone nome="search" />
              <input type="text" placeholder="Código, classificação ou nome" aria-label="Buscar conta" value={vm.busca}
                onChange={e => vm.setBusca(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') vm.setBusca(''); }} />
            </label>
            {vm.grupos.length > 1 && (
              <MenuSuspenso rotulo={vm.grupo || 'Grupo'} titulo="Grupo" direita className={'btn btn-outline' + (vm.grupo ? ' ativo' : '')}
                itens={[{ rotulo: 'Todos', marcado: !vm.grupo, onClick: () => vm.setGrupo('') }, ...vm.grupos.map(g => ({ rotulo: g, marcado: g === vm.grupo, onClick: () => vm.setGrupo(g) }))]} />
            )}
          </>
        )}
        <MenuSuspenso icone="upload" rotulo={vm.plano ? 'Trocar plano' : 'Importar plano'} className={vm.plano ? 'btn btn-outline' : 'btn btn-primary'} direita largura={340}
          itens={[
            { rotulo: 'Planilha do Alterdata…', icone: 'fileUp', dica: 'plano ou balancete', onClick: escolherArquivo },
            { rotulo: 'Balancete do Entregas', icone: 'relatorio', dica: 'Clientes › Balancetes', onClick: () => void vm.usarBalancete('entregas') },
            { rotulo: 'Balancete da Conferência', icone: 'relatorio', dica: 'o último do Concilia aí', onClick: () => void vm.usarBalancete('conferencia') },
          ]} />
      </div>

      {!vm.plano ? (
        !vm.carregando && (
          <div className="gh-blank">
            <Icone nome="list" />
            <h4>Esta empresa ainda não tem plano de contas</h4>
            <p>Exporte o plano de contas do Alterdata em Excel e importe aqui. O Creditor passa a usar este plano para achar as contas.</p>
            <p className="cad-botoes">
              <button type="button" className="btn btn-primary" onClick={escolherArquivo}><Icone nome="fileUp" />Escolher a planilha</button>
              <button type="button" className="btn btn-outline" onClick={() => void vm.usarBalancete('entregas')}>Usar o balancete do Entregas</button>
              <button type="button" className="btn btn-outline" onClick={() => void vm.usarBalancete('conferencia')}>Usar o balancete da Conferência</button>
            </p>
          </div>
        )
      ) : !vm.achadas ? (
        <p className="empty">Nenhuma conta com isso.</p>
      ) : (
        <div className="table-wrap">
          <table className="cad-tabela cad-plano">
            <thead><tr><th>Classificação</th><th>Código</th><th>Conta</th><th>Grupo</th><th>Usada em</th></tr></thead>
            <tbody>
              {vm.linhas.map(x => (
                <tr key={x.codigo} className={x.sintetica ? 'cad-sintetica' : undefined}>
                  <td className="num fraco">{x.classificacao || ''}</td>
                  <td className="num">{x.codigo}</td>
                  <td><span style={{ paddingLeft: Math.min(x.nivel, 6) * 14 }}>{x.nome}</span></td>
                  <td className="fraco">{x.grupo || ''}</td>
                  <td>{x.usos.map(u => <span key={u} className="badge badge-neutral cad-badge" title={u}>{u}</span>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {vm.achadas > vm.limite && <p className="hint" style={{ padding: '8px 16px' }}>Mostrando {vm.limite} de {vm.achadas.toLocaleString('pt-BR')}. Use a busca ou o grupo.</p>}
        </div>
      )}
    </section>
  );
}
