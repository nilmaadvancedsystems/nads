// Financeiro › Configurações (15/10/2026: "vamos criar um emissor de notas fiscais para o financeiro"), no estilo das
// configurações do Notion (como o Cadastro › Empresa): a emissão (ambiente, série, numeração), o prestador (a Nilma), o
// serviço (com a descrição automática das notas), o e-mail ao cliente, o token da prefeitura e o robô. Cada campo grava ao sair dele; o inválido não grava e mostra o aviso ao lado.
import { ConfigLinha, ConfigSecao, Icone, Interruptor, MenuSuspenso, useCarregando, BotaoAcao } from '@nads/ui';
import { dataBr, dataHoraBr } from './formatosDaNota';
import { AMBIENTES, OPCOES_DA_APURACAO, OPCOES_DO_SIMPLES, useConfiguracoesDoFinanceiro } from './useConfiguracoesDoFinanceiro';

const enter = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') e.currentTarget.blur(); };
const URL_DA_PREFEITURA = 'https://mg-taiobeiras-pm-nfs.cloud.el.com.br';

export function ConfiguracoesDoFinanceiro() {
  const vm = useConfiguracoesDoFinanceiro();
  useCarregando(vm.carregando);
  if (vm.carregando) return null;
  const c = vm.config;
  const r = vm.robo;
  /** um campo de texto que grava ao sair (a chave refaz o valor mostrado quando o gravado muda) */
  const campo = (id: string, valor: string, rotulo: string, aoSair: (v: string) => void, extra?: { placeholder?: string; modo?: 'numeric' | 'decimal'; largo?: boolean; aoDigitar?: (v: string) => void }) => (
    <input key={id + '|' + valor} type="text" className={'nf-entrada' + (extra?.largo ? ' largo' : '')} aria-label={rotulo} defaultValue={valor} inputMode={extra?.modo} placeholder={extra?.placeholder}
      onChange={extra?.aoDigitar ? e => extra.aoDigitar?.(e.target.value) : undefined}
      onBlur={e => { if (e.target.value !== valor) aoSair(e.target.value); else extra?.aoDigitar?.(valor); }} onKeyDown={enter} />
  );
  const apuracao = OPCOES_DA_APURACAO.find(o => o.id === c.prestador.regApTribSN);
  return (
    <>
      {vm.exemplos && <p className="registro-dica nf-exemplos"><Icone nome="alert" />Dados de exemplo: nada do que mudar aqui vai para o banco.</p>}

      <ConfigSecao titulo="Emissão" acao={vm.semConfig ? <button type="button" className="btn btn-ghost" onClick={vm.gravarPadrao} title="Ainda não tem configuração salva: valem os dados do escritório da nota real">Salvar a configuração padrão</button> : undefined}>
        <ConfigLinha titulo="Ambiente" descricao="Em homologação a nota não vale nada. Em produção ela vale de verdade na prefeitura.">
          <MenuSuspenso rotulo={AMBIENTES.find(a => a.id === c.ambiente)?.rotulo || ''} className="btn btn-outline" titulo="Ambiente" largura={180}
            itens={AMBIENTES.map(a => ({ rotulo: a.rotulo, marcado: a.id === c.ambiente, onClick: () => { void vm.definirAmbiente(a.id); } }))} />
          <span className={'badge ' + (c.ambiente === 'producao' ? 'badge-ok' : 'badge-warn')}>{c.ambiente === 'producao' ? 'Produção' : 'Sem valor fiscal'}</span>
        </ConfigLinha>
        <ConfigLinha titulo="Série" descricao="A série da DPS." aviso={vm.avisos.serie}>
          {campo('serie', c.serie, 'Série', vm.definirSerie, { modo: 'numeric' })}
        </ConfigLinha>
        <ConfigLinha titulo="Próximo número na homologação" descricao="O número da próxima DPS de teste." aviso={vm.avisos['numero-homologacao']}>
          {campo('num-h', String(c.proximoNumero.homologacao), 'Próximo número na homologação', v => vm.definirProximoNumero('homologacao', v), { modo: 'numeric' })}
        </ConfigLinha>
        <ConfigLinha titulo="Próximo número na produção" descricao="Siga a sequência que já saiu pela prefeitura: número repetido é recusado." aviso={vm.avisos['numero-producao']}>
          {campo('num-p', String(c.proximoNumero.producao), 'Próximo número na produção', v => vm.definirProximoNumero('producao', v), { modo: 'numeric' })}
        </ConfigLinha>
      </ConfigSecao>

      <ConfigSecao titulo="O prestador">
        <ConfigLinha titulo="CNPJ" descricao="O do escritório, o mesmo do certificado." aviso={vm.avisos.cnpj}>
          {campo('cnpj', vm.cnpjFormatado, 'CNPJ do prestador', vm.definirCnpj, { modo: 'numeric', placeholder: '00.000.000/0000-00' })}
        </ConfigLinha>
        <ConfigLinha titulo="Inscrição municipal" descricao="Como está no cadastro da prefeitura, com os zeros." aviso={vm.avisos.im}>
          {campo('im', c.prestador.im, 'Inscrição municipal', vm.definirIm)}
        </ConfigLinha>
        <ConfigLinha titulo="Simples Nacional">
          <MenuSuspenso rotulo={OPCOES_DO_SIMPLES.find(o => o.id === c.prestador.opSimpNac)?.rotulo || ''} className="btn btn-outline" titulo="Simples Nacional" largura={200}
            itens={OPCOES_DO_SIMPLES.map(o => ({ rotulo: o.rotulo, marcado: o.id === c.prestador.opSimpNac, onClick: () => vm.definirSimples(o.id) }))} />
        </ConfigLinha>
        {c.prestador.opSimpNac === 3 && (
          <ConfigLinha titulo="Apuração no Simples" descricao="Como o ISS é apurado.">
            <MenuSuspenso rotulo={apuracao?.rotulo || 'Escolher'} className="btn btn-outline" titulo="Apuração no Simples" largura={220}
              itens={OPCOES_DA_APURACAO.map(o => ({ rotulo: o.rotulo, marcado: o.id === c.prestador.regApTribSN, onClick: () => vm.definirApuracao(o.id) }))} />
          </ConfigLinha>
        )}
      </ConfigSecao>

      <ConfigSecao titulo="O serviço">
        <ConfigLinha titulo="Código nacional (cTribNac)" descricao="6 dígitos: contabilidade, item 17.19, é 171901." aviso={vm.avisos.cTribNac}>
          {campo('cTribNac', c.servico.cTribNac, 'Código de tributação nacional', vm.definirCTribNac, { modo: 'numeric' })}
        </ConfigLinha>
        <ConfigLinha titulo="Código na prefeitura (cIntContrib)" descricao="O código do serviço no cadastro da prefeitura." aviso={vm.avisos.cIntContrib}>
          {campo('cIntContrib', c.servico.cIntContrib, 'Código do serviço na prefeitura', vm.definirCIntContrib)}
        </ConfigLinha>
        <ConfigLinha titulo="NBS" descricao="9 dígitos." aviso={vm.avisos.nbs}>
          {campo('nbs', c.servico.cNBS, 'Código NBS', vm.definirNbs, { modo: 'numeric' })}
        </ConfigLinha>
        <ConfigLinha titulo="Alíquota do ISS (%)" descricao="Entre 0 e 5%. Vazio: a prefeitura calcula." aviso={vm.avisos.aliquota}>
          {campo('aliquota', vm.aliquotaNoCampo, 'Alíquota do ISS em porcentagem', vm.definirAliquota, { modo: 'decimal', placeholder: '3,74' })}
        </ConfigLinha>
        <ConfigLinha titulo="Descrição automática das notas" aviso={vm.avisos.descricao}
          descricao={<>A descrição que a nota nova já traz (dá para mudar na própria nota). Pode usar {vm.variaveisDaDescricao.map((v, i) => <span key={v.nome}>{i ? (i === vm.variaveisDaDescricao.length - 1 ? ' e ' : ', ') : ''}<code>{v.nome}</code> ({v.exemplo})</span>)}. Vazio volta ao padrão.<br />Prévia: <strong>{vm.previaDaDescricao}</strong></>}>
          {campo('descricao', c.descricao, 'Descrição automática das notas', vm.definirDescricao, { largo: true, aoDigitar: vm.digitarDescricao })}
        </ConfigLinha>
        <ConfigLinha titulo="Observação na nota" descricao="A frase das informações complementares (a do IBPT).">
          <textarea key={'obs|' + c.servico.infoCompl} className="nf-entrada nf-texto largo" rows={2} aria-label="Observação na nota" defaultValue={c.servico.infoCompl}
            onBlur={e => { if (e.target.value.trim() !== c.servico.infoCompl) vm.definirObservacao(e.target.value); }} />
        </ConfigLinha>
      </ConfigSecao>

      <ConfigSecao titulo="E-mail ao cliente">
        <ConfigLinha titulo="Mandar a nota ao cliente" descricao="Quando a nota sai em produção, o robô manda a DANFSe (PDF) e o XML para o e-mail do tomador, uma vez. Nota de homologação não vai.">
          <Interruptor ligado={c.email.automatico} onMudar={vm.alternarEmailAutomatico} rotulo="Mandar a nota ao cliente por e-mail" />
        </ConfigLinha>
        <ConfigLinha titulo="Assunto" descricao="Pode usar {numero}, {cliente}, {valor} e {competencia}. Vazio volta ao padrão." aviso={vm.avisos['email-assunto']}>
          {campo('email-assunto', c.email.assunto, 'Assunto do e-mail', vm.definirAssuntoDoEmail, { largo: true })}
        </ConfigLinha>
        <ConfigLinha titulo="Texto" descricao="O mesmo vale aqui: {cliente}, {numero}, {valor} e {competencia}. Vazio volta ao padrão." aviso={vm.avisos['email-texto']}>
          <textarea key={'email-texto|' + c.email.texto} className="nf-entrada nf-texto largo" rows={7} aria-label="Texto do e-mail" defaultValue={c.email.texto}
            onBlur={e => { if (e.target.value.trim() !== c.email.texto) vm.definirTextoDoEmail(e.target.value); }} />
        </ConfigLinha>
      </ConfigSecao>

      <ConfigSecao titulo="Token da prefeitura">
        <ConfigLinha titulo="Salvar o token"
          descricao={<>No portal da prefeitura (<a href={URL_DA_PREFEITURA} target="_blank" rel="noreferrer">{URL_DA_PREFEITURA.replace('https://', '')}</a>): Configurações › Integração › Gerar Token. Cole aqui; o nads guarda e não mostra de volta.</>}
          aviso={vm.avisos.token}>
          <input type="password" className="nf-entrada" aria-label="Token da prefeitura" autoComplete="off" placeholder={vm.tokenGravadoEm ? 'Colar um token novo' : 'Colar o token'} value={vm.token}
            onChange={e => vm.setToken(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void vm.gravarToken(); }} />
          <BotaoAcao className="btn" carregando={vm.gravandoToken} textoCarregando="Salvando…" disabled={!vm.token.trim()} onClick={() => void vm.gravarToken()}>Salvar token</BotaoAcao>
        </ConfigLinha>
        <ConfigLinha titulo="Situação do token">
          {vm.tokenGravadoEm
            ? <span className="cfg-valor">Salvo em {dataHoraBr(vm.tokenGravadoEm)}</span>
            : <span className="badge badge-bad">Nenhum token salvo</span>}
        </ConfigLinha>
      </ConfigSecao>

      <ConfigSecao titulo="O robô">
        <ConfigLinha titulo="Robô da nuvem" descricao={r.ligado ? undefined : r.motivo || undefined}>
          <span className={'badge ' + (!r.carregado ? 'badge-neutral' : r.ligado ? 'badge-ok' : 'badge-bad')}>{!r.carregado ? 'Lendo…' : r.ligado ? 'Ligado' : 'Desligado'}</span>
        </ConfigLinha>
        <ConfigLinha titulo="Certificado" descricao={r.certificado ? 'Válido até ' + dataBr(r.certificado.validade) : 'O robô ainda não leu o certificado.'}>
          <span className={'cfg-valor' + (r.certificado ? '' : ' vazio')}>{r.certificado?.titular || '—'}</span>
        </ConfigLinha>
      </ConfigSecao>
    </>
  );
}
