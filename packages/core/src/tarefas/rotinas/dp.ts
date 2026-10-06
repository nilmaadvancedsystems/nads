// A rotina do Departamento Pessoal (Vitor, 06/10/2026: o Checklist Folha "seria a rotina do dp"), no mesmo modelo do
// Fiscal: cada obrigação da planilha é uma etapa com as tarefas dela, em ordem —
//   Folha — Recibos de pagamento e a Folha;
//   eSocial — S-1200 (remunerações), S-1210 (pagamentos) e S-1299 (o fechamento);
//   Guias — DCTFWeb, o DARF e o FGTS Digital;
//   Envio — as guias e os recibos ao cliente, pelo jeito que ele recebe.
// Cada etapa vale só para quem tem a obrigação (empresas/dp.ts: Folha tem quase tudo; Pró-Labore, sem o FGTS; Sem
// Movimento, só o S-1299 e a DCTFWeb); fora disso, "não se aplica". É o único lugar a mexer: a ordem, os nomes e as tarefas.
import type { Etapa, ItemDoChecklist, Rotina } from '../tipos';

const item = (id: string, texto: string, mais: Omit<ItemDoChecklist, 'id' | 'texto'> = {}): ItemDoChecklist => ({ id, texto, ...mais });
const etapa = (id: string, secao: string, nome: string, descricao: string, checklist: ItemDoChecklist[], mais: Partial<Etapa> = {}): Etapa => ({
  id, secao, nome, descricao, ferramenta: null, verificacao: 'manual', objecoes: [], checklist, ...mais,
});

const ESOCIAL = { rotulo: 'Abrir o eSocial', url: 'https://login.esocial.gov.br/' };
const ECAC = { rotulo: 'Abrir o e-CAC', url: 'https://cav.receita.fazenda.gov.br/' };
const FGTS = { rotulo: 'Abrir o FGTS Digital', url: 'https://fgtsdigital.sistema.gov.br/' };

export const ROTINA_DP: Rotina = {
  departamento: 'dp',
  etapas: [
    // ─── Folha ────────────────────────────────────────────────────────────────
    etapa('dp-recibos', 'Folha', 'Recibos de pagamento', 'Lance as variáveis do mês e gere os recibos.', [
      item('variaveis', 'Lançar as variáveis do mês', { sub: ['Horas extras', 'Faltas e atrasos', 'Adiantamentos', 'Comissões'] }),
      item('recibos', 'Gerar e conferir os recibos de pagamento'),
    ], { obrigacaoDp: 'recibos' }),
    etapa('dp-folha', 'Folha', 'Folha de pagamento', 'Calcule a folha do mês e confira os totais.', [
      item('calcular', 'Calcular a folha'),
      item('conferir', 'Conferir proventos, descontos e líquidos', { aviso: 'Confira admissões, demissões, férias e afastamentos do mês.' }),
    ], { obrigacaoDp: 'folha' }),
    // ─── eSocial ──────────────────────────────────────────────────────────────
    etapa('dp-s1200', 'eSocial', 'S-1200', 'Envie as remunerações do mês ao eSocial.', [
      item('enviar', 'Enviar o S-1200 (remunerações)', { link: ESOCIAL }),
      item('retorno', 'Conferir o retorno, sem erro'),
    ], { obrigacaoDp: 's1200' }),
    etapa('dp-s1210', 'eSocial', 'S-1210', 'Envie os pagamentos do mês ao eSocial.', [
      item('enviar', 'Enviar o S-1210 (pagamentos)', { link: ESOCIAL }),
      item('retorno', 'Conferir o retorno, sem erro'),
    ], { obrigacaoDp: 's1210' }),
    etapa('dp-s1299', 'eSocial', 'S-1299', 'Feche a competência no eSocial.', [
      item('fechar', 'Fechar a competência (S-1299)', { link: ESOCIAL, aviso: 'Sem movimento: o fechamento vai sem remuneração.' }),
      item('recibo', 'Baixar o recibo do fechamento'),
    ], { obrigacaoDp: 's1299' }),
    // ─── Guias ────────────────────────────────────────────────────────────────
    etapa('dp-dctfweb', 'Guias', 'DCTFWeb', 'Transmita a DCTFWeb do mês.', [
      item('transmitir', 'Transmitir a DCTFWeb', { link: ECAC }),
      item('recibo', 'Baixar o recibo'),
    ], { obrigacaoDp: 'dctfweb' }),
    etapa('dp-darf', 'Guias', 'DARF', 'Emita o DARF do INSS e do IRRF.', [
      item('emitir', 'Emitir o DARF da DCTFWeb', { link: ECAC }),
      item('conferir', 'Conferir o valor com a folha'),
    ], { obrigacaoDp: 'darf' }),
    etapa('dp-fgts', 'Guias', 'FGTS Digital', 'Emita a guia do FGTS Digital.', [
      item('emitir', 'Emitir a guia do FGTS', { link: FGTS }),
      item('conferir', 'Conferir o valor com a folha'),
    ], { obrigacaoDp: 'fgts' }),
    // ─── Envio ────────────────────────────────────────────────────────────────
    etapa('dp-envio', 'Envio', 'Entrega ao cliente', 'Envie as guias e os recibos ao cliente.', [
      item('enviar', 'Enviar as guias e os recibos ao cliente'),
    ], { obrigacaoDp: 'envio' }),
  ],
};
