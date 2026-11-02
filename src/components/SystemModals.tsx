import React, { useState } from 'react';
import {
  X,
  Download,
  Copy,
  Check,
  Cpu,
  HardDrive,
  Usb,
  ShieldCheck,
  ShieldAlert,
  Terminal,
  UserCheck,
  FolderOpen,
  Play,
} from 'lucide-react';
import { RegistryKeyNode } from '../types/registry';
import { getValueData } from '../data/initialRegistry';

interface RegExportModalProps {
  node: RegistryKeyNode | null;
  onClose: () => void;
}

export function generateRegFileContent(node: RegistryKeyNode): string {
  const lines: string[] = ['Windows Registry Editor Version 5.00', ''];

  function serializeNode(current: RegistryKeyNode) {
    if (current.path !== 'Equipo') {
      const cleanPath = current.path.replace(/^Equipo\\/, '');
      lines.push(`[${cleanPath}]`);
      for (const val of current.values) {
        if (val.isDefault && !val.data) continue;
        const namePart = val.isDefault ? '@' : `"${val.name.replace(/"/g, '\\"')}"`;
        if (val.type === 'REG_DWORD') {
          const num = parseInt(val.data, 10);
          const hex = (isNaN(num) ? 0 : num >>> 0).toString(16).padStart(8, '0');
          lines.push(`${namePart}=dword:${hex}`);
        } else if (val.type === 'REG_SZ') {
          const escaped = val.data.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          lines.push(`${namePart}="${escaped}"`);
        } else {
          const escaped = val.data.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          lines.push(`; Tipo ${val.type}`);
          lines.push(`${namePart}="${escaped}"`);
        }
      }
      lines.push('');
    }
    for (const child of current.children) {
      serializeNode(child);
    }
  }

  serializeNode(node);
  return lines.join('\r\n');
}

export const RegExportModal: React.FC<RegExportModalProps> = ({ node, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!node) return null;

  const regContent = generateRegFileContent(node);

  const handleCopy = () => {
    navigator.clipboard.writeText(regContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([regContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${node.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.reg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-md border border-slate-300 bg-white shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-sky-700" />
            <h3 className="text-xs font-semibold text-slate-800">
              Exportar archivo de Registro (.reg) — {node.name}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-500 hover:bg-red-600 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-xs text-slate-600">
            Así es como Windows serializa esta rama en un script <code className="font-mono text-slate-900">.reg</code> para automatizar despliegues o copias de seguridad:
          </p>

          <pre className="max-h-80 overflow-auto rounded border border-slate-200 bg-slate-950 p-3.5 text-xs font-mono text-emerald-400 leading-relaxed">
            {regContent}
          </pre>

          <div className="flex items-center justify-between pt-2 border-t border-slate-200">
            <span className="text-[11px] font-mono text-slate-500">
              Cabecera estándar: Windows Registry Editor Version 5.00
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copiado' : 'Copiar código .reg'}
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-sky-600 rounded hover:bg-sky-700 transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="h-3.5 w-3.5" />
                Descargar .reg
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface BootSimulatorModalProps {
  root: RegistryKeyNode;
  onClose: () => void;
  onNavigateToKey: (path: string) => void;
}

export const BootSimulatorModal: React.FC<BootSimulatorModalProps> = ({
  root,
  onClose,
  onNavigateToKey,
}) => {
  const [activeActionOutput, setActiveActionOutput] = useState<string | null>(null);

  const hiberboot =
    getValueData(
      root,
      'Equipo\\HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power',
      'HiberbootEnabled'
    ) ?? '1';
  const usbStart =
    getValueData(
      root,
      'Equipo\\HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\USBSTOR',
      'Start'
    ) ?? '3';
  const longPaths =
    getValueData(
      root,
      'Equipo\\HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\FileSystem',
      'LongPathsEnabled'
    ) ?? '0';
  const numLock =
    getValueData(
      root,
      'Equipo\\HKEY_USERS\\.DEFAULT\\Control Panel\\Keyboard',
      'InitialKeyboardIndicators'
    ) ?? '0';
  const programFilesDir =
    getValueData(
      root,
      'Equipo\\HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion',
      'ProgramFilesDir'
    ) ?? 'C:\\Program Files';
  const disableTaskMgr =
    getValueData(
      root,
      'Equipo\\HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System',
      'DisableTaskMgr'
    ) ?? '0';
  const hideFileExt =
    getValueData(
      root,
      'Equipo\\HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced',
      'HideFileExt'
    ) ?? '1';
  const minerVal = getValueData(
    root,
    'Equipo\\HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
    'CryptoMinerUpdater'
  );
  const enableLua =
    getValueData(
      root,
      'Equipo\\HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System',
      'EnableLUA'
    ) ?? '1';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-md border border-slate-300 bg-white shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 text-white px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Play className="h-4 w-4 text-sky-400" />
            <h3 className="text-sm font-semibold">
              Simulador de Secuencia de Arranque y Comportamiento de Windows en Vivo
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-red-600 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5">
          <p className="text-xs text-slate-600 leading-relaxed">
            Comprueba cómo Windows lee las colmenas del Registro desde que pulsas el botón de encendido hasta que el usuario inicia sesión. Haz clic en los botones de prueba inferior para verificar el efecto real de tus cambios:
          </p>

          {/* 4 Boot Stages */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Stage 1: Kernel & Power */}
            <div className="rounded border border-slate-200 bg-slate-50 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Cpu className="h-4 w-4 text-sky-600" />
                  1. Fase Kernel y Sistema de Archivos (HKLM\SYSTEM)
                </span>
                <span className="text-[11px] font-mono text-slate-500">Pre-Login</span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-slate-200/70">
                  <span className="text-slate-600">Modo de Inicio (HiberbootEnabled):</span>
                  <button
                    type="button"
                    onClick={() => {
                      onNavigateToKey('Equipo\\HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power');
                      onClose();
                    }}
                    className={`font-mono font-medium hover:underline ${
                      hiberboot === '0' ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {hiberboot === '0' ? '● 0 (Arranque Limpio / Dual-Boot OK)' : '▲ 1 (Inicio Rápido Híbrido)'}
                  </button>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-600">Rutas Largas NTFS (LongPathsEnabled):</span>
                  <span className={`font-mono font-medium ${longPaths === '1' ? 'text-emerald-700' : 'text-slate-700'}`}>
                    {longPaths === '1' ? '● 1 (Hasta 32.767 caracteres)' : '○ 0 (Límite 260 caracteres)'}
                  </span>
                </div>
              </div>
            </div>

            {/* Stage 2: Kernel Drivers & USBSTOR */}
            <div className="rounded border border-slate-200 bg-slate-50 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Usb className="h-4 w-4 text-sky-600" />
                  2. Controladores de Dispositivo (HKLM\...\Services)
                </span>
                <span className="text-[11px] font-mono text-slate-500">Ring 0</span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-slate-200/70">
                  <span className="text-slate-600">Driver USBSTOR.SYS (Start):</span>
                  <button
                    type="button"
                    onClick={() => {
                      onNavigateToKey('Equipo\\HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\USBSTOR');
                      onClose();
                    }}
                    className={`font-mono font-medium hover:underline ${
                      usbStart === '4' ? 'text-emerald-700' : 'text-sky-700'
                    }`}
                  >
                    {usbStart === '4' ? '● 4 (Pendrives Bloqueados DLP)' : `● ${usbStart} (Pendrives Permitidos)`}
                  </button>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-600">Bloq Num en Login (HKEY_USERS\.DEFAULT):</span>
                  <span className="font-mono font-medium text-slate-800">
                    {numLock === '2' ? '● 2 (Activado al encender)' : '○ 0 (Apagado en login)'}
                  </span>
                </div>
              </div>
            </div>

            {/* Stage 3: HKLM Global Software */}
            <div className="rounded border border-slate-200 bg-slate-50 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <HardDrive className="h-4 w-4 text-sky-600" />
                  3. Configuración Global (HKLM\SOFTWARE)
                </span>
                <span className="text-[11px] font-mono text-slate-500">Todos los usuarios</span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-slate-200/70">
                  <span className="text-slate-600">Ruta Instalación 64-bit:</span>
                  <code className="font-mono font-semibold text-slate-900">{programFilesDir}</code>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-600">Control Cuentas Usuario (EnableLUA):</span>
                  <span className={`font-mono font-medium ${enableLua === '1' ? 'text-emerald-700' : 'text-red-700'}`}>
                    {enableLua === '1' ? '● 1 (UAC Protegido)' : '▲ 0 (UAC Desactivado)'}
                  </span>
                </div>
              </div>
            </div>

            {/* Stage 4: HKCU User Session */}
            <div className="rounded border border-slate-200 bg-slate-50 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <UserCheck className="h-4 w-4 text-sky-600" />
                  4. Sesión del Usuario Activo (HKEY_CURRENT_USER)
                </span>
                <span className="text-[11px] font-mono text-slate-500">NTUSER.DAT</span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-slate-200/70">
                  <span className="text-slate-600">Estado de Inicio (HKCU\...\Run):</span>
                  {minerVal ? (
                    <span className="font-mono font-medium text-red-700 flex items-center gap-1">
                      <ShieldAlert className="h-3.5 w-3.5" /> ¡Malware miner_svc.exe activo!
                    </span>
                  ) : (
                    <span className="font-mono font-medium text-emerald-700 flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5" /> Inicio limpio sin malware
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-600">Administrador de Tareas:</span>
                  <span className={`font-mono font-medium ${disableTaskMgr === '1' ? 'text-red-700' : 'text-emerald-700'}`}>
                    {disableTaskMgr === '1' ? '▲ Bloqueado (DisableTaskMgr=1)' : '● Habilitado (DisableTaskMgr=0)'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive OS Action Sandbox */}
          <div className="rounded border border-slate-300 bg-slate-900 text-slate-100 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-sky-400">
                Banco de Pruebas del Sistema Operativo (Haz clic para probar tus ajustes del Registro)
              </span>
              <span className="text-[11px] font-mono text-slate-400">Respuesta en tiempo real</span>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  setActiveActionOutput(
                    usbStart === '4'
                      ? '🛑 [KERNEL USBSTOR.SYS]: Dispositivo USB detectado, pero el servicio tiene Start = 4 (Deshabilitado). Windows ha bloqueado el montaje de la unidad E:\\. Teclado y ratón USB siguen operativos.'
                      : `✅ [KERNEL USBSTOR.SYS]: El servicio tiene Start = ${usbStart}. Unidad de pendrive USB montada correctamente en E:\\ con acceso de lectura y escritura.`
                  )
                }
                className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-white rounded border border-slate-700 transition-colors whitespace-nowrap shrink-0"
              >
                Conectar Pendrive USB
              </button>

              <button
                type="button"
                onClick={() =>
                  setActiveActionOutput(
                    disableTaskMgr === '1'
                      ? '❌ [ERROR DE DIRECTIVA HKCU]: "El administrador ha deshabilitado el Administrador de tareas" (DisableTaskMgr = 1 en HKCU\\...\\Policies\\System).'
                      : '✅ [TASKMGR.EXE]: Administrador de Tareas abierto correctamente. Procesos visibles.'
                  )
                }
                className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-white rounded border border-slate-700 transition-colors whitespace-nowrap shrink-0"
              >
                Abrir Administrador de Tareas (Ctrl+Shift+Esc)
              </button>

              <button
                type="button"
                onClick={() =>
                  setActiveActionOutput(
                    hideFileExt === '1'
                      ? '⚠️ [EXPLORADOR DE ARCHIVOS]: Como HideFileExt = 1, el archivo malicioso se muestra en pantalla como "Nomina_Mayo.pdf" ocultando su verdadera extensión ".exe".'
                      : '✅ [EXPLORADOR DE ARCHIVOS]: Como HideFileExt = 0, el archivo revela su nombre completo "Nomina_Mayo.pdf.exe". ¡Intento de phishing detectado a simple vista!'
                  )
                }
                className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-white rounded border border-slate-700 transition-colors whitespace-nowrap shrink-0"
              >
                Inspeccionar archivo sospechoso en Explorador
              </button>

              <button
                type="button"
                onClick={() =>
                  setActiveActionOutput(
                    `📦 [WINDOWS INSTALLER .MSI]: Leyendo HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\ProgramFilesDir... Ruta sugerida por defecto en el asistente: "${programFilesDir}\\MiPrograma\\"`
                  )
                }
                className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-white rounded border border-slate-700 transition-colors whitespace-nowrap shrink-0"
              >
                Simular Instalador de Programa (64 bits)
              </button>
            </div>

            {activeActionOutput && (
              <div className="rounded bg-slate-950 border border-slate-800 p-3 text-xs font-mono text-sky-300 leading-relaxed">
                {activeActionOutput}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end border-t border-slate-200 bg-slate-50 px-4 py-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-white bg-slate-900 rounded hover:bg-slate-800 transition-colors"
          >
            Volver al Editor del Registro
          </button>
        </div>
      </div>
    </div>
  );
};
