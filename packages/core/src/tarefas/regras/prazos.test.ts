// A tabela única de prazos (plano do Acessórias, 17/11/2026, ficha E02; frase do dono: "Seguir para a E02").
// Datas fixas, nunca a data de hoje.
import { describe, expect, it } from 'vitest';
import { VENCIMENTOS } from '../../areaCliente/vencimentos';
import { rotinaDo } from '../rotinas/rotinaDo';
import { diasUteisAntes, linhaDoPrazo, PRAZOS, prazoDaEtapa } from './prazos';
import { PRAZOS_DO_DP } from './prazosDoDp';

describe('a tabela de prazos das etapas', () => {
  it('toda etapa da tabela existe na rotina do departamento (pega id errado)', () => {
    for (const p of PRAZOS) expect(!!rotinaDo(p.departamento)?.etapas.some(e => e.id === p.etapa), p.departamento + ' ' + p.etapa).toBe(true);
  });
  it('uma linha por etapa', () => {
    const chaves = PRAZOS.map(p => p.departamento + '|' + p.etapa);
    expect(new Set(chaves).size).toBe(chaves.length);
  });
  it('FGTS de out/2026: 20/11 é feriado, antecipa para 19/11; o interno 3 dias úteis antes', () => {
    expect(prazoDaEtapa('dp', 'dp-fgts', '2026-10')).toEqual({ legal: '2026-11-19', interno: '2026-11-16', multa: true });
  });
  it('S-1200 de out/2026: 15/11 é domingo e feriado, antecipa para sexta 13/11', () => {
    expect(prazoDaEtapa('dp', 'dp-s1200', '2026-10')?.legal).toBe('2026-11-13');
  });
  it('a folha: o 5º dia útil contando o sábado', () => {
    expect(prazoDaEtapa('dp', 'dp-folha', '2026-11')?.legal).toBe('2026-12-05');
  });
  it('o Contábil não tem prazo; etapa sem linha e competência torta também não', () => {
    expect(prazoDaEtapa('contabil', 'contabil-fechamento', '2026-10')).toBeNull();
    expect(PRAZOS.some(p => p.departamento === 'contabil')).toBe(false);
    expect(prazoDaEtapa('fiscal', 'fiscal-conf-saidas', '2026-10')).toBeNull();
    expect(prazoDaEtapa('dp', 'dp-fgts', '2026-13')).toBeNull();
  });
  it('a multa nas obrigações que a lei multa; toda linha marca o que falta conferir', () => {
    for (const e of ['dp-dctfweb', 'dp-s1200', 'dp-s1210', 'dp-s1299', 'dp-reinf', 'dp-darf', 'dp-fgts']) expect(linhaDoPrazo('dp', e)?.multa, e).toBe(true);
    for (const e of ['fiscal-simples', 'fiscal-mei']) expect(linhaDoPrazo('fiscal', e)?.multa, e).toBe(true);
    for (const p of PRAZOS) expect(p.conferir, p.etapa).toMatch(/multa a confirmar/);
  });
  it('dias úteis antes pula o fim de semana e o feriado', () => {
    expect(diasUteisAntes('2026-11-23', 1, 'federal')).toBe('2026-11-19'); // 20/11 feriado, 21 e 22 fim de semana
  });
  it('PRAZOS_DO_DP continua com os mesmos dias, ajustes e fontes de antes da E02', () => {
    expect(PRAZOS_DO_DP).toEqual({
      folha: { dia: 'quinto-dia-util', ajuste: 'antecipa', fonte: 'CLT, art. 459, § 1º' },
      recibos: { dia: 'quinto-dia-util', ajuste: 'antecipa', fonte: 'CLT, art. 459, § 1º' },
      s1200: { dia: 15, ajuste: 'antecipa', fonte: 'Manual do eSocial (eventos periódicos)' },
      s1210: { dia: 15, ajuste: 'antecipa', fonte: 'Manual do eSocial (eventos periódicos)' },
      s1299: { dia: 15, ajuste: 'antecipa', fonte: 'Manual do eSocial (eventos periódicos)' },
      reinf: { dia: 15, ajuste: 'antecipa', fonte: 'IN RFB 2.043/2021' },
      dctfweb: { dia: 20, ajuste: 'antecipa', fonte: 'Lei 8.212/1991, art. 30, I, "b" (o DARF da DCTFWeb)' },
      darf: { dia: 20, ajuste: 'antecipa', fonte: 'Lei 8.212/1991, art. 30; Lei 11.196/2005, art. 70' },
      fgts: { dia: 20, ajuste: 'antecipa', fonte: 'Lei 8.036/1990, art. 15 (Lei 14.438/2022)' },
      econsignado: { dia: 20, ajuste: 'antecipa', fonte: 'na guia do FGTS Digital (Lei 8.036/1990, art. 15)' },
    });
  });
  it('a agenda do cliente usa o mesmo dia, ajuste e esfera da tabela; só a DCTFWeb tem o dia 15 para o cliente', () => {
    for (const v of VENCIMENTOS) {
      const p = PRAZOS.find(x => x.etapa === v.etapa)!;
      expect([v.mesesDepois, v.ajuste, v.esfera], v.etapa).toEqual([p.mesesDepois, p.ajuste, p.esfera]);
      expect(v.dia, v.etapa).toBe(v.etapa === 'dp-dctfweb' ? 15 : p.dia);
    }
    expect(linhaDoPrazo('dp', 'dp-dctfweb')?.dia).toBe(20); // o DP continua no 20
  });
});
