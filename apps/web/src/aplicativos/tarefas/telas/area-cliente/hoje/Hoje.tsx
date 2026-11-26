// Área do Cliente › Hoje (26/11/2026, o módulo refeito; escolhidas as "5 seções", com a Hoje: "O que preciso fazer
// agora?"). Refeita no mesmo dia ("refaz isso", "ta feio que doi"), com as peças do nads: os Números em painéis coloridos
// (a do Resumo do DP e da Carteira: cada número no tom do que é, com o ícone; tocar leva à seção) e dois cartões com as
// linhas (ent-linhas), cada uma em duas linhas: o que é em cima, a empresa embaixo, o selo e a hora à direita. Só desenha.
import { Esqueleto, Icone, IconeDeArquivo, Vazio, formatoPeloNome, useCarregando, type NomeIcone } from '@nads/ui';
import { AvisosDaArea } from '../base/Base';
import { useHoje } from './useHoje';

function Painel({ tom, icone, rotulo, valor, sub, onClick }: { tom: string; icone: NomeIcone; rotulo: string; valor: number; sub: string; onClick: () => void }) {
  return (
    <button type="button" className={'stat stat-filtro painel-numero painel-' + tom} onClick={onClick}>
      <span className="painel-numero-icone" aria-hidden="true"><Icone nome={icone} width={16} height={16} /></span>
      <p className="stat-label">{rotulo}</p>
      <p className="stat-value num">{valor}</p>
      <p className="hint" style={{ margin: 0 }}>{sub}</p>
    </button>
  );
}

export function Hoje() {
  const vm = useHoje();
  useCarregando(vm.carregando);
  const r = vm.resumo;
  return (
    <section>
      <AvisosDaArea exemplos={vm.exemplos} erro={vm.erro} oQue="a Área do Cliente" />
      {vm.carregando ? <Esqueleto linhas={4} /> : <>
        <div className="stat-grid dp-numeros" style={{ marginBottom: 20 }}>
          <Painel tom={r.semResposta ? 'aviso' : 'ok'} icone="mensagem" rotulo="Solicitações abertas" valor={r.pendentes}
            sub={r.pendentes ? (r.semResposta ? r.semResposta + ' sem resposta' : 'todas respondidas') : 'nada esperando'} onClick={vm.ir.solicitacoes} />
          <Painel tom="info" icone="caixaEntrada" rotulo="Arquivos novos" valor={r.arquivosNovos} sub="nos últimos 7 dias" onClick={vm.ir.documentos} />
          <Painel tom="roxo" icone="sino" rotulo="Comunicados no ar" valor={r.comunicadosNoAr} sub={r.comunicadosNoAr ? 'os clientes estão vendo' : 'nenhum agora'} onClick={vm.ir.comunicados} />
          <Painel tom={r.acessosComErro ? 'marca' : 'ciano'} icone="equipe" rotulo="Clientes com acesso" valor={r.comAcesso}
            sub={r.acessosComErro ? r.acessosComErro + (r.acessosComErro === 1 ? ' senha com problema' : ' senhas com problema') : 'empresas com link'} onClick={vm.ir.clientes} />
        </div>

        <div className="area-hoje">
          <div className="card">
            <div className="card-head"><h3>Esperando a equipe</h3><button type="button" className="btn btn-ghost" onClick={vm.ir.solicitacoes}>Ver todas<Icone nome="chevronRight" width={16} height={16} /></button></div>
            {vm.esperando.length ? (
              <ul className="ent-linhas area-linhas">
                {vm.esperando.map(c => (
                  <li key={c.id}>
                    <button type="button" className="ent-linha-abre" onClick={() => vm.abrirSolicitacao(c.id)}>
                      <span className="area-linha-icone"><Icone nome="mensagem" width={16} height={16} /></span>
                      <div><b>{c.titulo}</b><span className="fraco">{c.codigo != null ? c.codigo + ' · ' : ''}{c.empresa}</span></div>
                      <span className="area-linha-fim">
                        <span className={c.semResposta ? 'badge badge-warn' : 'badge badge-neutral'}>{c.semResposta ? 'Sem resposta' : 'Em andamento'}</span>
                        <span className="hint" title={c.quandoCompleto}>{c.quando}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : <Vazio compacto icone="checkCircle" titulo="Nenhuma solicitação esperando" texto="Quando um cliente pedir algo, aparece aqui." />}
          </div>
          <div className="card">
            <div className="card-head"><h3>Últimos arquivos recebidos</h3><button type="button" className="btn btn-ghost" onClick={vm.ir.documentos}>Ver todos<Icone nome="chevronRight" width={16} height={16} /></button></div>
            {vm.ultimos.length ? (
              <ul className="ent-linhas area-linhas">
                {vm.ultimos.map(x => (
                  <li key={x.id}>
                    <button type="button" className="ent-linha-abre" onClick={() => vm.abrirRecebido(x.id)}>
                      <span className="area-linha-icone"><IconeDeArquivo formato={formatoPeloNome(x.nome)} tamanho={24} /></span>
                      <div><b>{x.nome}</b><span className="fraco">{x.codigo} · {x.empresa}</span></div>
                      <span className="area-linha-fim">
                        <span className="badge badge-neutral">{x.tipo}</span>
                        <span className="hint" title={x.quandoCompleto}>{x.quando}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : <Vazio compacto icone="caixaEntrada" titulo="Nenhum arquivo recebido ainda" />}
          </div>
        </div>
      </>}
    </section>
  );
}
