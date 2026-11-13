// A Visão geral da Área do Cliente (12/11/2026, enxuta: "ficou muita informação"): a saudação, o que precisa do cliente
// (cada item com UMA ação; ou o "tudo em dia"), os próximos vencimentos no estilo extrato (as ações da guia no clique) e o
// enviar documento. Os números, os resumos do Faturamento e do Registro e a atividade saíram: cada aba tem os seus.
// Só desenha: o estado e as ações vêm de useInicio.ts.
import { Icone, type NomeIcone } from '@nads/ui';
import { JanelaDoArquivo } from '../partes/JanelaDoArquivo';
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

        {/* ao lado: o enviar documento */}
        <div className="cli-inicio-lado">
          <section className="card cli-v-enviar">
            <div className="card-head"><h3>Enviar documento</h3></div>
            <Enviar {...props} />
          </section>
        </div>
      </div>

      {vm.vista.aberto && <JanelaDoArquivo arquivo={vm.vista.aberto} onBaixar={vm.vista.baixar} onFechar={vm.vista.fechar} />}
    </>
  );
}
