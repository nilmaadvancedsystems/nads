// ViewModel da etapa Fechar a competência (Vitor, 16/10/2026: "aplique todas as suas sugestões"): o Fechamento confere
// sozinho e manda ao cliente o que vai ser questionado num envio só.
// - O dinâmico final (o da Importação, ou um mais novo importado aqui, que passa a valer para todas as etapas) roda as
//   regras de novo (@nads/core clientes.conferirFechamento): o balancete fecha, nada do lado errado. Pendência trava.
// - O que foi marcado no "+" de Clientes e de Fornecedores vai num ticket só do Mandei (antes, um em cada etapa).
import { clientes as cl, formatos, mandei as md, tarefas as t } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useMemo, useState } from 'react';
import { useMarcasDoMes } from '../../../../dados/clientes';
import { useCadastro, useContatoDoEntregas } from '../../../../dados/repo';
import { criarTicket } from '../../../../dados/mandei';
import { useOperador } from '../../../../casca/operador';
import { useContabilDaEmpresa } from '../../../../../../comum/contabilDaEmpresa';
import { useDadosDeTesteDaEtapa, useEtapaAberta, useRequisitosDaEtapa } from '../contexto';

const mesAntes = (m: string) => { const [a, mm] = m.split('-').map(Number); return mm === 1 ? (a - 1) + '-12' : a + '-' + String(mm - 1).padStart(2, '0'); };

type Lado = cl.LadoDaConta;

/** O que vai ser questionado de um lado: as contas conferidas (as deste mês e as que passaram do anterior) com linha no "+". */
function questoesDe(doc: cl.DocClientes, anterior: cl.DocClientes) {
  const contas = { ...cl.conferidosQuePassam(anterior, doc), ...doc.contas };
  return Object.entries(contas)
    .filter(([, m]) => !!m.razao && cl.razaoComPendencia(m.razao, m.baixas) && cl.itensEscolhidos(m.razao, m.perguntar).length > 0)
    .map(([codigo, m]) => ({ codigo, marca: m }));
}

export function useFechamento() {
  const s = useEtapaAberta();
  const { aviso } = useRetorno();
  const op = useOperador().operador;
  const mes = s.meses[s.meses.length - 1] || s.competencia;
  const rotuloMes = mes ? t.rotuloNumericoCompetencia(mes) : '';
  const contabil = useContabilDaEmpresa(s.nome, s.codigo);
  // o ⚡ do modo desenvolvedor: o dinâmico de teste fica só nesta tela (16/10/2026)
  const [teste, setTeste] = useState<{ nome: string; d: cl.BalanceteDinamico } | null>(null);
  useDadosDeTesteDaEtapa(s.dev ? [{ id: 'certo', rotulo: 'Dinâmico de teste (tudo certo)' }, { id: 'erros', rotulo: 'Dinâmico de teste (com pendências)' }] : [],
    id => setTeste({ nome: 'TESTE balancete dinâmico.xls', d: cl.dinamicoCompletoDeTeste(s.meses, id === 'erros') }));
  const din = teste || contabil.dinamico;
  const pendencias = useMemo(() => (din ? cl.conferirFechamento(din.d, s.meses) : []), [din, s.meses]);

  // o envio único: Clientes e Fornecedores
  const avisar = (m: string) => aviso({ tom: 'erro', titulo: 'Fechamento', texto: m });
  const mc = useMarcasDoMes(s.nome, mes, avisar, 'clientes');
  const ac = useMarcasDoMes(s.nome, mes ? mesAntes(mes) : '', undefined, 'clientes');
  const mf = useMarcasDoMes(s.nome, mes, avisar, 'fornecedores');
  const af = useMarcasDoMes(s.nome, mes ? mesAntes(mes) : '', undefined, 'fornecedores');
  const lados: { lado: Lado; marcas: typeof mc; q: ReturnType<typeof questoesDe> }[] = [
    { lado: 'clientes', marcas: mc, q: questoesDe(mc.doc, ac.doc) },
    { lado: 'fornecedores', marcas: mf, q: questoesDe(mf.doc, af.doc) },
  ];
  const assinaturas = lados.map(x => cl.assinaturaDoEnvio(x.q.map(({ codigo, marca }) => ({ codigo, perguntar: cl.itensEscolhidos(marca.razao, marca.perguntar).map(cl.chaveDoItem) }))));
  const qtd = lados.reduce((n, x) => n + x.q.length, 0);
  const faltaMandar = lados.some((x, i) => !!assinaturas[i] && x.marcas.doc.enviado !== assinaturas[i]);
  const vivo = useCadastro(s.nome, s.codigo);
  const doEntregas = useContatoDoEntregas(s.codigo);
  const contato = { email: vivo.cadastro.contato?.email || doEntregas?.email || '', whatsapp: vivo.cadastro.contato?.whatsapp || doEntregas?.whatsapp || '' };

  const faltam = [
    ...(!din ? ['Importar o balancete dinâmico (na Importação ou aqui)'] : []),
    ...pendencias.map(p => p.titulo + ' (' + p.contas.length + (p.contas.length === 1 ? ' conta)' : ' contas)')),
    ...(faltaMandar ? ['Mandar ao cliente o que vai ser questionado (' + qtd + (qtd === 1 ? ' conta)' : ' contas)')] : []),
  ];
  useRequisitosDaEtapa({ pronto: !faltam.length, faltam });

  const reais = formatos.reais;
  return {
    temDinamico: !!din, arquivo: din?.nome || '',
    /** um dinâmico mais novo (o final, depois das correções): vale para todas as etapas */
    async importar(f: File | null) {
      if (!f) return;
      try { await contabil.importarDinamico(f); aviso({ tom: 'ok', titulo: 'Balancete dinâmico importado', texto: f.name }); }
      catch (e) { aviso({ tom: 'erro', titulo: 'Não deu para ler ' + f.name, texto: e instanceof Error ? e.message : String(e) }); }
    },
    pendencias: pendencias.map(p => ({
      id: p.id, titulo: p.titulo, dica: p.dica,
      contas: p.contas.map(c => ({
        conta: c.conta, nome: c.nome,
        meses: c.meses.map(m => t.rotuloNumericoCompetencia(m.mes) + ': ' + reais(Math.abs(m.saldo)) + (m.saldo < 0 ? ' C' : ' D')).join(' · '),
      })),
    })),
    // o envio único
    questoes: lados.flatMap(x => x.q.map(({ codigo, marca }) => ({
      id: x.lado + codigo, lado: x.lado === 'clientes' ? 'Cliente' : 'Fornecedor', codigo, nome: marca.nome, valor: reais(Math.abs(marca.saldo)),
      perguntar: cl.itensEscolhidos(marca.razao, marca.perguntar).map(cl.rotuloDoItem).join(' · '),
    }))),
    contato,
    faltaNoCadastro: !vivo.carregada ? ['o cadastro (carregando)'] : contato.email || contato.whatsapp ? [] : ['o e-mail ou o WhatsApp'],
    jaMandado: qtd > 0 && !faltaMandar,
    carregado: mc.carregado && mf.carregado,
    mandar: () => {
      const { email, whatsapp } = contato;
      if (!email && !whatsapp) { aviso({ tom: 'erro', titulo: 'Mandei', texto: 'Cadastre o e-mail ou o WhatsApp da empresa em Cadastro › Empresa.' }); return; }
      const tk = criarTicket({
        empresa: { nome: s.nome, codigo: s.codigo }, para: { nome: '', email, ...(whatsapp ? { whatsapp } : {}) },
        assunto: 'Saldos em aberto — ' + rotuloMes,
        mensagem: 'No fechamento de ' + rotuloMes + ', estes saldos de clientes e fornecedores ficaram em aberto. Pode nos dizer o que aconteceu com cada um?',
        criadoPor: { nome: op?.nome || '' },
        origem: { titulo: 'Fechamento · ' + rotuloMes, rota: window.location.pathname, competencia: mes },
        itens: lados.flatMap(x => x.q.map(({ codigo, marca }) => ({
          id: x.lado + '-' + codigo, titulo: (x.lado === 'clientes' ? 'Cliente: ' : 'Fornecedor: ') + marca.nome, valor: reais(Math.abs(marca.saldo)), opcoes: md.OPCOES_PADRAO,
          linhas: cl.linhasParaOTicket(marca.razao, marca.saldo, mes, marca.perguntar, x.lado, marca.baixas),
        }))),
      });
      lados.forEach((x, i) => { if (assinaturas[i]) x.marcas.salvar({ ...x.marcas.doc, enviado: assinaturas[i] }); });
      aviso({ tom: 'ok', titulo: 'Ticket ' + md.rotuloDoNumero(tk.numero) + ' mandado', texto: [email, whatsapp && 'WhatsApp ' + whatsapp].filter(Boolean).join(' e ') + ' · acompanhe em Mandei' });
    },
  };
}
