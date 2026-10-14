// Cadastro › a empresa, no estilo das configurações do Notion (Vitor, 14/10/2026: "adicionando na parte de empresa os
// dados dela, e melhorando a parametrização no estilo do Notion; parametrizações por setor"). Três telas:
//   - DadosDaEmpresa (Empresa): a identificação e a situação na Receita (o que o Entregas já tem), o contato e os sócios;
//   - ParametrosContabeis (Contábil › Parâmetros): os cartões, a liquidação de cobrança e a nota de honorário;
//   - ParametrosFiscais (Fiscal › Parâmetros): o regime tributário e se presta serviços.
// Cada opção numa linha solta (ConfigLinha): o nome, a descrição curta e o controle à direita.
import { empresas } from '@nads/core';
import { ConfigLinha, ConfigSecao, Icone, Interruptor, MenuSuspenso, useCarregando } from '@nads/ui';
import { useState } from 'react';
import { useDadosDaEmpresa } from './useDadosDaEmpresa';

const dataBr = (iso: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : iso; };
const Valor = ({ v }: { v: string }) => <span className={'cfg-valor' + (v ? '' : ' vazio')}>{v || '—'}</span>;

/** Empresa: os dados dela, o contato e os sócios. */
export function DadosDaEmpresa({ rota }: { rota: string }) {
  const vm = useDadosDaEmpresa(rota);
  // a linha nova (vazia) do Adicionar sócio, até ganhar um nome ou um CPF
  const [novo, setNovo] = useState(false);
  // o e-mail ou o WhatsApp inválido não grava: o aviso fica ao lado, até a próxima tentativa
  const [erroDoContato, setErroDoContato] = useState<string | null>(null);
  useCarregando(vm.carregando);
  if (vm.carregando) return null;
  const d = vm.entregas.dados;
  const r = d?.receita || null;
  const linhas = [...vm.socios, ...(novo ? [{ nome: '', cpf: '' }] : [])];
  /** grava ao sair do campo: a lista inteira, com esta linha trocada */
  const mudar = (i: number, campo: 'nome' | 'cpf', v: string) => {
    const lista = [...vm.socios];
    if (i < vm.socios.length) lista[i] = { ...lista[i], [campo]: v };
    else { lista.push({ nome: '', cpf: '', [campo]: v }); if (v.trim()) setNovo(false); }
    vm.definirSocios(lista);
  };
  const tirar = (i: number) => { if (i >= vm.socios.length) setNovo(false); else vm.definirSocios(vm.socios.filter((_, j) => j !== i)); };
  const enter = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') e.currentTarget.blur(); };
  const ativa = !r?.situacao || r.situacao === 'ATIVA';
  return (
    <>
      <ConfigSecao titulo="Identificação">
        <ConfigLinha titulo="CNPJ"><Valor v={vm.cnpj ? empresas.cadastro.cnpjFormatado(vm.cnpj) : ''} /></ConfigLinha>
        <ConfigLinha titulo="Razão social"><Valor v={r?.razaoSocial || vm.empresa?.nome || ''} /></ConfigLinha>
        <ConfigLinha titulo="Nome fantasia"><Valor v={d?.nomeFantasia || ''} /></ConfigLinha>
        <ConfigLinha titulo="Código no Alterdata"><Valor v={vm.empresa?.codigo != null ? String(vm.empresa.codigo) : ''} /></ConfigLinha>
        <ConfigLinha titulo="Inscrição estadual"><Valor v={d?.inscricaoEstadual || ''} /></ConfigLinha>
        <ConfigLinha titulo="Endereço"><Valor v={[r?.endereco || d?.endereco, !r?.endereco ? d?.cidade : ''].filter(Boolean).join(' · ')} /></ConfigLinha>
      </ConfigSecao>

      <ConfigSecao titulo="Na Receita" acao={r?.conferidoEm ? <span className="hint">conferido em {dataBr(r.conferidoEm.slice(0, 10))}</span> : undefined}>
        {!r ? (
          <ConfigLinha titulo="Sem consulta" descricao={vm.entregas.carregado ? 'O Entregas ainda não consultou o CNPJ desta empresa na Receita.' : 'Lendo o Entregas…'} />
        ) : (
          <>
            <ConfigLinha titulo="Situação" descricao={r.situacaoDesde ? 'desde ' + dataBr(r.situacaoDesde) : undefined}
              aviso={!ativa ? 'A empresa não está ativa na Receita.' : undefined}>
              <span className={'badge ' + (ativa ? 'badge-ok' : 'badge-bad')}>{r.situacao || '—'}</span>
            </ConfigLinha>
            <ConfigLinha titulo="Atividade principal" descricao={r.cnaeDescricao || undefined}><Valor v={r.cnae} /></ConfigLinha>
            <ConfigLinha titulo="Natureza jurídica"><Valor v={r.naturezaJuridica} /></ConfigLinha>
            <ConfigLinha titulo="Porte"><Valor v={r.porte} /></ConfigLinha>
            <ConfigLinha titulo="Abertura"><Valor v={dataBr(r.abertura)} /></ConfigLinha>
          </>
        )}
      </ConfigSecao>

      {/* o contato da empresa (Vitor, 07/10/2026): o Mandei manda as perguntas de Clientes e Fornecedores para os dois */}
      <ConfigSecao titulo="Contato">
        <ConfigLinha titulo="E-mail" descricao="Para onde o Mandei manda as perguntas de clientes e fornecedores."
          aviso={erroDoContato && erroDoContato.startsWith('E-mail') ? erroDoContato : undefined}>
          <label className="busca-curta" title="O e-mail da empresa">
            <Icone nome="envelope" />
            <input key={'email|' + vm.email} type="email" aria-label="E-mail da empresa" defaultValue={vm.email} placeholder="financeiro@empresa.com.br"
              onBlur={e => setErroDoContato(vm.definirContato('email', e.target.value))} onKeyDown={enter} />
          </label>
        </ConfigLinha>
        <ConfigLinha titulo="WhatsApp" descricao="Com o DDD. Com os dois, o link chega pelos dois."
          aviso={erroDoContato && erroDoContato.startsWith('WhatsApp') ? erroDoContato : undefined}>
          <label className="busca-curta" title="O WhatsApp da empresa, com o DDD">
            <Icone nome="mensagem" />
            <input key={'whatsapp|' + vm.whatsapp} type="tel" inputMode="numeric" aria-label="WhatsApp da empresa" defaultValue={vm.whatsapp} placeholder="(38) 99999-8888"
              onBlur={e => setErroDoContato(vm.definirContato('whatsapp', e.target.value))} onKeyDown={enter} />
          </label>
        </ConfigLinha>
      </ConfigSecao>

      {/* os sócios, com o nome e o CPF (Vitor, 06/10/2026): o relatório da etapa Bancos mostra a transferência para eles */}
      <ConfigSecao titulo="Sócios" acao={(
        <>
          {vm.sociosDaReceita.length > 0 && (
            <button type="button" className="btn btn-ghost" onClick={() => vm.importarSociosDaReceita(vm.sociosDaReceita)} title={vm.sociosDaReceita.join(', ')}>
              Usar os da Receita ({vm.sociosDaReceita.length})
            </button>
          )}
          <button type="button" className="btn" disabled={novo} onClick={() => setNovo(true)}><Icone nome="plus" />Adicionar sócio</button>
        </>
      )}>
        {!linhas.length ? <ConfigLinha titulo="Nenhum sócio" descricao="A etapa Bancos usa o nome e o CPF para achar as transferências para eles." /> : linhas.map((so, i) => (
          <div key={i + '|' + so.nome + '|' + so.cpf} className="cfg-linha cfg-socio">
            <input type="text" aria-label="Nome do sócio" defaultValue={so.nome} placeholder="Nome completo" autoFocus={i >= vm.socios.length}
              onBlur={e => { if (e.target.value.trim() !== so.nome) mudar(i, 'nome', e.target.value); }} onKeyDown={enter} />
            <input type="text" aria-label="CPF do sócio" inputMode="numeric" defaultValue={so.cpf} placeholder="CPF"
              onBlur={e => { if (e.target.value.replace(/\D/g, '') !== so.cpf) mudar(i, 'cpf', e.target.value); }} onKeyDown={enter} />
            <button type="button" className="icon-btn icon-btn-sm" title="Tirar o sócio" aria-label="Tirar o sócio" onClick={() => tirar(i)}><Icone nome="x" /></button>
          </div>
        ))}
      </ConfigSecao>
    </>
  );
}

/** Contábil › Parâmetros: o que liga as etapas do Contábil. */
export function ParametrosContabeis({ rota }: { rota: string }) {
  const vm = useDadosDaEmpresa(rota);
  useCarregando(vm.carregando);
  if (vm.carregando) return null;
  // ligado = Sim; desligado = Não (ou ainda não informado)
  const chave = (campo: 'cartaoEmpresarial' | 'vendeNoCartao' | 'credLiquidacao', rotulo: string) => (
    <Interruptor ligado={vm[campo] === true} rotulo={rotulo} onMudar={() => vm.definirCartao(campo, vm[campo] !== true)} />
  );
  return (
    <>
      <ConfigSecao titulo="Cartões">
        <ConfigLinha titulo="Cartão empresarial" descricao="Compras no cartão de crédito da empresa: a etapa Cartões quebra a fatura no razão do cartão.">
          {chave('cartaoEmpresarial', 'Cartão empresarial')}
        </ConfigLinha>
        <ConfigLinha titulo="Vende no cartão" descricao="Vendas pelas maquininhas: a etapa Cartões concilia com as notas.">
          {chave('vendeNoCartao', 'Vende no cartão')}
        </ConfigLinha>
      </ConfigSecao>
      <ConfigSecao titulo="Recebimentos e honorários">
        {/* o Creditor (Vitor, 08/10/2026): a empresa recebe liquidação de cobrança do banco (CRÉD.LIQ.COBRANÇA) */}
        <ConfigLinha titulo="Liquidação de cobrança (Creditor)" descricao="O banco credita as cobranças liquidadas no caixa: a etapa Creditor entra todo mês.">
          {chave('credLiquidacao', 'Liquidação de cobrança')}
        </ConfigLinha>
        {/* a nota de honorário (Vitor, 07/10/2026): sem nota, a etapa Honorários pede o Extrato por cobrança */}
        <ConfigLinha titulo="Emite nota de honorário" descricao="Sem nota, a etapa Honorários lança as cobranças pelo Extrato por cobrança.">
          <Interruptor ligado={vm.emiteNotaHonorario === true} rotulo="Emite nota de honorário" onMudar={() => vm.definirNotaDeHonorario(vm.emiteNotaHonorario !== true)} />
        </ConfigLinha>
      </ConfigSecao>
    </>
  );
}

/** Fiscal › Parâmetros: o regime (que monta a rotina do Fiscal) e os serviços. */
export function ParametrosFiscais({ rota }: { rota: string }) {
  const vm = useDadosDaEmpresa(rota);
  useCarregando(vm.carregando);
  if (vm.carregando) return null;
  return (
    <ConfigSecao titulo="Tributação">
      {/* o regime (13/10/2026: "no cadastro da empresa tenha os regimes, aí muda na rotina") */}
      <ConfigLinha titulo="Regime tributário" descricao="Define as etapas da rotina do Fiscal (PGDAS, DAS-MEI, ICMS, PIS/COFINS, IRPJ/CSLL)."
        aviso={vm.receitaDiscorda ? 'Na Receita: ' + vm.receitaDiscorda + '. Confira.' : undefined}>
        <MenuSuspenso rotulo={vm.regime ?? (vm.regimePadrao || 'Escolher')} className="btn btn-ghost" titulo="Regime tributário" direita largura={200}
          itens={vm.regimes.map(r => ({ rotulo: r, marcado: (vm.regime ?? vm.regimePadrao) === r, onClick: () => { if (vm.regime !== r) vm.definirRegime(r); } }))} />
      </ConfigLinha>
      <ConfigLinha titulo="Presta serviços" descricao="Mostra a aba Prestados na Importação e os serviços prestados na Conferência.">
        <Interruptor ligado={vm.prestaServico === true} rotulo="Presta serviços" onMudar={() => vm.definirPrestaServico(vm.prestaServico !== true)} />
      </ConfigLinha>
    </ConfigSecao>
  );
}
