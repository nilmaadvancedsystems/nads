// ViewModel da etapa Cheque especial da Tarefa (Vitor, 13/10/2026: "não vai ficar em uma aplicação externa, mas acoplada
// no Tarefas; rebuilda ele para cada banco"). Por banco: os dias que fecham negativos no extrato já importado e os que o
// razão ainda não tem; a conta do banco e a do cheque especial (gravadas no Cadastro na primeira vez, por conta
// bancária) e o .xls com o ajuste e o estorno de cada dia, sempre com o histórico 92029. Sem o relatório de saldo diário
// e sem o "D = saldo positivo": o saldo vem do extrato, que o sistema já lê.
import { chequeEspecial as ce, empresas, extrator as x, tarefas } from '@nads/core';
import { baixarBytes, useCarregando, useRetorno } from '@nads/ui';
import { useState } from 'react';
import { useCadastro } from '../../../../dados/repo';
import { useAplicarNoExtrator, useExtratorDaEmpresa } from '../../../../dados/extrator';
import { useDrive } from '../../../../../extratudo/ferramentas/extrator/dados/repo';
import { useOperador } from '../../../../casca/operador';
import { useEtapaAberta, useRequisitosDaEtapa } from '../contexto';

export function useChequeEspecial() {
  const { nome, codigo, meses } = useEtapaAberta();
  const vivo = useCadastro(nome, codigo);
  const cadastro = vivo.carregada ? vivo.cadastro : null;
  const empresa = useExtratorDaEmpresa(nome);
  const op = useOperador().operador;
  const { aviso } = useRetorno();
  const { drive, acesso } = useDrive();
  const aplicar = useAplicarNoExtrator(nome);
  const [atualizando, setAtualizando] = useState(false);
  useCarregando(atualizando);
  // os extratos do Drive importados antes do saldo impresso do dia: o "Atualizar pelo Drive" relê só o saldo deles
  const semSaldo = x.extratosSemSaldoDoDia(empresa, meses);

  async function atualizarPeloDrive() {
    if (atualizando || !semSaldo.length) return;
    try {
      if (!acesso.entrou) {
        if (drive.loginDeFora) { aviso({ tom: 'erro', titulo: 'Entre no Entregas', texto: 'O Drive usa o mesmo login do Entregas.' }); return; }
        await drive.entrarComGoogle();
      }
      setAtualizando(true);
      let lidos = 0;
      for (const a of semSaldo) {
        if (!a.drive) continue;
        const bytes = new Uint8Array(await drive.baixar(a.drive.id, a.drive.nome));
        const ano = Number((a.lancamentos[0]?.data || '').slice(0, 4)) || new Date().getFullYear();
        const lido = await x.lerArquivo(a.drive.nome, bytes, 'banco', ano);
        if (lido.saldosDoDia?.length) { aplicar(e => x.definirSaldosDoDia(e, a.id, lido.saldosDoDia || [], new Date())); lidos++; }
      }
      aviso(lidos
        ? { tom: 'ok', titulo: 'Saldos atualizados pelo Drive', texto: lidos + (lidos === 1 ? ' extrato' : ' extratos') + ': os dias negativos agora são os do banco.' }
        : { tom: 'erro', titulo: 'Nada para atualizar', texto: 'Os extratos do Drive não trazem o saldo do dia.' });
    } catch (e) {
      aviso({ tom: 'erro', titulo: 'Não consegui ler o Drive', texto: e instanceof Error ? e.message : String(e) });
    } finally {
      setAtualizando(false);
    }
  }
  const { bancos, primeiro } = x.bancosDaEmpresaNa(empresa, cadastro, codigo, meses[meses.length - 1] || '');
  // só gerar: a Tarefa pode seguir (lançar no Alterdata e importar o razão de novo é com a pessoa; a objeção "ainda não
  // foi lançado" interrompe)
  useRequisitosDaEtapa({ pronto: true, faltam: [] });

  const linhas = bancos.map(b => {
    const ch = x.chequeEspecialDoBanco(empresa, b.id, primeiro, meses);
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

  function baixar(id: string) {
    const l = linhas.find(b => b.id === id);
    if (!l) return;
    if (!l.contaBanco || !l.contaCheque) { aviso({ tom: 'erro', titulo: l.nome, texto: 'Informe a conta do banco e a do cheque especial.' }); return; }
    const lanc = x.lancamentosDoChequeEspecial(empresa, id, primeiro, meses, l.faltam, l.contaBanco, l.contaCheque);
    if (!lanc.length) { aviso({ tom: 'erro', titulo: l.nome, texto: 'Nenhum dia negativo sem o cheque especial no razão.' }); return; }
    const arquivo = 'cheque_especial_' + (codigo ?? nome) + '_' + l.nome.replace(/[^\w]+/g, '') + '.xls';
    baixarBytes(ce.planilhaDeLancamentos(lanc, 'xls'), arquivo, ce.tipoMimeLancamentos('xls'));
    aviso({ tom: 'ok', titulo: l.nome + ': ' + lanc.length + ' lançamentos', texto: arquivo + ' · lance no Alterdata e importe o razão do banco de novo' });
  }

  return {
    periodo: meses.length > 1 ? tarefas.rotuloNumericoCompetencia(meses[0]) + ' a ' + tarefas.rotuloNumericoCompetencia(meses[meses.length - 1]) : meses[0] ? tarefas.rotuloNumericoCompetencia(meses[0]) : '',
    carregado: !!cadastro,
    bancos: linhas.map(({ faltam: _f, ...r }) => r),
    historico: ce.HISTORICO_PADRAO,
    gravarConta, baixar,
    /** quantos extratos do Drive ainda estão sem o saldo impresso do dia (o botão só aparece com algum) */
    semSaldo: semSaldo.length, atualizando, atualizarPeloDrive: () => { void atualizarPeloDrive(); },
  };
}
