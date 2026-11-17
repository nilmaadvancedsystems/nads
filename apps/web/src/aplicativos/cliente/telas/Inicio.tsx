// A tela inicial da Área do Cliente. Refeita em 17/11/2026 ("remove esse boa tarde e esse inicio precisamos montar de
// maneira mais simples possivel o inicio, onde precisamos ter uma tela de guias e documentos la"; escolhida "Guias e
// documentos juntos", no celular e no computador): sem a saudação, sem o resumo e sem os primeiros passos. Só três
// coisas: as guias a pagar, os documentos mais recentes (o nome e Baixar) e o botão de enviar. (17/11/2026: "remove
// isso") sem a lista da resposta, do certificado e do pedido do escritório: ficam no sino.
// (17/11/2026: "deixa mais bonito", escolhido o "Cartãozinho por guia") cada guia com a sigla num quadradinho da cor do
// tipo, o nome, quando vence, o valor e UM botão redondo (sem o "⋯"); tocar na guia abre a prévia. A vencida vira um
// cartão com a faixa vermelha e o "Pedir guia nova" embaixo.
// Só desenha: o estado e as ações vêm de useInicio.ts.
import './inicio.css';
import { Icone } from '@nads/ui';
import { IconeDoArquivo } from '../partes/IconeDoArquivo';
import { SiglaDaGuia } from '../partes/SiglaDaGuia';
import { JanelaDoArquivo } from '../partes/JanelaDoArquivo';
import { useInicio } from './useInicio';
import { useJanelaDeEnvio } from './JanelaDeEnvio';
import type { AreaCliente, DaCasca } from './useAreaCliente';

export function Inicio(props: DaCasca & { empresa: string; contato: AreaCliente['contato']; onWhatsapp?: () => void; primeiros?: AreaCliente['primeiros'] }) {
  const abrirEnvio = useJanelaDeEnvio(props);
  const vm = useInicio(props, abrirEnvio);
  return (
    <>
      {/* o título só para o leitor de tela: na tela, as duas listas já dizem o que é */}
      <h1 className="page-title cli-so-leitor">Guias e documentos</h1>

      <div className="cli-vg cli-ini">
        {/* as guias a pagar: a vencida primeiro (pede uma nova) */}
        <section className="card cli-vg-cartao cli-vg-proximos cli-ini-guias" aria-label="Guias a pagar">
          <div className="card-head">
            <h3>Guias a pagar</h3>
            <button type="button" className="btn btn-ghost btn-sm" onClick={vm.verGuias}>Ver todas<Icone nome="chevronRight" width={16} height={16} /></button>
          </div>
          {/* o total a pagar, grande, como o saldo no app do banco (17/11/2026: "quero um numero grande de quanto ele tem para
              pagar no estilo saldo de banco") */}
          {vm.guias.length > 0 && (
            <div className="cli-ini-saldo">
              <span className="cli-ini-saldo-rot">Total a pagar</span>
              <strong className="cli-ini-saldo-valor">{vm.total}</strong>
              <span className={'cli-ini-saldo-sub' + (vm.temVencida ? ' tem-vencida' : '')}>{vm.totalSub}</span>
            </div>
          )}
          {vm.guias.length ? (
            <ul className="cli-ini-guias-lista">
              {vm.guias.map(g => (
                <li key={g.id} className={'cli-ini-guia tipo-' + g.curto.toLowerCase() + (g.tom ? ' tom-' + g.tom : '')}>
                  {/* tocar na guia abre a prévia (só a que tem o PDF) */}
                  <button type="button" className="cli-ini-guia-abre" disabled={!g.abrir || g.abrindo} onClick={g.abrir ?? undefined} aria-label={g.abrir ? 'Ver a guia: ' + g.nome : g.nome}>
                    {/* a logo do órgão, a mesma das Guias e obrigações (17/11/2026: "coloque as logos assim como no guias e obrigacoes") */}
                    <span className="cli-ini-sigla" aria-hidden="true"><SiglaDaGuia tipo={g.tipo} tamanho={40} /></span>
                    <span className="cli-ini-guia-txt">
                      <b><span className="cli-ini-longo">{g.nome}</span><span className="cli-ini-curto">{g.curto}</span></b>
                      <span className="cli-ini-quando">{g.quando}</span>
                    </span>
                    <span className="cli-ini-valor">{g.valor}</span>
                  </button>
                  {g.acao && (
                    <button type="button" className="icon-btn cli-ini-acao" disabled={vm.baixando === g.id} onClick={g.acao.fazer} aria-label={g.acao.rotulo + ': ' + g.nome} title={g.acao.rotulo}>
                      <Icone nome={g.acao.icone} width={18} height={18} />
                    </button>
                  )}
                  {g.pedirNova && <button type="button" className="cli-ini-pedir-nova" onClick={g.pedirNova}>Pedir guia nova<Icone nome="chevronRight" width={15} height={15} /></button>}
                </li>
              ))}
            </ul>
          ) : <p className="cli-ini-vazio">Nenhuma guia a pagar agora.</p>}
          {vm.maisGuias > 0 && <button type="button" className="cli-ini-mais" onClick={vm.verGuias}>Mais {vm.maisGuias} {vm.maisGuias === 1 ? 'guia' : 'guias'}</button>}
        </section>

        {/* os documentos mais recentes: o novo (ainda não baixado) primeiro */}
        <section className="card cli-vg-cartao cli-ini-docs" aria-label="Documentos">
          <div className="card-head">
            <h3>Documentos{vm.documentosNovos > 0 && <span className="cli-ini-conta">{vm.documentosNovos} {vm.documentosNovos === 1 ? 'novo' : 'novos'}</span>}</h3>
            <button type="button" className="btn btn-ghost btn-sm" onClick={vm.verDocumentos}>Ver todos<Icone nome="chevronRight" width={16} height={16} /></button>
          </div>
          {vm.documentos.length ? (
            <ul className="cli-ini-lista">
              {vm.documentos.map(d => (
                <li key={d.chave} className="cli-ini-doc">
                  <IconeDoArquivo formato={d.formato} tamanho={28} />
                  <span className="cli-vg-guia-txt">
                    <b className="cli-vg-nome">{d.nome}</b>
                    {(d.novo || d.detalhe) && <span className="cli-vg-quando">{d.novo && <span className="cli-ini-novo">Novo</span>}{d.detalhe}</span>}
                  </span>
                  {/* o mesmo botão redondo das guias (17/11/2026, "deixa mais bonito") */}
                  <button type="button" className="icon-btn cli-ini-acao" disabled={vm.baixando === d.chave} onClick={d.baixar} aria-label={'Baixar: ' + d.nome} title="Baixar">
                    <Icone nome="download" width={18} height={18} />
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="cli-ini-vazio">Nenhum documento por enquanto.</p>}
        </section>

        {/* o enviar: um botão só; abre a janela de envio */}
        <button type="button" className="btn btn-primary cli-ini-enviar" onClick={vm.enviar}>
          <Icone nome="upload" width={17} height={17} />Enviar documento
        </button>
      </div>

      {vm.vista.aberto && <JanelaDoArquivo arquivo={vm.vista.aberto} onBaixar={vm.vista.baixar} onFechar={vm.vista.fechar} />}
    </>
  );
}
