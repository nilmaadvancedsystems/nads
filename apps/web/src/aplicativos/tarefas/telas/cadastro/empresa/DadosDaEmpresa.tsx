// Cadastro › Empresa: as regras da empresa. "Presta serviços?", "Cartão empresarial" e "Vende no cartão" no Interruptor
// (13/10/2026: ligado = Sim) e os sócios (o nome e o CPF de cada um).
import { Dica, Icone, Interruptor, MenuSuspenso, useCarregando } from '@nads/ui';
import { useState } from 'react';
import { useDadosDaEmpresa } from './useDadosDaEmpresa';

export function DadosDaEmpresa({ rota }: { rota: string }) {
  const vm = useDadosDaEmpresa(rota);
  // a linha nova (vazia) do Adicionar sócio, até ganhar um nome ou um CPF
  const [novo, setNovo] = useState(false);
  // o e-mail ou o WhatsApp inválido não grava: o aviso fica ao lado, até a próxima tentativa
  const [erroDoContato, setErroDoContato] = useState<string | null>(null);
  useCarregando(vm.carregando);
  if (vm.carregando) return null;
  // o Interruptor do catálogo (Vitor, 13/10/2026: "troque para toggle"): ligado = Sim; desligado = Não (ou ainda não informado)
  const doCartao = (campo: 'cartaoEmpresarial' | 'vendeNoCartao' | 'credLiquidacao', rotulo: string) => (
    <Interruptor ligado={vm[campo] === true} rotulo={rotulo} onMudar={() => vm.definirCartao(campo, vm[campo] !== true)} />
  );
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
  return (
    <section>
      {/* o regime (13/10/2026: "no cadastro da empresa tenha os regimes, aí muda na rotina") */}
      <div className="cad-regra">
        <div className="cad-regra-txt">
          <span className="cad-campo-rotulo">Regime tributário<Dica texto={'Muda as etapas da rotina do Fiscal: o PGDAS no Simples, o DAS-MEI no MEI; ICMS, PIS/COFINS, IRPJ/CSLL e as EFDs no Presumido e no Real.' + (vm.regime == null && vm.regimePadrao ? ' Sem escolher, vale o ' + vm.origemDoPadrao + ': ' + vm.regimePadrao + '.' : '')} /></span>
          {vm.receitaDiscorda && <span className="hint"><b>Na Receita: {vm.receitaDiscorda}.</b> Confira.</span>}
        </div>
        {/* o menu do catálogo (Vitor, 13/10/2026: os sete botões ficaram feios), o mesmo da Nova empresa */}
        <div className="cad-regra-opcoes">
          <MenuSuspenso rotulo={vm.regime ?? (vm.regimePadrao || 'Escolher')} className="btn btn-outline" titulo="Regime tributário" direita largura={200}
            itens={vm.regimes.map(r => ({ rotulo: r, marcado: (vm.regime ?? vm.regimePadrao) === r, onClick: () => { if (vm.regime !== r) vm.definirRegime(r); } }))} />
        </div>
      </div>
      <div className="cad-regra">
        <div className="cad-regra-txt">
          <span className="cad-campo-rotulo">Presta serviços<Dica texto="Mostra a aba Prestados na Importação e os serviços prestados na Conferência." /></span>
        </div>
        <div className="cad-regra-opcoes" role="group" aria-label="Presta serviços">
          <Interruptor ligado={vm.prestaServico === true} rotulo="Presta serviços" onMudar={() => vm.definirPrestaServico(vm.prestaServico !== true)} />
        </div>
      </div>
      {/* os cartões (Vitor, 07/10/2026): ligam a etapa Cartões na Tarefas */}
      <div className="cad-regra">
        <div className="cad-regra-txt">
          <span className="cad-campo-rotulo">Cartão empresarial<Dica texto="Compras no cartão de crédito da empresa: a etapa Cartões quebra a fatura no razão do cartão." /></span>
        </div>
        <div className="cad-regra-opcoes" role="group" aria-label="Cartão empresarial">
          {doCartao('cartaoEmpresarial', 'Cartão empresarial')}
        </div>
      </div>
      <div className="cad-regra">
        <div className="cad-regra-txt">
          <span className="cad-campo-rotulo">Vende no cartão<Dica texto="Vendas pelas maquininhas (Cielo, Rede, Getnet, Stone, PagBank): a etapa Cartões concilia com as notas." /></span>
        </div>
        <div className="cad-regra-opcoes" role="group" aria-label="Vende no cartão">
          {doCartao('vendeNoCartao', 'Vende no cartão')}
        </div>
      </div>
      {/* o Creditor (Vitor, 08/10/2026): a empresa recebe liquidação de cobrança do banco (CRÉD.LIQ.COBRANÇA) */}
      <div className="cad-regra">
        <div className="cad-regra-txt">
          <span className="cad-campo-rotulo">Liquidação de cobrança (Creditor)<Dica texto="O banco credita as cobranças liquidadas no caixa (CRÉD.LIQ.COBRANÇA): a etapa Creditor entra em todos os meses da Tarefa. Sem resposta ou Não, ela entra só nos meses em que o razão do caixa tiver a liquidação." /></span>
        </div>
        <div className="cad-regra-opcoes" role="group" aria-label="Liquidação de cobrança (Creditor)">
          {doCartao('credLiquidacao', 'Liquidação de cobrança')}
        </div>
      </div>
      {/* a nota de honorário (Vitor, 07/10/2026): sem nota, a etapa Honorários pede o Extrato por cobrança */}
      <div className="cad-regra">
        <div className="cad-regra-txt">
          <span className="cad-campo-rotulo">Emite nota de honorário<Dica texto="O escritório emite nota de honorário para a empresa. Sem nota, a etapa Honorários lança as cobranças pelo Extrato por cobrança." /></span>
        </div>
        <div className="cad-regra-opcoes" role="group" aria-label="Emite nota de honorário">
          <Interruptor ligado={vm.emiteNotaHonorario === true} rotulo="Emite nota de honorário" onMudar={() => vm.definirNotaDeHonorario(vm.emiteNotaHonorario !== true)} />
        </div>
      </div>
      {/* o contato da empresa (Vitor, 07/10/2026): o Mandei manda as perguntas de Clientes e Fornecedores para os dois */}
      <div className="cad-regra">
        <div className="cad-regra-txt">
          <span className="cad-campo-rotulo">E-mail e WhatsApp<Dica texto="Para onde o Mandei manda as perguntas de Clientes e Fornecedores: um dos dois basta (com os dois, o link chega pelos dois). O WhatsApp com o DDD." /></span>
          {erroDoContato && <span className="hint"><b>{erroDoContato}</b></span>}
        </div>
        <div className="cad-regra-opcoes">
          <label className="busca-curta" title="O e-mail da empresa">
            <Icone nome="envelope" />
            <input key={'email|' + vm.email} type="email" aria-label="E-mail da empresa" defaultValue={vm.email} placeholder="financeiro@empresa.com.br"
              onBlur={e => setErroDoContato(vm.definirContato('email', e.target.value))} onKeyDown={enter} />
          </label>
          <label className="busca-curta" title="O WhatsApp da empresa, com o DDD">
            <Icone nome="mensagem" />
            <input key={'whatsapp|' + vm.whatsapp} type="tel" inputMode="numeric" aria-label="WhatsApp da empresa" defaultValue={vm.whatsapp} placeholder="(38) 99999-8888"
              onBlur={e => setErroDoContato(vm.definirContato('whatsapp', e.target.value))} onKeyDown={enter} />
          </label>
        </div>
      </div>
      {/* os sócios, com o nome e o CPF (Vitor, 06/10/2026): o relatório da etapa Bancos mostra a transferência para eles */}
      <div className="cad-regra">
        <div className="cad-regra-txt">
          <span className="cad-campo-rotulo">Sócios<Dica texto="O nome e o CPF de cada sócio. A etapa Bancos mostra a transferência para eles (pelo nome ou pelo CPF do PIX)." /></span>
        </div>
        <div className="cad-regra-opcoes">
          <button type="button" className="btn" disabled={novo} onClick={() => setNovo(true)}><Icone nome="plus" />Adicionar sócio</button>
        </div>
      </div>
      {linhas.length > 0 && (
        <div className="table-wrap">
          <table className="table-compact">
            <thead><tr><th>Nome</th><th>CPF</th><th /></tr></thead>
            <tbody>
              {linhas.map((so, i) => (
                <tr key={i + '|' + so.nome + '|' + so.cpf}>
                  <td>
                    <input type="text" aria-label="Nome do sócio" defaultValue={so.nome} placeholder="Nome completo" autoFocus={i >= vm.socios.length}
                      onBlur={e => { if (e.target.value.trim() !== so.nome) mudar(i, 'nome', e.target.value); }} onKeyDown={enter} />
                  </td>
                  <td>
                    <input type="text" aria-label="CPF do sócio" inputMode="numeric" defaultValue={so.cpf} placeholder="000.000.000-00"
                      onBlur={e => { if (e.target.value.replace(/\D/g, '') !== so.cpf) mudar(i, 'cpf', e.target.value); }} onKeyDown={enter} />
                  </td>
                  <td className="num">
                    <button type="button" className="icon-btn icon-btn-sm" title="Tirar o sócio" aria-label="Tirar o sócio" onClick={() => tirar(i)}>
                      <Icone nome="x" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
