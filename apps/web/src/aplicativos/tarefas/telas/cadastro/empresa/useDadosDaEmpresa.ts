// ViewModel de Cadastro › Empresa: as regras da empresa que os aplicativos seguem. Hoje, "presta serviços?"
// (Vitor, 30/09/2026: a regra fica no Cadastro): decide a aba Prestados na Importação e os serviços prestados
// na Conferência. Grava na hora, com o registro no histórico.
import { empresas, tarefas } from '@nads/core';
import { useMemo, useState } from 'react';
import { podeTrocarRazaoSocial } from '../../../casca/navegacao';
import { useNovidade } from '../../../../../comum/novidades';
import { useOperador } from '../../../casca/operador';
import { empresasNovas, regimeNoEntregas } from '../../../dados/fonte';
import { useAcesso, useDadosDaEmpresaNoEntregas, useRegimesDoEntregas } from '../../../dados/repo';
import { competenciaDeHoje, rotuloCompetencia, useCadastroAberto } from '../useCadastroAberto';
import { somarMeses } from '../obrigacoes/useObrigacoesDaEmpresa';
import { useConsultaNaReceita } from './useConsultaNaReceita';

export function useDadosDaEmpresa(rota: string) {
  const c = useCadastroAberto(rota);
  const operador = useOperador().operador;
  const comSci = useNovidade('sci-no-cadastro');
  // o regime com "a partir de" (plano do Acessórias, ficha E10; novidade em teste, junto com as Obrigações)
  const regimeComData = useNovidade('obrigacoes-por-empresa');
  const hoje = competenciaDeHoje();
  const [regimeDesde, setRegimeDesde] = useState(hoje);
  useRegimesDoEntregas();
  const codigo = c.empresa?.codigo ?? null;
  const doEntregas = regimeNoEntregas(codigo);
  const padraoEntregas = empresas.cadastro.regimeDoEntregas(doEntregas);
  // os dados da empresa que o Entregas tem (o CNPJ, o cadastro de lá e a Receita; 14/10/2026)
  const identificacao = useDadosDaEmpresaNoEntregas(codigo);
  const regimeQueVale = (c.cadastro.regime as string | undefined) || padraoEntregas || tarefas.regimeDaLista(codigo) || c.empresa?.regime || '';
  const cnpj = c.cadastro.cnpj || identificacao.dados?.documento || '';
  // o que a Receita diz (17/11/2026): campo a campo, o gravado no nads pelo Consultar na Receita; sem ele, o do Entregas
  const daReceitaNoEntregas = useMemo(() => empresas.cadastro.retratoDoEntregas(identificacao.dados, doEntregas), [identificacao.dados, doEntregas]);
  const consulta = useConsultaNaReceita({
    cadastro: c.cadastro, nomeDaLista: c.empresa?.nome || '', cnpj, doEntregas: daReceitaNoEntregas, regimeQueVale,
    carregando: c.carregando, por: c.por, operador, salvar: c.salvar,
  });
  const planilhaDoFiscal = empresas.parametrosFiscaisDaPlanilha(codigo);
  const fiscal = empresas.parametrosFiscaisQueValem(codigo, c.cadastro.fiscal);
  // quem cuida da empresa no Fiscal e no Contábil (17/11/2026: trocar aqui, pelo Dados da empresa): o escolhido no
  // cadastro; no Fiscal, sem escolha, o da planilha do Checklist Folha (como em Empresas por responsável)
  const acesso = useAcesso();
  const ativos = acesso.equipe().lista;
  const igual = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const daPlanilhaBruto = empresas.clienteDoDp(codigo)?.responsavel || '';
  const daPlanilha = daPlanilhaBruto ? ativos.find(p => p.ativo && igual(p.nome, daPlanilhaBruto))?.nome || daPlanilhaBruto.charAt(0) + daPlanilhaBruto.slice(1).toLowerCase() : '';
  const podeTrocarResponsavel = !!operador?.admin;
  const responsaveis = empresas.cadastro.DEPARTAMENTOS_DO_RESPONSAVEL.map(d => {
    const opcoes = empresas.cadastro.quemPodeSerResponsavel(ativos, d.id);
    const escolhido = c.cadastro.responsaveis?.[d.id] || '';
    const valeNaEquipe = !!escolhido && opcoes.some(n => igual(n, escolhido) || igual(n.split('.')[0], escolhido));
    const doFiscalDaPlanilha = d.id === 'fiscal' && !escolhido ? daPlanilha : '';
    const t = c.cadastro.transferencias?.[d.id];
    return {
      dep: d.id, rotulo: d.rotulo, opcoes,
      /** quem cuida hoje ('' = ninguém) */
      atual: valeNaEquipe ? escolhido : doFiscalDaPlanilha,
      /** de onde veio: o escolhido no nads, a planilha do Fiscal ou ninguém; fora = o escolhido saiu da equipe */
      origem: valeNaEquipe ? 'cadastro' as const : doFiscalDaPlanilha ? 'planilha' as const : escolhido ? 'fora' as const : 'nenhum' as const,
      foraDaEquipe: !valeNaEquipe ? escolhido : '',
      /** no Fiscal, o da planilha (o que volta a valer se tirar o escolhido) */
      daPlanilha: d.id === 'fiscal' ? daPlanilha : '',
      /** a transferência pedida (a troca daqui passa por cima dela) */
      transferencia: t ? { de: t.de, para: t.para, faltam: empresas.cadastro.faltamAceitar(t) } : null,
    };
  });
  function definirFiscal<K extends keyof empresas.cadastro.ParametrosDoFiscal>(campo: K, valor: NonNullable<empresas.cadastro.ParametrosDoFiscal[K]>) {
    if (c.carregando) return;
    // o mesmo valor da planilha (o texto vazio, sem nada na planilha) volta a seguir a planilha
    const limpo = typeof valor === 'string' ? valor.trim() : valor;
    const daPlanilha = planilhaDoFiscal?.[campo] ?? (typeof valor === 'string' ? '' : undefined);
    const igual = JSON.stringify(daPlanilha) === JSON.stringify(limpo);
    const novo = empresas.cadastro.definirParametrosFiscais(c.cadastro, { [campo]: igual ? null : valor }, c.por, new Date());
    if (novo !== c.cadastro) c.salvar(novo);
  }
  return {
    empresa: c.empresa,
    /** a identificação (Entregas) e o CNPJ do cadastro do nads (as empresas novas, pela Receita) */
    entregas: identificacao,
    cnpj,
    /** o Consultar na Receita: a consulta na hora, o antes × depois e o gravar só o escolhido */
    consulta,
    /** o que a Receita diz, para mostrar: o gravado no nads; sem ele, o que o Entregas sabe */
    naReceita: empresas.cadastro.retratoQueVale(c.cadastro.receita, daReceitaNoEntregas),
    /** quando e por quem foi conferido (o do nads; sem ele, o vigia do Entregas) */
    conferidoNaReceita: c.cadastro.receita
      ? { em: c.cadastro.receita.conferidoEm, por: c.cadastro.receita.por }
      : identificacao.dados?.receita?.conferidoEm ? { em: identificacao.dados.receita.conferidoEm, por: 'o Entregas' } : null,
    /** os sócios que a Receita lista e o cadastro ainda não tem (pelo nome) */
    sociosDaReceita: (identificacao.dados?.receita?.socios || []).filter((n: string) => !(c.cadastro.socios || []).some(so => so.nome.trim().toUpperCase() === n.trim().toUpperCase())),
    importarSociosDaReceita(nomes: string[]) {
      if (c.carregando || !nomes.length) return;
      const novo = empresas.cadastro.definirSocios(c.cadastro, [...(c.cadastro.socios || []), ...nomes.map(nome => ({ nome, cpf: '' }))], c.por, new Date());
      if (novo !== c.cadastro) c.salvar(novo);
    },
    carregando: c.carregando,
    /**
     * a razão social (13/11/2026: trocar pelo próprio sistema): a trocada no nads; sem ela, a da Receita (pelo Entregas)
     * ou o nome da lista. A chave da empresa continua o nome da lista: trocar não tira nada dela.
     */
    razaoSocial: c.cadastro.razaoSocial?.atual || identificacao.dados?.receita?.razaoSocial || c.empresa?.nome || '',
    /** quem trocou, quando e as anteriores (sem = nunca foi trocada no nads) */
    trocaDaRazao: c.cadastro.razaoSocial || null,
    /** a da Receita, quando é outra (para trocar com um clique) */
    razaoDaReceita: (() => {
      const daReceita = empresas.cadastro.razaoSocialLimpa(identificacao.dados?.receita?.razaoSocial || '');
      return daReceita && daReceita !== empresas.cadastro.razaoSocialDoCadastro(c.cadastro, c.empresa?.nome) ? daReceita : '';
    })(),
    /** só o nível Diretor (e o Dono) troca a razão social; o admin sem esse nível, não (13/11/2026: "só diretor") */
    podeTrocarRazao: podeTrocarRazaoSocial(operador),
    /** troca a razão social; devolve o erro (null = trocou ou não mudou) */
    trocarRazaoSocial(nova: string): string | null {
      if (c.carregando || !podeTrocarRazaoSocial(operador)) return 'Só o diretor troca a razão social.';
      const outras = [...empresas.EMPRESAS_COM_DP, ...empresasNovas()].map(e => ({ codigo: e.codigo, nome: e.nome, razaoSocial: empresas.nomeParaMostrar(e) }));
      const r = empresas.cadastro.trocarRazaoSocial(c.cadastro, nova, outras, c.por, new Date());
      if ('erro' in r) return r.erro;
      if (r !== c.cadastro) c.salvar(r);
      return null;
    },
    /** quem cuida da empresa no Fiscal e no Contábil */
    responsaveis,
    /** só o Diretor (o admin) troca, como em Empresas por responsável */
    podeTrocarResponsavel,
    /** troca direto, sem pedir o aceite; a transferência pedida no departamento cai (fica no histórico) */
    trocarResponsavel(dep: empresas.cadastro.DepartamentoDoResponsavel, nome: string) {
      if (c.carregando || !podeTrocarResponsavel) return;
      const novo = empresas.cadastro.trocarResponsavelDireto(c.cadastro, dep, nome, c.por, new Date());
      if (novo === c.cadastro) return;
      c.salvar(novo);
      // no Registro de alterações (ficha M02 com a E20)
      const rotulo = empresas.cadastro.DEPARTAMENTOS_DO_RESPONSAVEL.find(d => d.id === dep)?.rotulo || dep;
      acesso.registrarAlteracao('responsavel-trocado', rotulo + ' · ' + c.empresa.nome + ': ' + (c.cadastro.responsaveis?.[dep] || 'sem responsável') + ' → ' + nome);
    },
    /** o regime (13/10/2026): o escolhido no cadastro (null = vale o da lista do escritório) e o da lista */
    regime: (c.cadastro.regime as empresas.cadastro.Regime | undefined) ?? null,
    /** sem escolher no nads: o do Entregas (o enquadramento; sem ele, a Receita) ou o da lista do escritório */
    regimePadrao: padraoEntregas || tarefas.regimeDaLista(codigo) || c.empresa?.regime || '',
    origemDoPadrao: !padraoEntregas ? 'da lista do escritório' : doEntregas?.enquadramento ? 'do Entregas' : 'da Receita (pelo Entregas)',
    /** o que a Receita diz, quando discorda do regime que vale (ex.: Simples aqui e fora do Simples lá) */
    receitaDiscorda: empresas.cadastro.receitaDiscorda(regimeQueVale, doEntregas) ? doEntregas!.receita : '',
    regimes: empresas.cadastro.REGIMES,
    definirRegime(regime: empresas.cadastro.Regime) {
      if (c.carregando) return;
      // com a data (ficha E10): o regime novo vale da competência escolhida em diante; os meses antes ficam no anterior
      if (regimeComData && c.cadastro.regime !== regime) {
        const novo = empresas.cadastro.mudarRegime(c.cadastro, regime, regimeDesde, regimeQueVale, c.por, new Date());
        if (novo !== c.cadastro) c.salvar(novo);
        return;
      }
      // clicar no que já está marcado volta para o da lista
      const novo = empresas.cadastro.definirRegime(c.cadastro, c.cadastro.regime === regime ? null : regime, c.por, new Date());
      if (novo !== c.cadastro) c.salvar(novo);
    },
    /** o regime com data (ficha E10): a competência em que a troca passa a valer e as trocas gravadas */
    regimeComData,
    regimeDesde,
    setRegimeDesde,
    opcoesRegimeDesde: [-3, -2, -1, 0, 1, 2, 3].map(n => {
      const v = somarMeses(hoje, n);
      return { valor: v, rotulo: rotuloCompetencia(v) + (n === 0 ? ' (este mês)' : '') };
    }),
    trocasDeRegime: (c.cadastro.regimes || []).map((x, i, l) => ({
      desde: x.desde,
      texto: x.regime + (x.desde ? ' desde ' + rotuloCompetencia(x.desde) : '') + (l[i + 1] ? ' até ' + rotuloCompetencia(somarMeses(l[i + 1].desde, -1)) : ''),
    })),
    tirarTrocaDeRegime(desde: string) {
      if (c.carregando) return;
      const novo = empresas.cadastro.tirarMudancaDeRegime(c.cadastro, desde, c.por, new Date());
      if (novo !== c.cadastro) c.salvar(novo);
    },
    /** true, false ou null (não informado) */
    prestaServico: c.cadastro.prestaServico ?? null,
    definirPrestaServico(sim: boolean) {
      if (c.carregando) return;
      const atual = c.cadastro.prestaServico ?? null;
      // clicar no que já está marcado volta para "não informado"
      const novo = empresas.cadastro.definirPrestaServico(c.cadastro, atual === sim ? null : sim, c.por, new Date());
      if (novo !== c.cadastro) c.salvar(novo);
    },
    /**
     * os parâmetros do Fiscal (29/10/2026): os que valem e de onde veio cada um (mudado no Cadastro ou da planilha do
     * Fiscal). Mudar para o mesmo valor da planilha volta a seguir a planilha.
     */
    fiscal: fiscal.valores,
    origemDoFiscal: fiscal.origem,
    abaDoFiscal: fiscal.aba,
    parametrosFiscais: empresas.cadastro.PARAMETROS_FISCAIS,
    segmentosFiscais: empresas.cadastro.SEGMENTOS_FISCAIS,
    maxTextoDoFiscal: empresas.cadastro.MAX_TEXTO_DO_FISCAL,
    definirFiscal,
    alternarSegmento(s: empresas.cadastro.SegmentoFiscal) {
      const atual = fiscal.valores.segmentos || [];
      definirFiscal('segmentos', atual.includes(s) ? atual.filter(x => x !== s) : [...atual, s]);
    },
    voltarFiscalAPlanilha() {
      if (c.carregando) return;
      const novo = empresas.cadastro.voltarFiscalAPlanilha(c.cadastro, c.por, new Date());
      if (novo !== c.cadastro) c.salvar(novo);
    },
    /** os cartões (Vitor, 07/10/2026): true, false ou null (não informado); ligam a etapa Cartões na Tarefas */
    cartaoEmpresarial: c.cadastro.cartaoEmpresarial ?? null,
    vendeNoCartao: c.cadastro.vendeNoCartao ?? null,
    /** a liquidação de cobrança no caixa (Vitor, 08/10/2026): Sim põe o Creditor em todos os meses da Tarefa */
    credLiquidacao: c.cadastro.credLiquidacao ?? null,
    definirCartao(campo: 'cartaoEmpresarial' | 'vendeNoCartao' | 'credLiquidacao', sim: boolean) {
      if (c.carregando) return;
      const atual = c.cadastro[campo] ?? null;
      // clicar no que já está marcado volta para "não informado"
      const novo = empresas.cadastro.definirCartao(c.cadastro, campo, atual === sim ? null : sim, c.por, new Date());
      if (novo !== c.cadastro) c.salvar(novo);
    },
    /** de quais bancos vem o relatório de liquidação (Vitor, 14/10/2026): o importar automático do Creditor procura esses */
    relatoriosDeLiquidacao: c.cadastro.relatoriosDeLiquidacao || [],
    marcarRelatorioDeLiquidacao(banco: empresas.cadastro.BancoDoRelatorio, marcado: boolean) {
      if (c.carregando) return;
      const novo = empresas.cadastro.definirRelatorioDeLiquidacao(c.cadastro, banco, marcado, c.por, new Date());
      if (novo !== c.cadastro) c.salvar(novo);
    },
    /** o escritório emite nota de honorário para a empresa (Vitor, 07/10/2026): decide o que a etapa Honorários pede */
    emiteNotaHonorario: c.cadastro.emiteNotaHonorario ?? null,
    definirNotaDeHonorario(sim: boolean) {
      if (c.carregando) return;
      const atual = c.cadastro.emiteNotaHonorario ?? null;
      // clicar no que já está marcado volta para "não informado"
      const novo = empresas.cadastro.definirNotaDeHonorario(c.cadastro, atual === sim ? null : sim, c.por, new Date());
      if (novo !== c.cadastro) c.salvar(novo);
    },
    /** a empresa está no SCI (24/11/2026): só as ligadas aparecem no minimum; o interruptor tem a novidade
     *  dele ('sci-no-cadastro', para todos), à parte da do minimum ('shadersci', modo desenvolvedor) */
    comSci,
    noSci: c.cadastro.noSci === true,
    /** o plano de contas do SCI (24/11/2026: "colocar o plano de contas, referenciar para nao ficar selecionando"); null = falta escolher */
    planoSci: c.cadastro.planoSci ?? null,
    planosDoSci: empresas.cadastro.PLANOS_DO_SCI,
    /** a competência (AAAA-MM) em que a empresa entrou no SCI (26/11/2026); '' = não informada */
    sciDesde: c.cadastro.sciDesde ?? '',
    definirSciDesde(competencia: string) {
      if (c.carregando) return;
      const novo = empresas.cadastro.definirSciDesde(c.cadastro, competencia, c.por, new Date());
      if (novo !== c.cadastro) c.salvar(novo);
    },
    definirNoSci(sim: boolean, plano?: empresas.cadastro.PlanoDoSci) {
      if (c.carregando) return;
      const novo = empresas.cadastro.definirNoSci(c.cadastro, sim, c.por, new Date(), plano);
      if (novo !== c.cadastro) c.salvar(novo);
    },
    /** o lembrete de vencimento desta empresa (17/11/2026, o dono: "quero que a parte de vencimento tenha como escolher por cliente"): 'padrao' = como o escritório */
    lembrete: { modo: (c.cadastro.lembreteVencimento?.modo ?? 'padrao') as 'padrao' | 'sim' | 'nao', diasAntes: c.cadastro.lembreteVencimento?.diasAntes ?? null },
    definirLembrete(modo: 'padrao' | 'sim' | 'nao', diasAntes: number | null = null) {
      if (c.carregando) return;
      const escolha = modo === 'padrao' ? null : { modo, ...(modo === 'sim' && diasAntes != null ? { diasAntes } : {}) };
      const novo = empresas.cadastro.definirLembreteDeVencimento(c.cadastro, escolha, c.por, new Date());
      if (novo !== c.cadastro) c.salvar(novo);
    },
    /** o e-mail e o WhatsApp da empresa (Vitor, 07/10/2026): para onde o Mandei manda as perguntas de Clientes e Fornecedores */
    email: c.cadastro.contato?.email || '',
    whatsapp: c.cadastro.contato?.whatsapp || '',
    /** grava ao sair do campo; inválido não grava e devolve o aviso (null = gravou ou não mudou) */
    definirContato(campo: 'email' | 'whatsapp', valor: string): string | null {
      if (c.carregando) return null;
      const novo = empresas.cadastro.definirContato(c.cadastro, campo, valor, c.por, new Date());
      if (novo !== c.cadastro) { c.salvar(novo); return null; }
      const igual = (c.cadastro.contato?.[campo] || '') === (campo === 'whatsapp' ? empresas.cadastro.whatsappLimpo(valor) : valor.trim());
      return igual || !valor.trim() ? null : campo === 'email' ? 'E-mail inválido.' : 'WhatsApp inválido: o número com o DDD (10 ou 11 dígitos).';
    },
    /** os outros e-mails (o DP Envios manda para eles também); separados por vírgula, espaço ou quebra de linha */
    outrosEmails: c.cadastro.contato?.outrosEmails || [],
    definirOutrosEmails(texto: string): string | null {
      if (c.carregando) return null;
      const valores = texto.split(/[\s,;]+/).filter(Boolean);
      const novo = empresas.cadastro.definirOutrosEmails(c.cadastro, valores, c.por, new Date());
      if (novo !== c.cadastro) { c.salvar(novo); return null; }
      return valores.some(e => !empresas.cadastro.emailValido(e)) ? 'Algum e-mail está inválido.' : null;
    },
    /** os sócios, com o nome e o CPF (a etapa Bancos acha a transferência para o sócio no extrato) */
    socios: c.cadastro.socios || [],
    /** grava a lista inteira (a linha vazia some) */
    definirSocios(lista: { nome: string; cpf: string }[]) {
      if (c.carregando) return;
      const novo = empresas.cadastro.definirSocios(c.cadastro, lista, c.por, new Date());
      if (novo !== c.cadastro) c.salvar(novo);
    },
  };
}
