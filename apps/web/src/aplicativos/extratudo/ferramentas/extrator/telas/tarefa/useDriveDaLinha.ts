// ViewModel do Drive na linha do banco (etapa dos extratos): "Buscar no Drive" procura o extrato da
// competência na pasta da empresa (pasta do ano, pelo mapa do robô do Entregas), baixa a cópia, lê e
// importa — o PDF não é guardado, só os lançamentos e de qual arquivo do Drive vieram. Sem login do
// Entregas, pede primeiro (o mesmo usuário das Pendências). Não achou um só: a pessoa escolhe entre os
// candidatos. "Visualizar" pede ao robô um link temporário (~30 min) e só abre; o link não é guardado.
import { creditor, extrator as x } from '@nads/core';
import { useEffect, useRef, useState } from 'react';
import { useDrive } from '../../dados/repo';
import { useGuardado } from '../../../../../../comum/guardado';
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
  // o mês que o "Todos pelo Drive" está buscando agora: a célula dele na grade gira (Vitor, 09/10/2026: no lugar da janela)
  const [mesAtual, setMesAtual] = useState<string | null>(null);
  const [lote, setLote] = useState<{ banco: string; meses: string[]; feitos: { mes: string; ok: boolean }[]; atual: string; inicio: number; pronto: boolean } | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  // os extratos que foram para o Drive e ainda não viraram arquivo de lá ('banco|mes' → o envio), guardados (Vitor,
  // 19/10/2026: "deixe um ícone do Drive do lado esquerdo desse check, carregando; quando upar, ele fica igual aos outros")
  const [subindo, setSubindo] = useGuardado<Record<string, { envio: string; em: number }>>('drive-subindo|' + (codigo ?? ''), {});
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

  // os extratos que vieram do Drive e foram lidos por um leitor mais velho: com o login, baixa cada um de novo e relê com o
  // leitor de agora, um de cada vez (Vitor, 14/10/2026: "corrija essas pendências em todas as empresas de todos os meses";
  // o importado do computador não tem como: o arquivo não fica guardado)
  const relidos = useRef(new Set<string>());
  // um laço de cada vez: cada releitura muda a lista, e o laço que já está rodando segue até o fim
  const relendo = useRef(false);
  const paraReler = vm.extratosParaReler.map(a => a.id).join(',');
  const { relerExtrato, avisar } = vm;
  useEffect(() => {
    if (!acesso.entrou || drive.exemplos || relendo.current) return;
    const fila = vm.extratosParaReler.filter(a => a.drive && !relidos.current.has(a.id));
    if (!fila.length) return;
    relendo.current = true;
    void (async () => {
      let n = 0;
      for (const a of fila) {
        if (!a.drive) continue;
        relidos.current.add(a.id);
        try {
          const conteudo = await drive.baixar(a.drive.id, a.drive.nome);
          const lido = await x.lerArquivo(a.drive.nome, new Uint8Array(conteudo), 'banco');
          relerExtrato(a.id, lido);
          n++;
        } catch { /* sem o robô agora: fica como estava (na próxima vez que abrir, tenta de novo) */ }
      }
      relendo.current = false;
      if (n) avisar(n === 1 ? '1 extrato do Drive relido com o leitor novo' : n + ' extratos do Drive relidos com o leitor novo');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acesso.entrou, paraReler]);

  /**
   * Traz do Drive o primeiro dos arquivos do mês que tiver o extrato: o achado e, se ele vier vazio, os outros do mês (o
   * "(1)" com o mesmo nome pode ser outra coisa). 'vazio': nenhum tinha lançamento; false: não entrou (cancelou a pergunta).
   */
  async function trazer(linha: Linha, arquivos: creditor.ArquivoAchado[], mes?: string): Promise<boolean | 'vazio'> {
    for (const [i, a] of arquivos.entries()) {
      const conteudo = await drive.baixar(a.id, a.nome);
      const ok = await vm.importarDoDrive(linha.id, { id: a.id, nome: a.nome }, conteudo, mes, i < arquivos.length - 1);
      if (ok !== 'vazio') return ok;
    }
    return 'vazio';
  }
  /** o achado primeiro, depois os outros do mesmo mês */
  const doMes = (r: { arquivo: creditor.ArquivoAchado | null; candidatos: creditor.ArquivoAchado[] }) =>
    r.arquivo ? [r.arquivo, ...r.candidatos.filter(c => c.id !== r.arquivo?.id && c.daCompetencia)] : [];

  async function usar(linha: Linha, a: creditor.ArquivoAchado, outros: creditor.ArquivoAchado[] = []) {
    setEscolha(null);
    vm.marcarLendo(linha.id);
    try {
      await trazer(linha, [a, ...outros]);
    } catch (e) {
      vm.marcarLendo(null);
      vm.avisarErro('O extrato não veio do Drive', mensagemDeErro(e));
    }
  }

  /**
   * A pasta da empresa no mapa do Drive; se algum dos meses não aparece nela, pede ao robô para reler a pasta na hora e
   * olha de novo (Vitor, 14/10/2026: no dia 13 o mapa da 58 estava velho e o BNB de 01 a 05, que estava no Drive desde
   * abril, não veio; o robô só refez o mapa de madrugada).
   */
  async function pastaComOsMeses(linha: Linha, meses: readonly string[]) {
    const pasta = await drive.pastaDoCliente(codigo);
    const conta = { nome: linha.nome, marca: linha.marca, conta: linha.numeroConta };
    const falta = meses.some(m => x.acharExtratoNoDrive(pasta?.itens || [], pasta?.raiz || null, m, conta).situacao !== 'achou');
    if (!falta || !pasta || !drive.atualizarMapaDoCliente) return pasta;
    try { await drive.atualizarMapaDoCliente(pasta.raiz); } catch { return pasta; }
    return (await drive.pastaDoCliente(codigo)) || pasta;
  }

  async function buscar(linha: Linha) {
    if (!acesso.entrou) {
      // aberto dentro do Entregas: o login é o de lá (sem pedir senha aqui)
      if (drive.loginDeFora) { vm.avisarErro('Entre no Entregas', 'O Drive usa o mesmo login do Entregas.'); return; }
      setPendente(linha); setLogin(l => ({ ...l, aberto: true, erro: '' })); return;
    }
    setBuscando(linha.id);
    try {
      const pasta = await pastaComOsMeses(linha, [vm.competencia]);
      const r = x.acharExtratoNoDrive(pasta?.itens || [], pasta?.raiz || null, vm.competencia, { nome: linha.nome, marca: linha.marca, conta: linha.numeroConta });
      if (r.situacao === 'achou' && r.arquivo) await usar(linha, r.arquivo, doMes(r).slice(1));
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
    const vazios: string[] = [];
    const rotuloDe = (m: string) => m.slice(5) + '/' + m.slice(0, 4);
    setLote({ banco: linha.nome, meses: meses.map(rotuloDe), feitos: [], atual: rotuloDe(meses[0]), inicio: Date.now(), pronto: false });
    const passou = (mes: string, ok: boolean, proximo?: string) => setLote(l => (l ? { ...l, feitos: [...l.feitos, { mes, ok }], atual: proximo || '' } : l));
    try {
      const pasta = await pastaComOsMeses(linha, meses);
      for (const [i, mes] of meses.entries()) {
        const seguinte = meses[i + 1] ? rotuloDe(meses[i + 1]) : '';
        // "Cancelar": para antes do próximo mês (o que já veio fica)
        if (cancelado.current) {
          vm.avisarErro(linha.nome + ': cancelado', achados.length ? 'Ficaram os que já vieram: ' + achados.join(', ') + '.' : 'Nenhum mês foi trazido.');
          return;
        }
        setMesAtual(mes);
        const r = x.acharExtratoNoDrive(pasta?.itens || [], pasta?.raiz || null, mes, { nome: linha.nome, marca: linha.marca, conta: linha.numeroConta });
        const rotulo = mes.slice(5) + '/' + mes.slice(0, 4);
        if (r.situacao !== 'achou' || !r.arquivo) { faltam.push(rotulo); passou(rotulo, false, seguinte); continue; }
        // só conta como trazido o que entrou (Vitor, 19/10/2026: "fala que traz, mas não traz nada")
        const ok = await trazer(linha, doMes(r), mes);
        if (ok === 'vazio') vazios.push(rotulo);
        else if (ok) achados.push(rotulo);
        else faltam.push(rotulo);
        passou(rotulo, ok === true, seguinte);
      }
      if (faltam.length || vazios.length) {
        vm.avisarErro(linha.nome + ': ' + (achados.length ? 'trouxe ' + achados.join(', ') : 'nada veio do Drive'),
          [faltam.length ? 'Não achei no Drive: ' + faltam.join(', ') + '.' : '', vazios.length ? 'O arquivo do Drive não tem lançamentos (não é o extrato?): ' + vazios.join(', ') + '.' : ''].filter(Boolean).join(' '));
      } else vm.avisar(linha.nome + ': extratos de ' + achados.join(', ') + ' trazidos do Drive');
    } catch (e) {
      vm.avisarErro('Não consegui olhar o Drive', mensagemDeErro(e));
    } finally {
      setBuscando(null);
      setCancelando(false);
      setMesAtual(null);
      // sem a janela do andamento (Vitor, 09/10/2026: "não gostei dessa popup"): o resumo fica no aviso
      setLote(null);
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

  /**
   * O extrato importado do computador vai para o Drive quando o mês não está lá (Vitor, 09/10/2026: "upe no drive o que ele
   * upou do pc"; o PDF de vários meses vai quebrado, um por mês). Vai para o Claudio Secretario e o arquivamento põe em
   * EXTRATOS/AAAA/MM/BANCÁRIOS/<BANCO>. Só com o login do Entregas; mês que já tem extrato (ou candidato) no Drive não vai.
   */
  async function subirAoDrive(linha: Linha, fs: File[], cliente: string) {
    if (!drive.enviarAoDrive || !fs.length) return;
    // sem o Drive conectado, pede o login e manda depois (Vitor, 19/10/2026: na 289, o 06 e o 07 do Sicoob entraram e nunca
    // foram para o Drive, sem aviso; o olhinho não tinha o PDF para abrir)
    if (!acesso.entrou) {
      if (drive.loginDeFora || drive.exemplos) return;
      depois.current = () => { void subirAoDrive(linha, fs, cliente); };
      setLogin(l => ({ ...l, aberto: true, erro: '' }));
      return;
    }
    const mandados: string[] = [];
    try {
      const pasta = await drive.pastaDoCliente(codigo);
      const conta = { nome: linha.nome, marca: linha.marca, conta: linha.numeroConta };
      for (const f of fs) {
        const bytes = new Uint8Array(await f.arrayBuffer());
        const lido = await x.lerArquivo(f.name, bytes.slice(), 'banco');
        // o extrato sem movimento vai inteiro, no mês dele (Vitor, 13/10/2026)
        const ext = (/\.[a-z0-9]+$/i.exec(f.name)?.[0] || '.pdf').toLowerCase();
        const pedacos = lido.semMovimento?.length === 1 ? [{ mes: lido.semMovimento[0], nome: x.nomeDoExtratoDoMes(linha.nome, lido.semMovimento[0], ext), bytes }]
          : lido.erro ? [] : await x.extratoPorMes(f.name, bytes, lido, linha.nome);
        for (const p of pedacos) {
          const r = x.acharExtratoNoDrive(pasta?.itens || [], pasta?.raiz || null, p.mes, conta);
          // já tem o extrato DESTE mês no Drive: não manda de novo. (Vitor, 19/10/2026: "não está sendo armazenado" — o mês
          // sem arquivo devolve como candidatos os extratos dos OUTROS meses, e o envio era pulado em toda empresa que já
          // tinha algum extrato no Drive)
          if (r.situacao === 'achou' || r.situacao === 'varios' || r.candidatos.some(c => c.daCompetencia)) continue;
          const envio = await drive.enviarAoDrive({ nome: p.nome, bytes: p.bytes }, { competencia: p.mes, codigo, cliente });
          if (envio) setSubindo(x => ({ ...x, [linha.id + '|' + p.mes]: { envio, em: Date.now() } }));
          mandados.push(p.mes.slice(5) + '/' + p.mes.slice(0, 4));
        }
      }
      if (mandados.length) vm.avisar('Mandado para o Drive: ' + mandados.join(', ') + ' (vai direto para a pasta do banco, em até 2 minutos)');
    } catch (e) {
      vm.avisarErro('Não mandei para o Drive' + (mandados.length ? ' (foram ' + mandados.join(', ') + ')' : ''), mensagemDeErro(e));
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
      // pronto, sem a linha do que está fazendo e sem o "· trazido" (Vitor, 09/10/2026): o check verde já diz
      detalhe: lote.pronto ? '' : 'Procurando o extrato de ' + lote.atual + ' no Drive',
      numeros: [
        { rotulo: 'Meses', valor: total, tom: 'info', icone: 'calendar' },
        { rotulo: 'Trazidos', valor: lote.feitos.filter(f => f.ok).length, tom: 'ok', icone: 'check' },
        { rotulo: 'Não achei', valor: lote.feitos.filter(f => !f.ok).length, tom: 'aviso', icone: 'alert' },
      ],
      passos: lote.meses.map(m => {
        const f = lote.feitos.find(x => x.mes === m);
        return { texto: m + (f && !f.ok ? ' · não está no Drive' : ''), feito: !!f, atual: !f && m === lote.atual && !lote.pronto, falhou: !!f && !f.ok };
      }),
    };
  })() : null;

  // acompanha os envios: o robô gravou (pronto), relê o mapa da pasta da empresa e liga o extrato do mês ao arquivo de lá;
  // erro, ou mais de 15 minutos sem aparecer no mapa, desiste (fica o check, como antes)
  const chavesSubindo = Object.keys(subindo).join(',');
  const { ligarMesAoDrive } = vm;
  useEffect(() => {
    if (!chavesSubindo || !drive.situacaoDosEnvios || !acesso.entrou) return;
    let vivo = true;
    async function conferir() {
      const lista = Object.entries(subindo);
      const sit = await drive.situacaoDosEnvios!(lista.map(([, v]) => v.envio));
      const prontos = lista.filter(([, v]) => sit[v.envio]?.status === 'pronto');
      const sair: string[] = lista.filter(([, v]) => sit[v.envio]?.status === 'erro' || Date.now() - v.em > 15 * 60e3).map(([k]) => k);
      // o fim de cada envio vira aviso (Vitor, 19/10/2026: "bota algo pra eu saber se está arquivado no Drive")
      const rotuloDe = (k: string) => { const [banco, mes] = k.split('|'); return (vm.bancos.find(b => b.id === banco)?.nome || banco) + ' ' + mes.slice(5) + '/' + mes.slice(0, 4); };
      const falharam = [...sair];
      const arquivados: string[] = [];
      if (prontos.length) {
        const antes = await drive.pastaDoCliente(codigo);
        if (antes?.raiz && drive.atualizarMapaDoCliente) await drive.atualizarMapaDoCliente(antes.raiz);
        const pasta = await drive.pastaDoCliente(codigo);
        for (const [k] of prontos) {
          const [banco, mes] = k.split('|');
          const linha = vm.bancos.find(b => b.id === banco);
          const conta = { nome: linha?.nome || banco, marca: linha?.marca, conta: linha?.numeroConta };
          const r = x.acharExtratoNoDrive(pasta?.itens || [], pasta?.raiz || null, mes, conta);
          if (r.situacao === 'achou' && r.arquivo) { ligarMesAoDrive(banco, mes, { id: r.arquivo.id, nome: r.arquivo.nome }); sair.push(k); arquivados.push(rotuloDe(k) + (sit[subindo[k].envio]?.pasta ? ' (' + sit[subindo[k].envio].pasta + ')' : '')); }
        }
      }
      if (vivo && sair.length) setSubindo(x => { const n = { ...x }; for (const k of sair) delete n[k]; return n; });
      if (vivo && arquivados.length) vm.avisar('Arquivado no Drive: ' + arquivados.join(', '));
      if (vivo && falharam.length) vm.avisarErro('Não foi para o Drive', falharam.map(rotuloDe).join(', ') + ': o robô não gravou (erro ou mais de 15 minutos). Importe o PDF de novo no mês.');
    }
    void conferir().catch(() => { /* sem o robô agora: tenta de novo */ });
    const t = setInterval(() => { void conferir().catch(() => undefined); }, 10000);
    return () => { vivo = false; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chavesSubindo, acesso.entrou]);

  /** o extrato do mês no mapa do Drive, sem pedir ao robô para reler (o olhinho do mês que veio do computador) */
  async function arquivoNoDrive(linha: Linha, mes: string): Promise<{ id: string; nome: string } | null> {
    if (!acesso.entrou) return null;
    const pasta = await drive.pastaDoCliente(codigo);
    const r = x.acharExtratoNoDrive(pasta?.itens || [], pasta?.raiz || null, mes, { nome: linha.nome, marca: linha.marca, conta: linha.numeroConta });
    return r.situacao === 'achou' && r.arquivo ? { id: r.arquivo.id, nome: r.arquivo.nome } : null;
  }

  return {
    arquivoNoDrive,
    /** o extrato do mês está subindo para o Drive (o ícone do Drive girando ao lado do check) */
    subindoAoDrive: (banco: string, mes: string) => !!subindo[banco + '|' + mes],
    exemplos: drive.exemplos,
    /** a janela do andamento do "Todos pelo Drive" (não aparece mais: o andamento fica na grade e o resumo no aviso) */
    andamento,
    /** o mês que está sendo buscado no Drive agora ('aaaa-mm'), na linha `buscando` */
    mesAtual,
    fecharAndamento: () => setLote(null),
    entrou: acesso.entrou,
    buscando,
    /** pediu para cancelar a busca de vários meses (espera o mês que está baixando) */
    cancelando,
    cancelar: () => { cancelado.current = true; setCancelando(true); },
    buscar: (linha: Linha) => { void buscar(linha); },
    subirAoDrive: (linha: Linha, fs: File[], cliente: string) => { void subirAoDrive(linha, fs, cliente); },
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
