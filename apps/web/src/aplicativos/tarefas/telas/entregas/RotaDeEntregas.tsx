// Entregas › Rota (16/10/2026: "quero integrar no app … o entregas, só que preciso que fique tudo no visual igual para não
// destoar do app"): a barra (a busca, quem pôs na rota, a região e Nova entrega) e a lista das paradas no jeito da lista do
// Cadastro, na ordem da rota. Clicar na parada (ou em Assinar) abre a janela de confirmar: a assinatura, a foto, ou "não
// entregue". As setas sobem e descem a parada (a ordem vale para todo mundo, como no Entregas).
import { BotaoIcone, Esqueleto, Icone, MenuSuspenso, useCarregando } from '@nads/ui';
import { JanelaDaParada } from './JanelaDaParada';
import { JanelaNovaEntrega } from './JanelaNovaEntrega';
import { useRotaDeEntregas } from './useRotaDeEntregas';

export function RotaDeEntregas() {
  const vm = useRotaDeEntregas();
  useCarregando(vm.carregando);
  return (
    <section className="ent-tela">
      {vm.nova && <JanelaNovaEntrega fechar={() => vm.setNova(false)} />}
      {vm.aberta && <JanelaDaParada id={vm.aberta} fechar={() => vm.setAberta(null)} />}

      <div className="tarefas-barra-topo">
        <label className="busca-curta">
          <Icone nome="search" />
          <input type="text" placeholder="Buscar cliente" aria-label="Buscar cliente na rota (nome, código ou CNPJ)" value={vm.busca}
            onChange={e => vm.setBusca(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') vm.setBusca(''); }} />
        </label>
        <MenuSuspenso icone="usuario" rotulo={vm.pessoa || 'Pessoa'} titulo="Quem pôs na rota" className={'btn btn-outline' + (vm.pessoa ? ' ativo' : '')}
          itens={[{ rotulo: 'Todas as pessoas', marcado: !vm.pessoa, onClick: () => vm.setPessoa('') }, ...vm.pessoas.map(p => ({ rotulo: p, marcado: p === vm.pessoa, onClick: () => vm.setPessoa(p) }))]} />
        <MenuSuspenso icone="home" rotulo={vm.rotuloDasZonas} titulo="Região" className={'btn btn-outline' + (vm.zonas.length ? ' ativo' : '')}
          itens={[{ rotulo: 'Todas as regiões', marcado: !vm.zonas.length, onClick: vm.limparZonas }, ...vm.zonasDaRota.map(z => ({ rotulo: z.rotulo, marcado: vm.zonas.includes(z.valor), onClick: () => vm.alternarZona(z.valor) }))]} />
        <span className="hint">
          {vm.carregando ? '' : vm.paradas + (vm.paradas === 1 ? ' parada' : ' paradas') + (vm.filtrando && vm.linhas.length !== vm.quantas ? ' (de ' + vm.quantas + ' entregas na rota)' : '')}
        </span>
        <span className="tarefas-barra-espaco" />
        {vm.exemplos && <span className="badge badge-neutral">Exemplos</span>}
        <button type="button" className="btn btn-primary" onClick={() => vm.setNova(true)}><Icone nome="plus" />Nova entrega</button>
      </div>
      {vm.erro && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erro}</p>}

      {vm.carregando ? <Esqueleto linhas={5} /> : !vm.linhas.length ? (
        <p className="empty">{vm.quantas ? 'Nenhuma parada com esses filtros.' : 'Nenhuma entrega na rota. Clique em "Nova entrega" para pôr a primeira.'}</p>
      ) : (
        <div className="table-wrap">
          <table className="tabela-empresas cad-lista ent-lista">
            <thead><tr><th className="num">#</th><th>Cliente</th><th>Competência</th><th>Documentos</th><th>Região</th><th>Pôs na rota</th><th aria-label="Ações" /></tr></thead>
            <tbody>
              {vm.linhas.map((l, i) => (
                <tr key={l.e.id} className="linha-abre" tabIndex={0} title="Abrir a parada para confirmar" onClick={() => vm.setAberta(l.e.id)} onKeyDown={e => { if (e.key === 'Enter') vm.setAberta(l.e.id); }}>
                  <td className="num fraco">{l.posicao}</td>
                  <td>
                    <span className="cad-empresa-nome">{l.e.clienteNome}</span>
                    {l.aviso && <span className="ent-aviso"><Icone nome="alert" />{l.aviso}</span>}
                  </td>
                  <td className="fraco">{l.competencia}</td>
                  <td><span className="ent-corta" title={l.documentos}>{l.documentos}</span>{l.total && <span className="fraco num ent-total">{l.total}</span>}</td>
                  <td className="fraco">{l.regiao || '—'}</td>
                  <td className="fraco">{l.e.entregadoPorNome || l.e.entregadoPor || '—'}</td>
                  <td className="ent-acoes" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
                    {l.e.tentativa > 1 && <span className="badge badge-bad">{l.e.tentativa}ª vez</span>}
                    {l.juntas > 1 && <span className="badge badge-neutral" title="Paradas no mesmo lugar: dá para confirmar todas juntas">{l.juntas} juntas</span>}
                    <BotaoIcone icone="arrowUp" titulo="Subir na rota" pequeno disabled={vm.movendo || i === 0} onClick={() => void vm.mover(l.e.id, -1)} />
                    <BotaoIcone icone="arrowDown" titulo="Descer na rota" pequeno disabled={vm.movendo || i === vm.linhas.length - 1} onClick={() => void vm.mover(l.e.id, 1)} />
                    <button type="button" className="btn" onClick={() => vm.setAberta(l.e.id)}><Icone nome="lapis" />Assinar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
