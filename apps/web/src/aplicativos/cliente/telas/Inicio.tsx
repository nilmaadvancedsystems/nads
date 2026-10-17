// A Visão geral da Área do Cliente (Vitor, 16/10/2026), no layout do protótipo com as peças do nads: o card de boas-vindas
// com os dois atalhos, os quatro números, e embaixo as obrigações e guias próximas (com as já pagas) ao lado do
// atendimento. Versão D (acabamento premium sóbrio): o N da Nilma de marca-d'água no cartão de boas-vindas, sem degradê;
// os números em cartões soltos, grandes e tabulares, que levam à aba deles; o valor de cada guia alinhado à direita.
import { formatos } from '@nads/core';
import { Icone, MarcaN, type NomeIcone } from '@nads/ui';
import { LinhaDeGuia } from '../partes/LinhaDeGuia';
import { MarcaDoEscritorio } from '../partes/MarcaDoEscritorio';
import { Vazio } from '../partes/Vazio';
import { useInicio } from './useInicio';
import type { AreaCliente, DaCasca, IdAba } from './useAreaCliente';

function Numero({ rotulo, valor, nota, ruim, ir, irPara }: { rotulo: string; valor: string | number; nota: string; ruim?: boolean; ir: IdAba; irPara: (id: IdAba) => void }) {
  return (
    <button type="button" className="cli-numero" onClick={() => irPara(ir)}>
      <span className="cli-sobre">{rotulo}</span>
      <span className="cli-numero-valor">{valor}</span>
      <span className={'hint' + (ruim ? ' ruim' : '')} title={nota}>{nota}</span>
    </button>
  );
}

export function Inicio(props: DaCasca & { empresa: string; contato: AreaCliente['contato'] }) {
  const vm = useInicio(props);
  const c = props.contato;
  const contatos: { icone: NomeIcone; texto?: string }[] = [
    { icone: 'envelope', texto: c.email }, { icone: 'telefone', texto: c.telefone }, { icone: 'mensagem', texto: c.whatsapp && 'WhatsApp ' + c.whatsapp }, { icone: 'clock', texto: c.horario },
  ];
  return (
    <>
      <section className="card cli-boas-vindas">
        <span className="cli-marca-dagua" aria-hidden="true"><MarcaN /></span>
        <p className="cli-sobre">{formatos.capital(vm.mesAtual)}</p>
        <h1 className="page-title">Bem-vindo à sua área exclusiva</h1>
        <p className="page-desc">As guias para pagar, os documentos do escritório, os seus funcionários e os pedidos ao escritório.</p>
        <div className="cli-acoes">
          <button type="button" className="btn btn-primary" onClick={() => vm.irPara('guias')}><Icone nome="recibo" width={16} height={16} />Guias deste mês</button>
          <button type="button" className="btn" onClick={() => vm.irPara('chamados')}><Icone nome="mensagem" width={16} height={16} />Abrir chamado</button>
        </div>
      </section>

      <div className="cli-numeros">
        <Numero rotulo="Guias a vencer" valor={vm.totalDeGuias} ir="guias" irPara={vm.irPara} ruim={vm.vencidas > 0}
          nota={vm.vencidas ? (vm.vencidas === 1 ? '1 vencida' : vm.vencidas + ' vencidas') : vm.guiasEmPoucas || 'Nenhuma em aberto'} />
        <Numero rotulo="Empregados ativos" valor={vm.pessoal.ativos} ir="dp" irPara={vm.irPara}
          nota={vm.pessoal.emFerias === 1 ? '1 em férias' : vm.pessoal.emFerias ? vm.pessoal.emFerias + ' em férias' : 'Ninguém em férias'} />
        <Numero rotulo="Chamados em aberto" valor={vm.chamadosEmAberto} ir="chamados" irPara={vm.irPara} nota={vm.primeiroEmAberto || 'Nenhum'} />
        <Numero rotulo="Documentos do mês" valor={vm.docsDoMes} ir="documentos" irPara={vm.irPara}
          nota={vm.docsNovos === 1 ? '1 ainda não baixado' : vm.docsNovos ? vm.docsNovos + ' ainda não baixados' : 'Todos baixados'} />
      </div>

      <div className="cli-duas">
        <section className="card">
          <div className="card-head">
            <div>
              <h3>Obrigações e guias próximas</h3>
              <p className="hint">As guias que o escritório gerou para a sua empresa</p>
            </div>
            <button type="button" className="btn btn-ghost" onClick={() => vm.irPara('guias')}>Ver todas<Icone nome="chevronRight" width={16} height={16} /></button>
          </div>
          {vm.guias.length || vm.pagas.length ? (
            <ul className="cli-lista">
              {vm.guias.map(g => <LinhaDeGuia key={g.id} guia={g} codigo={vm.codigos[g.id]} ocupado={vm.baixando === g.id} onBaixar={id => void vm.baixar(id)} onCopiar={vm.copiarCodigo} />)}
              {vm.pagas.map(p => (
                <li key={p.id} className="cli-linha">
                  <span className="cli-sigla pago" style={{ width: 44, height: 44 }} aria-hidden="true"><Icone nome="check" width={18} height={18} /></span>
                  <div className="cli-linha-txt">
                    <b>{p.nome}</b>
                    <p className="hint">Pago em {p.pagoEm}</p>
                  </div>
                  <div className="cli-linha-dir">
                    <span className="badge badge-ok">Pago</span>
                    <span className="cli-valor cli-linha-valor">{formatos.reais(p.valor)}</span>
                    <span className="cli-linha-acoes">
                      {p.temComprovante && (
                        <button type="button" className="icon-btn" title="Baixar o comprovante" aria-label={'Baixar o comprovante de ' + p.nome} onClick={() => void vm.baixarComprovante(p.id)}>
                          <Icone nome="fileDown" width={16} height={16} />
                        </button>
                      )}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : <Vazio icone="recibo" titulo="Nenhuma guia por enquanto" texto="Quando o escritório gerar uma guia, ela aparece aqui." />}
        </section>

        <section className="card cli-atendimento">
          <div className="card-head"><h3>Atendimento</h3></div>
          <div className="cli-pessoa">
            <MarcaDoEscritorio tamanho={44} />
            <div><b>{c.equipe}</b><span className="hint">O seu contato no escritório</span></div>
          </div>
          <ul className="cli-contatos">
            {contatos.filter(k => k.texto).map(k => <li key={k.icone}><Icone nome={k.icone} width={16} height={16} /><span>{k.texto}</span></li>)}
          </ul>
          <button type="button" className="btn cli-largo" onClick={() => vm.irPara('chamados')}>Solicitar documento ou serviço</button>
        </section>
      </div>
    </>
  );
}
