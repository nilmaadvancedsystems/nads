// A Visão geral da Área do Cliente como painel do mês (12/11/2026: "retrabalhe completamente a página inicial"; a
// escolhida entre as propostas: "painel do mês"):
//   1. a saudação e o mês, com quando o escritório atualizou;
//   2. os quatro números (a pagar, vencidas, o próximo vencimento, as solicitações), cada um leva à aba dele;
//   3. o que precisa do cliente, cada item com UMA ação (as pendências de dados/visaoGeral.ts), ou o "tudo em dia";
//   4. os próximos vencimentos no estilo extrato (o mesmo das Guias), com as ações da guia no clique; ao lado, os resumos
//      do Faturamento e do Registro (clicáveis);
//   5. o enviar documento na coluna da direita e a atividade recente na largura toda.
// Só desenha: o estado e as ações vêm de useInicio.ts.
import { Icone, type NomeIcone } from '@nads/ui';
import { JanelaDoArquivo } from '../partes/JanelaDoArquivo';
import { LinhaDaAtividade } from '../partes/LinhaDaAtividade';
import { tituloDaGuiaNova, type Pendencia } from '../dados/visaoGeral';
import { Enviar } from './Enviar';
import { useInicio } from './useInicio';
import { useJanelaDeEnvio } from './JanelaDeEnvio';
import type { AreaCliente, DaCasca } from './useAreaCliente';

const ICONE_DA_PENDENCIA: Record<Pendencia['origem'], NomeIcone> = { guia: 'recibo', chamado: 'mensagem', certificado: 'escudo', aviso: 'sino', ticket: 'checklist' };

export function Inicio(props: DaCasca & { empresa: string; contato: AreaCliente['contato']; onWhatsapp?: () => void }) {
  const abrirEnvio = useJanelaDeEnvio(props);
  const vm = useInicio(props, abrirEnvio);
  return (
    <>
      <div className="cli-titulo cli-saudacao">
        <div>
          <h1 className="page-title">{vm.saudacao}</h1>
          <p className="hint cli-titulo-sub">{vm.sobre}</p>
        </div>
      </div>

      {/* os números do mês */}
      <div className="cli-numeros cli-numeros-inicio">
        {vm.numeros.map(n => (
          <button key={n.chave} type="button" className={'cli-numero cli-numero-link' + (n.tom ? ' tom-' + n.tom : '')} onClick={() => vm.irPara(n.ir)}>
            <span className="cli-sobre">{n.rotulo}</span>
            <span className="cli-numero-valor menor">{n.valor}</span>
            <span className="hint">{n.dica}</span>
          </button>
        ))}
      </div>

      {/* o que precisa do cliente (ou o tudo em dia) */}
      {vm.pendencias.length ? (
        <section className="card cli-precisa">
          <div className="card-head"><h3>Precisa de você</h3><span className="cli-conta">{vm.pendencias.length}</span></div>
          <ul>
            {vm.pendencias.map(p => (
              <li key={p.id} className={'cli-precisa-item tom-' + p.tom}>
                <span className="cli-precisa-ico" aria-hidden="true"><Icone nome={ICONE_DA_PENDENCIA[p.origem]} width={16} height={16} /></span>
                <span className="cli-precisa-txt"><b>{p.titulo}</b><span className="hint">{p.texto}</span></span>
                <button type="button" className={'btn btn-sm' + (p.tom === 'bad' ? ' btn-primary' : '')} disabled={p.acao.tipo === 'baixar-guia' && vm.baixando === p.acao.guia} onClick={() => vm.agir(p.acao)}>{p.rotulo}</button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <div className="cli-tudo-em-dia"><Icone nome="checkCircle" width={18} height={18} /><span><b>Tudo em dia.</b> Nada pendente com você por enquanto.</span></div>
      )}

      <div className="cli-inicio-meio">
        {/* os próximos vencimentos, no estilo extrato */}
        <section className="card cli-inicio-proximos">
          <div className="card-head">
            <h3>Próximos vencimentos</h3>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => vm.irPara('guias')}>Agenda completa<Icone nome="chevronRight" width={16} height={16} /></button>
          </div>
          {vm.proximos.length ? (
            <div className="cli-extrato">
              {vm.proximos.map(d => (
                <section key={d.data} className={'cli-extrato-dia' + (d.atrasado ? ' passou' : '') + (d.hoje ? ' hoje' : '')}>
                  <p className="cli-extrato-data cli-extrato-data-fixa"><span>{d.cabecalho}</span>{d.hoje && <b className="cli-extrato-hoje">hoje</b>}{d.atrasado && <b className="cli-extrato-atrasado">atrasado</b>}</p>
                  <ul>
                    {d.itens.map(x => (
                      <li key={x.chave} className={'cli-extrato-item m-' + (x.tipo === 'guia' ? 'guia' : 'entrega') + ' t-' + x.tom + (x.tipo === 'entrega' ? ' entrega' : '')}>
                        {x.tipo === 'guia' ? (
                          <button type="button" className="cli-extrato-linha" aria-expanded={x.aberto} onClick={() => vm.abrirLinha(x.chave)}>
                            <i className="cli-extrato-ponto" aria-hidden="true" />
                            <span className="cli-extrato-nome">{x.nome}</span>
                            <span className="cli-extrato-sit">{x.situacao}</span>
                            <span className="cli-extrato-valor">{x.valorTexto}</span>
                          </button>
                        ) : (
                          <div className="cli-extrato-linha cli-extrato-linha-fixa">
                            <i className="cli-extrato-ponto" aria-hidden="true" />
                            <span className="cli-extrato-nome">{x.nome}</span>
                            <span className="cli-extrato-sit">{x.situacao}</span>
                            <span className="cli-extrato-valor" />
                          </div>
                        )}
                        {x.aberto && x.guiaObj && (
                          <span className="cli-extrato-acoes">
                            {x.temPdf && <button type="button" className="btn btn-sm btn-ghost" disabled={vm.vista.abrindo === x.guiaObj.id} onClick={() => vm.verGuia(x.guiaObj!.id)}><Icone nome="olho" width={14} height={14} />Ver</button>}
                            {x.tom === 'vencida' ? (
                              <button type="button" className="btn btn-sm cli-pedir-nova" onClick={() => vm.pedirGuiaNova(tituloDaGuiaNova(x.guiaObj!))}><Icone nome="repeat" width={14} height={14} />Pedir nova</button>
                            ) : (
                              <>
                                {x.codigo && <button type="button" className="btn btn-sm btn-ghost" onClick={() => vm.copiarCodigo(x.codigo)}><Icone nome="copiar" width={14} height={14} />Copiar código</button>}
                                {x.temPdf && <button type="button" className="btn btn-sm btn-primary" disabled={vm.baixando === x.guiaObj.id} onClick={() => void vm.baixar(x.guiaObj!.id)}><Icone nome="download" width={14} height={14} />Baixar</button>}
                              </>
                            )}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : <p className="hint cli-inicio-vazio">Nada vence nos próximos 30 dias.</p>}
        </section>

        {/* ao lado: os resumos do Faturamento e do Registro e o enviar documento (12/11/2026: embaixo, ele ficava baixo ao
            lado da atividade, com um vazio grande) */}
          <div className="cli-inicio-lado">
            {vm.faturamento && (
              <button type="button" className="card cli-resumo-link" onClick={() => vm.irPara('faturamento')}>
                <span className="cli-resumo-topo"><span className="cli-sobre">Faturamento</span><Icone nome="chevronRight" width={16} height={16} /></span>
                <span className="cli-resumo-valor">{vm.faturamento.valor}</span>
                <span className="hint">em {vm.faturamento.mes}{vm.faturamento.variacao && <> · <span className={'cli-variacao ' + (vm.faturamento.subiu ? 'sobe' : 'desce')}>{vm.faturamento.variacao}</span></>}</span>
                <span className="cli-mini-barras" aria-hidden="true">
                  {vm.faturamento.barras.map(b => <i key={b.mes} className={b.ultimo ? 'ultimo' : ''} style={{ height: b.altura + '%' }} />)}
                </span>
              </button>
            )}
            {vm.registro && (
              <button type="button" className="card cli-resumo-link" onClick={() => vm.irPara('dp')}>
                <span className="cli-resumo-topo"><span className="cli-sobre">Registro</span><Icone nome="chevronRight" width={16} height={16} /></span>
                <span className="cli-resumo-valor">{vm.registro.folha}</span>
                <span className="hint">folha{vm.registro.competencia ? ' de ' + vm.registro.competencia : ''} · {vm.registro.ativos}</span>
              </button>
            )}
            <section className="card cli-v-enviar">
              <div className="card-head"><h3>Enviar documento</h3></div>
              <Enviar {...props} />
            </section>
          </div>
      </div>

      {/* a atividade recente na largura toda */}
      <section className="card cli-v-atividade">
          <div className="card-head"><h3>Atividade recente</h3></div>
          {vm.atividade.length ? (
            <ul className="cli-lista cli-atividades">
              {vm.atividade.map(a => (
                <LinhaDaAtividade key={a.id} origem={a.origem} titulo={a.titulo} texto={a.texto} quando={a.quando}
                  onAbrir={a.chamado ? () => vm.irPara('chamados', { chamado: a.chamado }) : undefined} />
              ))}
            </ul>
          ) : <p className="hint cli-inicio-vazio">O que você enviar e o que o escritório responder aparece aqui.</p>}
      </section>

      {vm.vista.aberto && <JanelaDoArquivo arquivo={vm.vista.aberto} onBaixar={vm.vista.baixar} onFechar={vm.vista.fechar} />}
    </>
  );
}
