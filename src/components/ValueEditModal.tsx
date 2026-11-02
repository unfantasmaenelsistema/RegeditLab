import React, { useState, useEffect } from 'react';
import { X, HelpCircle, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { RegistryValue, RegistryValueType } from '../types/registry';

interface ValueEditModalProps {
  value: RegistryValue | null;
  keyPath: string;
  onClose: () => void;
  onSave: (valueId: string, newData: string, newName?: string) => void;
}

export const ValueEditModal: React.FC<ValueEditModalProps> = ({
  value,
  keyPath,
  onClose,
  onSave,
}) => {
  const [base, setBase] = useState<'hex' | 'dec'>('dec');
  const [inputText, setInputText] = useState('');
  const [nameText, setNameText] = useState('');

  useEffect(() => {
    if (!value) return;
    setNameText(value.name);
    if (value.type === 'REG_DWORD' || value.type === 'REG_QWORD') {
      setBase('dec');
      setInputText(value.data || '0');
    } else {
      setInputText(value.data);
    }
  }, [value]);

  if (!value) return null;

  const isNumeric = value.type === 'REG_DWORD' || value.type === 'REG_QWORD';

  const handleBaseChange = (newBase: 'hex' | 'dec') => {
    if (newBase === base) return;
    if (newBase === 'hex') {
      const decNum = parseInt(inputText, 10);
      setInputText(isNaN(decNum) ? '0' : (decNum >>> 0).toString(16));
    } else {
      const hexNum = parseInt(inputText, 16);
      setInputText(isNaN(hexNum) ? '0' : String(hexNum >>> 0));
    }
    setBase(newBase);
  };

  const getDecimalString = (): string => {
    if (!isNumeric) return inputText;
    const parsed = parseInt(inputText, base === 'hex' ? 16 : 10);
    return isNaN(parsed) ? '0' : String(parsed >>> 0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(value.id, getDecimalString(), value.isDefault ? undefined : nameText.trim() || value.name);
    onClose();
  };

  const dialogTitle = (() => {
    switch (value.type) {
      case 'REG_DWORD':
        return 'Editar valor DWORD (32 bits)';
      case 'REG_QWORD':
        return 'Editar valor QWORD (64 bits)';
      case 'REG_MULTI_SZ':
        return 'Editar cadena múltiple';
      case 'REG_BINARY':
        return 'Editar valor binario';
      case 'REG_EXPAND_SZ':
        return 'Editar cadena expandible';
      default:
        return 'Editar cadena';
    }
  })();

  const currentDecValue = getDecimalString();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-md border border-slate-300 bg-white shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Windows Native Title Bar */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-3.5 py-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-sky-700">
              {isNumeric ? '010' : 'ab'}
            </span>
            <h3 className="text-xs font-semibold text-slate-800">{dialogTitle}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-500 hover:bg-red-600 hover:text-white transition-colors"
            aria-label="Cerrar ventana"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="text-[11px] font-mono text-slate-500 truncate bg-slate-50 px-2.5 py-1.5 rounded border border-slate-200">
            {keyPath}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Nombre del valor:
            </label>
            <input
              type="text"
              value={nameText}
              disabled={value.isDefault}
              onChange={(e) => setNameText(e.target.value)}
              className="w-full rounded border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-mono text-slate-800 disabled:text-slate-500 focus:border-sky-600 focus:bg-white focus:outline-none"
            />
          </div>

          <div className={isNumeric ? 'grid grid-cols-1 sm:grid-cols-12 gap-4 items-start' : ''}>
            <div className={isNumeric ? 'sm:col-span-7' : ''}>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Información del valor:
              </label>
              {value.type === 'REG_MULTI_SZ' ? (
                <textarea
                  rows={3}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  autoFocus
                  className="w-full rounded border border-sky-600 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              ) : (
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  autoFocus
                  className="w-full rounded border border-sky-600 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              )}
              {isNumeric && (
                <p className="mt-1 text-[11px] font-mono text-slate-500 tabular-nums">
                  Equivalente: 0x{(parseInt(currentDecValue, 10) >>> 0).toString(16).padStart(8, '0')} ({currentDecValue})
                </p>
              )}
            </div>

            {isNumeric && (
              <fieldset className="sm:col-span-5 rounded border border-slate-200 p-2.5 bg-slate-50/60">
                <legend className="px-1 text-[11px] font-medium text-slate-600">Base</legend>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="base"
                      checked={base === 'hex'}
                      onChange={() => handleBaseChange('hex')}
                      className="text-sky-600 focus:ring-sky-500"
                    />
                    <span>Hexadecimal</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="base"
                      checked={base === 'dec'}
                      onChange={() => handleBaseChange('dec')}
                      className="text-sky-600 focus:ring-sky-500"
                    />
                    <span>Decimal</span>
                  </label>
                </div>
              </fieldset>
            )}
          </div>

          {/* Didactic Guide inside modal */}
          {value.description && (
            <div className="rounded border border-slate-200 bg-slate-50 p-3 space-y-2.5">
              <div className="flex items-start gap-2">
                <HelpCircle className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-700 leading-relaxed">
                  <span className="font-semibold text-slate-900">Función en Windows: </span>
                  {value.description}
                </div>
              </div>

              {value.allowedGuide && value.allowedGuide.length > 0 && (
                <div className="space-y-1.5 pt-1 border-t border-slate-200/80">
                  <p className="text-[11px] font-semibold text-slate-600">
                    Valores admitidos (haz clic para aplicar rápidamente):
                  </p>
                  <div className="space-y-1">
                    {value.allowedGuide.map((opt) => {
                      const isSelected = currentDecValue === opt.value || inputText === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            if (isNumeric && base === 'hex') {
                              setInputText(parseInt(opt.value, 10).toString(16));
                            } else {
                              setInputText(opt.value);
                            }
                          }}
                          className={`w-full text-left flex items-center justify-between gap-2 rounded px-2.5 py-1.5 text-xs transition-colors border ${
                            isSelected
                              ? 'border-sky-600 bg-sky-50/90 text-slate-900 font-medium'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <code className="font-mono font-semibold text-sky-700 shrink-0">
                              {opt.value}
                            </code>
                            <span className="truncate">{opt.label}</span>
                          </div>
                          <span className="shrink-0 flex items-center gap-1 text-[11px] font-medium">
                            {opt.impact === 'nominal' && (
                              <span className="text-emerald-700 flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Seguro
                              </span>
                            )}
                            {opt.impact === 'warning' && (
                              <span className="text-amber-700 flex items-center gap-1">
                                <AlertTriangle className="h-3.5 w-3.5" /> Precaución
                              </span>
                            )}
                            {opt.impact === 'danger' && (
                              <span className="text-red-700 flex items-center gap-1">
                                <ShieldAlert className="h-3.5 w-3.5" /> Riesgo
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-medium text-white bg-sky-600 rounded hover:bg-sky-700 transition-colors whitespace-nowrap shrink-0"
            >
              Aceptar
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface CreateItemModalProps {
  mode: 'key' | 'value' | null;
  initialValueType?: RegistryValueType;
  keyPath: string;
  onClose: () => void;
  onCreateKey: (keyName: string, description: string) => void;
  onCreateValue: (name: string, type: RegistryValueType, data: string, description: string) => void;
}

export const CreateItemModal: React.FC<CreateItemModalProps> = ({
  mode,
  initialValueType = 'REG_DWORD',
  keyPath,
  onClose,
  onCreateKey,
  onCreateValue,
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<RegistryValueType>(initialValueType);
  const [data, setData] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    setType(initialValueType);
    setName('');
    setData(initialValueType === 'REG_DWORD' || initialValueType === 'REG_QWORD' ? '0' : '');
    setDescription('');
  }, [mode, initialValueType]);

  if (!mode) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (mode === 'key') {
      onCreateKey(name.trim(), description.trim() || 'Subclave creada por el administrador en el simulador.');
    } else {
      onCreateValue(
        name.trim(),
        type,
        data,
        description.trim() || `Valor ${type} personalizado creado por el alumno.`
      );
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-md border border-slate-300 bg-white shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-3.5 py-2">
          <h3 className="text-xs font-semibold text-slate-800">
            {mode === 'key' ? 'Nueva Clave del Registro' : 'Nuevo Valor del Registro'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-500 hover:bg-red-600 hover:text-white transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3.5">
          <div className="text-[11px] font-mono text-slate-500 truncate bg-slate-50 px-2.5 py-1.5 rounded border border-slate-200">
            Ubicación: {keyPath}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {mode === 'key' ? 'Nombre de la nueva subclave:' : 'Nombre del nuevo valor:'}
            </label>
            <input
              type="text"
              required
              placeholder={mode === 'key' ? 'Ej: MiAplicacion' : 'Ej: NoAutoUpdate'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs font-mono text-slate-900 focus:border-sky-600 focus:outline-none"
            />
          </div>

          {mode === 'value' && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Tipo de dato:
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as RegistryValueType)}
                  className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-900 focus:border-sky-600 focus:outline-none"
                >
                  <option value="REG_SZ">REG_SZ (Valor de cadena)</option>
                  <option value="REG_DWORD">REG_DWORD (Valor DWORD de 32 bits)</option>
                  <option value="REG_QWORD">REG_QWORD (Valor QWORD de 64 bits)</option>
                  <option value="REG_EXPAND_SZ">REG_EXPAND_SZ (Valor de cadena expandible %VAR%)</option>
                  <option value="REG_MULTI_SZ">REG_MULTI_SZ (Valor de cadena múltiple)</option>
                  <option value="REG_BINARY">REG_BINARY (Valor binario hexadecimal)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Información del valor inicial:
                </label>
                <input
                  type="text"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  placeholder={type === 'REG_DWORD' ? '0' : 'Texto o ruta...'}
                  className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs font-mono text-slate-900 focus:border-sky-600 focus:outline-none"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Nota didáctica (opcional):
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Para qué sirve esta clave o valor..."
              className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-600 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-medium text-white bg-sky-600 rounded hover:bg-sky-700 transition-colors whitespace-nowrap shrink-0"
            >
              Crear
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
