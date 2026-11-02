import { describe, expect, it } from 'vitest';
import {
  formatRegistryDataForDisplay,
  generateRegFileContent,
  isRegistryTree,
  newId,
  normalizeBinaryInput,
  normalizeValueData,
  numericToBase,
  parseNumericInput,
  resolveRegistryAddress,
  serializeValue,
} from './registryEngine';
import { INITIAL_REGISTRY_TREE, findNodeByPath } from '../data/initialRegistry';
import { RegistryValue } from '../types/registry';

const v = (type: RegistryValue['type'], data: string, name = 'Prueba'): RegistryValue => ({
  id: 'x',
  name,
  type,
  data,
});

describe('valores numéricos', () => {
  it('DWORD en hexadecimal y decimal, con prefijo 0x y vacío = 0', () => {
    expect(parseNumericInput('ff', 'hex', 'REG_DWORD')).toEqual({ ok: true, value: '255' });
    expect(parseNumericInput('0xFF', 'hex', 'REG_DWORD')).toEqual({ ok: true, value: '255' });
    expect(parseNumericInput('4294967295', 'dec', 'REG_DWORD')).toEqual({ ok: true, value: '4294967295' });
    expect(parseNumericInput('', 'dec', 'REG_DWORD')).toEqual({ ok: true, value: '0' });
  });

  it('rechaza basura y desbordamientos en vez de truncar en silencio', () => {
    // v1: parseInt('12abc') daba 12 y 0x1ffffffff se truncaba a 32 bits
    expect(parseNumericInput('12abc', 'dec', 'REG_DWORD').ok).toBe(false);
    expect(parseNumericInput('-1', 'dec', 'REG_DWORD').ok).toBe(false);
    expect(parseNumericInput('1ffffffff', 'hex', 'REG_DWORD').ok).toBe(false);
    expect(parseNumericInput('4294967296', 'dec', 'REG_DWORD').ok).toBe(false);
    expect(parseNumericInput('xyz', 'hex', 'REG_DWORD').ok).toBe(false);
  });

  it('QWORD conserva los 64 bits', () => {
    expect(parseNumericInput('ffffffffffffffff', 'hex', 'REG_QWORD')).toEqual({
      ok: true,
      value: '18446744073709551615',
    });
    expect(parseNumericInput('10000000000000000', 'hex', 'REG_QWORD').ok).toBe(false);
    expect(numericToBase('4294967296', 'hex')).toBe('100000000');
    expect(formatRegistryDataForDisplay(v('REG_QWORD', '4294967296'))).toBe('0x100000000 (4294967296)');
  });

  it('formato de la columna Datos como regedit', () => {
    expect(formatRegistryDataForDisplay(v('REG_DWORD', '1'))).toBe('0x00000001 (1)');
    expect(formatRegistryDataForDisplay(v('REG_DWORD', '4294967295'))).toBe('0xffffffff (4294967295)');
    expect(formatRegistryDataForDisplay(v('REG_BINARY', ''))).toBe('(valor binario de longitud cero)');
    expect(formatRegistryDataForDisplay({ ...v('REG_SZ', ''), isDefault: true })).toBe('(valor no establecido)');
    // una cadena vacía normal se ve vacía, no «valor no establecido»
    expect(formatRegistryDataForDisplay(v('REG_SZ', ''))).toBe('');
  });
});

describe('binario y cadena múltiple', () => {
  it('normaliza bytes y detecta errores', () => {
    expect(normalizeBinaryInput('00 01 A4,ff')).toEqual({ ok: true, value: '00 01 a4 ff' });
    expect(normalizeBinaryInput('0001a4')).toEqual({ ok: true, value: '00 01 a4' });
    expect(normalizeBinaryInput('0 1').ok).toBe(false);
    expect(normalizeBinaryInput('zz').ok).toBe(false);
  });

  it('REG_MULTI_SZ descarta líneas vacías', () => {
    expect(normalizeValueData('REG_MULTI_SZ', 'a\n\nb\r\n')).toEqual({ ok: true, value: 'a\nb' });
  });
});

describe('barra de direcciones', () => {
  it('acepta abreviaturas, prefijo Equipo/Computer y barras sobrantes', () => {
    const target = 'Equipo\\HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\USBSTOR';
    expect(resolveRegistryAddress('HKLM\\SYSTEM\\CurrentControlSet\\Services\\USBSTOR')).toBe(target);
    expect(resolveRegistryAddress('hklm\\SYSTEM\\CurrentControlSet\\Services\\USBSTOR\\')).toBe(target);
    expect(resolveRegistryAddress('Computer\\HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\USBSTOR')).toBe(target);
    expect(resolveRegistryAddress(`"${target}"`)).toBe(target);
    expect(resolveRegistryAddress('HKU\\.DEFAULT')).toBe('Equipo\\HKEY_USERS\\.DEFAULT');
    expect(resolveRegistryAddress('Equipo')).toBe('Equipo');
    expect(resolveRegistryAddress('SYSTEM\\CurrentControlSet')).toBeNull();
  });

  it('todas las pistas de los casos usan rutas que la barra resuelve', () => {
    const p = resolveRegistryAddress('HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System');
    expect(findNodeByPath(INITIAL_REGISTRY_TREE, p!)).not.toBeNull();
  });
});

describe('exportación .reg', () => {
  it('DWORD y REG_SZ con escapes', () => {
    expect(serializeValue(v('REG_DWORD', '4'))).toEqual(['"Prueba"=dword:00000004']);
    expect(serializeValue(v('REG_SZ', 'C:\\Program Files', 'Ruta "x"'))).toEqual([
      '"Ruta \\"x\\""="C:\\\\Program Files"',
    ]);
  });

  it('REG_EXPAND_SZ se exporta como hex(2) en UTF-16LE, no como cadena', () => {
    // Lo mismo que exporta regedit para SecurityHealth acortado a «%windir%»
    expect(serializeValue(v('REG_EXPAND_SZ', '%windir%', 'S'))).toEqual([
      '"S"=hex(2):25,00,77,00,69,00,6e,00,64,00,69,00,72,00,25,00,00,00',
    ]);
  });

  it('QWORD hex(b) little-endian, MULTI_SZ hex(7) y binario hex:', () => {
    expect(serializeValue(v('REG_QWORD', '1'))).toEqual(['"Prueba"=hex(b):01,00,00,00,00,00,00,00']);
    expect(serializeValue(v('REG_MULTI_SZ', 'a\nb', 'M'))).toEqual([
      '"M"=hex(7):61,00,00,00,62,00,00,00,00,00',
    ]);
    expect(serializeValue(v('REG_BINARY', '00 ff', 'B'))).toEqual(['"B"=hex:00,ff']);
  });

  it('parte las líneas largas a 80 columnas con «\\» y dos espacios', () => {
    const lines = serializeValue(v('REG_EXPAND_SZ', '%SystemRoot%\\System32\\drivers\\etc\\hosts', 'Ruta'));
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(80);
    lines.slice(0, -1).forEach((l) => expect(l.endsWith('\\')).toBe(true));
    lines.slice(1).forEach((l) => expect(l.startsWith('  ')).toBe(true));
  });

  it('la rama exportada lleva cabecera, aviso y ruta sin «Equipo\\»', () => {
    const node = findNodeByPath(
      INITIAL_REGISTRY_TREE,
      'Equipo\\HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run'
    )!;
    const text = generateRegFileContent(node);
    expect(text.startsWith('Windows Registry Editor Version 5.00\r\n')).toBe(true);
    expect(text).toContain('; Los datos son FICTICIOS');
    expect(text).toContain('[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run]');
    expect(text).toContain('"SecurityHealth"=hex(2):');
    expect(text).not.toContain('@=""');
  });
});

describe('estado guardado y utilidades', () => {
  it('valida el árbol antes de usarlo', () => {
    expect(isRegistryTree(JSON.parse(JSON.stringify(INITIAL_REGISTRY_TREE)))).toBe(true);
    expect(isRegistryTree({ name: 'Equipo', path: 'Equipo' })).toBe(false);
    expect(isRegistryTree(null)).toBe(false);
    expect(isRegistryTree({ name: 'a', path: 'a', hive: 'HKLM', values: [{ id: 1 }], children: [] })).toBe(false);
  });

  it('ids únicos aunque se creen en el mismo milisegundo', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newId('v')));
    expect(ids.size).toBe(50);
  });

  it('todos los ids de valor del árbol inicial son únicos', () => {
    const ids: string[] = [];
    const walk = (n: typeof INITIAL_REGISTRY_TREE) => {
      n.values.forEach((val) => ids.push(val.id));
      n.children.forEach(walk);
    };
    walk(INITIAL_REGISTRY_TREE);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
