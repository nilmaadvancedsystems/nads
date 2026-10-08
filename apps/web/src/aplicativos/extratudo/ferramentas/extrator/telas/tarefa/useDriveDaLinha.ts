// ViewModel do Drive na linha do banco (etapa dos extratos): "Buscar no Drive" procura o extrato da
// competência na pasta da empresa (pasta do ano, pelo mapa do robô do Entregas), baixa a cópia, lê e
// importa — o PDF não é guardado, só os lançamentos e de qual arquivo do Drive vieram. Sem login do
// Entregas, pede primeiro (o mesmo usuário das Pendências). Não achou um só: a pessoa escolhe entre os
// candidatos. "Visualizar" pede ao robô um link temporário (~30 min) e só abre; o link não é guardado.
import { creditor, extrator as x } from '@nads/core';
import { useEffect, useRef, useState } from 'react';
import { useDrive } from '../../dados/repo';
import type { useImportacao } from '../importacao/useImportacao';
import { tempo, type AndamentoDeExtratos } from './AndamentoDosExtratos';

type Vm = ReturnType<typeof useImportacao>;
type Linha = Vm['bancos'][number];

const mensagemDeErro = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function useDriveDaLinha(vm: Vm, codigo: number | null) {
  const { drive, acesso } = useDrive();
  const [login, setLogin] = useState({ aberto: false, usuario: '', senha: '', entrando: false, erro: '' });
  const [pendente, setPendente] = useState<Linha | null>(null);
  const [escolha, setEscolha] = useState<{ linha: Linha; texto: string; candidatos: creditor.ArquivoAchado[] } | null>(null);
  const [buscando, setBuscando] = useState<string | null>(null);
  // "Cancelar" a busca de vários meses: para antes do próximo mês
  const cancelado = useRef(false);
  const [cancelando, setCancelando] = useState(false);
  // a janela do andamento do "Todos pelo Drive" (08/10/2026: "janela de andamento"): mês por mês do banco
  const [lote, setLote] = useState<{ banco: string; meses: string[]; feitos: { mes: string; ok: boolean }[]; atual: string; inicio: number; pronto: boolean } | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (!lote || lote.pronto) return;
    const r = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(r);
  }, [lote]);
  // o que fazer depois de entrar, quando o login foi pedido por outra coisa (o Pedir extratos)
  const depois = useRef<(() => void) | null>(null);

  // o saldo anterior dos extratos que abrem a conta e vieram do Drive antes de a leitura guardar o saldo: com o login,
  // pede o arquivo de novo ao robô e lê só o saldo (uma vez por arquivo; se não der, fica como está)
  const tentados = useRef(new Set<string>());
  const semSaldo = vm.extratosSemSaldo.map(a => a.id).join(',');
  const { gravarSaldoAnterior } = vm;
  useEffect(() => {
    if (!acesso.entrou) return;
    for (const a of vm.extratosSemSaldo) {
      if (!a.drive || tentados.current.has(a.id)) continue;
      tentados.current.add(a.id);
      const doDrive = a.drive;
      drive.baixar(doDrive.id, doDrive.nome)
        .then(conteudo => x.lerArquivo(doDrive.nome, new Uint8Array(conteudo), 'banco'))
        .then(lido => { if (typeof lido.saldoAnterior === 'number') gravarSaldoAnterior(a.id, lido.saldoAnterior); })
        .catch(() => { /* sem o robô agora: fica sem o saldo (reimportar resolve) */ });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acesso.entrou, semSaldo]);

  async function usar(linha: Linha, a: creditor.ArquivoAchado) {
    setEscolha(null);
    vm.marcarLendo(linha.id);
    try {
      const conteudo = await drive.baixar(a.id, a.nome);
      await vm.importarDoDrive(linha.id, { id: a.id, nome: a.nome }, conteudo);
    } catch (e) {
      vm.marcarLendo(null);
      vm.avisarErro('O extrato não veio do Drive', mensagemDeErro(e));
    }
  }

  async function buscar(linha: Linha) {
    if (!acesso.entrou) {
      // aberto dentro do Entregas: o login é o de lá (sem pedir senha aqui)
      if (drive.loginDeFora) { vm.avisarErro('Entre no Entregas', 'O Drive usa o mesmo login do Entregas.'); return; }
      setPendente(linha); setLogin(l => ({ ...l, aberto: true, erro: '' })); return;
    }
    setBuscando(linha.id);
    try {
      const pasta = await drive.pastaDoCliente(codigo);
      const r = x.acharExtratoNoDrive(pasta?.itens || [], pasta?.raiz || null, vm.competencia, { nome: linha.nome, marca: linha.marca, conta: linha.numeroConta });
      if (r.situacao === 'achou' && r.arquivo) await usar(linha, r.arquivo);
      else setEscolha({ linha, texto: x.mensagemDaBuscaDoExtrato(r, vm.competencia.slice(5) + '/' + vm.competencia.slice(0, 4)), candidatos: r.candidatos });
    } catch (e) {
      vm.avisarErro('Não consegui olhar o Drive', mensagemDeErro(e));
    } finally {
      setBuscando(null);
    }
  }

  /** No período: procura no Drive o extrato de cada mês que falta daquele banco e importa os que achar. */
  async function buscarNoPeriodo(linha: Linha, meses: string[]) {
    if (!meses.length) return;
    if (!acesso.entrou) {
      if (drive.loginDeFora) { vm.avisarErro('Entre no Entregas', 'O Drive usa o mesmo login do Entregas.'); return; }
      depois.current = () => { void buscarNoPeriodo(linha, meses); };
      setLogin(l => ({ ...l, aberto: true, erro: '' }));
      return;
    }
    setBuscando(linha.id);
    cancelado.current = false;
    setCancelando(false);
    const achados: string[] = [];
    const faltam: string[] = [];
    const rotuloDe = (m: string) => m.slice(5) + '/' + m.slice(0, 4);
    setLote({ banco: linha.nome, meses: meses.map(rotuloDe), feitos: [], atual: rotuloDe(meses[0]), inicio: Date.now(), pronto: false });
    const passou = (mes: string, ok: boolean, proximo?: string) => setLote(l => (l ? { ...l, feitos: [...l.feitos, { mes, ok }], atual: proximo || '' } : l));
    try {
      const pasta = await drive.pastaDoCliente(codigo);
      for (const [i, mes] of meses.entries()) {
        const seguinte = meses[i + 1] ? rotuloDe(meses[i + 1]) : '';
        // "Cancelar": para antes do próximo mês (o que já veio fica)
        if (cancelado.current) {
          vm.avisarErro(linha.nome + ': cancelado', achados.length ? 'Ficaram os que já vieram: ' + achados.join(', ') + '.' : 'Nenhum mês foi trazido.');
          return;
        }
        const r = x.acharExtratoNoDrive(pasta?.itens || [], pasta?.raiz || null, mes, { nome: linha.nome, marca: linha.marca, conta: linha.numeroConta });
        const rotulo = mes.slice(5) + '/' + mes.slice(0, 4);
        if (r.situacao !== 'achou' || !r.arquivo) { faltam.push(rotulo); passou(rotulo, false, seguinte); continue; }
        const conteudo = await drive.baixar(r.arquivo.id, r.arquivo.nome);
        await vm.importarDoDrive(linha.id, { id: r.arquivo.id, nome: r.arquivo.nome }, conteudo);
        achados.push(rotulo);
        passou(rotulo, true, seguinte);
      }
      if (faltam.length) vm.avisarErro(linha.nome + ': ' + (achados.length ? 'trouxe ' + achados.join(', ') : 'nada no Drive'), 'Não achei no Drive: ' + faltam.join(', ') + '.');
      else vm.avisar(linha.nome + ': extratos de ' + achados.join(', ') + ' trazidos do Drive');
    } catch (e) {
      vm.avisarErro('Não consegui olhar o Drive', mensagemDeErro(e));
    } finally {
      setBuscando(null);
      setCancelando(false);
      setLote(l => (l ? { ...l, pronto: true, atual: '' } : l));
    }
  }

  async function entrar() {
    setLogin(l => ({ ...l, entrando: true, erro: '' }));
    try {
      await drive.entrarComGoogle();
      setLogin({ aberto: false, usuario: '', senha: '', entrando: false, erro: '' });
      const linha = pendente;
      setPendente(null);
      if (linha) void buscar(linha);
      const f = depois.current;
      depois.current = null;
      f?.();
    } catch (e) {
      setLogin(l => ({ ...l, entrando: false, erro: mensagemDeErro(e) }));
    }
  }

  const andamento: AndamentoDeExtratos | null = lote ? (() => {
    const feitos = lote.feitos.length;
    const total = lote.meses.length;
    const foi = Math.round((agora - lote.inicio) / 1000);
    const falta = feitos && !lote.pronto ? Math.round((foi / feitos) * (total - feitos)) : null;
    return {
      titulo: lote.pronto ? lote.banco + ': Drive conferido' : 'Trazendo do Drive · ' + lote.banco,
      subtitulo: lote.pronto ? 'Concluído' : tempo(foi) + (falta ? ' · falta uns ' + tempo(Math.max(1, falta)) : ''),
      pct: lote.pronto ? 100 : Math.min(99, Math.round(((feitos + 0.5) / Math.max(1, total)) * 100)),
      pronto: lote.pronto,
      detalhe: lote.pronto ? 'Os meses que estavam no Drive entraram' : 'Procurando o extrato de ' + lote.atual + ' no Drive',
      numeros: [
        { rotulo: 'Meses', valor: total, tom: 'info', icone: 'calendar' },
        { rotulo: 'Trazidos', valor: lote.feitos.filter(f => f.ok).length, tom: 'ok', icone: 'check' },
        { rotulo: 'Não achei', valor: lote.feitos.filter(f => !f.ok).length, tom: 'aviso', icone: 'alert' },
      ],
      passos: lote.meses.map(m => {
        const f = lote.feitos.find(x => x.mes === m);
        return { texto: m + (f ? (f.ok ? ' · trazido' : ' · não está no Drive') : ''), feito: !!f, atual: !f && m === lote.atual && !lote.pronto, falhou: !!f && !f.ok };
      }),
    };
  })() : null;

  return {
    exemplos: drive.exemplos,
    /** a janela do andamento do "Todos pelo Drive" */
    andamento,
    fecharAndamento: () => setLote(null),
    entrou: acesso.entrou,
    buscando,
    /** pediu para cancelar a busca de vários meses (espera o mês que está baixando) */
    cancelando,
    cancelar: () => { cancelado.current = true; setCancelando(true); },
    buscar: (linha: Linha) => { void buscar(linha); },
    buscarNoPeriodo: (linha: Linha, meses: string[]) => { void buscarNoPeriodo(linha, meses); },
    login: { ...login, set: (m: Partial<typeof login>) => setLogin(l => ({ ...l, ...m })), entrar: () => { void entrar(); }, fechar: () => { setPendente(null); depois.current = null; setLogin(l => ({ ...l, aberto: false })); } },
    /** pede o login do Entregas e, ao entrar, faz `f` */
    pedirLogin: (f: () => void) => { depois.current = f; setLogin(l => ({ ...l, aberto: true, erro: '' })); },
    escolha,
    usar: (a: creditor.ArquivoAchado) => { if (escolha) void usar(escolha.linha, a); },
    fecharEscolha: () => setEscolha(null),
    /** o link temporário para ver o arquivo do Drive (não guardar) */
    link: (arquivo: { id: string; nome: string }) => drive.link(arquivo.id, arquivo.nome),
  };
}
