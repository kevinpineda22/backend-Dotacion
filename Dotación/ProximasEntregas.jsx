import React, { useState, useEffect, useMemo } from 'react';
import { FaSearch, FaBell, FaEdit, FaCalendarAlt, FaExclamationTriangle, FaClock, FaList, FaHistory, FaPlus, FaUser } from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './ProximasEntregas.css';

/* ============================
   Helpers / Fechas / IDs
============================ */
const hoyISO = () => {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
};
const addMonthsISO = (dateStr, months=4) => {
  const d = new Date(dateStr);
  const nd = new Date(d.getFullYear(), d.getMonth()+months, d.getDate());
  return [nd.getFullYear(), String(nd.getMonth()+1).padStart(2,'0'), String(nd.getDate()).padStart(2,'0')].join('-');
};
const genId = () => {
  try { return crypto.randomUUID(); } catch { return `${Date.now()}_${Math.random().toString(16).slice(2)}`; }
};
function ensureArrayEntregas(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw == null) return [];
  if (typeof raw === 'string') {
    try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch { return []; }
  }
  return [];
}

/* ============================
   Modal: Nueva Entrega (append)
============================ */
const NuevaEntregaModal = ({ open, onClose, registro, onEntregado, mesesProxima = 4 }) => {
  // Obtener información del usuario (igual que en Acceso.jsx)
  const correoUsuario = localStorage.getItem("correo_empleado");
  const empleado = JSON.parse(localStorage.getItem("empleado_info") || "{}");
  
  const usuarioActual = {
    email: correoUsuario,
    nombre: empleado.nombre || "Usuario no identificado",
    area: empleado.area || "Área no definida"
  };

  if (!open) return null;

  const categorias = useMemo(() => {
    if (registro?.dotacion) return Object.keys(registro.dotacion);
    return [];
  }, [registro]);

  const [categoria, setCategoria] = useState('');
  const [itemsForm, setItemsForm] = useState({});

  useEffect(() => {
    const map = {
      "Auxiliar Cárnico": "carnicero",
      "Auxiliar Fruver": "fruver",
      "Surtidor y Bodeguero": "surtidorBodeguero",
      "Domiciliario": "domiciliario",
      "Servicio Generales": "servicioGenerales",
      "Lider Punto": "liderPunto",
      "Administrativos": "administrativos",
      "Cajera": "cajera",
      "Monitor de Servicio": "monitorServicio",
    };
    const tipoKey = map[registro?.dotacion_tipo] || registro?.dotacion_tipo;
    const initialCat = categorias.includes(tipoKey) ? tipoKey : (categorias[0] || '');
    setCategoria(initialCat);
  }, [registro, categorias]);

  useEffect(() => {
    if (!categoria || !registro?.dotacion?.[categoria]) {
      setItemsForm({});
      return;
    }
    const plantilla = registro.dotacion[categoria];
    const initial = Object.entries(plantilla).reduce((acc, [key, value]) => ({
      ...acc,
      [key]: {
        checked: !!value?.checked,
        talla: value?.talla || '',
        unidades: Number(value?.unidades ?? 1) || 1
      }
    }), {});
    setItemsForm(initial);
  }, [categoria, registro]);

  const toggleCheck = (key) => setItemsForm(prev => ({ ...prev, [key]: { ...prev[key], checked: !prev[key]?.checked } }));
  const setField = (key, field, value) => setItemsForm(prev => ({ ...prev, [key]: { ...prev[key], [field]: field === 'unidades' ? Number(value) : value } }));

  const handleGuardarEntrega = async () => {
    try {
      const itemsSeleccionados = Object.entries(itemsForm)
        .filter(([, v]) => v.checked)
        .reduce((acc, [k, v]) => ({ ...acc, [k]: { talla: v.talla || '', unidades: Number(v.unidades || 1) } }), {});
      if (Object.keys(itemsSeleccionados).length === 0) {
        toast.warn('Selecciona al menos un ítem para entregar.', { position: 'top-right' });
        return;
      }

      const fechaEntregaNueva = hoyISO();
      const proximaEntregaNueva = addMonthsISO(fechaEntregaNueva, mesesProxima);

      const entrega = {
        id: genId(),
        tipo: 'regular',
        fecha: fechaEntregaNueva,
        categoria,
        items: itemsSeleccionados,
        observacion: '',
        // Agregar información del usuario que registra
        registradoPor: usuarioActual.email,
        nombreRegistrador: usuarioActual.nombre,
        areaRegistrador: usuarioActual.area,
        fechaRegistro: new Date().toISOString(),
        usuarioRegistro: {
          email: usuarioActual.email,
          nombre: usuarioActual.nombre,
          area: usuarioActual.area
        }
      };

      const resp = await fetch(`https://backend-dotacion.vercel.app/api/dotaciones/${registro.id}/entregas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entrega, fecha_entrega: fechaEntregaNueva, proxima_entrega: proximaEntregaNueva })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Error al registrar la nueva entrega');

      const nuevasEntregas = ensureArrayEntregas(registro.entregas).concat(entrega);
      onEntregado({
        entregas: nuevasEntregas,
        fecha_entrega: fechaEntregaNueva,
        proxima_entrega: proximaEntregaNueva,
        dotacion: {
          ...(registro.dotacion || {}),
          [categoria]: Object.entries(itemsForm).reduce((acc, [k, v]) => ({
            ...acc, [k]: { checked: !!v.checked, talla: v.talla || '', unidades: Number(v.unidades || 1) }
          }), {})
        }
      });

      toast.success('Entrega registrada y próxima entrega generada.', { position: 'top-right', autoClose: 3000 });
      onClose();
    } catch (err) {
      toast.error(`Error: ${err.message}`, { position: 'top-right', autoClose: 3000 });
    }
  };

  return (
    <div className="dotacion-modal-overlay">
      <div className="dotacion-modal-content">
        <h3>Generar Entrega Nueva</h3>

        {/* Mostrar información del usuario */}
        {usuarioActual.email && (
          <div style={{
            background: 'linear-gradient(135deg, #f0f9e8 0%, #e8f5e8 100%)',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '16px',
            border: '1px solid #89DC00',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.9rem'
          }}>
            <FaUser style={{ color: '#89DC00', fontSize: '16px' }} />
            <div>
              <div style={{ color: '#210d65', fontWeight: '600' }}>
                Registrando como: <strong>{usuarioActual.nombre}</strong>
              </div>
              <div style={{ color: '#666', fontSize: '12px', marginTop: '2px' }}>
                {usuarioActual.email} • {usuarioActual.area}
              </div>
            </div>
          </div>
        )}

        <div className="form-row">
          <label><strong>Categoría</strong></label>
          <select className="input" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {categorias.map(cat => (<option key={cat} value={cat}>{cat}</option>))}
          </select>
        </div>

        <div style={{ marginTop: 12 }}>
          <strong>Ítems a entregar</strong>
          <div className="items-grid">
            {Object.keys(itemsForm).length === 0 && (
              <div style={{ color: '#666' }}>No hay ítems en esta categoría.</div>
            )}
            {Object.entries(itemsForm).map(([key, v]) => {
              const label = key.charAt(0).toUpperCase() + key.slice(1);
              return (
                <div key={key} className="item-row">
                  <label className="chk">
                    <input type="checkbox" checked={!!v.checked} onChange={() => toggleCheck(key)} />
                    <span>{label}</span>
                  </label>
                  <div className="item-fields">
                    <input
                      className="input"
                      type="text"
                      placeholder="Talla"
                      value={v.talla}
                      onChange={(e) => setField(key, 'talla', e.target.value)}
                    />
                    <input
                      className="input"
                      type="number"
                      min={1}
                      placeholder="Unidades"
                      value={v.unidades}
                      onChange={(e) => setField(key, 'unidades', e.target.value)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="dotacion-modal-buttons">
          <button className="dotacion-modal-save" onClick={handleGuardarEntrega}>Guardar</button>
          <button className="dotacion-modal-cancel" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
};

/* =============================================
   Modal: Historial de Entregas con Edición
============================================= */
const HistorialEntregasModal = ({ open, onClose, entregas, id, onSave }) => {
  // Obtener información del usuario para las ediciones
  const correoUsuario = localStorage.getItem("correo_empleado");
  const empleado = JSON.parse(localStorage.getItem("empleado_info") || "{}");
  
  const usuarioActual = {
    email: correoUsuario,
    nombre: empleado.nombre || "Usuario no identificado",
    area: empleado.area || "Área no definida"
  };

  const [editCat, setEditCat] = useState(null);
  const [editEntregaId, setEditEntregaId] = useState(null);
  const [editForm, setEditForm] = useState({});
  // Nuevos estados para manejo de items
  const [availableItems, setAvailableItems] = useState({});
  const [showAddItems, setShowAddItems] = useState(false);

  // Definir todos los items disponibles por categoría de dotación
  const dotacionCompleta = {
    administrativos: {
      camisa: { checked: false, talla: '', unidades: 1 },
      bonoCalzado: { checked: false, talla: '', unidades: 1 },
      pantalon: { checked: false, talla: '', unidades: 1 },
      botas: { checked: false, talla: '', unidades: 1 }
    },
    carnicero: {
      ConjuntoCarnicería: { checked: false, talla: '', unidades: 1 },
      Cofia: { checked: false, talla: '', unidades: 1 },
      Gorra: { checked: false, talla: '', unidades: 1 },
      botas: { checked: false, talla: '', unidades: 1 },
      tapabocas: { checked: false, talla: '', unidades: 1 }
    },
    fruver: {
      delantal: { checked: false, talla: '', unidades: 1 },
      Camisa: { checked: false, talla: '', unidades: 1 },
      pantalon: { checked: false, talla: '', unidades: 1 },
      botas: { checked: false, talla: '', unidades: 1 },
      guantes: { checked: false, talla: '', unidades: 1 }
    },
    surtidorBodeguero: {
      camisa: { checked: false, talla: '', unidades: 1 },
      pantalon: { checked: false, talla: '', unidades: 1 },
      botas: { checked: false, talla: '', unidades: 1 },
    },
    domiciliario: {
      Camibuso: { checked: false, talla: '', unidades: 1 },
      pantalon: { checked: false, talla: '', unidades: 1 },
      botas: { checked: false, talla: '', unidades: 1 },
      impermeable: { checked: false, talla: '', unidades: 1 }
    },
    servicioGenerales: {
      conjuntoAseo: { checked: false, talla: '', unidades: 1 },
      Calzado: { checked: false, talla: '', unidades: 1 }
    },
    liderPunto: {
      camisa: { checked: false, talla: '', unidades: 1 },
      pantalon: { checked: false, talla: '', unidades: 1 },
      bonoCalzado: { checked: false, talla: '', unidades: 1 }
    },
    cajera: {
      camisa: { checked: false, talla: '', unidades: 1 },
      pantalon: { checked: false, talla: '', unidades: 1 },
      bonoCalzado: { checked: false, talla: '', unidades: 1 },
      botas: { checked: false, talla: '', unidades: 1 },
    },
    monitorServicio: {
      camisa: { checked: false, talla: '', unidades: 1 },
      pantalon: { checked: false, talla: '', unidades: 1 },
      bonoCalzado: { checked: false, talla: '', unidades: 1 },
      botas: { checked: false, talla: '', unidades: 1 },
    }
  };

  const historialPorCategoria = useMemo(() => {
    const byCat = {};
    const list = ensureArrayEntregas(entregas);
    for (const e of list) {
      if (!e?.categoria) continue;
      if (!byCat[e.categoria]) byCat[e.categoria] = [];
      byCat[e.categoria].push(e);
    }
    for (const cat of Object.keys(byCat)) {
      byCat[cat].sort((a, b) => {
        if (a.tipo === 'inicial') return -1;
        if (b.tipo === 'inicial') return 1;
        return new Date(b.fecha) - new Date(a.fecha);
      });
    }
    return byCat;
  }, [entregas]);

  if (!open) return null;
  const categorias = Object.keys(historialPorCategoria);
  const hayHistorial = categorias.length > 0;

  const handleEdit = (cat, entrega) => {
    setEditCat(cat);
    setEditEntregaId(entrega.id);
    const initial = Object.entries(entrega.items || {}).reduce((acc, [key, value]) => ({
      ...acc, [key]: { talla: value?.talla || '', unidades: Number(value?.unidades ?? 1) || 1 }
    }), {});
    setEditForm(initial);
    
    // Preparar items disponibles para agregar (excluir los que ya están)
    const dotacionItems = dotacionCompleta[cat] || {};
    const itemsDisponibles = Object.keys(dotacionItems).filter(
      item => !entrega.items || !entrega.items[item]
    );
    setAvailableItems(itemsDisponibles.reduce((acc, item) => ({
      ...acc, [item]: { talla: '', unidades: 1, selected: false }
    }), {}));
    setShowAddItems(false);
  };

  const handleInputChange = (item, field, value) => {
    setEditForm(prev => ({ ...prev, [item]: { ...prev[item], [field]: field === 'unidades' ? Number(value) : value } }));
  };

  // Nueva función para eliminar un item
  const handleDeleteItem = (itemToDelete) => {
    setEditForm(prev => {
      const newForm = { ...prev };
      delete newForm[itemToDelete];
      return newForm;
    });
    toast.info(`Item ${itemToDelete} eliminado`, { position: 'top-right', autoClose: 2000 });
  };

  // Nueva función para agregar items
  const handleAddItems = () => {
    const selectedItems = Object.entries(availableItems)
      .filter(([, value]) => value.selected)
      .reduce((acc, [key, value]) => ({
        ...acc, [key]: { talla: value.talla, unidades: value.unidades }
      }), {});

    if (Object.keys(selectedItems).length === 0) {
      toast.warn('Selecciona al menos un item para agregar', { position: 'top-right' });
      return;
    }

    setEditForm(prev => ({ ...prev, ...selectedItems }));
    
    // Actualizar items disponibles (remover los agregados)
    setAvailableItems(prev => {
      const updated = { ...prev };
      Object.keys(selectedItems).forEach(key => delete updated[key]);
      return updated;
    });
    
    setShowAddItems(false);
    toast.success(`${Object.keys(selectedItems).length} items agregados`, { position: 'top-right', autoClose: 2000 });
  };

  // Función para manejar la selección de items disponibles
  const handleAvailableItemChange = (item, field, value) => {
    setAvailableItems(prev => ({
      ...prev,
      [item]: {
        ...prev[item],
        [field]: field === 'unidades' ? Number(value) : field === 'selected' ? value : value
      }
    }));
  };

  const handleSaveEdit = async () => {
    try {
      const updatedItems = Object.fromEntries(
        Object.entries(editForm).map(([k, v]) => [k, { talla: v?.talla || '', unidades: Number(v?.unidades ?? 1) || 1 }])
      );

      // Base segura
      const base = ensureArrayEntregas(entregas);
      const idx = base.findIndex(e => e?.id === editEntregaId);
      if (idx === -1) {
        toast.error('No se encontró la entrega a editar.', { position: 'top-right' });
        return;
      }

      const nuevaLista = base.slice();
      nuevaLista[idx] = { 
        ...nuevaLista[idx], 
        items: updatedItems,
        // Agregar información de quién editó
        ultimaModificacion: {
          fecha: new Date().toISOString(),
          usuario: usuarioActual.email,
          nombre: usuarioActual.nombre,
          area: usuarioActual.area
        }
      };

      // Intento por entregaId
      let resp = await fetch(`https://backend-dotacion.vercel.app/api/dotaciones/${id}/entregas/${editEntregaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: updatedItems })
      });

      // Fallback seguro (no enviar [] nunca)
      if (!resp.ok && (resp.status === 404 || resp.status === 405)) {
        resp = await fetch(`https://backend-dotacion.vercel.app/api/dotaciones/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(nuevaLista.length > 0 ? { entregas: nuevaLista } : {})
        });
      }

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || 'Error al actualizar la entrega');

      onSave(nuevaLista);
      toast.success('Entrega actualizada con éxito', { position: 'top-right', autoClose: 3000 });
      setEditCat(null);
      setEditEntregaId(null);
      setEditForm({});
      setAvailableItems({});
      setShowAddItems(false);
    } catch (error) {
      toast.error(`Error: ${error.message}`, { position: 'top-right', autoClose: 3000 });
    }
  };

  const handleCancelEdit = () => {
    setEditCat(null);
    setEditEntregaId(null);
    setEditForm({});
    setAvailableItems({});
    setShowAddItems(false);
  };

  return (
    <div className="dotacion-modal-overlay">
      <div className="dotacion-modal-content">
        <h3>Historial de Entregas</h3>
        {!hayHistorial ? (
          <div>
            <div>No hay entregas registradas.</div>
            <pre style={{whiteSpace:'pre-wrap',fontSize:12,background:'#f7f7f7',padding:8,borderRadius:6,marginTop:8}}>
              {JSON.stringify(ensureArrayEntregas(entregas), null, 2)}
            </pre>
          </div>
        ) : (
          categorias.map(cat => {
            const lista = historialPorCategoria[cat] || [];
            return (
              <div key={cat} className="categoria-section">
                <h4>{cat.charAt(0).toUpperCase() + cat.slice(1)}</h4>
                <div className="historial-list">
                  {lista.map((ent, idx) => {
                    const etiqueta = ent.tipo === 'inicial' ? 'Dotación Inicial' : `Entrega #${idx}`;
                    return (
                      <div key={ent.id} className="historial-card">
                        <div className="historial-head">
                          <div><strong>{etiqueta}:</strong></div>
                          <div><strong>Fecha:</strong> {ent.fecha}</div>
                          
                          {/* Mostrar quién registró la entrega */}
                          {(ent.registradoPor || ent.nombreRegistrador) && (
                            <div style={{ 
                              fontSize: '0.75rem', 
                              color: '#666', 
                              backgroundColor: '#f8f9fa',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              margin: '4px 0',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              <FaUser style={{ fontSize: '10px' }} />
                              <span>
                                Registrado por: <strong>{ent.nombreRegistrador || ent.registradoPor}</strong>
                                {ent.areaRegistrador && <span> • {ent.areaRegistrador}</span>}
                              </span>
                            </div>
                          )}
                          
                          <button className="dotacion-edit-btn" title="Editar entrega" onClick={() => handleEdit(cat, ent)}>
                            <FaEdit />
                          </button>
                        </div>

                        {editCat === cat && editEntregaId === ent.id ? (
                          <div className="historial-items">
                            {/* Botones de gestión de items */}
                            <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              <button 
                                className="dotacion-modal-save" 
                                onClick={() => setShowAddItems(!showAddItems)}
                                style={{ fontSize: '12px', padding: '6px 12px' }}
                              >
                                <FaPlus /> {showAddItems ? 'Ocultar' : 'Agregar Items'}
                              </button>
                            </div>

                            {/* Panel para agregar items */}
                            {showAddItems && Object.keys(availableItems).length > 0 && (
                              <div style={{ 
                                border: '1px solid #ddd', 
                                borderRadius: '6px', 
                                padding: '12px', 
                                marginBottom: '16px',
                                backgroundColor: '#f9f9f9' 
                              }}>
                                <h5 style={{ margin: '0 0 12px 0' }}>Items Disponibles para Agregar:</h5>
                                {Object.entries(availableItems).map(([key, value]) => {
                                  const itemName = key.charAt(0).toUpperCase() + key.slice(1);
                                  return (
                                    <div key={key} style={{ 
                                      marginBottom: '12px', 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      gap: '8px',
                                      flexWrap: 'wrap'
                                    }}>
                                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <input
                                          type="checkbox"
                                          checked={value.selected}
                                          onChange={(e) => handleAvailableItemChange(key, 'selected', e.target.checked)}
                                        />
                                        <strong>{itemName}</strong>
                                      </label>
                                      <input
                                        type="text"
                                        placeholder="Talla"
                                        value={value.talla}
                                        onChange={(e) => handleAvailableItemChange(key, 'talla', e.target.value)}
                                        style={{ padding: '4px', width: '80px' }}
                                      />
                                      <input
                                        type="number"
                                        placeholder="Unidades"
                                        value={value.unidades}
                                        onChange={(e) => handleAvailableItemChange(key, 'unidades', e.target.value)}
                                        min="1"
                                        style={{ padding: '4px', width: '80px' }}
                                      />
                                    </div>
                                  );
                                })}
                                <button 
                                  className="dotacion-modal-save" 
                                  onClick={handleAddItems}
                                  style={{ fontSize: '12px', padding: '6px 12px', marginTop: '8px' }}
                                >
                                  Confirmar Agregar
                                </button>
                              </div>
                            )}

                            {/* Items actuales en edición */}
                            {Object.entries(editForm).map(([key, value]) => {
                              const itemName = key.charAt(0).toUpperCase() + key.slice(1);
                              return (
                                <div key={key} style={{ 
                                  marginBottom: '16px', 
                                  border: '1px solid #eee', 
                                  borderRadius: '4px', 
                                  padding: '12px' 
                                }}>
                                  <div style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center',
                                    marginBottom: '8px'
                                  }}>
                                    <strong>{itemName}</strong>
                                    <button
                                      onClick={() => handleDeleteItem(key)}
                                      style={{
                                        background: '#ff4444',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        padding: '4px 8px',
                                        fontSize: '12px',
                                        cursor: 'pointer'
                                      }}
                                      title="Eliminar item"
                                    >
                                      Eliminar
                                    </button>
                                  </div>
                                  <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                                    <input
                                      type="text"
                                      placeholder="Talla"
                                      value={value.talla}
                                      onChange={(e) => handleInputChange(key, 'talla', e.target.value)}
                                      style={{ padding: '8px', width: '100px' }}
                                    />
                                    <input
                                      type="number"
                                      placeholder="Unidades"
                                      value={value.unidades}
                                      onChange={(e) => handleInputChange(key, 'unidades', e.target.value)}
                                      min="1"
                                      style={{ padding: '8px', width: '80px' }}
                                    />
                                  </div>
                                </div>
                              );
                            })}

                            {Object.keys(editForm).length === 0 && (
                              <div style={{ color: '#666', fontStyle: 'italic' }}>
                                No hay items en esta entrega. Usa "Agregar Items" para añadir prendas.
                              </div>
                            )}

                            <div className="dotacion-modal-buttons">
                              <button className="dotacion-modal-save" onClick={handleSaveEdit}>Guardar</button>
                              <button className="dotacion-modal-cancel" onClick={handleCancelEdit}>Cancelar</button>
                            </div>
                          </div>
                        ) : (
                          <div className="historial-items">
                            {Object.entries(ent.items || {}).map(([k, v]) => (
                              <div key={k} className="hist-item">
                                <strong>{k.charAt(0).toUpperCase() + k.slice(1)}:</strong> {v.talla ? `Talla ${v.talla}, ` : ''}{v.unidades} und
                              </div>
                            ))}
                          </div>
                        )}
                        {ent.observacion && <div className="historial-note"><em>{ent.observacion}</em></div>}

                        {/* Mostrar información de última modificación si existe */}
                        {ent.ultimaModificacion && (
                          <div style={{ 
                            fontSize: '0.75rem', 
                            color: '#666', 
                            fontStyle: 'italic', 
                            marginTop: '8px',
                            padding: '6px 10px',
                            background: '#fff3cd',
                            borderRadius: '4px',
                            borderLeft: '3px solid #ffc107'
                          }}>
                            <div style={{ fontWeight: '600', color: '#856404' }}>Última modificación:</div>
                            <div style={{ marginTop: '2px' }}>
                              📅 {new Date(ent.ultimaModificacion.fecha).toLocaleString('es-CO')}
                            </div>
                            <div style={{ marginTop: '2px' }}>
                              👤 {ent.ultimaModificacion.nombre || ent.ultimaModificacion.usuario}
                              {ent.ultimaModificacion.area && <span> • {ent.ultimaModificacion.area}</span>}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
        <div className="dotacion-modal-buttons">
          <button className="dotacion-modal-close" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
};

/* ============================
   Semáforo / utilidades UI
============================ */
function calcularDiff(fechaEntrega, proximaEntrega) {
  // Cambiar la lógica: calcular diferencia entre proximaEntrega y HOY
  if (!proximaEntrega || proximaEntrega === '-') return -Infinity;
  const hoy = new Date();
  const entrega = new Date(proximaEntrega);
  // Solo fecha, sin horas
  hoy.setHours(0,0,0,0);
  entrega.setHours(0,0,0,0);
  return (entrega - hoy) / (1000 * 60 * 60 * 24);
}
function getEntregaColor(diff) {
  if (diff < 0) return { class: 'dotacion-entrega-pasada', style: { backgroundColor: '#e0e0e0' } };
  if (diff <= 7) return { class: 'dotacion-entrega-urgente pulse-animation', style: { backgroundColor: '#FF0000' } };
  if (diff <= 29) return { class: 'dotacion-entrega-pronto', style: { backgroundColor: '#FFD700' } };
  return { class: 'dotacion-entrega-normal', style: { backgroundColor: '#ffffff' } };
}



/* ============================
   Componente principal
============================ */
const ProximasEntregas = () => {
  // Obtener información del usuario (igual que en Acceso.jsx)
  const correoUsuario = localStorage.getItem("correo_empleado");
  const empleado = JSON.parse(localStorage.getItem("empleado_info") || "{}");
  
  const usuarioActual = {
    email: correoUsuario,
    nombre: empleado.nombre || "Usuario no identificado",
    area: empleado.area || "Área no definida"
  };

  const [entregas, setEntregas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [globalFilter, setGlobalFilter] = useState('');
  const [filtroSemaforo, setFiltroSemaforo] = useState('todas');
  const [viewMode, setViewMode] = useState('cards');
  const [nuevaEntregaOpen, setNuevaEntregaOpen] = useState(false);
  const [historialOpen, setHistorialOpen] = useState(false);
  const [registroActivo, setRegistroActivo] = useState(null);

  // Nuevos estados para la búsqueda de empleados antiguos
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [employeeData, setEmployeeData] = useState(null);

  // Estado para modal de desactivación
  const [confirmDesactivarOpen, setConfirmDesactivarOpen] = useState(false);
  const [empleadoDesactivar, setEmpleadoDesactivar] = useState(null);

  // Estado para paginación
  const [visibleCount, setVisibleCount] = useState(10);

  // Estado para edición de nombre
  const [editingNameId, setEditingNameId] = useState(null);
  const [tempName, setTempName] = useState('');

  const startEditingName = (row) => {
    setEditingNameId(row.id);
    setTempName(row.nombre);
  };

  const cancelEditingName = () => {
    setEditingNameId(null);
    setTempName('');
  };

  const saveName = async (id) => {
    try {
      const response = await fetch(`https://backend-dotacion.vercel.app/api/dotaciones/${id}/nombre`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: tempName }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al actualizar el nombre');
      }

      // Actualizar estado local
      setEntregas(prev => prev.map(item => item.id === id ? { ...item, nombre: tempName } : item));
      toast.success('Nombre actualizado correctamente');
      setEditingNameId(null);
    } catch (error) {
      toast.error(error.message);
    }
  };

  // Función para buscar empleado (Implementación agregada)
  const fetchEmployeeData = async (query) => {
    if (!query) return;
    try {
      const response = await fetch(`https://backend-dotacion.vercel.app/api/terceros/${query}`);
      if (!response.ok) throw new Error('Empleado no encontrado o error en búsqueda');
      const data = await response.json();
      setEmployeeData(data);
    } catch (error) {
      toast.error(error.message);
      setEmployeeData(null);
    }
  };

  // Funciones para desactivar (Implementación agregada)
  const handleOpenDesactivar = (row) => {
    setEmpleadoDesactivar(row);
    setConfirmDesactivarOpen(true);
  };

  const handleConfirmarDesactivar = async () => {
    if (!empleadoDesactivar) return;
    try {
      const response = await fetch(`https://backend-dotacion.vercel.app/api/dotaciones/${empleadoDesactivar.id}/desactivar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) throw new Error('Error al desactivar el empleado');

      setEntregas(prev => prev.map(item => 
        item.id === empleadoDesactivar.id ? { ...item, activo: false } : item
      ));
      
      toast.success('Empleado desactivado correctamente');
      setConfirmDesactivarOpen(false);
      setEmpleadoDesactivar(null);
    } catch (error) {
      toast.error(error.message);
    }
  };

  // Fetch inicial de entregas
  useEffect(() => {
    const fetchEntregas = async () => {
      try {
        const response = await fetch('https://backend-dotacion.vercel.app/api/dotaciones', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        const result = await response.json();
        const list = Array.isArray(result?.data) ? result.data : [];
        const validData = list.map((item, i) => ({
          id: item.id ?? i,
          nombre: item.nombre ?? '-',
          documento: item.documento ?? '-',
          sede: item.sede ?? '-',
          cargo: item.cargo ?? '-',
          empresa: item.empresa ?? '-',
          dotacion_tipo: item.dotacion_tipo ?? '-',
          fecha_ingreso: item.fecha_ingreso ?? '-',
          fecha_entrega: item.fecha_entrega ?? item.fechaEntrega ?? '-',
          proxima_entrega: item.proxima_entrega ?? '-',
          dotacion: item.dotacion ?? null,
          entregas: ensureArrayEntregas(item.entregas),
          activo: item.activo !== false,
          // Mapear información del responsable desde la base de datos
          registradoPor: item.registrado_por || 'No disponible',
          fechaRegistro: item.fecha_registro || null,
        }));
        setEntregas(validData);
        setLoading(false);
      } catch (err) {
        setError(err.message || 'Error desconocido');
        setLoading(false);
      }
    };
    fetchEntregas();
  }, []);

  

 
  // Función para manejar el registro de una nueva entrega
  const handleEntregaRegistrada = (updated) => {
    setEntregas(prev =>
      prev.map(item =>
        item.id === registroActivo.id
          ? {
              ...item,
              entregas: ensureArrayEntregas(updated.entregas),
              fecha_entrega: updated.fecha_entrega,
              proxima_entrega: updated.proxima_entrega,
              dotacion: updated.dotacion
            }
          : item
      )
    );
  };

  // Función para guardar cambios desde el historial
  const handleSaveEntregasFromHistorial = (updatedEntregas) => {
    setEntregas(prev =>
      prev.map(item => item.id === registroActivo.id ? { ...item, entregas: ensureArrayEntregas(updatedEntregas) } : item)
    );
  };

  // Filtrar y paginar los datos (simplificado)
  const filteredData = useMemo(() => {
    let data = entregas;
    // Solo filtrar por activo (más simple y claro)
    data = data.filter(item => item.activo !== false);
    
    if (globalFilter) {
      const lowerFilter = globalFilter.toLowerCase();
      data = data.filter(item => Object.values(item).some(val => String(val).toLowerCase().includes(lowerFilter)));
    }
    if (filtroSemaforo !== 'todas') {
      data = data.filter(e => {
        const diff = calcularDiff(e.fecha_entrega, e.proxima_entrega);
        if (filtroSemaforo === 'urgente') return diff >= 0 && diff <= 7;
        if (filtroSemaforo === 'pronto') return diff > 7 && diff <= 29;
        if (filtroSemaforo === 'pasada') return diff < 0;
        return true;
      });
    }
    return data.slice(0, visibleCount);
  }, [entregas, globalFilter, filtroSemaforo, visibleCount]);

  // Actualizar los contadores (simplificado)
  const entregasActivas = useMemo(() => {
    return entregas.filter(item => item.activo !== false);
  }, [entregas]);

  const contarUrgentes = useMemo(() => entregasActivas.filter(e => {
    const diff = calcularDiff(e.fecha_entrega, e.proxima_entrega);
    return diff >= 0 && diff <= 7;
  }).length, [entregasActivas]);

  const contarProntos = useMemo(() => entregasActivas.filter(e => {
    const diff = calcularDiff(e.fecha_entrega, e.proxima_entrega);
    return diff > 7 && diff <= 29;
  }).length, [entregasActivas]);

  const contarPasadas = useMemo(() => entregasActivas.filter(e => {
    const diff = calcularDiff(e.fecha_entrega, e.proxima_entrega);
    return diff < 0;
  }).length, [entregasActivas]);

  const resumenDashboard = useMemo(() => ({
    todas: entregasActivas.length,
    urgente: contarUrgentes,
    pronto: contarProntos,
    pasada: contarPasadas,
  }), [entregasActivas, contarUrgentes, contarProntos, contarPasadas]);

  if (loading) return <div className="admin-dot-content">Cargando...</div>;
  if (error) return <div className="admin-dot-content">Error: {error}</div>;
  if (entregas.length === 0) {
    return (
      <div className="admin-dot-content">
        <div className="admin-dot-table-wrapper">
          <p>No hay datos de entregas disponibles.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dot-content">
      <NuevaEntregaModal
        open={nuevaEntregaOpen}
        onClose={() => setNuevaEntregaOpen(false)}
        registro={registroActivo}
        onEntregado={handleEntregaRegistrada}
        mesesProxima={4}
      />

      <HistorialEntregasModal
        open={historialOpen}
        onClose={() => setHistorialOpen(false)}
        entregas={ensureArrayEntregas(registroActivo?.entregas)}
        id={registroActivo?.id}
        onSave={handleSaveEntregasFromHistorial}
      />

      {/* Modal de Confirmación de Desactivación */}
      {confirmDesactivarOpen && (
        <div className="dotacion-modal-overlay">
          <div className="dotacion-modal-content" style={{ maxWidth: '400px' }}>
            <h3>Confirmar Desactivación</h3>
            <p>¿Estás seguro de que deseas desactivar a <strong>{empleadoDesactivar?.nombre}</strong>?</p>
            <p style={{ fontSize: '0.9rem', color: '#666' }}>El empleado dejará de aparecer en la lista principal.</p>
            <div className="dotacion-modal-buttons">
              <button className="dotacion-modal-save" style={{ backgroundColor: '#dc3545' }} onClick={handleConfirmarDesactivar}>Sí, Desactivar</button>
              <button className="dotacion-modal-cancel" onClick={() => setConfirmDesactivarOpen(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <div className="dotacion-dashboard-summary">
        <div className={`dotacion-summary-card ${filtroSemaforo === 'todas' ? 'active' : ''}`} style={{ backgroundColor: '#210d65' }} onClick={() => setFiltroSemaforo('todas')}>
          <FaList /><div><h3>Todas</h3><p>{resumenDashboard.todas}</p></div>
        </div>
        <div className={`dotacion-summary-card ${filtroSemaforo === 'pronto' ? 'active' : ''}`} style={{ backgroundColor: '#FFD700' }} onClick={() => setFiltroSemaforo('pronto')}>
          <FaClock /><div><h3>Prontas</h3><p>{resumenDashboard.pronto}</p></div>
        </div>
        <div className={`dotacion-summary-card ${filtroSemaforo === 'urgente' ? 'active' : ''}`} style={{ backgroundColor: '#FF0000' }} onClick={() => setFiltroSemaforo('urgente')}>
          <FaExclamationTriangle /><div><h3>Urgentes</h3><p>{resumenDashboard.urgente}</p></div>
        </div>
        <div className={`dotacion-summary-card ${filtroSemaforo === 'pasada' ? 'active' : ''}`} style={{ backgroundColor: '#e0e0e0' }} onClick={() => setFiltroSemaforo('pasada')}>
          <FaCalendarAlt /><div><h3>Pasadas</h3><p>{resumenDashboard.pasada}</p></div>
        </div>
        <div className={`dotacion-summary-card ${viewMode === 'cards' ? 'active' : ''}`} style={{ backgroundColor: '#210d65', color: '#fff' }} onClick={() => setViewMode('cards')}>
          <FaList /><div><h3>Vista Cards</h3></div>
        </div>
        <div className={`dotacion-summary-card ${viewMode === 'table' ? 'active' : ''}`} style={{ backgroundColor: '#210d65', color: '#fff' }} onClick={() => setViewMode('table')}>
          <FaList /><div><h3>Vista Tabla</h3></div>
        </div>
      </div>

      <div className="admin-dot-table-wrapper">
        <div className="dotacion-filter-bar">
          <span className="dotacion-filter-icon"><FaSearch /></span>
          <input value={globalFilter} onChange={e => setGlobalFilter(e.target.value)} placeholder="Buscar..." className="dotacion-filter-input" />
          <span className="dotacion-filter-count">{filteredData.length} registros</span>
    
        </div>

        {searchOpen && (
          <div className="employee-search-container">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Escribe el nombre del empleado..."
              className="dotacion-filter-input"
            />
            <button 
              onClick={() => fetchEmployeeData(searchQuery)}
              className="btn-search"
            >
              <FaSearch /> Buscar
            </button>
            {employeeData && (
              <div className="employee-details">
                <h4>Datos del Empleado</h4>
                <p><strong>Razón Social:</strong> {employeeData.Razon_social}</p>
                <p><strong>Nombres:</strong> {employeeData.Nombres}</p>
                <p><strong>NIT:</strong> {employeeData.Nit || 'N/A'}</p>
                <p><strong>Documento:</strong> {employeeData.id_tercero}</p>
                <p><strong>Tipo Identificación:</strong> {employeeData.Id_tipo_ident || 'N/A'}</p>
                <p><strong>Apellido 1:</strong> {employeeData.Apellido1}</p>
                <p><strong>Apellido 2:</strong> {employeeData.Apellido2}</p>
                <button 
                  className="btn-entregar"
                  onClick={() => {
                    setRegistroActivo({
                      id: genId(),
                      nombre: employeeData.Nombres || employeeData.Razon_social,
                      documento: employeeData.id_tercero,
                      dotacion_tipo: 'Generar nueva dotación',
                      fecha_ingreso: employeeData.Ts,
                      fecha_entrega: hoyISO(),
                      proxima_entrega: addMonthsISO(hoyISO(), 4),
                    });
                    setNuevaEntregaOpen(true);
                    setSearchOpen(false);
                    setEmployeeData(null);
                    setSearchQuery('');
                  }}
                >
                  <FaPlus /> Generar Entrega
                </button>
                <button 
                  className="btn-cancel"
                  onClick={() => {
                    setSearchOpen(false);
                    setEmployeeData(null);
                    setSearchQuery('');
                  }}
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        )}

        {viewMode === 'table' ? (
          <>
            <table className="admin-dot-table">
              <thead>
                <tr>
                  <th>Nombre</th><th>Documento</th><th>Sede</th><th>Cargo</th><th>Empresa</th>
                  <th>Tipo Dotación</th><th>Fecha Ingreso</th><th>Fecha Entrega</th><th>Próxima Entrega</th><th>Creado por</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row) => {
                  // Usar la nueva lógica de días restantes
                  const diff = calcularDiff(row.fecha_entrega, row.proxima_entrega);
                  const { class: colorClass } = getEntregaColor(diff);
                  const state = diff < 0 ? 'pasada' : diff <= 7 ? 'urgente' : diff <= 29 ? 'pronto' : 'normal';
                  return (
                    <tr key={row.id} className={colorClass}>
                      <td>
                        {editingNameId === row.id ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <input 
                              type="text" 
                              value={tempName} 
                              onChange={(e) => setTempName(e.target.value)}
                              style={{ padding: '4px', borderRadius: '4px', border: '1px solid #ccc', width: '100%' }}
                              autoFocus
                            />
                            <button onClick={() => saveName(row.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'green', padding: 0 }} title="Guardar">✔</button>
                            <button onClick={cancelEditingName} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'red', padding: 0 }} title="Cancelar">✖</button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>{row.nombre}</span>
                            <FaEdit 
                              style={{ cursor: 'pointer', color: '#666', fontSize: '0.8rem', marginLeft: '8px' }} 
                              onClick={() => startEditingName(row)} 
                              title="Editar nombre"
                            />
                          </div>
                        )}
                      </td>
                      <td>{row.documento}</td>
                      <td>{row.sede}</td>
                      <td>{row.cargo}</td>
                      <td>{row.empresa}</td>
                      <td>{row.dotacion_tipo}</td>
                      <td>{row.fecha_ingreso}</td>
                      <td>{row.fecha_entrega}</td>
                      <td>
                        <div className="dotacion-card-proxima">
                          <span className={`fecha-chip ${state}`}>{row.proxima_entrega}</span>
                          {colorClass.includes('urgente') && <FaBell className="bell-icon" title="¡Urgente!" />}
                          {colorClass.includes('pronto') && <FaBell className="bell-icon" title="Próxima dotación" />}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.85rem', color: '#666' }}>
                          {row.nombreRegistrador || row.registradoPor || 'No disponible'}
                          {row.areaRegistrador && (
                            <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                              {row.areaRegistrador}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <button className="btn-entregar" title="Generar entrega nueva" onClick={() => { setRegistroActivo(row); setNuevaEntregaOpen(true); }}>
                          <FaPlus /> Generar Entrega
                        </button>
                        <button className="btn-historial" title="Ver historial de entregas" onClick={() => {
                          const parsedRow = { ...row, entregas: ensureArrayEntregas(row.entregas) };
                          setRegistroActivo(parsedRow);
                          setHistorialOpen(true);
                        }}>
                          <FaHistory /> Historial
                        </button>
                        {/* botón para abrir modal de desactivar */}
                        <button className="btn-desactivar" title="Desactivar empleado" onClick={() => handleOpenDesactivar(row)} style={{ marginLeft: 8 }}>
                          Desactivar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredData.length < entregas.length && (
              <div style={{ textAlign: 'center', margin: '16px 0' }}>
                <button
                  className="btn-cargar-mas"
                  onClick={() => setVisibleCount(prev => prev + 10)}
                >
                  Cargar más
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="dotacion-cards-container">
              {filteredData.map((row) => {
                // Usar la nueva lógica de días restantes
                const diff = calcularDiff(row.fecha_entrega, row.proxima_entrega);
                const { class: colorClass, style } = getEntregaColor(diff);
                const maxDays = 30;
                const progressPct = diff > maxDays ? 100 : Math.max(0, (diff / maxDays) * 100);
                const state = diff < 0 ? 'pasada' : diff <= 7 ? 'urgente' : diff <= 29 ? 'pronto' : 'normal';
                return (
                  <div key={row.id} className={`dotacion-card ${colorClass}`} style={style}>
                    <div className="dotacion-card-header">
                      {editingNameId === row.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', width: '100%' }}>
                          <input 
                            type="text" 
                            value={tempName} 
                            onChange={(e) => setTempName(e.target.value)}
                            style={{ padding: '4px', borderRadius: '4px', border: '1px solid #ccc', flex: 1, color: '#000' }}
                            onClick={(e) => e.stopPropagation()}
                            autoFocus
                          />
                          <button onClick={(e) => { e.stopPropagation(); saveName(row.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'green', fontWeight: 'bold', fontSize: '1.2rem' }} title="Guardar">✔</button>
                          <button onClick={(e) => { e.stopPropagation(); cancelEditingName(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'red', fontWeight: 'bold', fontSize: '1.2rem' }} title="Cancelar">✖</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <h4 style={{ margin: 0, color: '#210d65' }}>{row.nombre}</h4>
                          <FaEdit 
                            style={{ cursor: 'pointer', color: '#666', fontSize: '0.9rem' }} 
                            onClick={(e) => { e.stopPropagation(); startEditingName(row); }} 
                            title="Editar nombre"
                          />
                        </div>
                      )}
                      <span className="dotacion-card-documento">{row.documento}</span>
                    </div>
                    <div className="dotacion-card-body">
                      <p><strong>Sede:</strong> {row.sede}</p>
                      <p><strong>Cargo:</strong> {row.cargo}</p>
                      <p><strong>Empresa:</strong> {row.empresa}</p>
                      <p><strong>Tipo Dotación:</strong> {row.dotacion_tipo}</p>
                      <p><strong>Fecha Ingreso:</strong> {row.fecha_ingreso}</p>
                      <p><strong>Fecha Entrega:</strong> {row.fecha_entrega}</p>
                      
                      {/* Mostrar información del creador solo si hay datos válidos */}
                      {row.registradoPor && row.registradoPor !== 'No disponible' && (
                        <div style={{ 
                          marginTop: '12px',
                          padding: '10px 12px',
                          backgroundColor: '#f8f9fa',
                          borderRadius: '8px',
                          borderLeft: '4px solid #89DC00',
                          fontSize: '0.85rem'
                        }}>
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '6px',
                            color: '#210d65',
                            fontWeight: '600',
                            marginBottom: '4px'
                          }}>
                            <FaUser style={{ fontSize: '12px' }} />
                            <span>Creado por:</span>
                          </div>
                          <div style={{ color: '#333', fontWeight: '500' }}>
                            {row.registradoPor}
                          </div>
                          {row.fechaRegistro && (
                            <div style={{ 
                              fontSize: '0.75rem', 
                              color: '#666', 
                              marginTop: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              📅 {new Date(row.fechaRegistro).toLocaleDateString('es-CO', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div className="dotacion-card-proxima">
                        <strong>Próxima Entrega:</strong>
                        <span className={`fecha-chip ${state}`} style={{ marginLeft: 6 }}>{row.proxima_entrega}</span>
                        {(state === 'urgente' || state === 'pronto') && (<FaBell className="bell-icon" title="¡Atención!" />)}
                      </div>
                      <div className="dotacion-progress-bar">
                        <div className={`bar ${state}`} style={{ width: `${progressPct}%` }} />
                      </div>
                      <p><strong>Días Restantes:</strong> {diff >= 0 ? Math.floor(diff) : 'Pasado'}</p>
                    </div>
                    <div className="dotacion-card-actions">
                      <button className="btn-entregar" title="Generar entrega nueva" onClick={() => { setRegistroActivo(row); setNuevaEntregaOpen(true); }}>
                        <FaPlus /> Generar Entrega
                      </button>
                      <button className="btn-historial" title="Ver historial" onClick={() => {
                        const parsedRow = { ...row, entregas: ensureArrayEntregas(row.entregas) };
                        setRegistroActivo(parsedRow);
                        setHistorialOpen(true);
                      }}>
                        <FaHistory /> Historial
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {filteredData.length < entregas.length && (
              <div style={{ textAlign: 'center', margin: '16px 0' }}>
                <button
                  className="btn-cargar-mas"
                  onClick={() => setVisibleCount(prev => prev + 10)}
                >
                  Cargar más
                </button>
              </div>
            )}
          </>
        )}
      </div>
      <ToastContainer />
    </div>
  );
};

export default ProximasEntregas;