// O ViewModel da ferramenta nads → SCI (23/11/2026, docs/sci): o intermediário sem banco entre o nads e o SCI. Entram as
// planilhas de importação que as telas do nads já baixam (Lançatudo, Creditor, Cartões, Honorários...) e, se tiver, a
// planilha de de/para das contas; sai a planilha que o gerador do SCI importa. Tudo no navegador: nada vai para o banco,
// e dá para abrir no próprio PC do SCI e importar na hora.
import { empresas, sci } from '@nads/core';
import { baixarBytes, useRetorno } from '@nads/ui';
import { useMemo, useState } from 'react';

/** Uma planilha do nads escolhida, já lida. */
export interface PlanilhaDoNads { id: number; nome: string; linhas: sci.LinhaDoNads[] }

const ACEITAR = /\.(xls|xlsx|ods|csv)$/i;
let proximoId = 1;

export function useNadsParaSci() {
  const { aviso } = useRetorno();
  const [planilhas, setPlanilhas] = useState<PlanilhaDoNads[]>([]);
  const [dePara, setDePara] = useState<{ nome: string; mapa: Map<string, sci.ContaNoSci> } | null>(null);
  const [cnpj, setCnpj] = useState('');
  const [lote, setLote] = useState('');
  const [historicoPadrao, setHistoricoPadrao] = useState('');
  const [ocupado, setOcupado] = useState(false);
  // o de/para automático (docs/sci item 2): o plano padrão do SCI da empresa e o plano dela no Alterdata
  const [idDoPlano, setIdDoPlano] = useState<sci.IdDoPlanoSci | ''>('');
  const [planoDaEmpresa, setPlanoDaEmpresa] = useState<{ nome: string; contas: empresas.cadastro.ContaDoPlano[] } | null>(null);
  // o balancete do SCI de volta (docs/sci item 1): só lido aqui, para apontar onde olhar no SCI
  const [balancete, setBalancete] = useState<{ nome: string; b: sci.BalanceteSci } | null>(null);

  async function lerTodas(fs: File[], ler: (f: File, bytes: Uint8Array) => void) {
    setOcupado(true);
    try {
      for (const f of fs) {
        if (!ACEITAR.test(f.name)) { aviso({ tom: 'info', titulo: 'Escolha uma planilha', texto: f.name + ' não é .xls, .xlsx, .ods nem .csv.' }); continue; }
        try { ler(f, new Uint8Array(await f.arrayBuffer())); }
        catch (e) { aviso({ tom: 'erro', titulo: 'Não consegui ler ' + f.name, texto: e instanceof Error ? e.message : undefined }); }
      }
    } finally { setOcupado(false); }
  }

  function adicionar(fs: File[]) {
    void lerTodas(fs, (f, bytes) => {
      const linhas = sci.lerPlanilhaDoNads(bytes, f.name);
      if (!linhas.length) { aviso({ tom: 'info', titulo: 'Nenhum lançamento em ' + f.name, texto: 'Use a planilha que o nads baixa para importar (as 10 colunas do Alterdata).' }); return; }
      setPlanilhas(atual => [...atual.filter(p => p.nome !== f.name), { id: proximoId++, nome: f.name, linhas }]);
    });
  }

  function escolherDePara(fs: File[]) {
    void lerTodas(fs.slice(0, 1), (f, bytes) => {
      const mapa = sci.lerDePara(bytes);
      if (!mapa.size) { aviso({ tom: 'info', titulo: 'Nenhuma conta em ' + f.name, texto: 'Na 1ª coluna a conta do nads, na 2ª a conta do SCI e, se quiser, o nome na 3ª.' }); return; }
      setDePara({ nome: f.name, mapa });
    });
  }

  function escolherBalancete(fs: File[]) {
    void lerTodas(fs.slice(0, 1), (f, bytes) => {
      const r = sci.lerBalanceteDoSci(bytes, f.name);
      if (!r.balancete) { aviso({ tom: 'info', titulo: 'Não entendi o balancete ' + f.name, texto: r.erro }); return; }
      setBalancete({ nome: f.name, b: r.balancete });
    });
  }

  function escolherPlanoDaEmpresa(fs: File[]) {
    void lerTodas(fs.slice(0, 1), (f, bytes) => {
      const leitura = empresas.cadastro.lerPlanoDeContas(empresas.cadastro.lerPlanilhaDoPlano(bytes.buffer as ArrayBuffer, f.name));
      if (leitura.erro || !leitura.contas.length) { aviso({ tom: 'info', titulo: 'Não entendi o plano ' + f.name, texto: leitura.erro || 'Use o plano de contas exportado do Alterdata.' }); return; }
      setPlanoDaEmpresa({ nome: f.name, contas: leitura.contas });
    });
  }

  const planoSci = useMemo(() => (idDoPlano ? sci.planoDoSci(idDoPlano) : null), [idDoPlano]);
  const pares = useMemo(() => (planoSci && planoDaEmpresa ? sci.deParaPeloPlano(planoDaEmpresa.contas, planoSci) : []), [planoSci, planoDaEmpresa]);
  const resumoDoDePara = useMemo(() => sci.resumoDoDePara(pares), [pares]);
  /** o automático com o do escritório por cima (o da planilha é o conferido) */
  const deParaFinal = useMemo(() => {
    if (!pares.length) return dePara?.mapa ?? null;
    return sci.juntarDePara(sci.mapaDoDePara(pares), dePara?.mapa ?? null);
  }, [pares, dePara]);

  function baixarDePara() {
    if (!pares.length) return;
    baixarBytes(sci.planilhaDoDePara(pares), 'de-para_sci_' + (idDoPlano || 'plano') + '.xlsx', sci.TIPO_XLSX_SCI);
  }

  const linhas = useMemo(() => planilhas.flatMap(p => p.linhas), [planilhas]);
  const mes = useMemo(() => sci.mesPrincipal(linhas), [linhas]);
  const lancamentos = useMemo(
    () => sci.lancamentosParaOSci(linhas, { cnpjEmpresa: cnpj, lote, historicoPadrao, dePara: deParaFinal, planoSci }),
    [linhas, cnpj, lote, historicoPadrao, deParaFinal, planoSci],
  );
  const resumo = useMemo(() => sci.resumoDoSci(lancamentos), [lancamentos]);
  /** os motivos que mais aparecem, para mostrar o que acertar antes de baixar */
  const problemas = useMemo(() => {
    const conta = new Map<string, number>();
    for (const l of lancamentos) for (const p of l.problemas) conta.set(p, (conta.get(p) || 0) + 1);
    return [...conta].sort((a, b) => b[1] - a[1]);
  }, [lancamentos]);

  const invertidos = useMemo(() => (balancete ? sci.saldosInvertidos(balancete.b) : []), [balancete]);
  const conferencia = useMemo(() => (balancete ? sci.conferirComOBalancete(lancamentos, balancete.b, planoSci) : []), [balancete, lancamentos, planoSci]);

  function baixar() {
    if (!resumo.prontos) return aviso({ tom: 'info', titulo: 'Nenhum lançamento pronto', texto: 'Acerte o que aparece em "O que falta" e baixe de novo.' });
    baixarBytes(sci.planilhaDoSci(lancamentos), sci.nomeDaPlanilhaSci(cnpj, mes), sci.TIPO_XLSX_SCI);
  }

  return {
    planilhas, adicionar, tirar: (id: number) => setPlanilhas(atual => atual.filter(p => p.id !== id)), limpar: () => setPlanilhas([]),
    dePara, escolherDePara, tirarDePara: () => setDePara(null),
    idDoPlano, setIdDoPlano, planoDaEmpresa, escolherPlanoDaEmpresa, tirarPlanoDaEmpresa: () => setPlanoDaEmpresa(null),
    pares, resumoDoDePara, baixarDePara,
    balancete, escolherBalancete, tirarBalancete: () => setBalancete(null), invertidos, conferencia,
    cnpj, setCnpj, lote, setLote, lotePadrao: sci.loteDoMes(mes), historicoPadrao, setHistoricoPadrao,
    lancamentos, resumo, problemas, mes, ocupado, baixar,
  };
}
