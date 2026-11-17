// A Visão geral da Área do Cliente. Refeita em 13/11/2026 ("refaça esses 3"; a linguagem das Solicitações): a saudação
// com uma linha de resumo do mês; o "Precisa de você" com o ponto da urgência, o texto e UM botão igual em todos (ou o
// "tudo em dia" no mesmo cartão); embaixo, lado a lado e da mesma altura, as próximas guias numa lista curta e alinhada
// (o clique abre ver, copiar o código e baixar; "Ver todas" leva às Guias) e o enviar documento.
// Enxugada em 16/11/2026 (o dono apresentou a área e ouviu "tinha muita informação"; o mesmo critério das outras telas):
// o resumo com dois fatos; cada pendência numa linha só (o título, um detalhe curto e o botão); cada próxima guia com o
// nome, "Vence 19/11", o valor e UM botão (Baixar), o ver e o copiar no "⋯"; o enviar mais baixo; os primeiros passos
// discretos, só com o que falta.
// Só desenha: o estado e as ações vêm de useInicio.ts.
import './inicio.css';
import { Icone, MenuSuspenso } from '@nads/ui';
import { JanelaDoArquivo } from '../partes/JanelaDoArquivo';
import { Enviar } from './Enviar';
import { useInicio } from './useInicio';
import { useJanelaDeEnvio } from './JanelaDeEnvio';
import type { AreaCliente, DaCasca } from './useAreaCliente';
import { PrimeirosPassos } from '../partes/PrimeirosPassos';
import { AjudaDaTela } from '../partes/AjudaDaTela';
import { MarcaDaTela } from '../partes/MarcaDaTela';

export function Inicio(props: DaCasca & { empresa: string; contato: AreaCliente['contato']; onWhatsapp?: () => void; primeiros: AreaCliente['primeiros'] }) {
  const abrirEnvio = useJanelaDeEnvio(props);
  const vm = useInicio(props, abrirEnvio);
  return (
    <>
      <div className="cli-titulo cli-saudacao">
        <div>
          <MarcaDaTela /><h1 className="page-title">{vm.saudacao}</h1><AjudaDaTela />
          <p className="cli-subtitulo">{vm.resumo}</p>
        </div>
      </div>

      <div className="cli-vg">
        {/* os primeiros passos (15/11/2026): some quando tudo está feito ou no "x" */}
        {props.primeiros && <PrimeirosPassos lista={props.primeiros} irPara={props.irPara} enviar={abrirEnvio} />}
        {/* o que precisa do cliente, o mais urgente primeiro (o ponto vermelho); ou o tudo em dia no mesmo cartão */}
        {vm.pendencias.length ? (
          <section className="card cli-vg-cartao cli-vg-precisa cli-precisa">
            <div className="card-head"><h3>Precisa de você</h3></div>
            <ul className="cli-vg-itens">
              {vm.pendencias.map(p => (
                <li key={p.id} className={'cli-vg-pend tom-' + p.tom}>
                  <span className="cli-vg-ponto" aria-hidden="true" />
                  {/* (16/11/2026, "muita informação") uma linha: o título e o detalhe curto; a explicação longa no title */}
                  <span className="cli-vg-pend-txt" title={p.texto}><b>{p.titulo}</b>{p.detalhe && <span>{p.detalhe}</span>}</span>
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
                {/* (16/11/2026, "muita informação") o nome, "Vence 19/11", o valor, UM botão e o "⋯" (ver, copiar o código) */}
                <ul className="cli-vg-guias">
                  {vm.proximas.map(g => (
                    <li key={g.id} className="cli-vg-guia cli-extrato-linha">
                      <span className="cli-vg-guia-txt"><b className="cli-vg-nome">{g.nome}</b><span className="cli-vg-quando">{g.quando}</span></span>
                      <span className="cli-vg-valor">{g.valor}</span>
                      <span className="cli-vg-guia-acoes">
                        {g.principal ? (
                          <button type="button" className="btn btn-sm cli-vg-baixar" disabled={vm.baixando === g.id} onClick={g.principal.acao} aria-label={g.principal.rotulo + ': ' + g.nome}>
                            <Icone nome={g.principal.icone} width={15} height={15} /><span className="cli-vg-rotulo">{g.principal.rotulo}</span>
                          </button>
                        ) : <span className="cli-vg-ainda">Ainda não chegou</span>}
                        {g.mais.length ? (
                          <MenuSuspenso rotulo="" icone="mais" className="icon-btn cli-vg-mais" semSeta direita flutuante compacto dica="Mais ações" titulo={'Mais ações: ' + g.nome} itens={g.mais} />
                        ) : <span className="cli-vg-vaga" aria-hidden="true" />}
                      </span>
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
