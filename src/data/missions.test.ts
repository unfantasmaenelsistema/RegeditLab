import { describe, expect, it } from 'vitest';
import {
  DIDACTIC_MISSIONS,
  INITIAL_REGISTRY_TREE,
  findNodeByPath,
  getValueData,
  isFastStartupActive,
  isMinerActive,
} from './initialRegistry';
import { RegistryKeyNode } from '../types/registry';

const fresh = (): RegistryKeyNode => JSON.parse(JSON.stringify(INITIAL_REGISTRY_TREE));
const mission = (n: string) => DIDACTIC_MISSIONS.find((m) => m.number === n)!;

function setValue(root: RegistryKeyNode, path: string, name: string, data: string) {
  const val = findNodeByPath(root, path)!.values.find((v) => v.name === name)!;
  val.data = data;
}

function removeValue(root: RegistryKeyNode, path: string, name: string) {
  const node = findNodeByPath(root, path)!;
  node.values = node.values.filter((v) => v.name !== name);
}

const HKCU_RUN = 'Equipo\\HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
const HKLM_RUN = 'Equipo\\HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run';
const POWER = 'Equipo\\HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power';

describe('casos prácticos', () => {
  it('ningún caso está resuelto en el registro de fábrica', () => {
    const root = fresh();
    for (const m of DIDACTIC_MISSIONS) expect(m.checkCompleted(root), m.number).toBe(false);
  });

  it('cada caso apunta a una clave y un valor que existen', () => {
    const root = fresh();
    for (const m of DIDACTIC_MISSIONS) {
      expect(getValueData(root, m.targetPath, m.targetValueName), m.number).toBeDefined();
    }
  });

  it('las soluciones de las pistas resuelven los 7 casos en una misma sesión', () => {
    const root = fresh();
    setValue(root, POWER, 'HiberbootEnabled', '0');
    removeValue(root, HKCU_RUN, 'CryptoMinerUpdater');
    setValue(root, 'Equipo\\HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\USBSTOR', 'Start', '4');
    setValue(root, 'Equipo\\HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion', 'ProgramFilesDir', 'D:\\Programas');
    setValue(root, 'Equipo\\HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System', 'DisableTaskMgr', '0');
    setValue(root, 'Equipo\\HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced', 'HideFileExt', '0');
    setValue(root, 'Equipo\\HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\FileSystem', 'LongPathsEnabled', '1');
    setValue(root, 'Equipo\\HKEY_USERS\\.DEFAULT\\Control Panel\\Keyboard', 'InitialKeyboardIndicators', '2');
    for (const m of DIDACTIC_MISSIONS) expect(m.checkCompleted(root), m.number).toBe(true);
  });

  it('caso 01: desactivar la hibernación entera también apaga el Inicio Rápido', () => {
    const root = fresh();
    expect(isFastStartupActive(root)).toBe(true);
    setValue(root, 'Equipo\\HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Power', 'HibernateEnabled', '0');
    expect(mission('01').checkCompleted(root)).toBe(true);
  });

  it('caso 01: HibernateEnabled ya no está en Session Manager\\Power', () => {
    expect(getValueData(fresh(), POWER, 'HibernateEnabled')).toBeUndefined();
  });

  it('caso 02: renombrar el valor del minero NO lo neutraliza', () => {
    const root = fresh();
    findNodeByPath(root, HKCU_RUN)!.values.find((v) => v.name === 'CryptoMinerUpdater')!.name = 'WindowsUpdate';
    expect(isMinerActive(root)).toBe(true);
    expect(mission('02').checkCompleted(root)).toBe(false);
  });

  it('caso 02: moverlo a HKLM\\...\\Run tampoco, y vaciar su ruta sí', () => {
    const root = fresh();
    const miner = findNodeByPath(root, HKCU_RUN)!.values.find((v) => v.name === 'CryptoMinerUpdater')!;
    removeValue(root, HKCU_RUN, 'CryptoMinerUpdater');
    findNodeByPath(root, HKLM_RUN)!.values.push({ ...miner, id: 'movido' });
    expect(mission('02').checkCompleted(root)).toBe(false);

    const root2 = fresh();
    setValue(root2, HKCU_RUN, 'CryptoMinerUpdater', '');
    expect(mission('02').checkCompleted(root2)).toBe(true);
  });

  it('caso 02: borrar también SecurityHealth deja el caso sin resolver', () => {
    const root = fresh();
    removeValue(root, HKCU_RUN, 'CryptoMinerUpdater');
    removeValue(root, HKLM_RUN, 'SecurityHealth');
    expect(mission('02').checkCompleted(root)).toBe(false);
  });

  it('caso 04 tolera la barra final en la ruta', () => {
    const root = fresh();
    setValue(root, 'Equipo\\HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion', 'ProgramFilesDir', 'D:\\Programas\\');
    expect(mission('04').checkCompleted(root)).toBe(true);
  });

  it('caso 05: eliminar DisableTaskMgr también lo resuelve; un 2 sigue bloqueando', () => {
    const path = 'Equipo\\HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System';
    const root = fresh();
    removeValue(root, path, 'DisableTaskMgr');
    expect(mission('05').checkCompleted(root)).toBe(true);
    const root2 = fresh();
    setValue(root2, path, 'DisableTaskMgr', '2');
    expect(mission('05').checkCompleted(root2)).toBe(false);
  });

  it('caso 07 necesita las dos ramas', () => {
    const root = fresh();
    setValue(root, 'Equipo\\HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\FileSystem', 'LongPathsEnabled', '1');
    expect(mission('07').checkCompleted(root)).toBe(false);
  });
});
