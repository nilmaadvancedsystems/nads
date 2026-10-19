// A Visão geral da Área do Cliente (Vitor, 16 e 17/10/2026). "Melhora mais" de 17/10/2026 ("procura na net exemplos de
// portal de cliente"), no padrão dos portais de cliente das contabilidades (Assembly, TaxDome, a "Visão do Cliente" do
// Omie), no visual D:
//   1. o veredito no topo (CartaoDoVeredito): a frase da situação e o que precisamos do cliente, cada item com UMA ação;
//   2. à esquerda, as guias do momento com o resumo do pagamento (quanto, até quando) e a dica de como pagar; embaixo, a
//      atividade recente (o arquivo que chegou, a resposta do escritório, o que o escritório concluiu), quando tem;
//   3. à direita, o envio rápido (soltar o arquivo ali mesmo) e o atendimento.
// Os quatro números saíram (o veredito e o resumo do pagamento dizem o mesmo, cada um ao lado da ação); o card de avisos
// virou o "O que precisamos de você". No celular a ordem é: veredito, guias, envio, atividade e atendimento.
import { Icone, type NomeIcone } from '@nads/ui';
import { CartaoDeAtendimento } from '../partes/CartaoDeAtendimento';
import { CartaoDoVeredito, type ItemPendente } from '../partes/CartaoDoVeredito';
import { LinhaDaAtividade } from '../partes/LinhaDaAtividade';
import { LinhaDeGuia } from '../partes/LinhaDeGuia';
import { LinhaDePaga } from '../partes/LinhaDePaga';
import { ResumoDoPagamento } from '../partes/ResumoDoPagamento';
import { Vazio } from '../partes/Vazio';
import { tituloDaGuiaNova, type Pendencia } from '../dados/visaoGeral';
import { Enviar } from './Enviar';
import { useInicio } from './useInicio';
import { useJanelaDeEnvio } from './JanelaDeEnvio';
import type { AreaCliente, DaCasca } from './useAreaCliente';

const ICONE_DA_PENDENCIA: Record<Pendencia['origem'], NomeIcone> = { guia: 'recibo', chamado: 'mensagem', certificado: 'escudo', aviso: 'sino' };

export function Inicio(props: DaCasca & { empresa: string; contato: AreaCliente['contato']; onWhatsapp?: () => void }) {
  const abrirEnvio = useJanelaDeEnvio(props);
  const vm = useInicio(props, abrirEnvio);
  const itens: ItemPendente[] = vm.pendencias.map(p => ({
    id: p.id, tom: p.tom, icone: ICONE_DA_PENDENCIA[p.origem], titulo: p.titulo, texto: p.texto, rotulo: p.rotulo,
    onAcao: () => vm.agir(p.acao), ocupado: p.acao.tipo === 'baixar-guia' && vm.baixando === p.acao.guia,
  }));
  const temGuias = vm.guias.length + vm.pagas.length > 0;
  return (
    <>
      <CartaoDoVeredito sobre={vm.sobre} tom={vm.veredito.tom} titulo={vm.veredito.titulo} texto={vm.veredito.texto} itens={itens} />

      <div className="cli-duas cli-visao">
        <div className="cli-coluna">
          <section className="card cli-v-guias">
            <div className="card-head">
              <h3>Guias a pagar</h3>
              <button type="button" className="btn btn-ghost" onClick={() => vm.irPara('guias')}>Ver todas<Icone nome="chevronRight" width={16} height={16} /></button>
            </div>
            {temGuias ? (
              <>
                {vm.resumo && <ResumoDoPagamento {...vm.resumo} />}
                {vm.guias.length > 0 && (
                  <ul className="cli-lista">
                    {vm.guias.map(g => (
                      <LinhaDeGuia key={g.id} guia={g} codigo={vm.codigos[g.id]} faltam={vm.faltam(g)} destaque={g.id === vm.destaque} ocupado={vm.baixando === g.id}
                        onBaixar={id => void vm.baixar(id)} onCopiar={vm.copiarCodigo} onPedirNova={x => vm.pedirGuiaNova(tituloDaGuiaNova(x))} />
                    ))}
                  </ul>
                )}
                {vm.resumo && (
                  <p className="cli-como-pagar">
                    <Icone nome="ajuda" width={16} height={16} />
                    {vm.temCodigo ? 'Baixe o PDF ou copie o código de barras e pague no app do seu banco até o vencimento.' : 'Baixe o PDF e pague no app do seu banco até o vencimento.'}
                  </p>
                )}
                {vm.pagas.length > 0 && (
                  <>
                    <p className="cli-grupo">Pagas</p>
                    <ul className="cli-lista cli-pagas">
                      {vm.pagas.map(p => <LinhaDePaga key={p.id} paga={p} onComprovante={id => void vm.baixarComprovante(id)} />)}
                    </ul>
                  </>
                )}
              </>
            ) : <Vazio icone="checkCircle" titulo="Nada para pagar agora" texto="Quando o escritório gerar uma guia, ela aparece aqui." />}
          </section>

          {vm.atividade.length > 0 && (
            <section className="card cli-v-atividade">
              <div className="card-head"><h3>Atividade recente</h3></div>
              <ul className="cli-lista cli-atividades">
                {vm.atividade.map(a => (
                  <LinhaDaAtividade key={a.id} origem={a.origem} titulo={a.titulo} texto={a.texto} quando={a.quando}
                    onAbrir={a.chamado ? () => vm.irPara('chamados', { chamado: a.chamado }) : undefined} />
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="cli-coluna">
          <section className="card cli-v-enviar">
            <div className="card-head">
              <div><h3>Enviar documento</h3><p className="hint">Extratos, notas e comprovantes vão direto para o escritório.</p></div>
            </div>
            <Enviar {...props} />
          </section>
          <div className="cli-v-atendimento"><CartaoDeAtendimento contato={props.contato} onWhatsapp={props.onWhatsapp} /></div>
        </div>
      </div>
    </>
  );
}
