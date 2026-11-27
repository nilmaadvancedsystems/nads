// Configurações › Integração SCI (24/11/2026; o dono: "monta o nads para suportar completamente a integracao do sci mesmo
// que nao vamos usar por agora"): as chaves de cada parte, as empresas com o SCI ligado e o código do relatório do SCI
// Report de cada guia. Tudo desligado até alguém ligar e gravar. Só desenha: o estado vem de useIntegracaoSci.ts.
import { Dica, Esqueleto, Icone, Interruptor, useCarregando } from '@nads/ui';
import './integracao-sci.css';
import { useIntegracaoSci } from './useIntegracaoSci';
import { PlanosDoSci } from './PlanosDoSci';

export function IntegracaoSci() {
  const vm = useIntegracaoSci();
  useCarregando(vm.carregando);
  if (vm.carregando) return <Esqueleto linhas={6} />;
  return (
    <div className="sci-config">
      <div className="card cad-secao">
        <div className="cad-secao-topo">
          <span className="cad-faixa-icone" aria-hidden="true"><Icone nome="link" /></span>
          <h3>O que o nads faz com o SCI</h3>
        </div>
        <p className="hint">
          Tudo fica desligado até alguém ligar aqui e gravar. O token de cada empresa do RH NET se cola abaixo e fica embaralhado (só o
          robô da nuvem lê); o de Parceiro e o da contabilidade ficam no robô e nos segredos da função da Área do Cliente.
          {vm.atualizado && <> Gravado em {vm.atualizado}.</>}
        </p>
        {vm.partes.map(p => (
          <div key={p.chave} className="cad-chave">
            <div className="cad-chave-texto">
              <b>{p.titulo}<Dica texto={p.texto} /></b>
              {p.bloqueado && <span className="hint">Ligue antes a publicação no SCI Report.</span>}
            </div>
            <Interruptor ligado={p.ligado} onMudar={() => { if (!p.bloqueado || p.ligado) vm.alternar(p.chave); }} rotulo={p.titulo} />
          </div>
        ))}
      </div>

      {/* o RH NET (25/11/2026): o teste só de leitura de cada empresa ligada (o robô busca os cadastros e as admissões) */}
      {vm.rhNet && (
        <div className="card cad-secao">
          <div className="cad-secao-topo">
            <span className="cad-faixa-icone" aria-hidden="true"><Icone nome="usuario" /></span>
            <h3>RH NET
              <Dica texto="O RH NET usa o token de cada empresa (o Token de Cliente gerado no SCI WEB por um usuário dela). Cole aqui: o nads embaralha antes de gravar e só o robô da nuvem consegue ler. O Testar só lê: busca os cadastros da empresa e quantas admissões há." />
            </h3>
          </div>
          {vm.rhNet.length ? vm.rhNet.map(e => (
            <div key={e.codigo} className="sci-empresa">
              <div className="cad-chave">
                <div className="cad-chave-texto">
                  <b>{e.codigo}{e.nome ? ' · ' + e.nome : ''}</b>
                  <span className={'hint' + (e.tomDoToken ? ' sci-' + e.tomDoToken : '')}>{e.token}</span>
                  <span className={'hint' + (e.tom ? ' sci-' + e.tom : '')}>{e.situacao}</span>
                </div>
                <div className="sci-botoes">
                  {!e.editando && <button type="button" className="btn" onClick={() => vm.editarToken(e.codigo)}>{e.temToken ? 'Trocar token' : 'Colar token'}</button>}
                  <button type="button" className="btn" disabled={e.pedindo} onClick={() => vm.testarRhNet(e.codigo)}>{e.pedindo ? 'Pedindo…' : 'Testar'}</button>
                </div>
              </div>
              {e.editando && (
                <div className="sci-token">
                  <input className="input" type="password" autoComplete="off" spellCheck={false} value={vm.tokenTexto} onChange={ev => vm.mudarToken(ev.target.value)}
                    onKeyDown={ev => { if (ev.key === 'Enter') vm.gravarToken(e.codigo); }} placeholder="Token de Cliente da empresa (SCI WEB)" aria-label={'Token de Cliente da empresa ' + e.codigo} autoFocus />
                  <button type="button" className="btn btn-primary" disabled={vm.gravandoToken} onClick={() => vm.gravarToken(e.codigo)}>{vm.gravandoToken ? 'Gravando…' : 'Gravar token'}</button>
                  {e.temToken && <button type="button" className="btn" disabled={vm.gravandoToken} onClick={() => vm.tirarToken(e.codigo)}>Tirar</button>}
                  <button type="button" className="btn" onClick={vm.cancelarToken}>Cancelar</button>
                </div>
              )}
            </div>
          )) : <p className="hint">Nenhuma empresa ainda.</p>}
          {vm.adicionando ? (
            <div className="sci-nova">
              <label className="cad-campo">
                <span className="hint">Código da empresa{vm.nomeDoNovo ? ' · ' + vm.nomeDoNovo : ''}</span>
                <input className="input" type="text" inputMode="numeric" value={vm.novoCodigo} onChange={ev => vm.mudarNovoCodigo(ev.target.value)} placeholder="Ex.: 590" aria-label="Código da empresa a adicionar" autoFocus />
              </label>
              <label className="cad-campo">
                <span className="hint">Token de Cliente da empresa (SCI WEB)</span>
                <input className="input" type="password" autoComplete="off" spellCheck={false} value={vm.tokenTexto} onChange={ev => vm.mudarToken(ev.target.value)}
                  onKeyDown={ev => { if (ev.key === 'Enter') vm.adicionarEmpresa(); }} placeholder="Cole o token aqui" aria-label="Token da empresa a adicionar" />
              </label>
              <div className="sci-botoes">
                <button type="button" className="btn" onClick={vm.fecharAdicionar}>Cancelar</button>
                <button type="button" className="btn btn-primary" disabled={vm.gravandoToken} onClick={vm.adicionarEmpresa}>{vm.gravandoToken ? 'Adicionando…' : 'Adicionar'}</button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn sci-adicionar" onClick={vm.abrirAdicionar}><Icone nome="plus" width={16} height={16} />Adicionar empresa</button>
          )}
        </div>
      )}

      <div className="card cad-secao">
        <div className="cad-secao-topo">
          <span className="cad-faixa-icone" aria-hidden="true"><Icone nome="pasta" /></span>
          <h3>Empresas com o SCI ligado
            <Dica texto="Os códigos do nads, separados por vírgula. Só elas vão ao SCI. Comece por uma empresa de teste cujos avisos do SCI Report cheguem só ao escritório." />
          </h3>
        </div>
        <label className="cad-campo">
          <span className="hint">Códigos das empresas</span>
          <input className="input" type="text" inputMode="numeric" value={vm.empresasTexto} onChange={e => vm.mudarEmpresas(e.target.value)} placeholder="Ex.: 583" aria-label="Códigos das empresas com o SCI ligado" />
        </label>
        <span className="hint">{vm.config.empresas.length ? vm.config.empresas.length + (vm.config.empresas.length === 1 ? ' empresa' : ' empresas') : 'Nenhuma empresa: nada vai ao SCI.'}</span>
      </div>

      {/* (27/11/2026: "cria a lista para esconder a guia de teste da área") a API do SCI não apaga publicação */}
      <div className="card cad-secao">
        <div className="cad-secao-topo">
          <span className="cad-faixa-icone" aria-hidden="true"><Icone nome="olho" /></span>
          <h3>Guias do SCI Report escondidas da Área
            <Dica texto="Os números das publicações (publicadosId) que a Área do Cliente não mostra nem deixa abrir: uma guia de teste ou publicada por engano. A API da SCI não apaga publicação; para tirar do SCI Report, só pela tela do SCI." />
          </h3>
        </div>
        <label className="cad-campo">
          <span className="hint">Números das publicações</span>
          <input className="input" type="text" inputMode="numeric" value={vm.ocultasTexto} onChange={e => vm.mudarOcultas(e.target.value)} placeholder="Ex.: 51643495" aria-label="Números das publicações escondidas da Área" />
        </label>
        <span className="hint">{vm.config.ocultas.length ? vm.config.ocultas.length + (vm.config.ocultas.length === 1 ? ' guia escondida' : ' guias escondidas') : 'Nenhuma guia escondida.'}</span>
      </div>

      <div className="card cad-secao">
        <div className="cad-secao-topo">
          <span className="cad-faixa-icone" aria-hidden="true"><Icone nome="recibo" /></span>
          <h3>Relatório de cada guia no SCI Report
            <Dica texto="O código (até 4 letras ou números) do modelo de imposto cadastrado no SCI Report para cada guia. Sem código, a guia não é publicada e o Enviar guias diz por quê. 'Outras guias' vale para o que não tiver código próprio." />
          </h3>
        </div>
        <div className="sci-grade">
          {vm.guias.map(g => (
            <label key={g.chave} className="cad-campo">
              <span className="hint">{g.rotulo}</span>
              <input className="input" type="text" value={g.codigo} onChange={e => vm.mudarRelatorio(g.chave, e.target.value)} placeholder="0000" maxLength={4} aria-label={'Código do relatório: ' + g.rotulo} />
            </label>
          ))}
        </div>
      </div>

      <div className="sci-acoes">
        {vm.mudado && <button type="button" className="btn" onClick={vm.descartar} disabled={vm.gravando}>Descartar</button>}
        <button type="button" className="btn btn-primary" onClick={() => void vm.gravar()} disabled={!vm.mudado || vm.gravando}>
          {vm.gravando ? 'Gravando…' : 'Gravar'}
        </button>
      </div>

      {/* os planos de contas do SCI (26/11/2026): adicionar ou atualizar pela exportação; grava à parte do botão de cima */}
      <PlanosDoSci />
    </div>
  );
}
