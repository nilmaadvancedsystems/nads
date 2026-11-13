// O Administrativo (13/11/2026): as entradas de clientes no escritório. Protótipo do modo desenvolvedor: tudo fica na
// memória do navegador (some ao recarregar), com os exemplos do ⚡; o banco, a pasta de verdade no Drive e o cadastro de
// verdade vêm depois de o Vitor aprovar. As regras são do core (administrativo.entrada).
import { administrativo } from '@nads/core';
import { idNovo } from './tarefasDelegadas';

type Entrada = administrativo.entrada.Entrada;
const e = administrativo.entrada;

export interface RepoEntradas {
  exemplos: boolean;
  lista(): Entrada[];
  /** começa uma ficha nova (devolve o id) */
  nova(por: string): string;
  /** grava a entrada como ficou (as regras do core dizem como ela fica) */
  salvar(x: Entrada): void;
  /** guarda o arquivo de um documento recebido (os bytes ficam na memória) */
  guardar(id: string, documento: string, arquivo: File, por: string): Promise<void>;
  baixar(id: string, documento: string): Uint8Array | null;
  assinar(f: () => void): () => void;
  versao(): number;
}

/** As entradas de exemplo do ⚡: uma em cada etapa. */
function exemplos(): Entrada[] {
  const ha = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
  const sim = (ids: administrativo.entrada.IdRequisito[]) => Object.fromEntries(ids.map(i => [i, true]));
  const base = (id: string, n: number, h: number, ficha: Partial<administrativo.entrada.Ficha>) => e.comFicha(e.nova(id, n, 'Nilma', ha(h)), { ...e.fichaVazia(), ...ficha }, ha(h));
  const ana = { nome: 'Ana Exemplo', cpf: '', participacao: 60, administrador: true }, bruno = { nome: 'Bruno Exemplo', cpf: '', participacao: 40, administrador: false };
  const r1 = base('en-1', 1, 2, { contato: 'Carlos Exemplo', telefone: '(38) 99999-0001', razaoSocial: 'Mercado Exemplo Ltda', cidade: 'Taiobeiras', motivo: 'troca', regime: 'simples', atividade: 'comercio', faturamento: 120_000, funcionarios: 4, notasPorMes: 350, bancos: 3, contabilidadeAtual: 'Outro escritório da cidade', requisitos: { ...sim(['extratos', 'financeiro', 'sistema', 'contaPj']), prazo: false } });
  const r2 = e.paraOOrcamento(base('en-2', 2, 20, { contato: 'Daniela Exemplo', email: 'daniela@exemplo.com', razaoSocial: 'Clínica Exemplo', motivo: 'orcamento', regime: 'presumido', atividade: 'servico', faturamento: 80_000, funcionarios: 2, notasPorMes: 60, bancos: 2, requisitos: sim(['extratos', 'financeiro', 'sistema', 'prazo', 'certificado', 'contaPj', 'digital']), socios: [ana, bruno] }), 'Nilma', ha(18));
  const r3 = e.enviado(e.paraOOrcamento(base('en-3', 3, 50, { contato: 'Eduardo Exemplo', telefone: '(38) 99999-0003', razaoSocial: 'Oficina Exemplo', motivo: 'abertura', regime: 'mei', atividade: 'servico', requisitos: sim(['extratos', 'digital']) }), 'Nilma', ha(48)), 'Nilma', ha(47));
  const r4 = e.comDocumento(e.respostaDoCliente(e.enviado(e.paraOOrcamento(base('en-4', 4, 120, { contato: 'Fernanda Exemplo', telefone: '(38) 99999-0004', email: 'fernanda@exemplo.com', razaoSocial: 'Padaria Exemplo Ltda', cnpj: '00.000.000/0001-00', motivo: 'troca', regime: 'simples', atividade: 'misto', faturamento: 60_000, funcionarios: 1, notasPorMes: 900, bancos: 2, requisitos: sim(['extratos', 'financeiro', 'certificado', 'contaPj', 'digital']), socios: [{ ...ana, participacao: 100 }] }), 'Nilma', ha(110)), 'Nilma', ha(100)), true, 'Começa no mês que vem.', 'Nilma', ha(30)),
    { documento: 'empresa:contrato', nome: 'contrato-social.pdf', tamanho: 254_000, em: ha(10), por: 'Nilma' });
  const r5 = e.respostaDoCliente(e.enviado(e.paraOOrcamento(base('en-5', 5, 200, { contato: 'Gustavo Exemplo', telefone: '(38) 99999-0005', razaoSocial: 'Loja Exemplo', motivo: 'orcamento', regime: 'simples', atividade: 'comercio', requisitos: {} }), 'Nilma', ha(190)), 'Nilma', ha(189)), false, 'Achou caro; pediu para ligar no ano que vem.', 'Nilma', ha(150));
  return [r1, r2, r3, r4, r5];
}

/** paraTeste: o ⚡ (as entradas de exemplo) */
export function criarEntradasMemoria(paraTeste = false): RepoEntradas {
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  let lista: Entrada[] = paraTeste ? exemplos() : [];
  const bytes = new Map<string, Uint8Array>();
  return {
    exemplos: paraTeste,
    lista: () => lista,
    nova(por) {
      const id = 'en-' + idNovo();
      lista = [...lista, e.nova(id, lista.reduce((m, x) => Math.max(m, x.numero), 0) + 1, por, new Date().toISOString())];
      mudou();
      return id;
    },
    salvar(x) { lista = lista.map(y => (y.id === x.id ? x : y)); mudou(); },
    async guardar(id, documento, arquivo, por) {
      const x = lista.find(y => y.id === id);
      if (!x) throw new Error('a entrada não existe mais');
      bytes.set(id + '|' + documento, new Uint8Array(await arquivo.arrayBuffer()));
      lista = lista.map(y => (y.id === id ? e.comDocumento(y, { documento, nome: arquivo.name, tamanho: arquivo.size, em: new Date().toISOString(), por }) : y));
      mudou();
    },
    baixar: (id, documento) => bytes.get(id + '|' + documento) || null,
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
