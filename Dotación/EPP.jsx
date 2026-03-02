import React, { useEffect, useState, useMemo } from "react";
import "./EPP.css";

const EPP = () => {
  const [eppRecords, setEppRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filtros
  const [empresaFilter, setEmpresaFilter] = useState("");
  const [sedeFilter, setSedeFilter] = useState("");
  const [nombreFilter, setNombreFilter] = useState("");
  const [documentoFilter, setDocumentoFilter] = useState("");
  const [firmaFilter, setFirmaFilter] = useState(""); // "" | "firmado" | "pendiente"

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);

  // Modal detalle por empleado
  const [modalRecord, setModalRecord] = useState(null);

  // Lista de items considerados EPP
  const EPP_ITEMS = useMemo(() => [
    "botas", 
    "botasSeguridad", 
    "calzado",
    "guantes", 
    "tapabocas", 
    "casco", 
    "impermeable", 
    "cofia"
  ], []);

  const formatearNombreItem = (key) => {
    const map = {
      botas: "Botas",
      botasSeguridad: "Botas de Seguridad",
      calzado: "Calzado",
      guantes: "Guantes",
      tapabocas: "Tapabocas",
      casco: "Casco",
      impermeable: "Impermeable",
      cofia: "Cofia"
    };
    return map[key] || key;
  };

  useEffect(() => {
    const fetchActas = async () => {
      try {
        const response = await fetch("https://backend-dotacion.vercel.app/api/dotaciones");
        if (!response.ok) {
          throw new Error(`Error en la respuesta: ${response.status}`);
        }
        const result = await response.json();

        if (result && result.data && Array.isArray(result.data)) {
          // Helper: normaliza entregas que pueden venir como string JSON
          const parseEntregas = (raw) => {
            if (Array.isArray(raw)) return raw;
            if (typeof raw === 'string') {
              try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : []; }
              catch { return []; }
            }
            return [];
          };

          // Agrupar por empleado (documento)
          const employeeMap = {};

          result.data.forEach((acta) => {
            const entregas = parseEntregas(acta.entregas);
            const docKey = acta.documento || acta.id;
            
            if (!employeeMap[docKey]) {
              employeeMap[docKey] = {
                id: acta.id,
                nombre: acta.nombre,
                documento: acta.documento,
                cargo: acta.cargo || acta.dotacion_tipo,
                empresa: acta.empresa,
                sede: acta.sede,
                entregasEPP: [],
              };
            }

            entregas.forEach((entrega, index) => {
              if (!entrega || !entrega.items) return;

              const itemsEnEntrega = Object.keys(entrega.items);
              const eppEncontrados = itemsEnEntrega.filter(key => EPP_ITEMS.includes(key));

              if (eppEncontrados.length > 0) {
                employeeMap[docKey].entregasEPP.push({
                  entregaIndex: index,
                  tipo: entrega.tipo === 'inicial' ? 'Dotación Inicial' : `Entrega #${index}`,
                  fecha: entrega.fecha || acta.fecha_entrega,
                  categoria: entrega.categoria || '',
                  itemsEPP: eppEncontrados.map(key => ({
                    nombre: key,
                    ...entrega.items[key]
                  })),
                  firma: entrega.firma || null
                });
              }
            });
          });

          // Convertir map a array, solo incluir los que tienen al menos 1 entrega EPP
          const grouped = Object.values(employeeMap)
            .filter(emp => emp.entregasEPP.length > 0)
            .map(emp => {
              const totalEntregas = emp.entregasEPP.length;
              const firmadas = emp.entregasEPP.filter(e => !!e.firma).length;
              const pendientes = totalEntregas - firmadas;
              // Fecha más reciente de todas sus entregas EPP
              const fechaMasReciente = emp.entregasEPP.reduce((max, e) => {
                const f = new Date(e.fecha);
                return f > max ? f : max;
              }, new Date(0));
              return { ...emp, totalEntregas, firmadas, pendientes, fechaMasReciente };
            });

          // Ordenar por fecha de entrega más reciente primero
          grouped.sort((a, b) => b.fechaMasReciente - a.fechaMasReciente);

          setEppRecords(grouped);
          setTotalRecords(grouped.length);
        } else {
          setEppRecords([]);
          setTotalRecords(0);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchActas();
  }, [EPP_ITEMS]);

  // Listas para selects de filtros
  const empresasUnicas = useMemo(() => [...new Set(eppRecords.map(r => r.empresa).filter(Boolean))], [eppRecords]);
  const sedesUnicas = useMemo(() => [...new Set(eppRecords.map(r => r.sede).filter(Boolean))], [eppRecords]);

  // Filtrado
  const filteredRecords = useMemo(() => {
    const filtered = eppRecords.filter(r => {
      const nombreMatch = !nombreFilter || (r.nombre && r.nombre.toLowerCase().includes(nombreFilter.toLowerCase()));
      const documentoMatch = !documentoFilter || (r.documento && r.documento.toString().includes(documentoFilter));
      const empresaMatch = !empresaFilter || r.empresa === empresaFilter;
      const sedeMatch = !sedeFilter || r.sede === sedeFilter;
      
      let firmaMatch = true;
      if (firmaFilter === "firmado") firmaMatch = r.pendientes === 0;
      if (firmaFilter === "pendiente") firmaMatch = r.pendientes > 0;

      return nombreMatch && documentoMatch && empresaMatch && sedeMatch && firmaMatch;
    });
    
    setTotalRecords(filtered.length);
    setCurrentPage(1);
    return filtered;
  }, [eppRecords, nombreFilter, documentoFilter, empresaFilter, sedeFilter, firmaFilter]);

  // Paginación
  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredRecords.slice(startIndex, endIndex);
  }, [filteredRecords, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(totalRecords / itemsPerPage);

  const limpiarFiltros = () => {
    setNombreFilter("");
    setDocumentoFilter("");
    setEmpresaFilter("");
    setSedeFilter("");
    setFirmaFilter("");
  };

  const openModal = (record) => setModalRecord(record);
  const closeModal = () => setModalRecord(null);

  // Contadores resumen
  const totalEmpleados = filteredRecords.length;
  const totalPendientes = filteredRecords.filter(r => r.pendientes > 0).length;
  const totalCompletos = filteredRecords.filter(r => r.pendientes === 0).length;

  if (loading) return <div className="epp-container"><div className="loading">Cargando registros EPP...</div></div>;
  if (error) return <div className="epp-container"><div className="error">Error: {error}</div></div>;

  return (
    <div className="epp-container">
      <h2>Entrega de Equipos de Protección Personal (EPP)</h2>
      <p>Listado de empleados que han recibido dotación de seguridad (Botas, Casco, Guantes, etc), agrupado por persona.</p>

      {/* Resumen de estado */}
      <div className="epp-resumen-cards">
        <div className="epp-resumen-card epp-resumen-total">
          <span className="epp-resumen-number">{totalEmpleados}</span>
          <span className="epp-resumen-label">Empleados con EPP</span>
        </div>
        <div className="epp-resumen-card epp-resumen-ok">
          <span className="epp-resumen-number">{totalCompletos}</span>
          <span className="epp-resumen-label">Todo firmado</span>
        </div>
        <div className="epp-resumen-card epp-resumen-pendiente">
          <span className="epp-resumen-number">{totalPendientes}</span>
          <span className="epp-resumen-label">Con firmas pendientes</span>
        </div>
      </div>

      {/* Filtros */}
      <div className="epp-filtros-bar">
        <div className="epp-filtros-row">
          <label>
            Buscar por nombre:
            <input 
              type="text" 
              value={nombreFilter} 
              onChange={e => setNombreFilter(e.target.value)} 
              placeholder="Ingrese nombre..." 
              className="epp-filtro-input"
            />
          </label>
          <label>
            Buscar por documento:
            <input 
              type="text" 
              value={documentoFilter} 
              onChange={e => setDocumentoFilter(e.target.value)} 
              placeholder="Ingrese documento..." 
              className="epp-filtro-input"
            />
          </label>
        </div>
        <div className="epp-filtros-row">
          <label>
            Empresa:
            <select value={empresaFilter} onChange={e => setEmpresaFilter(e.target.value)} className="epp-filtro-select">
              <option value="">Todas</option>
              {empresasUnicas.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </label>
          <label>
            Sede:
            <select value={sedeFilter} onChange={e => setSedeFilter(e.target.value)} className="epp-filtro-select">
              <option value="">Todas</option>
              {sedesUnicas.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label>
            Estado firma:
            <select value={firmaFilter} onChange={e => setFirmaFilter(e.target.value)} className="epp-filtro-select">
              <option value="">Todos</option>
              <option value="firmado">✓ Todo firmado</option>
              <option value="pendiente">⏳ Con pendientes</option>
            </select>
          </label>
          <button onClick={limpiarFiltros} className="epp-limpiar-filtros">Limpiar Filtros</button>
        </div>
      </div>

      {/* Tabla */}
      {paginatedRecords.length === 0 ? (
        <div className="no-data">No se encontraron entregas de EPP con los filtros actuales.</div>
      ) : (
        <>
          <div className="epp-table-wrapper">
            <table className="epp-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Documento</th>
                  <th>Cargo</th>
                  <th>Empresa</th>
                  <th>Entregas EPP</th>
                  <th>Estado Firmas</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRecords.map((record) => (
                  <tr
                    key={record.documento}
                    className={`epp-row-main ${record.pendientes > 0 ? 'epp-row-pendiente' : 'epp-row-completo'}`}
                    onClick={() => openModal(record)}
                    style={{ cursor: 'pointer' }}
                    title="Clic para ver detalle"
                  >
                    <td><strong>{record.nombre}</strong></td>
                    <td>{record.documento}</td>
                    <td>{record.cargo}</td>
                    <td>{record.empresa}</td>
                    <td>
                      <span className="epp-badge-count">{record.totalEntregas} entrega{record.totalEntregas > 1 ? 's' : ''}</span>
                    </td>
                    <td>
                      {record.pendientes === 0 ? (
                        <span className="epp-firma-badge epp-firma-ok">✓ {record.firmadas}/{record.totalEntregas} firmadas</span>
                      ) : (
                        <span className="epp-firma-badge epp-firma-pendiente">⏳ {record.pendientes} sin firma</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="epp-paginacion">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="epp-paginacion-btn"
              >
                Anterior
              </button>
              <span className="epp-paginacion-info">Página {currentPage} de {totalPages}</span>
              <button 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className="epp-paginacion-btn"
              >
                Siguiente
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal de detalle EPP */}
      {modalRecord && (
        <div className="epp-modal-overlay" onClick={closeModal}>
          <div className="epp-modal-content" onClick={e => e.stopPropagation()}>
            {/* Encabezado del modal */}
            <div className="epp-modal-header">
              <div>
                <h3>{modalRecord.nombre}</h3>
                <p className="epp-modal-sub">
                  {modalRecord.documento} &bull; {modalRecord.cargo} &bull; {modalRecord.empresa} &bull; {modalRecord.sede}
                </p>
              </div>
              <div>
                {modalRecord.pendientes === 0 ? (
                  <span className="epp-firma-badge epp-firma-ok">✓ Todo firmado</span>
                ) : (
                  <span className="epp-firma-badge epp-firma-pendiente">⏳ {modalRecord.pendientes} sin firma</span>
                )}
              </div>
            </div>

            {/* Timeline de entregas */}
            <div className="epp-modal-entregas">
              {modalRecord.entregasEPP.map((ent, idx) => (
                <div key={idx} className={`epp-modal-entrega-card ${ent.firma ? 'epp-card-firmada' : 'epp-card-pendiente'}`}>
                  <div className="epp-modal-entrega-head">
                    <span className={`epp-tipo-badge ${ent.tipo === 'Dotación Inicial' ? 'epp-tipo-inicial' : 'epp-tipo-regular'}`}>
                      {ent.tipo}
                    </span>
                    <span className="epp-detail-fecha">📅 {ent.fecha ? new Date(ent.fecha).toLocaleDateString() : "N/A"}</span>
                    {ent.categoria && <span className="epp-detail-categoria">Categoría: {ent.categoria}</span>}
                  </div>

                  <div className="epp-modal-entrega-items">
                    <strong>Elementos EPP entregados:</strong>
                    <div className="epp-items-list" style={{ marginTop: '8px' }}>
                      {ent.itemsEPP.map((item, i) => (
                        <span key={i} className="epp-item-tag">
                          {formatearNombreItem(item.nombre)}
                          {item.talla && ` - Talla: ${item.talla}`}
                          {` (${item.unidades} und)`}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="epp-modal-entrega-firma">
                    <strong>Firma:</strong>
                    {ent.firma ? (
                      <a href={ent.firma} target="_blank" rel="noopener noreferrer">
                        <img src={ent.firma} alt="Firma" className="epp-modal-firma-img" />
                      </a>
                    ) : (
                      <span className="epp-no-firma">⚠ Sin firma</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="epp-modal-footer">
              <button className="epp-modal-close-btn" onClick={closeModal}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EPP;
