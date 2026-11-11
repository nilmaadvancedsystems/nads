// Fiscal › SIEG (31/10/2026: "coloca uma função de baixar do sieg q tinha na rotina"; "faz uma visualização mais completa, e
// também puxe entrada saída etc, tudo que de para puxar do sieg"): a empresa e o mês na barra; embaixo, o painel do SIEG da
// rotina (as notas do mês com Contar agora e Baixar XMLs), os números do mês (saídas, entradas, serviços, CT-e e os
// impostos) e as abas Saídas | Entradas | Serviços prestados | Serviços tomados | CT-e | Sequência, cada uma com o resumo
// por CFOP/CST/NBS e a tabela das notas com busca (clicar abre o espelho). Só as peças do catálogo (busca curta, Botão com
// borda, SeletorMes, Segmentado, Stat, Cartão, Tabela padrão, Vazio, Esqueleto).
import { BotaoIcone, Esqueleto, Icone, Segmentado, SeletorMes, Stat, useCarregando, Vazio } from '@nads/ui';
import type { KeyboardEvent } from 'react';
import { documentoFormatado } from '../../financeiro/formatosDaNota';
import { SiegDaEtapa } from '../../executor/partes/SiegDaEtapa';
import { EmpresaDaBarra } from '../partes/EmpresaDaBarra';
import { EspelhoDaNota } from '../partes/EspelhoDaNota';
import { useBaixarDoSieg, type AbaDaTela, type VmBaixarDoSieg } from './useBaixarDoSieg';

const brl = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const reais = (n: number) => 'R$ ' + brl(n);
const quantas = (n: number, um: string, varios: string) => n + ' ' + (n === 1 ? um : varios);
/** o número ou o traço (zero não diz nada na coluna dos impostos) */
const ouTraco = (n: number) => (n ? brl(n) : <span className="fraco">—</span>);
const peloTeclado = (fazer: () => void) => (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fazer(); } };

const ROTULO_DA_ABA = { saidas: 'Saídas', entradas: 'Entradas', prestados: 'Serviços prestados', tomados: 'Serviços tomados', ctes: 'CT-e' } as const;
const ABAS_DE_NOTAS = ['saidas', 'entradas', 'prestados', 'tomados', 'ctes'] as const;

export function BaixarDoSieg() {
  const vm = useBaixarDoSieg();
  useCarregando(vm.carregando);
  const codigo = vm.empresa ? String(vm.empresa.codigo) : '';
  const opcoes: { valor: AbaDaTela; rotulo: string }[] = [
    ...ABAS_DE_NOTAS.map(a => ({ valor: a, rotulo: ROTULO_DA_ABA[a] + (vm.painel ? ' (' + vm.painel.abas[a].quantidade + ')' : '') })),
    { valor: 'sequencia', rotulo: 'Sequência das saídas' },
  ];
  return (
    <section className="fc">
      {vm.vendo && <EspelhoDaNota nota={vm.vendo} codigo={vm.empresa?.codigo} competencia={vm.competencia} fechar={vm.fecharNota} />}
      <div className="tarefas-barra-topo fc-topo">
        <EmpresaDaBarra vm={vm} id="sieg-empresas" />
        <SeletorMes valor={vm.competencia} onMudar={vm.setCompetencia} rotulo="Competência" />
      </div>
      {!vm.empresa
        ? <div className="card fc-cartao"><Vazio icone="download" titulo="Escolha a empresa" texto="Depois o mês: tudo que o SIEG traz, as notas e o Baixar XMLs." /></div>
        : (
          <>
            <SiegDaEtapa key={'c' + codigo + vm.competencia} tipo="contagem" codigo={codigo} competencia={vm.competencia} />
            {vm.carregando ? <Esqueleto linhas={6} numeros={4} /> : (
              <>
                {vm.painel && <Numeros vm={vm} />}
                <Segmentado valor={vm.aba} onMudar={vm.mudarAba} opcoes={opcoes} />
                {vm.aba === 'sequencia'
                  ? <SiegDaEtapa key={'s' + codigo + vm.competencia} tipo="saidas" codigo={codigo} competencia={vm.competencia} />
                  : !vm.painel
                    ? <div className="card fc-cartao"><Vazio icone="download" titulo={'Os XMLs de ' + vm.rotuloCompetencia + ' ainda não foram baixados'} texto="Clique em Baixar do SIEG, no alto (XML, PDF ou os dois)." /></div>
                    : vm.resumo && <DaAba vm={vm} />}
              </>
            )}
          </>
        )}
    </section>
  );
}

/** os números do mês: as notas de cada lado e os impostos que elas trazem */
function Numeros({ vm }: { vm: VmBaixarDoSieg }) {
  const a = vm.painel!.abas;
  const canceladas = (n: number) => (n ? ' · ' + quantas(n, 'cancelada', 'canceladas') : '');
  return (
    <>
      <div className="stat-grid fin-numeros sieg-numeros">
        <Stat grande={false} rotulo="Saídas" valor={reais(a.saidas.valor)} sub={quantas(a.saidas.quantidade, 'nota', 'notas') + canceladas(a.saidas.canceladas)} />
        <Stat grande={false} rotulo="Entradas" valor={reais(a.entradas.valor)} sub={quantas(a.entradas.quantidade, 'nota', 'notas') + canceladas(a.entradas.canceladas)} />
        <Stat grande={false} rotulo="Serviços prestados" valor={reais(a.prestados.valor)} sub={quantas(a.prestados.quantidade, 'nota', 'notas') + canceladas(a.prestados.canceladas)} />
        <Stat grande={false} rotulo="Serviços tomados" valor={reais(a.tomados.valor)} sub={quantas(a.tomados.quantidade, 'nota', 'notas') + canceladas(a.tomados.canceladas)} />
        <Stat grande={false} rotulo="CT-e" valor={reais(a.ctes.valor)} sub={quantas(a.ctes.quantidade, 'conhecimento', 'conhecimentos') + canceladas(a.ctes.canceladas)} />
      </div>
      <div className="stat-grid fin-numeros sieg-numeros">
        <Stat grande={false} rotulo="ICMS das saídas" valor={reais(a.saidas.icms)} sub={'Nas entradas ' + reais(a.entradas.icms)} />
        <Stat grande={false} rotulo="ICMS-ST das entradas" valor={reais(a.entradas.st)} sub={'Nas saídas ' + reais(a.saidas.st)} />
        <Stat grande={false} rotulo="IPI das entradas" valor={reais(a.entradas.ipi)} sub={'Nas saídas ' + reais(a.saidas.ipi)} />
        <Stat grande={false} rotulo="ICMS dos CT-e" valor={reais(a.ctes.icms)} />
        <Stat grande={false} rotulo="Retenções nos serviços" valor={reais(a.prestados.retido + a.tomados.retido)} sub={'Prestados ' + reais(a.prestados.retido) + ' · tomados ' + reais(a.tomados.retido)} />
      </div>
    </>
  );
}

/** uma aba: o resumo por CFOP/CST/NBS (e as retenções dos serviços) e a tabela das notas */
function DaAba({ vm }: { vm: VmBaixarDoSieg }) {
  const r = vm.resumo!;
  const mercadoria = !vm.servico && vm.aba !== 'ctes';
  const rotuloDoCodigo = vm.resumoPor === 'nbs' ? 'NBS' : vm.resumoPor === 'cst' ? 'CST' : 'CFOP';
  if (!r.linhas.length) {
    return <div className="card fc-cartao"><Vazio icone="recibo" titulo={'Nenhuma nota em ' + vm.rotuloCompetencia} texto="Nesta aba o SIEG não trouxe nada no mês." /></div>;
  }
  return (
    <>
      <section className="card fc-cartao">
        <header className="fc-cartao-topo">
          <h3 className="fc-cartao-titulo">Resumo por {rotuloDoCodigo}</h3>
          <span className="fc-contagem">{quantas(vm.grupos.length, 'linha', 'linhas')}</span>
          {mercadoria && (
            <span className="fc-acoes">
              <Segmentado valor={vm.resumoPor === 'cst' ? 'cst' : 'cfop'} onMudar={vm.setResumoPor} opcoes={[{ valor: 'cfop', rotulo: 'Por CFOP' }, { valor: 'cst', rotulo: 'Por CST' }]} />
            </span>
          )}
        </header>
        <div className="table-wrap fc-tabela">
          <table className="table-compact">
            <thead>
              <tr>
                <th>{rotuloDoCodigo}</th><th className="num">Notas</th><th className="num">Valor</th>
                {!vm.servico && <th className="num">ICMS</th>}{mercadoria && <th className="num">ICMS-ST</th>}{mercadoria && <th className="num">IPI</th>}
              </tr>
            </thead>
            <tbody>
              {vm.grupos.map(g => (
                <tr key={g.codigo}>
                  <td><b className="num">{g.codigo}</b></td><td className="num">{g.notas}</td><td className="num"><b>{brl(g.valor)}</b></td>
                  {!vm.servico && <td className="num">{ouTraco(g.icms)}</td>}{mercadoria && <td className="num">{ouTraco(g.st)}</td>}{mercadoria && <td className="num">{ouTraco(g.ipi)}</td>}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td><td className="num">{r.quantidade}</td><td className="num">{brl(r.valor)}</td>
                {!vm.servico && <td className="num">{brl(r.icms)}</td>}{mercadoria && <td className="num">{brl(r.st)}</td>}{mercadoria && <td className="num">{brl(r.ipi)}</td>}
              </tr>
            </tfoot>
          </table>
        </div>
        {mercadoria && r.semItens > 0 && <p className="fc-pe">{quantas(r.semItens, 'nota veio', 'notas vieram')} sem os itens no resumo do SIEG: fora do CFOP e do CST.</p>}
      </section>
      {vm.servico && r.retencoes.length > 0 && (
        <div className="stat-grid fin-numeros sieg-numeros">
          {r.retencoes.map(x => <Stat key={x.imposto} grande={false} rotulo={'Retido · ' + x.imposto} valor={reais(x.valor)} />)}
        </div>
      )}
      <Notas vm={vm} />
    </>
  );
}

/** a tabela das notas da aba, com a busca; clicar abre o espelho (a NFS-e não tem) */
function Notas({ vm }: { vm: VmBaixarDoSieg }) {
  const r = vm.resumo!;
  const mercadoria = !vm.servico && vm.aba !== 'ctes';
  const parte = vm.aba === 'saidas' || vm.aba === 'prestados' ? 'Cliente' : vm.aba === 'ctes' ? 'Transportadora' : 'Fornecedor';
  const abre = (tipo: string) => tipo !== 'NFS-e';
  const colunas = 6 + (mercadoria ? 3 : 0);
  return (
    <section className="card fc-cartao">
      <header className="fc-cartao-topo">
        <h3 className="fc-cartao-titulo">Notas</h3>
        <span className="fc-contagem">{quantas(r.quantidade, 'nota', 'notas')}{r.canceladas > 0 && ' · ' + quantas(r.canceladas, 'cancelada', 'canceladas')}</span>
        <span className="fc-acoes">
          <label className="busca-curta fc-busca">
            <Icone nome="search" width={16} height={16} />
            <input type="text" placeholder="Número, nome ou valor" aria-label="Buscar a nota" value={vm.buscaDaNota} onChange={e => vm.setBuscaDaNota(e.target.value)} />
          </label>
        </span>
      </header>
      <div className="table-wrap fc-tabela">
        <table className="table-compact fc-clicavel">
          <thead>
            <tr>
              <th>Número</th><th>Data</th><th>{parte}</th>
              {mercadoria && <th>CFOP</th>}
              <th className="num">Valor</th>
              {vm.servico ? <th className="num">Retenções</th> : <th className="num">ICMS</th>}
              {mercadoria && <th className="num">ICMS-ST</th>}{mercadoria && <th className="num">IPI</th>}
              <th aria-label="Ver a nota" />
            </tr>
          </thead>
          <tbody>
            {vm.notas.map(n => {
              const abrir = () => { if (abre(n.tipo)) vm.verNota(n.id); };
              const retido = n.retencoes.reduce((s, x) => s + x.valor, 0);
              return (
                <tr key={n.id} className={n.cancelada ? 'fraco' : undefined} tabIndex={abre(n.tipo) ? 0 : undefined} onClick={abrir} onKeyDown={peloTeclado(abrir)}
                  title={abre(n.tipo) ? 'Ver a nota' : undefined} style={abre(n.tipo) ? undefined : { cursor: 'default' }}>
                  <td><b>{n.numero}{n.serie ? '/' + n.serie : ''}</b>{n.tipo === 'NFC-e' && <span className="fraco"> · NFC-e</span>}{n.cancelada && <> <span className="badge badge-bad">Cancelada</span></>}</td>
                  <td>{n.data}</td>
                  <td className="wrap">{n.nome || '—'}{n.doc && <span className="fraco num"> · {documentoFormatado(n.doc)}</span>}{vm.servico && n.descricao && <span className="fraco"> · {n.descricao}</span>}</td>
                  {mercadoria && <td className="num">{n.cfops.join(', ') || <span className="fraco">—</span>}</td>}
                  <td className="num"><b>{brl(n.valor)}</b></td>
                  {vm.servico
                    ? <td className="num" title={n.retencoes.map(x => x.imposto + ' ' + brl(x.valor)).join(' · ')}>{retido ? brl(retido) : <span className="fraco">—</span>}{n.retencoes.length > 0 && <span className="fraco"> · {n.retencoes.map(x => x.imposto).join(', ')}</span>}</td>
                    : <td className="num">{ouTraco(n.icms)}</td>}
                  {mercadoria && <td className="num">{ouTraco(n.st)}</td>}{mercadoria && <td className="num">{ouTraco(n.ipi)}</td>}
                  <td className="fc-acao">{abre(n.tipo) && <BotaoIcone icone="olho" pequeno titulo="Ver a nota" onClick={ev => { ev.stopPropagation(); vm.verNota(n.id); }} onKeyDown={ev => ev.stopPropagation()} />}</td>
                </tr>
              );
            })}
            {!vm.notas.length && <tr><td colSpan={colunas} className="hint">Nenhuma nota com essa busca.</td></tr>}
          </tbody>
        </table>
      </div>
      {vm.notasFora > 0 && <p className="fc-pe">Mais {vm.notasFora} {vm.notasFora === 1 ? 'nota' : 'notas'}: use a busca.</p>}
    </section>
  );
}
