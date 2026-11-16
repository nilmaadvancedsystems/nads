// ViewModel da etapa Cheque especial da Tarefa (Vitor, 13/10/2026: "não vai ficar em uma aplicação externa, mas acoplada
// no Tarefas; rebuilda ele para cada banco"). Por banco: os dias que fecham negativos no extrato já importado e os que o
// razão ainda não tem; a conta do banco e a do cheque especial (gravadas no Cadastro na primeira vez, por conta
// bancária) e o .xls com o ajuste e o estorno de cada dia, sempre com o histórico 92029. Sem o relatório de saldo diário
// e sem o "D = saldo positivo": o saldo vem do extrato, que o sistema já lê.
import { chequeEspecial as ce, empresas, extrator as x, tarefas } from '@nads/core';
import { baixarBytes, useRetorno } from '@nads/ui';
import { useCadastro } from '../../../../dados/repo';
import { useExtratorDaEmpresa } from '../../../../dados/extrator';
import { useOperador } from '../../../../casca/operador';
import { useEtapaAberta, useRequisitosDaEtapa } from '../contexto';
import { useBancosDeTeste } from '../bancos/useBancosDeTeste';
import { useModelosDeHistorico } from '../../../../dados/useModelosDeHistorico';
import { nomeDoLote } from '../../../../../../comum/importarNoAlterdata';

export function useChequeEspecial() {
  const { nome, codigo, meses } = useEtapaAberta();
  // o código do histórico (Contábil › Configurações; 92029 é o padrão)
  const modelos = useModelosDeHistorico();
  const historico = modelos['cheque.codigo'];
  // o ⚡ do modo desenvolvedor: os extratos e razões de teste da Importação (16/10/2026)
  useBancosDeTeste();
  const vivo = useCadastro(nome, codigo);
  const cadastro = vivo.carregada ? vivo.cadastro : null;
  const empresa = useExtratorDaEmpresa(nome);
  const op = useOperador().operador;
  const { aviso } = useRetorno();
  const { bancos, primeiro } = x.bancosDaEmpresaNa(empresa, cadastro, codigo, meses[meses.length - 1] || '');
  // só gerar: a Tarefa pode seguir (lançar no Alterdata e importar o razão de novo é com a pessoa; a objeção "ainda não
  // foi lançado" interrompe)
  useRequisitosDaEtapa({ pronto: true, faltam: [] });

  // só os bancos que precisam (16/11/2026: "don't compute the cheque especial in banks with the balance right"): o que nunca fecha
  // negativo e o que já tem o cheque no razão ficam de fora
  const linhas = bancos.map(b => ({ b, ch: x.chequeEspecialDoBanco(empresa, b.id, primeiro, meses) })).filter(({ ch }) => ch.calcula).map(({ b, ch }) => {
    const cad = cadastro?.bancos?.find(c => c.id === b.id);
    return {
      id: b.id, nome: b.nome, marca: b.marca || b.id,
      conta: [b.agencia && 'Ag. ' + b.agencia, b.conta && 'C/C ' + b.conta].filter(Boolean).join(' · '),
      contaBanco: cad?.contaContabil || '', contaCheque: cad?.contaChequeEspecial || '',
      // a conta só fica gravada quando o banco está no Cadastro
      noCadastro: !!cad,
      negativos: ch.negativos.length,
      dias: ch.faltam.map(d => ({ data: x.dataBR(d.data), saldo: x.reaisBR(d.saldo) })),
      total: x.reaisBR(ch.faltam.reduce((t, d) => t + Math.abs(d.saldo), 0)),
      faltam: ch.faltam,
      /** as pendências entre o extrato e o razão do período: o cheque sai mesmo assim, mas a pessoa confere a Importação */
      pendencias: ch.pendencias,
    };
  });

  /** grava a conta do banco ou a do cheque especial no Cadastro (ao sair do campo) */
  function gravarConta(id: string, campo: 'contaContabil' | 'contaChequeEspecial', valor: string) {
    if (!cadastro) return;
    const partida = empresas.cadastro.pontoDePartida(codigo, empresa.bancos || []);
    const r = empresas.cadastro.definirContasDoBanco(cadastro, id, { [campo]: valor.replace(/\D/g, '') }, partida, op?.nome || 'Tarefa', new Date());
    if (r.erro) { aviso({ tom: 'erro', titulo: 'Cheque especial', texto: r.erro }); return; }
    if (r.cadastro !== cadastro) vivo.salvar(r.cadastro);
  }

  const lancamentosDe = (l: (typeof linhas)[number]) => x.lancamentosDoChequeEspecial(empresa, l.id, primeiro, meses, l.faltam, l.contaBanco, l.contaCheque, historico);

  function baixar(id: string) {
    const l = linhas.find(b => b.id === id);
    if (!l) return;
    if (!l.contaBanco || !l.contaCheque) { aviso({ tom: 'erro', titulo: l.nome, texto: 'Informe a conta do banco e a do cheque especial.' }); return; }
    const lanc = lancamentosDe(l);
    if (!lanc.length) { aviso({ tom: 'erro', titulo: l.nome, texto: 'Nenhum dia negativo sem o cheque especial no razão.' }); return; }
    const arquivo = 'cheque_especial_' + (codigo ?? nome) + '_' + l.nome.replace(/[^\w]+/g, '') + '.xls';
    baixarBytes(ce.planilhaDeLancamentos(lanc, 'xls'), arquivo, ce.tipoMimeLancamentos('xls'));
    aviso({ tom: 'ok', titulo: l.nome + ': ' + lanc.length + ' lançamentos', texto: arquivo + ' · lance no Alterdata e importe o razão do banco de novo' });
  }

  /** o link desta etapa nesta empresa e período (16/11/2026): abre direto no Cheque especial */
  const link = typeof window === 'undefined' ? '' : window.location.origin + window.location.pathname + '?etapa=cheque-especial';
  async function copiarLink() {
    try { await navigator.clipboard.writeText(link); aviso({ tom: 'ok', titulo: 'Link copiado', texto: link }); }
    catch { aviso({ tom: 'erro', titulo: 'Não copiei o link', texto: link }); }
  }

  return {
    link, copiarLink,
    periodo: meses.length > 1 ? tarefas.rotuloNumericoCompetencia(meses[0]) + ' a ' + tarefas.rotuloNumericoCompetencia(meses[meses.length - 1]) : meses[0] ? tarefas.rotuloNumericoCompetencia(meses[0]) : '',
    carregado: !!cadastro,
    bancos: linhas.map(({ faltam: _f, ...r }, i) => ({
      ...r,
      /** o que o "Importar no Alterdata" manda (09/11/2026): a mesma planilha do Baixar */
      importacao: {
        codigo: codigo ?? null, empresa: nome, origem: 'cheque-especial', lote: nomeDoLote('Cheque especial ' + r.nome, r.dias.map(d => d.data)),
        planilha: () => {
          const lanc = r.contaBanco && r.contaCheque ? lancamentosDe(linhas[i]) : [];
          return lanc.length ? { bytes: ce.planilhaDeLancamentos(lanc, 'xls'), linhas: lanc.length } : null;
        },
      },
    })),
    historico,
    gravarConta, baixar,
  };
}
