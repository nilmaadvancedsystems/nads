// A Visão geral da Área do Cliente (Vitor, 16 e 17/10/2026: "quero que melhore esse layout"), no layout do protótipo com as
// peças do nads. Versão D: as boas-vindas numa faixa só (o mês, o título e uma frase à esquerda; os dois botões à
// direita), os quatro números com o detalhe numa linha (o total a pagar nas guias, o resumo curto dos chamados), a lista
// das guias em grade de colunas fixas, separada em "A pagar" e "Pagas", e à direita o atendimento compacto com os avisos
// embaixo, na mesma altura da lista.
import { formatos } from '@nads/core';
import { Icone, type NomeIcone } from '@nads/ui';
import type { ReactNode } from 'react';
import { LinhaDeGuia } from '../partes/LinhaDeGuia';
import { MarcaDoEscritorio } from '../partes/MarcaDoEscritorio';
import { SiglaDaGuia } from '../partes/SiglaDaGuia';
import { Vazio } from '../partes/Vazio';
import { useInicio } from './useInicio';
import type { AreaCliente, DaCasca, IdAba } from './useAreaCliente';

function Numero({ rotulo, valor, nota, ir, irPara }: { rotulo: string; valor: string | number; nota: ReactNode; ir: IdAba; irPara: (id: IdAba) => void }) {
  return (
    <button type="button" className="cli-numero" onClick={() => irPara(ir)}>
      <span className="cli-sobre">{rotulo}</span>
      <span className="cli-numero-valor">{valor}</span>
      <span className="hint">{nota}</span>
    </button>
  );
}

const ICONE_DO_AVISO: Record<IdAba, NomeIcone> = { inicio: 'sino', documentos: 'pastaAberta', guias: 'escudo', dp: 'usuario', chamados: 'mensagem' };

export function Inicio(props: DaCasca & { empresa: string; contato: AreaCliente['contato'] }) {
  const vm = useInicio(props);
  const c = props.contato;
  const contatos: { icone: NomeIcone; texto?: string }[] = [
    { icone: 'mensagem', texto: c.whatsapp && 'WhatsApp ' + c.whatsapp }, { icone: 'envelope', texto: c.email }, { icone: 'telefone', texto: c.telefone },
  ];
  return (
    <>
      <section className="card cli-boas-vindas">
        <div className="cli-boas-vindas-txt">
          <p className="cli-sobre">{formatos.capital(vm.mesAtual)}</p>
          <h1 className="page-title">Bem-vindo à sua área exclusiva</h1>
          <p className="page-desc">Guias, documentos e pedidos num lugar só.</p>
        </div>
        <div className="cli-acoes">
          <button type="button" className="btn btn-primary" onClick={() => vm.irPara('guias')}><Icone nome="recibo" width={16} height={16} />Guias deste mês</button>
          <button type="button" className="btn" onClick={() => vm.irPara('chamados')}><Icone nome="mensagem" width={16} height={16} />Abrir chamado</button>
        </div>
      </section>

      <div className="cli-numeros">
        <Numero rotulo="Guias a vencer" valor={vm.totalDeGuias} ir="guias" irPara={vm.irPara}
          nota={vm.totalDeGuias ? <>{vm.vencidas > 0 && <><b className="ruim">{vm.vencidas === 1 ? '1 vencida' : vm.vencidas + ' vencidas'}</b> · </>}{formatos.reais(vm.valorEmAberto)}</> : 'Nenhuma em aberto'} />
        <Numero rotulo="Empregados ativos" valor={vm.pessoal.ativos} ir="dp" irPara={vm.irPara}
          nota={vm.pessoal.emFerias === 1 ? '1 em férias' : vm.pessoal.emFerias ? vm.pessoal.emFerias + ' em férias' : 'Ninguém em férias'} />
        <Numero rotulo="Chamados em aberto" valor={vm.chamadosEmAberto} ir="chamados" irPara={vm.irPara} nota={vm.chamadosEmPoucas || 'Nenhum'} />
        <Numero rotulo="Documentos do mês" valor={vm.docsDoMes} ir="documentos" irPara={vm.irPara}
          nota={vm.docsNovos === 1 ? '1 ainda não baixado' : vm.docsNovos ? vm.docsNovos + ' não baixados' : 'Todos baixados'} />
      </div>

      <div className="cli-duas cli-iguais">
        <section className="card">
          <div className="card-head">
            <h3>Obrigações e guias próximas</h3>
            <button type="button" className="btn btn-ghost" onClick={() => vm.irPara('guias')}>Ver todas<Icone nome="chevronRight" width={16} height={16} /></button>
          </div>
          {vm.guias.length || vm.pagas.length ? (
            <>
              {vm.guias.length > 0 && (
                <>
                  <p className="cli-grupo">A pagar</p>
                  <ul className="cli-lista">
                    {vm.guias.map(g => <LinhaDeGuia key={g.id} guia={g} codigo={vm.codigos[g.id]} ocupado={vm.baixando === g.id} onBaixar={id => void vm.baixar(id)} onCopiar={vm.copiarCodigo} />)}
                  </ul>
                </>
              )}
              {vm.pagas.length > 0 && (
                <>
                  <p className="cli-grupo">Pagas</p>
                  <ul className="cli-lista cli-pagas">
                    {vm.pagas.map(p => (
                      <li key={p.id} className="cli-linha cli-linha-guia">
                        <span className="cli-g-logo">
                          {p.tipo ? <SiglaDaGuia tipo={p.tipo} tamanho={40} /> : <span className="cli-sigla pago" style={{ width: 40, height: 40 }} aria-hidden="true"><Icone nome="check" width={18} height={18} /></span>}
                        </span>
                        <div className="cli-g-txt">
                          <b>{p.nome}</b>
                          <p className="hint">Pago em {p.pagoEm}</p>
                        </div>
                        <span className="cli-g-selo"><span className="badge badge-ok">Pago</span></span>
                        <span className="cli-g-valor cli-valor">{formatos.reais(p.valor)}</span>
                        <span className="cli-g-acoes">
                          {p.temComprovante && (
                            <button type="button" className="icon-btn" title="Baixar o comprovante" aria-label={'Baixar o comprovante de ' + p.nome} onClick={() => void vm.baixarComprovante(p.id)}>
                              <Icone nome="fileDown" width={16} height={16} />
                            </button>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          ) : <Vazio icone="recibo" titulo="Nenhuma guia por enquanto" texto="Quando o escritório gerar uma guia, ela aparece aqui." />}
        </section>

        <div className="cli-coluna-direita">
          <section className="card cli-atendimento">
            <div className="cli-pessoa">
              <MarcaDoEscritorio tamanho={40} />
              <div><b>{c.equipe}</b>{c.horario && <span className="hint">{c.horario}</span>}</div>
            </div>
            <ul className="cli-contatos">
              {contatos.filter(k => k.texto).map(k => <li key={k.icone}><Icone nome={k.icone} width={16} height={16} /><span>{k.texto}</span></li>)}
            </ul>
          </section>

          <section className="card cli-avisos-card">
            <div className="card-head"><h3>Avisos</h3></div>
            {vm.avisosDaVisao.length ? (
              <ul className="cli-lista">
                {vm.avisosDaVisao.map(a => (
                  <li key={a.id}>
                    <button type="button" className="cli-linha cli-aviso-linha" onClick={() => a.ir && vm.irPara(a.ir)} disabled={!a.ir}>
                      <span className="cli-aviso-ico" aria-hidden="true"><Icone nome={ICONE_DO_AVISO[a.ir ?? 'inicio']} width={16} height={16} /></span>
                      <span className="cli-g-txt"><b>{a.titulo}</b><span className="hint">{a.texto}</span></span>
                      {a.ir && <Icone nome="chevronRight" width={16} height={16} />}
                    </button>
                  </li>
                ))}
              </ul>
            ) : <Vazio icone="sino" titulo="Nada novo" />}
          </section>
        </div>
      </div>
    </>
  );
}
