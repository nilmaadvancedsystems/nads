// ViewModel de Cadastro › Empresa: as regras da empresa que os aplicativos seguem. Hoje, "presta serviços?"
// (Vitor, 30/09/2026: a regra fica no Cadastro): decide a aba Prestados na Importação e os serviços prestados
// na Conferência. Grava na hora, com o registro no histórico.
import { empresas, tarefas } from '@nads/core';
import { regimeNoEntregas } from '../../../dados/fonte';
import { useDadosDaEmpresaNoEntregas, useRegimesDoEntregas } from '../../../dados/repo';
import { useCadastroAberto } from '../useCadastroAberto';

export function useDadosDaEmpresa(rota: string) {
  const c = useCadastroAberto(rota);
  useRegimesDoEntregas();
  const codigo = c.empresa?.codigo ?? null;
  const doEntregas = regimeNoEntregas(codigo);
  const padraoEntregas = empresas.cadastro.regimeDoEntregas(doEntregas);
  // os dados da empresa que o Entregas tem (o CNPJ, o cadastro de lá e a Receita; 14/10/2026)
  const identificacao = useDadosDaEmpresaNoEntregas(codigo);
  const regimeQueVale = (c.cadastro.regime as string | undefined) || padraoEntregas || tarefas.regimeDaLista(codigo) || c.empresa?.regime || '';
  return {
    empresa: c.empresa,
    /** a identificação (Entregas) e o CNPJ do cadastro do nads (as empresas novas, pela Receita) */
    entregas: identificacao,
    cnpj: c.cadastro.cnpj || identificacao.dados?.documento || '',
    /** os sócios que a Receita lista e o cadastro ainda não tem (pelo nome) */
    sociosDaReceita: (identificacao.dados?.receita?.socios || []).filter((n: string) => !(c.cadastro.socios || []).some(so => so.nome.trim().toUpperCase() === n.trim().toUpperCase())),
    importarSociosDaReceita(nomes: string[]) {
      if (c.carregando || !nomes.length) return;
      const novo = empresas.cadastro.definirSocios(c.cadastro, [...(c.cadastro.socios || []), ...nomes.map(nome => ({ nome, cpf: '' }))], c.por, new Date());
      if (novo !== c.cadastro) c.salvar(novo);
    },
    carregando: c.carregando,
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
      // clicar no que já está marcado volta para o da lista
      const novo = empresas.cadastro.definirRegime(c.cadastro, c.cadastro.regime === regime ? null : regime, c.por, new Date());
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
    /** o escritório emite nota de honorário para a empresa (Vitor, 07/10/2026): decide o que a etapa Honorários pede */
    emiteNotaHonorario: c.cadastro.emiteNotaHonorario ?? null,
    definirNotaDeHonorario(sim: boolean) {
      if (c.carregando) return;
      const atual = c.cadastro.emiteNotaHonorario ?? null;
      // clicar no que já está marcado volta para "não informado"
      const novo = empresas.cadastro.definirNotaDeHonorario(c.cadastro, atual === sim ? null : sim, c.por, new Date());
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
