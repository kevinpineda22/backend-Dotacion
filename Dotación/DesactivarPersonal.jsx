import React, { useEffect, useState, useMemo } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './ActasDeEntrega.css';

const ensureArrayEntregas = (raw) => {
  if (Array.isArray(raw)) return raw;
  if (!raw) return [];
  if (typeof raw === 'string') {
    try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch { return []; }
  }
  return [];
};

const DesactivarPersonal = () => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nombreFilter, setNombreFilter] = useState('');
  const [documentoFilter, setDocumentoFilter] = useState('');
  const [empresaFilter, setEmpresaFilter] = useState('');
  const [sedeFilter, setSedeFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [devolvio, setDevolvio] = useState(false);
  const [observacion, setObservacion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  
  // Estados de paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);

  useEffect(() => {
    const fetchList = async () => {
      setLoading(true);
      try {
        const resp = await fetch('https://backend-dotacion.vercel.app/api/dotaciones');
        const data = await resp.json();
        if (!resp.ok) throw new Error(data?.error || 'Error al obtener dotaciones');
        const arr = Array.isArray(data?.data) ? data.data : [];
        setList(arr);
      } catch (err) {
        setError(err.message || 'Error desconocido');
      } finally {
        setLoading(false);
      }
    };
    fetchList();
  }, []);

  // Filtros únicos
  const empresasUnicas = useMemo(() => [...new Set(list.map(a => a.empresa).filter(Boolean))], [list]);
  const sedesUnicas = useMemo(() => [...new Set(list.map(a => a.sede).filter(Boolean))], [list]);

  // Filtrado de datos con paginación
  const filteredList = useMemo(() => {
    // Filtrar por estado activo/inactivo
    const filteredByStatus = showInactive 
      ? list.filter(item => item.activo === false)
      : list.filter(item => item.activo !== false);
    
    // Aplicar filtros de búsqueda
    const filtered = filteredByStatus.filter(item => {
      const nombreMatch = !nombreFilter || 
        (item.nombre && item.nombre.toLowerCase().includes(nombreFilter.toLowerCase()));
      const documentoMatch = !documentoFilter || 
        (item.documento && item.documento.toString().includes(documentoFilter));
      const empresaMatch = !empresaFilter || item.empresa === empresaFilter;
      const sedeMatch = !sedeFilter || item.sede === sedeFilter;
      
      return nombreMatch && documentoMatch && empresaMatch && sedeMatch;
    });
    
    setTotalRecords(filtered.length);
    setCurrentPage(1); // Reset página cuando cambian los filtros
    
    return filtered;
  }, [list, nombreFilter, documentoFilter, empresaFilter, sedeFilter, showInactive]);

  // Datos paginados
  const paginatedList = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredList.slice(startIndex, endIndex);
  }, [filteredList, currentPage, itemsPerPage]);

  // Calcular total de páginas
  const totalPages = Math.ceil(totalRecords / itemsPerPage);

  // Función para cambiar página
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  // Función para limpiar filtros
  const limpiarFiltros = () => {
    setNombreFilter("");
    setDocumentoFilter("");
    setEmpresaFilter("");
    setSedeFilter("");
    setCurrentPage(1);
  };

  // Componente de paginación
  const Paginacion = () => {
    if (totalPages <= 1) return null;

    const getVisiblePages = () => {
      const pages = [];
      const showPages = 5;
      
      let startPage = Math.max(1, currentPage - Math.floor(showPages / 2));
      let endPage = Math.min(totalPages, startPage + showPages - 1);
      
      if (endPage - startPage < showPages - 1) {
        startPage = Math.max(1, endPage - showPages + 1);
      }
      
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
      
      return pages;
    };

    return (
      <div className="actas-paginacion">
        <div className="actas-paginacion-info">
          Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, totalRecords)} de {totalRecords} registros
        </div>
        <div className="actas-paginacion-controles">
          <button 
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="actas-paginacion-btn"
          >
            Anterior
          </button>
          
          {getVisiblePages().map((page) => (
            <button
              key={page}
              onClick={() => handlePageChange(page)}
              className={`actas-paginacion-btn ${currentPage === page ? 'active' : ''}`}
            >
              {page}
            </button>
          ))}
          
          <button 
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="actas-paginacion-btn"
          >
            Siguiente
          </button>
        </div>
      </div>
    );
  };

  const filtered = useMemo(() => {
    // Filtrar solo por activo (más simple)
    const filteredByStatus = showInactive 
      ? list.filter(item => item.activo === false)
      : list.filter(item => item.activo !== false);
    
    const q = nombreFilter.trim().toLowerCase();
    if (!q) return filteredByStatus;
    return filteredByStatus.filter(item =>
      String(item.nombre || '').toLowerCase().includes(q) ||
      String(item.documento || '').toLowerCase().includes(q)
    );
  }, [list, nombreFilter, showInactive]);

  const openModalFor = (registro) => {
    setSelected(registro);
    setDevolvio(Boolean(registro.devolvio_dotacion || registro.devolvioDotacion));
    setObservacion(registro.observacion_desactivacion || registro.observacion || '');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelected(null);
    setDevolvio(false);
    setObservacion('');
    setSubmitting(false);
  };

  const handleConfirmDesactivar = async () => {
    if (!selected || !selected.id) return;
    if (!window.confirm('¿Confirma desactivar este empleado?')) return;
    setSubmitting(true);
    try {
      const resp = await fetch(`https://backend-dotacion.vercel.app/api/dotaciones/${selected.id}/desactivar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ devolvioDotacion: devolvio, observacion }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || data?.details || 'Error al desactivar');
      toast.success('Empleado desactivado', { position: 'top-right' });
      
      // Actualizar lista local usando solo activo
      setList(prev => prev.map(it => 
        String(it.id) === String(selected.id) 
          ? { ...it, activo: false, devolvio_dotacion: devolvio, observacion_desactivacion: observacion }
          : it
      ));
      closeModal();
    } catch (err) {
      console.error('desactivar error:', err);
      toast.error(err.message || 'No se pudo desactivar', { position: 'top-right' });
      setSubmitting(false);
    }
  };

  const handleReactivar = async () => {
    if (!selected || !selected.id) return;
    if (!window.confirm('¿Confirma reactivar este empleado?')) return;
    setSubmitting(true);
    try {
      const resp = await fetch(`https://backend-dotacion.vercel.app/api/dotaciones/${selected.id}/reactivar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ observacion }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || data?.details || 'Error al reactivar');
      toast.success('Empleado reactivado', { position: 'top-right' });
      
      // Actualizar lista local usando solo activo
      setList(prev => prev.map(it => 
        String(it.id) === String(selected.id) 
          ? { ...it, activo: true, devolvio_dotacion: false, observacion_reactivacion: observacion }
          : it
      ));
      closeModal();
    } catch (err) {
      console.error('reactivar error:', err);
      toast.error(err.message || 'No se pudo reactivar', { position: 'top-right' });
      setSubmitting(false);
    }
  };

  if (loading) return <div className="admin-dot-content"><div className="loading">Cargando...</div></div>;
  if (error) return <div className="admin-dot-content"><div className="error">Error: {error}</div></div>;

  return (
    <div className="actas-entregas-container">
      <ToastContainer />
      <h2>Gestionar Personal</h2>
      <p>Listado de empleados. {showInactive ? 'Empleados inactivos - puede reactivarlos.' : 'Empleados activos - puede desactivarlos.'}</p>

      {/* Información del total de registros */}
      <div className="actas-total-info">
        <strong>Total de registros: {totalRecords}</strong>
      </div>

      {/* Filtros mejorados */}
      <div className="actas-filtros-bar">
        <div className="actas-filtros-row">
          <label>
            Buscar por nombre:
            <input
              type="text"
              value={nombreFilter}
              onChange={e => setNombreFilter(e.target.value)}
              placeholder="Ingrese nombre..."
              className="actas-filtro-input"
            />
          </label>
          <label>
            Buscar por documento:
            <input
              type="text"
              value={documentoFilter}
              onChange={e => setDocumentoFilter(e.target.value)}
              placeholder="Ingrese documento..."
              className="actas-filtro-input"
            />
          </label>
        </div>
        <div className="actas-filtros-row">
          <label>
            Empresa:
            <select value={empresaFilter} onChange={e => setEmpresaFilter(e.target.value)} className="actas-filtro-select">
              <option value="">Todas</option>
              {empresasUnicas.map(emp => <option key={emp} value={emp}>{emp}</option>)}
            </select>
          </label>
          <label>
            Sede:
            <select value={sedeFilter} onChange={e => setSedeFilter(e.target.value)} className="actas-filtro-select">
              <option value="">Todas</option>
              {sedesUnicas.map(sede => <option key={sede} value={sede}>{sede}</option>)}
            </select>
          </label>
          <button
            className={showInactive ? "actas-comprobante-button" : "ver-button"}
            onClick={() => {
              setShowInactive(!showInactive);
              setCurrentPage(1);
            }}
          >
            {showInactive ? 'Ver Activos' : 'Ver Inactivos'}
          </button>
          <button onClick={limpiarFiltros} className="actas-limpiar-filtros">
            Limpiar Filtros
          </button>
        </div>
      </div>

      {paginatedList.length === 0 ? (
        <div className="no-data">
          {showInactive ? 'No hay empleados inactivos.' : 'No hay empleados activos que coincidan.'}
        </div>
      ) : (
        <>
          <table className="actas-entregas-table mejorada" style={{ marginBottom: 12 }}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Documento</th>
                <th>Cargo</th>
                <th>Empresa</th>
                <th>Sede</th>
                <th>Última Entrega</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {paginatedList.map(r => {
                const entregas = ensureArrayEntregas(r.entregas);
                const ultima = entregas.length ? entregas[entregas.length - 1].fecha : '-';
                const esActivo = r.activo !== false;
                return (
                  <tr key={r.id || `${r.documento}_${Math.random()}`}>
                    <td>{r.nombre || 'N/A'}</td>
                    <td>{r.documento || 'N/A'}</td>
                    <td>{r.cargo || r.dotacion_tipo || 'N/A'}</td>
                    <td>{r.empresa || 'N/A'}</td>
                    <td>{r.sede || 'N/A'}</td>
                    <td>{ultima}</td>
                    <td>
                      <span style={{ 
                        color: esActivo ? '#4CAF50' : '#f44336',
                        fontWeight: 'bold'
                      }}>
                        {esActivo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <button 
                        className={esActivo ? "ver-button" : "actas-comprobante-button"} 
                        onClick={() => openModalFor(r)}
                      >
                        {esActivo ? 'Desactivar' : 'Reactivar'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {/* Componente de paginación */}
          <Paginacion />
        </>
      )}

      {/* Modal */}
      {modalOpen && selected && (
        <div className="actas-modal-overlay">
          <div className="actas-modal-content" style={{ maxWidth: 760 }}>
            <h3>
              {selected.activo !== false ? 'Desactivar: ' : 'Reactivar: '}
              {selected.nombre || 'N/A'}
            </h3>

            <div style={{ marginBottom: 12 }}>
              <strong>Documento:</strong> {selected.documento || 'N/A'}<br />
              <strong>Cargo:</strong> {selected.cargo || selected.dotacion_tipo || 'N/A'}<br />
              <strong>Empresa / Sede:</strong> {selected.empresa || 'N/A'} / {selected.sede || 'N/A'}<br />
              <strong>Estado actual:</strong> <span style={{ 
                color: selected.activo !== false ? '#4CAF50' : '#f44336',
                fontWeight: 'bold'
              }}>
                {selected.activo !== false ? 'Activo' : 'Inactivo'}
              </span>
            </div>

            {/* Mostrar historial solo si es desactivación o visualización */}
            <div style={{ marginBottom: 12 }}>
              <h4>Historial de entregas</h4>
              {ensureArrayEntregas(selected.entregas).length === 0 ? (
                <div className="no-data">No hay entregas registradas.</div>
              ) : (
                <div style={{ maxHeight: 250, overflowY: 'auto', paddingRight: 8 }}>
                  {ensureArrayEntregas(selected.entregas).map((ent, i) => (
                    <div key={ent.id || i} className="actas-historial-card" style={{ marginBottom: 8 }}>
                      <div className="actas-historial-head">
                        <strong>{ent.tipo === 'inicial' ? 'Dotación Inicial' : `Entrega #${i}`}</strong>
                        <span>{ent.fecha}</span>
                      </div>
                      <div className="actas-historial-items">
                        {ent.items && Object.entries(ent.items).map(([k, v]) => (
                          <div key={k} className="actas-historial-item">
                            <strong>{k}:</strong> {v.talla ? `Talla ${v.talla}, ` : ''}{v.unidades ?? ''}
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: 6 }}>
                        <strong>Firma:</strong> {ent.firma ? <img src={ent.firma} alt="firma" className="firma-img" /> : <span className="no-firma">Sin firma</span>}
                        {' '}
                        {ent.facturaUrl ? <button className="actas-comprobante-button" style={{ marginLeft: 8 }} onClick={() => window.open(ent.facturaUrl, '_blank', 'noopener,noreferrer')}>Ver comprobante</button> : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Checkbox solo para desactivación */}
            {selected.activo !== false && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={devolvio} onChange={e => setDevolvio(e.target.checked)} />
                  <span>Devolvió la dotación</span>
                </label>
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              <label>
                <strong>
                  {selected.activo !== false ? 'Observación (opcional)' : 'Motivo de reactivación (opcional)'}
                </strong>
              </label>
              <textarea 
                value={observacion} 
                onChange={e => setObservacion(e.target.value)} 
                rows={3} 
                style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ddd' }}
                placeholder={selected.activo !== false ? 'Motivo de la desactivación...' : 'Motivo de la reactivación...'}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="actas-modal-close" onClick={closeModal} disabled={submitting}>Cancelar</button>
              <button 
                className="actas-comprobante-button" 
                onClick={selected.activo !== false ? handleConfirmDesactivar : handleReactivar} 
                disabled={submitting}
              >
                {submitting ? 'Procesando...' : (selected.activo !== false ? 'Confirmar desactivación' : 'Confirmar reactivación')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DesactivarPersonal;
