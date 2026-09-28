// ViewModel do Verificar por conta (página escondida, aberta pelo "Revisar" do Relatório).
// O relatório da conta nunca é salvo: fica só em sessão.verificar e some ao sair da página.
// Origem: conferencia.html vc/vcReset/vcMulti/vcCodigos/vcRotuloContas (~L3701-3712),
// vcRenderMulti (~L3717), vcCarregarContas (~L3858), vcFaltando (~L3890), leitura do relatório
// na hora da escolha (~L3918-3943), vcMontarCfopSelect (~L3944-3977), Conferir (~L3980-4108),
// vcRenderResultado (~L4122-4205), Reimportar (~L4210-4216), Ok (~L4217), Conferido (~L4218-4224),
// Baixar resultado (~L4225-4246), Limpar (~L4247-4257), Voltar (~L1883).
import { conferencia as c, formatos } from '@nads/core';
import { useRetorno, type BotaoModal } from '@nads/ui';
import { useEffect, useRef, useState } from 'react';
import { useSessao, VERIFICAR_VAZIO, type EstadoVerificar } from '../sessao';

export const VC_LIMITE_LINHAS = 300;

/** O que aparece embaixo do campo do relatório enquanto lê / quando dá erro. */
export interface InfoRelatorio { tom: 'lendo' | 'erro'; titulo?: string; texto?: string }

/** Tudo que o original recalculava no vcEnter a partir do vc + empresa. */
function derivar(e: c.Empresa, v: EstadoVerificar) {
  const contasPlano = c.contasVerificaveis(e);
  const grupo = v.contas.map(cod => contasPlano.find(a => a.codigo === cod)).filter((a): a is c.Conta => !!a);
  const conta = grupo[0] || null;
  const multi = grupo.length > 1;
  const codigos = multi ? grupo.map(a => a.codigo) : conta ? [conta.codigo] : [];
  const servTipo = conta ? c.servicoDaContaVerificar(e, conta.codigo) : null;
  const opcoes = c.opcoesCfop(e, conta);
  const cfopGrupo = servTipo || !opcoes.chaves.length ? v.cfopGrupo
    : opcoes.vinculada || (v.cfopGrupo && opcoes.chaves.indexOf(v.cfopGrupo) > -1 ? v.cfopGrupo : null);
  const rotulo = c.rotuloContas(multi ? grupo : conta ? [conta] : []);
  return { contasPlano, grupo, conta, multi, codigos, servTipo, opcoes, cfopGrupo, rotulo };
}

export function useVerificarConta() {
  const s = useSessao();
  const { toast, modal } = useRetorno();
  const e = s.empresa;
  const v = s.verificar;
  const d = derivar(e, v);

  const [info, setInfo] = useState<Record<string, InfoRelatorio>>({});
  const [comparando, setComparando] = useState(false);
  const [abrirArquivo, setAbrirArquivo] = useState<{ codigo: string; n: number } | null>(null);
  const [seqResultado, setSeqResultado] = useState(0);
  const reimportando = useRef(false);
  // o estado mais novo, para depois do await da leitura do arquivo
  const vRef = useRef(v);
  useEffect(() => { vRef.current = v; });

  // ---------- relatório da conta: lido assim que o arquivo é escolhido ----------
  async function escolherRelatorio(codigo: string, f: File | null) {
    if (!f) return;
    const multi = d.multi;
    setInfo(i => ({ ...i, [codigo]: { tom: 'lendo' } }));
    if (!multi) { const nv = { ...vRef.current, razaoNome: { ...vRef.current.razaoNome, [codigo]: f.name } }; vRef.current = nv; s.setVerificar(nv); }
    const erro = (titulo: string, texto: string) => setInfo(i => ({ ...i, [codigo]: { tom: 'erro', titulo, texto } }));
    try {
      const linhas = c.lerRazao(c.lerPlanilha(await f.arrayBuffer()));
      if (!linhas.length) {
        if (reimportando.current) { reimportando.current = false; toast('Não achei lançamentos nesse arquivo.'); }
        erro('Não achei lançamentos nesse arquivo', 'Confira se o relatório tem uma coluna de histórico ou de valor.');
        return;
      }
      const atual = vRef.current;
      const nv: EstadoVerificar = { ...atual, razaoPorConta: { ...atual.razaoPorConta, [codigo]: linhas }, razaoNome: { ...atual.razaoNome, [codigo]: f.name } };
      vRef.current = nv;
      s.setVerificar(nv);
      setInfo(i => { const n = { ...i }; delete n[codigo]; return n; });
      if (reimportando.current) { reimportando.current = false; conferir(nv); }
    } catch (err) {
      if (reimportando.current) { reimportando.current = false; toast('Não deu para ler o arquivo.'); }
      erro('Não deu para ler o arquivo', err instanceof Error ? err.message : '');
    }
  }

  function escolherCfop(valor: string) {
    s.setVerificar(x => ({ ...x, cfopGrupo: valor || null }));
  }

  // ---------- comparar ----------
  function conferir(vv: EstadoVerificar = v) {
    if (comparando) return;
    const dd = derivar(e, vv);
    const falta = c.faltaParaConferir({
      temPlano: dd.contasPlano.length > 0, conta: dd.conta, multi: dd.multi,
      algumRelatorio: dd.grupo.some(a => vv.razaoPorConta[a.codigo]),
      relatorioUnico: !!dd.conta && (vv.razaoPorConta[dd.conta.codigo] || []).length > 0,
      servTipo: dd.servTipo, qtdNotasServ: dd.servTipo ? c.notasServicoDaConta(e, dd.servTipo, dd.codigos).length : 0,
      cfopGrupo: dd.cfopGrupo,
    });
    if (falta.length) {
      void modal({
        icone: 'alert', titulo: 'Falta preencher antes de conferir',
        html: '<ul style="margin:0;padding-left:18px;">' + falta.map(f => '<li>' + escapar(f) + '</li>').join('') + '</ul>',
        botoes: [{ rotulo: 'Entendi', valor: true, variante: 'btn-primary' }],
      });
      return;
    }
    setComparando(true);
    // adia um instante só pra desenhar o "Comparando…" antes de travar com a conta
    setTimeout(() => {
      try {
        let r: c.ResultadoVerificacao;
        try {
          r = c.conferirConta({ empresa: e, contas: dd.multi ? dd.grupo : [dd.conta as c.Conta], razaoPorConta: vv.razaoPorConta, cfopGrupo: dd.cfopGrupo, servTipo: dd.servTipo });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          toast(msg === 'Escolha o CFOP antes de conferir.' ? msg : 'Não deu para comparar: ' + msg);
          return;
        }
        const limpo = c.semPendencias(r);
        const rotConta = (dd.multi ? 'Contas ' : 'Conta ') + dd.rotulo;
        const agora = new Date();
        s.aplicar(x => dd.codigos.reduce((y, cod) => {
          if (limpo) return c.gravarVerificacao(y, s.filtro, cod, 'ok', rotConta + ' · relatório sem pendências', agora);
          if (c.verifEstado(y, s.filtro, cod) === 'ok') return c.gravarVerificacao(y, s.filtro, cod, null, rotConta + ' · voltou a ter pendências', agora);
          return y;
        }, x));
        const nv: EstadoVerificar = { ...vv, cfopGrupo: dd.cfopGrupo, resultado: r, abaRes: 'todas' };
        vRef.current = nv;
        s.setVerificar(nv);
        setSeqResultado(x => x + 1);
        // conferiu sem pendência (na primeira vez ou reconferindo): aviso limpo; em 3,5s volta
        // sozinho pro Relatório com a conta Ok. O "Ok" é sempre o sistema que grava (linha 114
        // acima) — não existe botão que o usuário use pra dar Ok na mão.
        if (limpo) {
          void modal({
            tom: 'ok', icone: 'checkCircle', titulo: 'Tudo certo!',
            html: '<b>' + escapar(dd.rotulo) + '</b><br>sem pendências · Ok no Relatório',
            botoes: [{ rotulo: 'Ok', valor: true, variante: 'btn-primary' }],
            fecharEm: { ms: 3500, valor: true },
          }).then(() => s.irPara('movimento/relatorio'));
        }
      } finally {
        setComparando(false);
      }
    }, 30);
  }

  // ---------- resultado ----------
  function escolherAba(aba: string) {
    s.setVerificar(x => ({ ...x, abaRes: aba }));
  }

  /** "Corrigi, quero reconferir": escolhe o relatório de novo e já confere. */
  async function reimportar() {
    const abrir = (codigo: string) => { reimportando.current = true; setAbrirArquivo({ codigo, n: Date.now() }); };
    if (!d.multi) { if (d.conta) abrir(d.conta.codigo); return; }
    if (v.abaRes && v.abaRes !== 'todas') { abrir(v.abaRes); return; }
    const botoes: BotaoModal<string | null>[] = [{ rotulo: 'Voltar', valor: null, variante: 'btn-outline' }];
    for (const a of d.grupo) botoes.push({ rotulo: 'Conta ' + a.codigo, valor: a.codigo, variante: 'btn-primary' });
    const cod = await modal<string | null>({ icone: 'upload', titulo: 'Qual relatório você corrigiu?', botoes });
    if (cod) abrir(cod);
  }

  function alternarConferido() {
    if (!d.conta) return;
    const rot = (d.multi ? 'Contas ' : 'Conta ') + d.rotulo;
    const on = c.verifEstado(e, s.filtro, d.conta.codigo) === 'conferido';
    const agora = new Date();
    s.aplicar(x => d.codigos.reduce((y, cod) => c.gravarVerificacao(y, s.filtro, cod, on ? null : 'conferido', rot + (on ? ' · conferido desfeito' : ' · conferida com pendências'), agora), x));
    toast(on ? 'Desfeito — a conta volta a mostrar a diferença.' : 'Conta marcada como conferida.');
  }

  function csv(): { texto: string; nome: string } | null {
    if (!v.resultado) return null;
    return { texto: formatos.montarCsv(c.csvVerificacao(v.resultado)), nome: c.nomeCsvVerificacao(s.nome) };
  }

  async function limpar() {
    const ok = await modal<boolean>({
      icone: 'alert', titulo: 'Limpar a conferência?', texto: 'O relatório lido e o resultado dessa conferência serão descartados. A conta continua a mesma.',
      botoes: [{ rotulo: 'Voltar', valor: false, variante: 'btn-outline' }, { rotulo: 'Limpar', valor: true, variante: 'btn-primary' }],
    });
    if (!ok) return;
    const nv = { ...VERIFICAR_VAZIO, contas: vRef.current.contas };
    vRef.current = nv;
    s.setVerificar(nv);
    setInfo({});
  }

  const voltar = () => s.irPara('movimento/relatorio');

  // ---------- o formulário ----------
  const cfop = d.servTipo ? null
    : !d.opcoes.chaves.length ? { desabilitado: true, valor: '', opcoes: [{ valor: '', rotulo: '— importe as notas de entradas/saídas primeiro —' }] }
    : d.opcoes.vinculada ? { desabilitado: true, valor: d.opcoes.vinculada, opcoes: [{ valor: d.opcoes.vinculada, rotulo: d.opcoes.rotulos[d.opcoes.vinculada] }] }
    : { desabilitado: false, valor: d.cfopGrupo || '', opcoes: [{ valor: '', rotulo: '— escolha o CFOP —' }].concat(d.opcoes.chaves.map(k => ({ valor: k, rotulo: d.opcoes.rotulos[k] }))) };

  const relatorio = (codigo: string, nome: string) => ({
    codigo, nome,
    linhas: v.razaoPorConta[codigo] ? v.razaoPorConta[codigo].length : 0,
    arquivo: v.razaoNome[codigo] || '',
    info: info[codigo] || null,
  });
  // uma conta: um campo só (sem conta escolhida, o campo fica sem dono, como no original)
  const relatorios = d.multi ? d.grupo.map(a => relatorio(a.codigo, a.nome)) : [d.conta ? relatorio(d.conta.codigo, d.conta.nome) : relatorio('', '')];

  return {
    semPlano: !d.contasPlano.length,
    contaTexto: d.rotulo,
    conta: d.conta,
    multi: d.multi,
    servico: d.servTipo ? c.resumoServicoVerificar(e, d.servTipo, d.codigos) : null,
    cfop, escolherCfop,
    relatorios, escolherRelatorio, abrirArquivo,
    comparando, conferir: () => conferir(), limpar, voltar,
    resultado: montarResultado(e, s.filtro, v, d),
    seqResultado,
    escolherAba, reimportar, alternarConferido, csv,
  };
}

/** O que o card do resultado desenha (vcRenderResultado). */
function montarResultado(e: c.Empresa, p: c.FiltroMovimento, v: EstadoVerificar, d: ReturnType<typeof derivar>) {
  const r = v.resultado;
  if (!r) return null;
  const soma = (ls: { valor: number }[]) => ls.reduce((t, l) => t + l.valor, 0);
  const multi = !!(r.contas && r.contas.length > 1);
  const contas = r.contas || [];
  const aba = multi && contas.some(x => x.codigo === v.abaRes) ? v.abaRes : 'todas';
  const limpo = c.semPendencias(r);
  const abas = multi ? [{ valor: 'todas', rotulo: 'Todas' }].concat(contas.map(x => ({ valor: x.codigo, rotulo: x.codigo }))) : null;
  const base = { aba, abas, limpo, fonte: r.fonte };

  if (aba !== 'todas') {
    // uma conta: o relatório dela e o que sobrou nela; faltando fica em Todas
    const conta = contas.find(x => x.codigo === aba) as { codigo: string; nome: string };
    const rc = c.resultadoDaConta(r, aba);
    return {
      ...base,
      porConta: { conta, somaConta: rc.somaConta, pendencias: rc.pendencias, pendZero: c.diferencaZerada(rc.pendencias), dups: rc.dups, somaDups: soma(rc.dups), mais: rc.mais, somaMais: soma(rc.mais) },
      todas: null,
    };
  }
  const t = c.totaisVerificacao(r);
  const zero = c.diferencaZerada(t.diferenca);
  return {
    ...base,
    porConta: null,
    todas: {
      conta: r.conta, multi, somaRazao: r.somaRazao, somaFiscal: r.somaFiscal, diferenca: t.diferenca, zero,
      composicao: zero ? null : c.composicaoDiferenca(r),
      faltando: c.linhasFaltando(r), somaFaltando: t.faltando,
      duplicadas: c.linhasDuplicadas(r), qtdDuplicadas: r.duplicada.length, somaDuplicadas: t.duplicadas,
      aMais: r.aMais.map(c.linhaDaTabela), somaAMais: t.aMais,
      icms: r.icms.map(c.linhaDaTabela), somaIcms: t.icms,
      conferido: !!d.conta && c.verifEstado(e, p, d.conta.codigo) === 'conferido',
      podeConferir: c.podeConferir(e, d.codigos, [r.fonte || '']),
    },
  };
}

function escapar(t: string): string {
  return t.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string));
}
