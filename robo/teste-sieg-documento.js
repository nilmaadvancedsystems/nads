// Testes do documento do cliente que vai ao SIEG (normalizarDocumento em sieg.js). Rode:
//   NODE_PATH=C:\claudio\nads\robo\node_modules node teste-sieg-documento.js
// Caso real (23/10/2026): a contagem da madrugada recebeu HTTP 400 "CNPJ/CPF do Emitente inválido" dos clientes 555, 228, 226 e 179
// porque o cadastro tem 14 dígitos com dígito verificador errado e o robô só olhava o tamanho.
const { normalizarDocumento: n } = require('./sieg');

let falhas = 0, total = 0;
function igual(nome, obtido, esperado) {
  total++;
  if (obtido !== esperado) { falhas++; console.log('FALHOU  ' + nome + '\n        obtido:   ' + JSON.stringify(obtido) + '\n        esperado: ' + JSON.stringify(esperado)); }
}

// os quatro do print, como estão no cadastro: sem o enquadramento Física não vão ao SIEG
igual('555 (14 dígitos, DV errado)', n('42460727600569'), '');
igual('228', n('42460727600307'), '');
igual('226', n('42460727600216'), '');
igual('179', n('36932930600245'), '');
igual('Jurídica não deriva CPF', n('42460727600569', 'Jurídica'), '');
// com enquadramento Física (produtor rural), o CPF sai dos 9 primeiros dígitos (aprovado pelo Vitor em 23/10/2026)
igual('555 Física', n('42460727600569', 'Física'), '42460727615');
igual('228 Física', n('42460727600307', 'Física'), '42460727615');
igual('226 Física', n('42460727600216', 'física'), '42460727615');
igual('179 Física', n('36932930600245', 'Fisica'), '36932930668');
igual('CNPJ válido de Física continua CNPJ', n('11222333000181', 'Física'), '11222333000181');
igual('Física com 13 dígitos não deriva', n('4246072760056', 'Física'), '');

// CNPJ válido, com e sem máscara
igual('CNPJ com máscara', n('11.222.333/0001-81'), '11222333000181');
igual('CNPJ só dígitos', n('11222333000181'), '11222333000181');
igual('CNPJ com 1 dígito trocado', n('11222333000182'), '');
// CPF (produtor rural) vai com 11 dígitos
igual('CPF com máscara', n('529.982.247-25'), '52998224725');
igual('CPF só dígitos', n('52998224725'), '52998224725');
igual('CPF com DV errado', n('52998224726'), '');
// zeros à esquerda perdidos (número no lugar de texto)
igual('CPF com zero à esquerda perdido (texto)', n('5108042680'), '05108042680');
igual('CPF com zero à esquerda perdido (número)', n(5108042680), '05108042680');
igual('CNPJ com zero à esquerda perdido (número)', n(191000000100), '');
igual('CNPJ 00.360.305/0001-04 como número', n(360305000104), '00360305000104');
// vazios e lixo
igual('vazio', n(''), '');
igual('undefined', n(undefined), '');
igual('null', n(null), '');
igual('só letras', n('ISENTO'), '');
igual('tudo zero', n('00000000000'), '');
igual('dígitos repetidos', n('11111111111111'), '');
igual('tamanho 12', n('123456789012'), '');
igual('tamanho 15', n('112223330001811'), '');

console.log(total - falhas + '/' + total + ' ok' + (falhas ? ' - ' + falhas + ' falharam' : ''));
process.exit(falhas ? 1 : 0);
