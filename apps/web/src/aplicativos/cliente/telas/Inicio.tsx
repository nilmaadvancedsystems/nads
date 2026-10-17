// A Visão geral da Área do Cliente (Vitor, 16 e 17/10/2026: "quero que melhore esse layout"), no layout do protótipo com as
// peças do nads. Versão D: as boas-vindas numa faixa só (o mês, o título e uma frase à esquerda; os dois botões à
// direita), os quatro números com o detalhe numa linha (o total a pagar nas guias, o resumo curto dos chamados), a lista
// das guias em grade de colunas fixas, separada em "A pagar" e "Pagas", e à direita o atendimento compacto com os avisos
// embaixo, na mesma altura da lista. Com o banco (17/10/2026), os números sem fonte (empregados e documentos do mês)
// dão lugar aos que o espelho tem, no mesmo lugar: as obrigações a fazer no mês (a agenda) e os arquivos enviados no mês
// (que abre o Enviar documento). Polida de 17/10/2026 (Vitor: "dê uma polida na tela de clientes"): com poucas guias, a
// lista completa com o que o escritório ainda entrega no mês; o atendimento no CartaoDeAtendimento (os contatos já fazem
// a ação); os vazios curtos e no meio do cartão.
import { formatos } from '@nads/core';
import { Icone, type NomeIcone } from '@nads/ui';
import type { ReactNode } from 'react';
import { CartaoDeAtendimento } from '../partes/CartaoDeAtendimento';
import { LinhaDaAgenda } from '../partes/LinhaDaAgenda';
import { LinhaDeGuia } from '../partes/LinhaDeGuia';
import { LinhaDePaga } from '../partes/LinhaDePaga';
import { Vazio } from '../partes/Vazio';
import { useInicio } from './useInicio';
import { useJanelaDeEnvio } from './JanelaDeEnvio';
import type { AreaCliente, DaCasca, IdAba } from './useAreaCliente';

function Numero({ rotulo, valor, nota, abrir }: { rotulo: string; valor: string | number; nota: ReactNode; abrir: () => void }) {
  return (
    <button type="button" className="cli-numero" onClick={abrir}>
      <span className="cli-sobre">{rotulo}</span>
      <span className="cli-numero-valor">{valor}</span>
      <span className="hint">{nota}</span>
    </button>
  );
}

const ICONE_DO_AVISO: Record<IdAba, NomeIcone> = { inicio: 'sino', documentos: 'pastaAberta', guias: 'escudo', dp: 'usuario', chamados: 'mensagem' };

export function Inicio(props: DaCasca & { empresa: string; contato: AreaCliente['contato']; onWhatsapp?: () => void }) {
  const vm = useInicio(props);
  const abrirEnvio = useJanelaDeEnvio(props);
  const ir = (id: IdAba) => () => vm.irPara(id);
  const temLista = vm.guias.length + vm.pagas.length + vm.obrigacoesDaLista.length > 0;
  return (
    <>
      <section className="card cli-boas-vindas">
        <div className="cli-boas-vindas-txt">
          <p className="cli-sobre">{formatos.capital(vm.mesAtual)}</p>
          <h1 className="page-title">Bem-vindo à sua área</h1>
          <p className="page-desc">{vm.secoes.documentos ? 'Guias, documentos e pedidos num lugar só.' : 'Guias, obrigações e pedidos num lugar só.'}</p>
        </div>
        <div className="cli-acoes">
          <button type="button" className="btn btn-primary" onClick={() => vm.irPara('guias')}><Icone nome="recibo" width={16} height={16} />Guias deste mês</button>
          <button type="button" className="btn" onClick={() => vm.irPara('chamados')}><Icone nome="mensagem" width={16} height={16} />Abrir chamado</button>
        </div>
      </section>

      <div className="cli-numeros">
        <Numero rotulo="Guias a pagar" valor={vm.totalDeGuias} abrir={ir('guias')}
          nota={vm.totalDeGuias ? <>{vm.vencidas > 0 && <><b className="ruim">{vm.vencidas === 1 ? '1 vencida' : vm.vencidas + ' vencidas'}</b> · </>}{formatos.reais(vm.valorEmAberto)}</> : 'Nenhuma em aberto'} />
        {vm.secoes.dp ? (
          <Numero rotulo="Empregados ativos" valor={vm.pessoal.ativos} abrir={ir('dp')}
            nota={vm.pessoal.emFerias === 1 ? '1 em férias' : vm.pessoal.emFerias ? vm.pessoal.emFerias + ' em férias' : 'Ninguém em férias'} />
        ) : (
          <Numero rotulo="Obrigações a fazer" valor={vm.obrigacoes.aFazer} abrir={ir('guias')}
            nota={vm.obrigacoes.total ? vm.obrigacoes.feitas + ' de ' + vm.obrigacoes.total + ' já feitas' : 'Nada neste mês'} />
        )}
        <Numero rotulo="Chamados em aberto" valor={vm.chamadosEmAberto} abrir={ir('chamados')} nota={vm.chamadosEmPoucas || 'Nenhum'} />
        {vm.secoes.documentos ? (
          <Numero rotulo="Documentos do mês" valor={vm.docsDoMes} abrir={ir('documentos')}
            nota={vm.docsNovos === 1 ? '1 ainda não baixado' : vm.docsNovos ? vm.docsNovos + ' não baixados' : 'Todos baixados'} />
        ) : (
          <Numero rotulo="Arquivos enviados" valor={vm.enviadosNoMes} abrir={abrirEnvio}
            nota={vm.ultimoEnvio ? 'Último em ' + vm.ultimoEnvio : 'Mande extratos e notas por aqui'} />
        )}
      </div>

      <div className="cli-duas cli-iguais">
        <section className="card">
          <div className="card-head">
            <h3>Obrigações e guias próximas</h3>
            <button type="button" className="btn btn-ghost" onClick={() => vm.irPara('guias')}>Ver todas<Icone nome="chevronRight" width={16} height={16} /></button>
          </div>
          {temLista ? (
            <>
              <p className="cli-grupo">A pagar</p>
              {vm.guias.length > 0 ? (
                <ul className="cli-lista">
                  {vm.guias.map(g => <LinhaDeGuia key={g.id} guia={g} codigo={vm.codigos[g.id]} ocupado={vm.baixando === g.id} onBaixar={id => void vm.baixar(id)} onCopiar={vm.copiarCodigo} />)}
                </ul>
              ) : <p className="cli-grupo-vazio">Nada para pagar agora.</p>}
              {vm.pagas.length > 0 && (
                <>
                  <p className="cli-grupo">Pagas</p>
                  <ul className="cli-lista cli-pagas">
                    {vm.pagas.map(p => <LinhaDePaga key={p.id} paga={p} onComprovante={id => void vm.baixarComprovante(id)} />)}
                  </ul>
                </>
              )}
              {vm.obrigacoesDaLista.length > 0 && (
                <>
                  <p className="cli-grupo">Entregas do escritório</p>
                  <ul className="cli-lista cli-agenda">
                    {vm.obrigacoesDaLista.map(i => <LinhaDaAgenda key={i.id} item={i} semSituacao />)}
                  </ul>
                </>
              )}
            </>
          ) : <Vazio icone="recibo" titulo="Nada para pagar agora" texto="Quando o escritório gerar uma guia, ela aparece aqui." />}
        </section>

        <div className="cli-coluna-direita">
          <CartaoDeAtendimento contato={props.contato} onWhatsapp={props.onWhatsapp} />

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
