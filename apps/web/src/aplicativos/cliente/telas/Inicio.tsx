// A Visão geral da Área do Cliente. Refeita em 13/11/2026 ("refaça esses 3"; a linguagem das Solicitações): a saudação
// com uma linha de resumo do mês; o "Precisa de você" com o ponto da urgência, o texto e UM botão igual em todos (ou o
// "tudo em dia" no mesmo cartão); embaixo, lado a lado e da mesma altura, as próximas guias numa lista curta e alinhada
// (o clique abre ver, copiar o código e baixar; "Ver todas" leva às Guias) e o enviar documento.
// Só desenha: o estado e as ações vêm de useInicio.ts.
import './inicio.css';
import { Icone } from '@nads/ui';
import { JanelaDoArquivo } from '../partes/JanelaDoArquivo';
import { Enviar } from './Enviar';
import { useInicio } from './useInicio';
import { useJanelaDeEnvio } from './JanelaDeEnvio';
import type { AreaCliente, DaCasca } from './useAreaCliente';

export function Inicio(props: DaCasca & { empresa: string; contato: AreaCliente['contato']; onWhatsapp?: () => void }) {
  const abrirEnvio = useJanelaDeEnvio(props);
  const vm = useInicio(props, abrirEnvio);
  return (
    <>
      <div className="cli-titulo cli-saudacao">
        <div>
          <h1 className="page-title">{vm.saudacao}</h1>
          <p className="cli-subtitulo">{vm.resumo}</p>
        </div>
      </div>

      <div className="cli-vg">
        {/* o que precisa do cliente, o mais urgente primeiro (o ponto vermelho); ou o tudo em dia no mesmo cartão */}
        {vm.pendencias.length ? (
          <section className="card cli-vg-cartao cli-vg-precisa cli-precisa">
            <div className="card-head"><h3>Precisa de você</h3></div>
            <ul className="cli-vg-itens">
              {vm.pendencias.map(p => (
                <li key={p.id} className={'cli-vg-pend tom-' + p.tom}>
                  <span className="cli-vg-ponto" aria-hidden="true" />
                  <span className="cli-vg-pend-txt"><b>{p.titulo}</b><span>{p.texto}</span></span>
                  <button type="button" className="btn btn-sm cli-vg-acao" disabled={p.acao.tipo === 'baixar-guia' && vm.baixando === p.acao.guia} onClick={() => vm.agir(p.acao)}>{p.rotulo}</button>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <section className="card cli-vg-cartao cli-vg-precisa cli-tudo-em-dia">
            <div className="card-head"><h3>Precisa de você</h3></div>
            <p className="cli-vg-emdia"><span className="cli-vg-ponto" aria-hidden="true" /><span><b>Tudo em dia.</b> {vm.emDia}</span></p>
          </section>
        )}

        <div className="cli-vg-baixo">
          {/* as próximas guias a pagar (a vencida e a de hoje já estão no "Precisa de você") */}
          <section className="card cli-vg-cartao cli-vg-proximos cli-inicio-proximos">
            <div className="card-head">
              <h3>Próximas guias</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={vm.verTodas}>Ver todas<Icone nome="chevronRight" width={16} height={16} /></button>
            </div>
            {vm.proximas.length ? (
              <>
                <ul className="cli-vg-guias">
                  {vm.proximas.map(g => (
                    <li key={g.id} className={g.aberta ? 'aberta' : undefined}>
                      <button type="button" className="cli-vg-guia cli-extrato-linha" aria-expanded={g.aberta} onClick={() => vm.abrirGuia(g.id)}>
                        <span className="cli-vg-data">{g.dia}<small>{g.semana}</small></span>
                        <span className="cli-vg-nome">{g.nome}</span>
                        <span className="cli-vg-faltam">{g.faltam}</span>
                        <span className="cli-vg-valor">{g.valor}</span>
                        <Icone nome="chevronDown" className="cli-vg-seta" width={14} height={14} />
                      </button>
                      {g.aberta && (
                        <div className="cli-vg-guia-acoes">
                          {g.temPdf && <button type="button" className="btn btn-sm" disabled={vm.vista.abrindo === g.id} onClick={() => vm.verGuia(g.id)}>Ver</button>}
                          {g.codigo && <button type="button" className="btn btn-sm" onClick={() => vm.copiarCodigo(g.codigo)}>Copiar código</button>}
                          {g.temPdf && <button type="button" className="btn btn-sm btn-primary" disabled={vm.baixando === g.id} onClick={() => void vm.baixar(g.id)}>Baixar</button>}
                          {!g.temPdf && !g.codigo && <span className="hint">O arquivo desta guia ainda não chegou.</span>}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="cli-vg-total"><span>{vm.rotuloDoTotal}</span><b>{vm.totalDasProximas}</b></p>
              </>
            ) : <p className="cli-vg-nada"><b>Nenhuma guia a pagar por enquanto</b><span>Quando o escritório mandar uma guia, ela aparece aqui.</span></p>}
          </section>

          {/* o enviar documento */}
          <section className="card cli-vg-cartao cli-vg-enviar cli-v-enviar">
            <div className="card-head"><h3>Enviar documento</h3></div>
            <Enviar {...props} />
          </section>
        </div>
      </div>

      {vm.vista.aberto && <JanelaDoArquivo arquivo={vm.vista.aberto} onBaixar={vm.vista.baixar} onFechar={vm.vista.fechar} />}
    </>
  );
}
