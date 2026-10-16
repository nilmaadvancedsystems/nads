import { describe, expect, it } from 'vitest';
import { guiaDoTexto, lerGuia } from './leitorDeGuia';

// textos inventados, no desenho dos documentos (nada de cliente de verdade)
const DAS = `Documento de Arrecadação do Simples Nacional
Pagar este documento até 20/10/2026
CNPJ Básico Razão Social
00.000.000 EMPRESA DE TESTE LTDA
Período de Apuração
09/2026
Número do Documento
07.18.26277.1234567-8
Valor Total do Documento
1.234,56
Data de Vencimento Principal Multa Juros
20/10/2026 1.200,00 0,00 0,00`;

const DAE = `GOVERNO DO ESTADO DE MINAS GERAIS
Secretaria de Estado de Fazenda
DOCUMENTO DE ARRECADAÇÃO ESTADUAL - DAE
Número do DAE
1234567890123
Período de Referência 09/2026
Data de Vencimento 10/10/2026
Valor Total
R$ 987,65`;

describe('o leitor de guia', () => {
  it('lê o DAS: vencimento do "Pagar este documento até", valor, número e competência', () => {
    expect(lerGuia(DAS)).toEqual({ guia: 'DAS', vencimento: '20/10/2026', valor: '1.234,56', numero: '07.18.26277.1234567-8', competencia: '2026-09' });
  });

  it('lê o DAE de MG: vencimento, valor total, número e período', () => {
    expect(lerGuia(DAE)).toEqual({ guia: 'DAE', vencimento: '10/10/2026', valor: '987,65', numero: '1234567890123', competencia: '2026-09' });
  });

  it('não depende de caixa, acento nem quebra de linha', () => {
    const r = lerGuia('DOCUMENTO DE ARRECADACAO DO SIMPLES NACIONAL pagar   este documento\nate 21/10/2026  VALOR TOTAL DO DOCUMENTO 45,00');
    expect(r).toMatchObject({ guia: 'DAS', vencimento: '21/10/2026', valor: '45,00' });
  });

  it('período em dia/mês/ano ("01/09/2026 a 30/09/2026") vale o primeiro mês', () => {
    const r = lerGuia(DAS.replace('09/2026\nNúmero', '01/09/2026 a 30/09/2026\nNúmero'));
    expect(r?.competencia).toBe('2026-09');
  });

  it('sem número nem competência, devolve só o essencial', () => {
    expect(lerGuia('Documento de Arrecadação Estadual\nVencimento 05/11/2026\nValor Total 10,50')).toEqual({ guia: 'DAE', vencimento: '05/11/2026', valor: '10,50' });
  });

  it('sem vencimento ou sem valor, ou data impossível: null', () => {
    expect(lerGuia('Documento de Arrecadação do Simples Nacional\nValor Total do Documento 10,00')).toBeNull();
    expect(lerGuia('Documento de Arrecadação do Simples Nacional\nPagar este documento até 20/10/2026')).toBeNull();
    expect(lerGuia('Documento de Arrecadação do Simples Nacional\nPagar este documento até 31/02/2026\nValor Total do Documento 10,00')).toBeNull();
  });

  it('texto que não é DAS nem DAE: null', () => {
    expect(guiaDoTexto('Comprovante de pagamento\nValor 10,00')).toBeNull();
    expect(lerGuia('')).toBeNull();
  });
});
