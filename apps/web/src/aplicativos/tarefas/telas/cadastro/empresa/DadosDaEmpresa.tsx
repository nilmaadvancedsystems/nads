// Cadastro › Empresa: as regras da empresa. "Presta serviços?", "Cartão empresarial" e "Vende no cartão" com Sim / Não
// (clicar de novo no marcado volta para "não informado") e os sócios (o nome e o CPF de cada um).
import { Icone, useCarregando } from '@nads/ui';
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
  const opcao = (sim: boolean, rotulo: string) => (
    <button type="button" className={'btn ' + (vm.prestaServico === sim ? 'btn-primary' : 'btn-outline')} aria-pressed={vm.prestaServico === sim}
      onClick={() => vm.definirPrestaServico(sim)}>{rotulo}</button>
  );
  const opcaoDoCartao = (campo: 'cartaoEmpresarial' | 'vendeNoCartao', sim: boolean, rotulo: string) => (
    <button type="button" className={'btn ' + (vm[campo] === sim ? 'btn-primary' : 'btn-outline')} aria-pressed={vm[campo] === sim}
      onClick={() => vm.definirCartao(campo, sim)}>{rotulo}</button>
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
      <div className="cad-regra">
        <div className="cad-regra-txt">
          <span className="cad-campo-rotulo">Presta serviços</span>
          <span className="hint">
            Mostra a aba Prestados na Importação e os serviços prestados na Conferência.
            {vm.prestaServico == null && ' Ainda não informado.'}
          </span>
        </div>
        <div className="cad-regra-opcoes" role="group" aria-label="Presta serviços">
          {opcao(true, 'Sim')}
          {opcao(false, 'Não')}
        </div>
      </div>
      {/* os cartões (Vitor, 07/10/2026): ligam a etapa Cartões na Tarefas */}
      <div className="cad-regra">
        <div className="cad-regra-txt">
          <span className="cad-campo-rotulo">Cartão empresarial</span>
          <span className="hint">
            Compras no cartão de crédito da empresa: a etapa Cartões quebra a fatura no razão do cartão.
            {vm.cartaoEmpresarial == null && ' Ainda não informado.'}
          </span>
        </div>
        <div className="cad-regra-opcoes" role="group" aria-label="Cartão empresarial">
          {opcaoDoCartao('cartaoEmpresarial', true, 'Sim')}
          {opcaoDoCartao('cartaoEmpresarial', false, 'Não')}
        </div>
      </div>
      <div className="cad-regra">
        <div className="cad-regra-txt">
          <span className="cad-campo-rotulo">Vende no cartão</span>
          <span className="hint">
            Vendas pelas maquininhas (Cielo, Rede, Getnet, Stone, PagBank): a etapa Cartões concilia com as notas.
            {vm.vendeNoCartao == null && ' Ainda não informado.'}
          </span>
        </div>
        <div className="cad-regra-opcoes" role="group" aria-label="Vende no cartão">
          {opcaoDoCartao('vendeNoCartao', true, 'Sim')}
          {opcaoDoCartao('vendeNoCartao', false, 'Não')}
        </div>
      </div>
      {/* a nota de honorário (Vitor, 07/10/2026): sem nota, a etapa Honorários pede o Extrato por cobrança */}
      <div className="cad-regra">
        <div className="cad-regra-txt">
          <span className="cad-campo-rotulo">Emite nota de honorário</span>
          <span className="hint">
            O escritório emite nota de honorário para a empresa. Sem nota, a etapa Honorários lança as cobranças pelo Extrato por cobrança.
            {vm.emiteNotaHonorario == null && ' Ainda não informado.'}
          </span>
        </div>
        <div className="cad-regra-opcoes" role="group" aria-label="Emite nota de honorário">
          {[true, false].map(sim => (
            <button key={String(sim)} type="button" className={'btn ' + (vm.emiteNotaHonorario === sim ? 'btn-primary' : 'btn-outline')} aria-pressed={vm.emiteNotaHonorario === sim}
              onClick={() => vm.definirNotaDeHonorario(sim)}>{sim ? 'Sim' : 'Não'}</button>
          ))}
        </div>
      </div>
      {/* o contato da empresa (Vitor, 07/10/2026): o Mandei manda as perguntas de Clientes e Fornecedores para os dois */}
      <div className="cad-regra">
        <div className="cad-regra-txt">
          <span className="cad-campo-rotulo">E-mail e WhatsApp</span>
          <span className="hint">
            Para onde o Mandei manda as perguntas de Clientes e Fornecedores (o link chega pelos dois). O WhatsApp com o DDD.
            {erroDoContato && <> <b>{erroDoContato}</b></>}
          </span>
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
          <span className="cad-campo-rotulo">Sócios</span>
          <span className="hint">O nome e o CPF de cada sócio. A etapa Bancos mostra a transferência para eles (pelo nome ou pelo CPF do PIX).</span>
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
