import { describe, expect, it } from 'vitest';
import { aliquotaEfetiva, avisoDeLimite, previaDoDas, reinfDasNotas, segregacaoDasSaidas, servicosDoMes } from './simples';
import type { NotaDoSieg, NotasSieg } from './index';

const eu = { doc: '11111111000111', nome: 'EMPRESA' };
const outro = { doc: '22222222000122', nome: 'OUTRO' };
const xml = (emitidas: NotaDoSieg[], recebidas: NotaDoSieg[] = []): NotasSieg => ({ codigo: '1', competencia: '2026-09', em: '', pasta: '', arquivos: 0, novos: 0, emitidas, recebidas });
const nfe = (itens: NotaDoSieg['itens'], extra: Partial<NotaDoSieg> = {}): NotaDoSieg => ({ tipo: 'NF-e', chave: 'k', numero: '1', serie: '1', data: '05/09/2026', emitente: eu, destinatario: outro, valor: 0, itens, ...extra });
const nfse = (de: typeof eu, para: typeof eu, valor: number, retencoes: { imposto: string; valor: number }[]): NotaDoSieg => ({ tipo: 'NFS-e', chave: '', numero: '7', serie: '', data: '07/09/2026', emitente: de, destinatario: para, valor, retencoes });

describe('o Simples pelos XMLs (13/10/2026)', () => {
  it('a alíquota efetiva pela LC 155/2016', () => {
    expect(aliquotaEfetiva('I', 500000)).toMatchObject({ faixa: 3, nominal: 9.5, efetiva: 6.728 });
    expect(aliquotaEfetiva('III', 250000)).toMatchObject({ faixa: 2, efetiva: 7.456 });
    expect(aliquotaEfetiva('I', 100000).efetiva).toBe(4);
  });
  it('a segregação: monofásico pelo NCM, ST pelo CSOSN/CFOP; devolução e remessa fora', () => {
    const s = segregacaoDasSaidas(xml([nfe([
      { ncm: '40111000', cfop: '5102', cst: '102', cest: '', valor: 1000 },       // pneu: monofásico
      { ncm: '22021000', cfop: '5405', cst: '500', cest: '0300700', valor: 300 }, // refrigerante com ST: os dois
      { ncm: '21069090', cfop: '5405', cst: '500', cest: '1704900', valor: 200 }, // só ST
      { ncm: '63026000', cfop: '5102', cst: '102', cest: '', valor: 500 },        // normal
      { ncm: '63026000', cfop: '5202', cst: '102', cest: '', valor: 999 },        // devolução: fora
    ]), nfe([{ ncm: '40111000', cfop: '5102', cst: '102', cest: '', valor: 7 }], { cancelada: true })]));
    expect(s).toMatchObject({ total: 2000, monofasico: 1000, monofasicoESt: 300, st: 200, normal: 500 });
    expect(s.porGrupo.map(g => g.grupo)).toEqual(['Pneus e câmaras', 'Bebidas frias']);
  });
  it('a prévia do DAS tira da alíquota o PIS/COFINS do monofásico e o ICMS da ST', () => {
    const p = previaDoDas(500000, [{ rotulo: 'Normal', anexo: 'I', valor: 1000 }, { rotulo: 'Monofásico', anexo: 'I', valor: 1000, semPisCofins: true }, { rotulo: 'ST', anexo: 'I', valor: 1000, semIcms: true }]);
    expect(p.parcelas.map(x => x.das)).toEqual([67.28, 56.85, 44.74]);
    expect(p.total).toBe(168.87);
    expect(p.economia).toBe(32.97);
  });
  it('o aviso de limite', () => {
    expect(avisoDeLimite('Simples', 3000000)).toBeNull();
    expect(avisoDeLimite('Simples', 3300000)?.nivel).toBe('atencao');
    expect(avisoDeLimite('Simples', 3700000)?.nivel).toBe('passou');
    expect(avisoDeLimite('MEI', 75000)?.nivel).toBe('atencao');
    expect(avisoDeLimite('Presumido', 9000000)).toBeNull();
  });
  it('a REINF pelas NFS-e: R-2010 e R-4020 dos tomados, R-2020 dos prestados', () => {
    const x = xml([nfse(eu, outro, 2000, [{ imposto: 'INSS', valor: 220 }])],
      [nfse(outro, eu, 1000, [{ imposto: 'INSS', valor: 110 }, { imposto: 'IRRF', valor: 15 }, { imposto: 'PIS', valor: 6.5 }])]);
    expect(reinfDasNotas(x).map(l => l.evento + ':' + l.inss + '/' + l.irrf + '/' + l.pis)).toEqual(['R-2010:110/0/0', 'R-2020:220/0/0', 'R-4020:0/15/6.5']);
    expect(servicosDoMes(xml([nfse(eu, outro, 500, [{ imposto: 'ISS', valor: 25 }]), nfse(eu, outro, 300, [])]))).toEqual({ total: 800, issRetido: 500 });
  });
});
