import React from 'react';
import {
  ArrowRight,
  HardDrive,
  User,
  Shield,
  Layers,
  Binary,
  FileCode2,
  FolderGit2,
} from 'lucide-react';

interface DidacticReferenceProps {
  onJumpToPath: (path: string) => void;
}

export const HklmVsHkcuComparator: React.FC<DidacticReferenceProps> = ({ onJumpToPath }) => {
  const mirrorPairs = [
    {
      topic: 'Programas en el Inicio Automático (Run)',
      hklmPath: 'Equipo\\HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run',
      hkcuPath: 'Equipo\\HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
      rule: 'Se ejecutan AMBAS listas: primero HKLM (para cualquier usuario que entre al PC) y después HKCU (solo para el usuario activo).',
      securityNote:
        'Un usuario estándar sin permisos de Administrador no puede escribir en HKLM\\...\\Run, por lo que el malware de usuario suele ocultarse en HKCU\\...\\Run.',
    },
    {
      topic: 'Directivas y Restricciones del Sistema (Policies\\System)',
      hklmPath: 'Equipo\\HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System',
      hkcuPath: 'Equipo\\HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System',
      rule: 'En Directivas (Policies), HKLM SIEMPRE gana en caso de conflicto sobre HKCU, ya que las políticas de seguridad de la máquina prevalecen sobre el usuario.',
      securityNote:
        'Control de Cuentas de Usuario (EnableLUA) vive en HKLM, mientras que bloqueos por cuenta como DisableTaskMgr suelen aplicarse en HKCU.',
    },
    {
      topic: 'Configuración General de Software (CurrentVersion)',
      hklmPath: 'Equipo\\HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion',
      hkcuPath: 'Equipo\\HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion',
      rule: 'En preferencias de aplicaciones (idioma, tema visual, barra de tareas), HKCU sobreescribe los valores predeterminados de HKLM para esa sesión.',
      securityNote:
        'Rutas globales como ProgramFilesDir viven exclusivamente en HKLM porque la carpeta C:\\Program Files es compartida por todo el sistema.',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          Arquitectura y Jerarquía: HKEY_LOCAL_MACHINE frente a HKEY_CURRENT_USER
        </h2>
        <p className="mt-1 text-sm text-slate-600 max-w-3xl">
          Comprender qué clave modificar depende de una pregunta fundamental en administración de sistemas: ¿el ajuste debe aplicarse al hardware/arranque y a todos los usuarios del equipo, o únicamente a la sesión del usuario activo?
        </p>
      </div>

      {/* Side-by-side comparison grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* HKLM */}
        <div className="rounded-md border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
            <div>
              <span className="text-xs font-mono font-semibold text-sky-700">
                Ámbito Global · Nivel de Máquina y Kernel
              </span>
              <h3 className="text-lg font-bold text-slate-900 font-mono mt-0.5">
                HKEY_LOCAL_MACHINE (HKLM)
              </h3>
            </div>
            <HardDrive className="h-5 w-5 text-sky-600 shrink-0" />
          </div>

          <div className="space-y-2.5 text-xs text-slate-700 leading-relaxed">
            <p>
              <strong className="text-slate-900">Alcance:</strong> Afecta a todo el ordenador, al arranque del sistema operativo, controladores (<code className="font-mono">.sys</code>), servicios y a <strong>todos los usuarios</strong> que inicien sesión.
            </p>
            <p>
              <strong className="text-slate-900">Archivos físicos en disco (Hives):</strong> Se almacena en <code className="font-mono text-slate-900">C:\Windows\System32\config\</code> dividido en los archivos binarios <code className="font-mono">SYSTEM</code>, <code className="font-mono">SOFTWARE</code>, <code className="font-mono">SAM</code> y <code className="font-mono">SECURITY</code>. (La subclave <code className="font-mono">HARDWARE</code> se crea dinámicamente en RAM en cada encendido).
            </p>
            <p>
              <strong className="text-slate-900">Permisos requeridos:</strong> Lectura para usuarios estándar; <strong>Escritura restringida a Administradores y SYSTEM</strong> (requiere elevación UAC).
            </p>
            <p>
              <strong className="text-slate-900">Casos típicos:</strong> Desactivar Inicio Rápido (<code className="font-mono">HiberbootEnabled</code>), deshabilitar puertos USB (<code className="font-mono">USBSTOR</code>), cambiar <code className="font-mono">ProgramFilesDir</code> o habilitar rutas largas NTFS.
            </p>
          </div>
        </div>

        {/* HKCU */}
        <div className="rounded-md border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
            <div>
              <span className="text-xs font-mono font-semibold text-emerald-700">
                Ámbito de Sesión · Perfil Individual
              </span>
              <h3 className="text-lg font-bold text-slate-900 font-mono mt-0.5">
                HKEY_CURRENT_USER (HKCU)
              </h3>
            </div>
            <User className="h-5 w-5 text-emerald-600 shrink-0" />
          </div>

          <div className="space-y-2.5 text-xs text-slate-700 leading-relaxed">
            <p>
              <strong className="text-slate-900">Alcance:</strong> Afecta exclusivamente al usuario que tiene la sesión iniciada en este momento. Otros usuarios del mismo PC no verán estos cambios.
            </p>
            <p>
              <strong className="text-slate-900">Archivo físico en disco (Hive):</strong> Se guarda dentro de la carpeta personal del usuario en <code className="font-mono text-slate-900">C:\Users\&lt;NombreUsuario&gt;\NTUSER.DAT</code> (archivo oculto del sistema). Realmente es un enlace simbólico a <code className="font-mono">HKEY_USERS\&lt;SID-del-Usuario&gt;</code>.
            </p>
            <p>
              <strong className="text-slate-900">Permisos requeridos:</strong> El propio usuario tiene permiso de lectura y escritura sobre su árbol <code className="font-mono">HKCU</code> (excepto dentro de la subclave <code className="font-mono">Policies</code> gestionada por el administrador).
            </p>
            <p>
              <strong className="text-slate-900">Casos típicos:</strong> Mostrar extensiones de archivo (<code className="font-mono">HideFileExt</code>), fondo de pantalla, ratón para zurdos, variables <code className="font-mono">%TEMP%</code> y programas de autoarranque de usuario.
            </p>
          </div>
        </div>
      </div>

      {/* Mirror paths & precedence rules */}
      <div className="rounded-md border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-sky-600" />
          <h3 className="text-sm font-bold text-slate-900">
            Claves Espejo y Reglas de Precedencia (¿Cuál gana cuando existen en ambos sitios?)
          </h3>
        </div>

        <div className="divide-y divide-slate-200">
          {mirrorPairs.map((pair) => (
            <div key={pair.topic} className="py-3.5 first:pt-1 last:pb-1 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-bold text-slate-900">{pair.topic}</h4>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onJumpToPath(pair.hklmPath)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 rounded border border-sky-200 transition-colors"
                  >
                    Abrir en HKLM <ArrowRight className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onJumpToPath(pair.hkcuPath)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 transition-colors"
                  >
                    Abrir en HKCU <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-700">{pair.rule}</p>
              <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span>{pair.securityNote}</span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const RegistryTypesAndHivesGuide: React.FC<DidacticReferenceProps> = ({ onJumpToPath }) => {
  const dataTypes = [
    {
      type: 'REG_SZ',
      name: 'Valor de cadena (String)',
      format: 'Cadena de texto (UTF-16) terminada en nulo',
      example: 'C:\\Program Files',
      usage: 'Rutas de archivos, nombres de programas, descripciones y parámetros de texto.',
    },
    {
      type: 'REG_DWORD',
      name: 'Valor DWORD (32 bits)',
      format: 'Entero sin signo de 32 bits (0 a 4.294.967.295)',
      example: '0x00000001 (1)',
      usage: 'Interruptores booleanos (0 = Desactivado, 1 = Activado), modos de inicio de servicios (Start = 2, 3, 4) y contadores.',
    },
    {
      type: 'REG_EXPAND_SZ',
      name: 'Valor de cadena expandible',
      format: 'Texto con variables de entorno dinámicas (%VAR%)',
      example: '%windir%\\system32\\SecurityHealthSystray.exe',
      usage: 'Rutas que Windows resuelve dinámicamente según el usuario o unidad (ej. %USERPROFILE%, %SystemRoot%).',
    },
    {
      type: 'REG_QWORD',
      name: 'Valor QWORD (64 bits)',
      format: 'Entero sin signo de 64 bits (hasta 18.446.744.073.709.551.615)',
      example: '0x100000000 (4294967296)',
      usage: 'Tamaños grandes de memoria, marcas de tiempo de 64 bits y direcciones de hardware.',
    },
    {
      type: 'REG_MULTI_SZ',
      name: 'Valor de cadena múltiple',
      format: 'Lista de cadenas separadas por saltos de línea',
      example: 'Dependencia1\\nDependencia2',
      usage: 'Listas de servicios requeridos, múltiples rutas de búsqueda o servidores DNS.',
    },
    {
      type: 'REG_BINARY',
      name: 'Valor binario',
      format: 'Bytes crudos en representación hexadecimal',
      example: '00 01 00 05 A4 FF',
      usage: 'Datos de configuración de hardware, posiciones de ventanas y certificados.',
    },
  ];

  const keyBookmarks = [
    {
      title: 'Inicio Rápido y Energía del Kernel',
      path: 'Equipo\\HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power',
      value: 'HiberbootEnabled (0 = Apagado real, 1 = Inicio rápido)',
    },
    {
      title: 'Controlador de Almacenamiento Masivo USB',
      path: 'Equipo\\HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\USBSTOR',
      value: 'Start (3 = Habilitado manual, 4 = Bloqueado)',
    },
    {
      title: 'Rutas de Instalación por Defecto',
      path: 'Equipo\\HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion',
      value: 'ProgramFilesDir y ProgramFilesDir (x86)',
    },
    {
      title: 'Autoarranque de Programas (Global vs Usuario)',
      path: 'Equipo\\HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
      value: 'Lista de ejecutables al iniciar sesión',
    },
    {
      title: 'Visibilidad de Extensiones en el Explorador',
      path: 'Equipo\\HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced',
      value: 'HideFileExt (0 = Mostrar extensiones, 1 = Ocultar)',
    },
    {
      title: 'Bloqueo de Administrador de Tareas y Regedit',
      path: 'Equipo\\HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System',
      value: 'DisableTaskMgr y DisableRegistryTools',
    },
    {
      title: 'Rutas Largas NTFS (> 260 caracteres)',
      path: 'Equipo\\HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\FileSystem',
      value: 'LongPathsEnabled (1 = Habilitado)',
    },
    {
      title: 'Información de BIOS y Procesador en RAM',
      path: 'Equipo\\HKEY_LOCAL_MACHINE\\HARDWARE\\DESCRIPTION\\System\\BIOS',
      value: 'BIOSVersion, SystemProductName',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          Guía de Tipos de Datos del Registro y Diccionario de Claves Esenciales
        </h2>
        <p className="mt-1 text-sm text-slate-600 max-w-3xl">
          Referencia rápida de los tipos de valores que maneja <code className="font-mono">regedit.exe</code> y acceso directo a las claves más importantes para resolución de problemas en Windows.
        </p>
      </div>

      {/* Data types table */}
      <div className="rounded-md border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 flex items-center gap-2">
          <Binary className="h-4 w-4 text-sky-600" />
          <h3 className="text-xs font-bold text-slate-900">
            Tipos de Datos Estándar en el Registro de Windows
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/60 text-slate-600 font-semibold">
                <th className="py-2.5 px-4">Identificador</th>
                <th className="py-2.5 px-4">Nombre en Regedit</th>
                <th className="py-2.5 px-4">Ejemplo de Dato</th>
                <th className="py-2.5 px-4">Uso Principal en Administración</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {dataTypes.map((dt) => (
                <tr key={dt.type} className="hover:bg-slate-50">
                  <td className="py-2.5 px-4 font-mono font-semibold text-sky-700 whitespace-nowrap">
                    {dt.type}
                  </td>
                  <td className="py-2.5 px-4 font-medium text-slate-900 whitespace-nowrap">
                    {dt.name}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-slate-700 whitespace-nowrap">
                    {dt.example}
                  </td>
                  <td className="py-2.5 px-4 text-slate-600">{dt.usage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Essential Keys Dictionary */}
      <div className="rounded-md border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex items-center gap-2">
          <FolderGit2 className="h-4 w-4 text-sky-600" />
          <h3 className="text-sm font-bold text-slate-900">
            Mapa de Claves Esenciales de Examen y Laboratorio (Haz clic para abrir en el Simulador)
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {keyBookmarks.map((bm) => (
            <div
              key={bm.path}
              className="rounded border border-slate-200 p-3.5 hover:border-sky-300 transition-colors flex flex-col justify-between gap-2 bg-slate-50/50"
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-slate-900">{bm.title}</h4>
                  <FileCode2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                </div>
                <p className="text-[11px] font-mono text-slate-600 break-all">{bm.path}</p>
                <p className="text-xs text-slate-700 font-medium pt-0.5">Valor clave: {bm.value}</p>
              </div>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => onJumpToPath(bm.path)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:text-sky-800 hover:underline"
                >
                  Inspeccionar clave en Regedit <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
