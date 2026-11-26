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
          Tudo fica desligado até alguém ligar aqui e gravar. Os tokens da SCI (o de Parceiro e o de Cliente) não ficam no nads: vão no
          metadado da máquina do robô, no arquivo do robô do PC e nos segredos da função da Área do Cliente.
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
              <Dica texto="O RH NET usa o token de cada empresa (gerado no SCI WEB por um usuário dela), que fica no robô, não no nads. O Testar só lê: busca os cadastros da empresa e quantas admissões há." />
            </h3>
          </div>
          {vm.rhNet.length ? vm.rhNet.map(e => (
            <div key={e.codigo} className="cad-chave">
              <div className="cad-chave-texto">
                <b>Empresa {e.codigo}</b>
                <span className={'hint' + (e.tom ? ' sci-' + e.tom : '')}>{e.situacao}</span>
              </div>
              <button type="button" className="btn" disabled={e.pedindo} onClick={() => vm.testarRhNet(e.codigo)}>{e.pedindo ? 'Pedindo…' : 'Testar'}</button>
            </div>
          )) : <p className="hint">Ponha a empresa de teste na lista abaixo e grave.</p>}
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
