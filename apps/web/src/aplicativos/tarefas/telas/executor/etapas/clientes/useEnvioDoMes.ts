// O Envio do mês pelo Mandei (11/11/2026), o mesmo em Clientes e em Fornecedores: o que foi marcado no "+" dos dois lados
// vai num ticket só (Vitor, 16/10/2026: "um envio só"), como fazia a etapa Fechar a competência, que saiu em 27/10 e
// deixou o Envio escondido. A regra está no @nads/core (clientes.envioDoMes); aqui, as marcas dos dois lados, o contato
// da empresa e o Mandar.
import { clientes as cl, formatos, mandei as md, tarefas } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useMemo } from 'react';
import { useOperador } from '../../../../casca/operador';
import { useMarcasDoMes } from '../../../../dados/clientes';
import { criarTicket } from '../../../../dados/mandei';
import { useCadastro, useContatoDoEntregas } from '../../../../dados/repo';
import { useEtapaAberta } from '../contexto';

const mesAntes = (m: string) => { const [a, mm] = m.split('-').map(Number); return mm === 1 ? (a - 1) + '-12' : a + '-' + String(mm - 1).padStart(2, '0'); };

export function useEnvioDoMes() {
  const s = useEtapaAberta();
  const { aviso } = useRetorno();
  const op = useOperador().operador;
  const mes = s.meses[s.meses.length - 1] || s.competencia;
  const rotuloMes = mes ? tarefas.rotuloNumericoCompetencia(mes) : '';
  const mc = useMarcasDoMes(s.nome, mes, undefined, 'clientes');
  const ac = useMarcasDoMes(s.nome, mes ? mesAntes(mes) : '', undefined, 'clientes');
  const mf = useMarcasDoMes(s.nome, mes, undefined, 'fornecedores');
  const af = useMarcasDoMes(s.nome, mes ? mesAntes(mes) : '', undefined, 'fornecedores');
  const envio = useMemo(() => cl.envioDoMes([
    { lado: 'clientes', doc: mc.doc, anterior: ac.doc },
    { lado: 'fornecedores', doc: mf.doc, anterior: af.doc },
  ]), [mc.doc, ac.doc, mf.doc, af.doc]);
  // o e-mail e o WhatsApp da empresa (Vitor, 07/10/2026): os do Cadastro; sem eles, os que o Entregas tem (08/10/2026)
  const vivo = useCadastro(s.nome, s.codigo);
  const doEntregas = useContatoDoEntregas(s.codigo);
  const contato = { email: vivo.cadastro.contato?.email || doEntregas?.email || '', whatsapp: vivo.cadastro.contato?.whatsapp || doEntregas?.whatsapp || '' };
  const carregado = mc.carregado && mf.carregado;

  return {
    /** as contas que vão ser questionadas, dos dois lados; jaFoi = o lado dela já foi mandado */
    questoes: envio.questoes.map(q => ({
      id: q.lado + '-' + q.codigo, lado: q.lado === 'clientes' ? 'Cliente' : 'Fornecedor', codigo: q.codigo, nome: q.marca.nome,
      valor: formatos.reais(Math.abs(q.marca.saldo)), perguntar: cl.perguntasDaQuestao(q), notas: cl.textoDasNotas(q.marca.razao?.notas),
      jaFoi: !envio.faltam.includes(q.lado),
    })),
    /** quantas contas faltam mandar (as dos lados com marcação nova) */
    faltaMandar: envio.questoes.filter(q => envio.faltam.includes(q.lado)).length,
    jaMandado: carregado && envio.questoes.length > 0 && !envio.faltam.length,
    contato,
    /** o que falta no Cadastro para mandar (vazio = pode): um dos dois basta (Vitor, 07/10/2026) */
    faltaNoCadastro: !vivo.carregada ? ['o cadastro (carregando)'] : contato.email || contato.whatsapp ? [] : ['o e-mail ou o WhatsApp'],
    mandar: () => {
      const { email, whatsapp } = contato;
      if (!email && !whatsapp) { aviso({ tom: 'erro', titulo: 'Mandei', texto: 'Cadastre o e-mail ou o WhatsApp da empresa em Cadastro › Empresa.' }); return; }
      if (!envio.faltam.length) return;
      const doMes = cl.ticketDoMes(envio, mes, rotuloMes);
      const tk = criarTicket({
        empresa: { nome: s.nome, codigo: s.codigo }, para: { nome: '', email, ...(whatsapp ? { whatsapp } : {}) },
        ...doMes, criadoPor: { nome: op?.nome || '' },
        origem: { titulo: 'Saldos em aberto · ' + rotuloMes, rota: window.location.pathname, competencia: mes },
      });
      // cada lado mandado guarda a assinatura: mudou o "+" depois, falta mandar de novo
      if (envio.faltam.includes('clientes')) mc.salvar({ ...mc.doc, enviado: envio.assinaturas.clientes });
      if (envio.faltam.includes('fornecedores')) mf.salvar({ ...mf.doc, enviado: envio.assinaturas.fornecedores });
      aviso({ tom: 'ok', titulo: 'Ticket ' + md.rotuloDoNumero(tk.numero) + ' mandado', texto: [email, whatsapp && 'WhatsApp ' + whatsapp].filter(Boolean).join(' e ') + ' · acompanhe em Área do Cliente › Meus tickets' });
    },
  };
}

export type EnvioDoMesVM = ReturnType<typeof useEnvioDoMes>;
