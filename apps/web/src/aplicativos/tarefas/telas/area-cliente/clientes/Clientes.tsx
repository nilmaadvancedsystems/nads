// A seção Clientes do módulo Área do Cliente refeito (26/11/2026: "quero que esse modulo seja completamente refeito para
// suportar e gerenciar de maneira mais simples e coerente a area do cliente como está hoje, preciso que seja o mais bonito
// e de facil entendimento possivel"): quem tem acesso, numa lista só, só com as empresas da pessoa ("a pessoa vai ver apenas
// as empresas dela"). Com as peças do nads ("essas telas… ta toda fora dos elementos predefinidos do nads"): a barra com o
// Segmentado e a busca e a tabela padrão; a linha abre a empresa na janela do Cadastro. A senha só para o admin. Só desenha.
import { Esqueleto, Icone, Vazio, useCarregando } from '@nads/ui';
import { MenuDeFiltro } from '../../dp/MenuDeFiltro';
import { AvisosDaArea, EmpresaDaLinha, Selo } from '../base/Base';
import { PainelDoCliente } from './PainelDoCliente';
import { useClientes } from './useClientes';

export function Clientes() {
  const vm = useClientes();
  useCarregando(vm.carregando);
  return (
    <section>
      <AvisosDaArea exemplos={vm.exemplos} erro={vm.erro} oQue="os links" />
      <div className="tarefas-barra-topo" style={{ marginTop: 12 }}>
        <MenuDeFiltro rotulo="Acesso" todos={'Todas (' + (vm.filtros.find(f => f.valor === 'todas')?.conta ?? 0) + ')'}
          valor={vm.filtro === 'todas' ? '' : vm.filtro} mudar={v => vm.mudarFiltro((v || 'todas') as typeof vm.filtro)}
          opcoes={vm.filtros.filter(f => f.valor !== 'todas').map(f => ({ valor: f.valor, rotulo: f.rotulo + ' (' + f.conta + ')' }))} />
        <span className="tarefas-barra-espaco" />
        {!vm.carregando && <span className="hint">{vm.resumo}</span>}
        <label className="busca-curta">
          <Icone nome="search" width={16} height={16} />
          <input type="text" placeholder="Buscar pelo código ou nome" aria-label="Buscar empresa" value={vm.busca} onChange={e => vm.mudarBusca(e.target.value)} />
        </label>
      </div>
      {vm.avisos.length > 0 && <p className="hint" style={{ marginBottom: 12 }}>{vm.avisos.join(' ')}</p>}

      {vm.carregando ? <Esqueleto linhas={8} />
        : !vm.linhas.length ? <Vazio icone="predio" titulo={vm.vazio} texto={vm.total ? 'Troque o filtro ou a busca.' : undefined} />
        : (
          <div className="table-wrap">
            <table className="table-compact">
              <thead><tr><th>Empresa</th><th>Acesso</th>{vm.admin && <th>Senha</th>}<th>Última atividade</th></tr></thead>
              <tbody>
                {vm.linhas.map(l => (
                  <tr key={l.codigo} className="linha-abre" tabIndex={0} onClick={() => vm.abrir(l.codigo)} onKeyDown={e => { if (e.key === 'Enter') vm.abrir(l.codigo); }}>
                    <td className="wrap"><EmpresaDaLinha codigo={l.codigo} nome={l.nome} /></td>
                    <td>{l.temLink ? <Selo tom="ok">Com link</Selo> : <Selo tom="neutro">Sem link</Selo>}</td>
                    {vm.admin && <td>{!l.senha ? <span className="fraco">—</span> : l.exigeSenha ? <Selo tom="conferido">{l.senha}</Selo> : <span className="fraco">{l.senha}</span>}</td>}
                    <td className="fraco" title={l.atividadeTitulo || undefined}>{l.atividade || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {vm.empresaAberta && <PainelDoCliente key={vm.empresaAberta.codigo} codigo={vm.empresaAberta.codigo} nome={vm.empresaAberta.nome} onFechar={vm.fechar} />}
    </section>
  );
}
