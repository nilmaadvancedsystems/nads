// Área do Cliente › Links (Vitor, 16/10/2026): as empresas do escritório com e sem link da Área do Cliente. Gerar, copiar,
// mandar no WhatsApp com o texto pronto, trocar e revogar (com confirmação): só o admin e os diretores veem esses botões.
import { Alerta, Esqueleto, Icone, MenuSuspenso, useCarregando } from '@nads/ui';
import { enderecoDoLink } from '../../dados/areaCliente';
import { BotoesDoLink } from './partes/BotoesDoLink';
import { ROTULO_DO_FILTRO_DOS_LINKS, useLinksDoCliente, type FiltroDosLinks } from './useLinksDoCliente';

export function LinksDoCliente() {
  const vm = useLinksDoCliente();
  const { acoes } = vm;
  useCarregando(vm.carregando);
  return (
    <section>
      {vm.exemplos && (
        <div className="alerta-linha">
          <Alerta titulo="Dados de exemplo" texto="Os links ficam só neste navegador e somem ao recarregar; nada vai para o banco." />
        </div>
      )}
      {vm.erro && (
        <div className="alerta-linha">
          <Alerta titulo="O banco não deixou ler os links" texto={vm.erro} />
        </div>
      )}
      <div className="tarefas-barra-topo" style={{ marginTop: 12 }}>
        <MenuSuspenso rotulo={ROTULO_DO_FILTRO_DOS_LINKS[vm.filtro]} className="btn btn-outline" dica="Filtrar as empresas"
          itens={(Object.keys(ROTULO_DO_FILTRO_DOS_LINKS) as FiltroDosLinks[]).map(f => ({ rotulo: ROTULO_DO_FILTRO_DOS_LINKS[f] + ' (' + vm.contagem[f] + ')', marcado: vm.filtro === f, onClick: () => vm.setFiltro(f) }))} />
        <span className="tarefas-barra-espaco" />
        <label className="busca-curta">
          <Icone nome="search" />
          <input type="text" placeholder="Buscar empresa ou código" aria-label="Buscar empresa" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} />
        </label>
      </div>
      {vm.carregando ? <Esqueleto linhas={8} /> : (
        <div className="table-wrap">
          <table className="table-compact">
            <thead>
              <tr><th>Código</th><th>Empresa</th><th>Link</th><th>De</th>{acoes.pode && <th>Ações</th>}</tr>
            </thead>
            <tbody>
              {vm.linhas.map(e => (
                <tr key={e.chave} data-empresa={e.codigo}>
                  <td className="num">{e.codigo}</td>
                  <td className="wrap">{e.nome}<span className="hint" style={{ display: 'block' }}>{e.regime}</span></td>
                  <td className="wrap">
                    {e.token
                      ? <><span className="badge badge-ok">Com link</span>{acoes.pode && <span className="ac-endereco-curto num" title={enderecoDoLink(e.token)}>…/cliente/{e.token.slice(0, 8)}…</span>}</>
                      : <span className="badge badge-neutral">Sem link</span>}
                  </td>
                  <td className="num fraco">{e.token ? vm.data(e.atualizadoEm) : ''}</td>
                  {acoes.pode && (
                    <td>
                      <BotoesDoLink temLink={!!e.token} ocupado={acoes.ocupada === e.codigo}
                        aoGerar={() => void acoes.gerar(e)} aoCopiar={() => acoes.copiar(e.token)} aoWhatsApp={() => acoes.whatsapp(e, e.token)}
                        aoTrocar={() => void acoes.trocar(e)} aoRevogar={() => void acoes.revogar(e)} />
                    </td>
                  )}
                </tr>
              ))}
              {!vm.linhas.length && <tr><td colSpan={acoes.pode ? 5 : 4} className="hint">Nenhuma empresa{vm.busca ? ' com "' + vm.busca + '"' : ' neste filtro'}.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
