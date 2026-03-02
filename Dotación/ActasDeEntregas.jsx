import React, { useEffect, useState, useMemo } from "react";
import "./ActasDeEntrega.css";

const ActasDeEntregas = () => {
  const [actas, setActas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedRows, setExpandedRows] = useState({});
  const [empresaFilter, setEmpresaFilter] = useState("");
  const [sedeFilter, setSedeFilter] = useState("");
  const [nombreFilter, setNombreFilter] = useState("");
  const [documentoFilter, setDocumentoFilter] = useState("");
  const [historialOpen, setHistorialOpen] = useState(false);
  const [registroActivo, setRegistroActivo] = useState(null);
  
  // Estados de paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);

  // Mapeo de cargos a claves de dotación (igual que en ProximasEntregas)
  const dotacionTipoMap = {
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

  useEffect(() => {
    // Obtener las actas de entrega desde el backend
    const fetchActas = async () => {
      try {
        const response = await fetch("https://backend-dotacion.vercel.app/api/dotaciones");
        if (!response.ok) {
          throw new Error(`Error en la respuesta: ${response.status}`);
        }
        const result = await response.json();

        // Verificar si result.data existe y es un array
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

          const actasData = result.data.map((acta) => ({
            ...acta,
            dotacion: acta.dotacion || null,
            empresa: acta.empresa || "",
            sede: acta.sede || "",
            entregas: parseEntregas(acta.entregas),
          }));
          setActas(actasData);
          setTotalRecords(actasData.length);
        } else {
          setActas([]);
          setTotalRecords(0);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchActas();
  }, []);

  // Filtros únicos
  const empresasUnicas = useMemo(() => [...new Set(actas.map(a => a.empresa).filter(Boolean))], [actas]);
  const sedesUnicas = useMemo(() => [...new Set(actas.map(a => a.sede).filter(Boolean))], [actas]);

  // Filtrado de datos con paginación
  const filteredActas = useMemo(() => {
    const filtered = actas.filter(a => {
      const nombreMatch = !nombreFilter || 
        (a.nombre && a.nombre.toLowerCase().includes(nombreFilter.toLowerCase()));
      const documentoMatch = !documentoFilter || 
        (a.documento && a.documento.toString().includes(documentoFilter));
      const empresaMatch = !empresaFilter || a.empresa === empresaFilter;
      const sedeMatch = !sedeFilter || a.sede === sedeFilter;
      
      return nombreMatch && documentoMatch && empresaMatch && sedeMatch;
    });
    
    setTotalRecords(filtered.length);
    setCurrentPage(1); // Reset página cuando cambian los filtros
    
    return filtered;
  }, [actas, nombreFilter, documentoFilter, empresaFilter, sedeFilter]);

  // Datos paginados
  const paginatedActas = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredActas.slice(startIndex, endIndex);
  }, [filteredActas, currentPage, itemsPerPage]);

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
      const showPages = 5; // Número de páginas a mostrar
      
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

  // Mostrar historial de entregas
  const handleVerHistorial = (acta) => {
    setRegistroActivo(acta);
    setHistorialOpen(true);
  };

  // Modal historial
  const HistorialModal = ({ open, onClose, entregas }) => {
    if (!open) return null;
    return (
      <div className="actas-modal-overlay">
        <div className="actas-modal-content">
          <h3>Historial de Dotaciones</h3>
          {Array.isArray(entregas) && entregas.length > 0 ? (
            <div className="actas-historial-list">
              {entregas.map((ent, idx) => (
                <div key={ent.id || idx} className="actas-historial-card">
                  <div className="actas-historial-head">
                    <strong>{ent.tipo === 'inicial' ? 'Dotación Inicial' : `Entrega #${idx}`}</strong>
                    <span>Fecha: {ent.fecha}</span>
                    <span>Categoría: {ent.categoria}</span>
                  </div>
                  <div className="actas-historial-items">
                    {ent.items && Object.entries(ent.items).map(([k, v]) => (
                      <div key={k} className="actas-historial-item">
                        <strong>{k.charAt(0).toUpperCase() + k.slice(1)}:</strong> {v.talla ? `Talla ${v.talla}, ` : ""}{v.unidades} und
                      </div>
                    ))}
                  </div>
                  {/* Mostrar firma si existe */}
                  <div>
                    <strong>Firma:</strong>{" "}
                    {ent.firma ? (
                      <img src={ent.firma} alt="Firma digital" className="firma-img" />
                    ) : (
                      <span className="no-firma">Sin firma</span>
                    )}
                  </div>

                  {/* Mostrar comprobante si existe */}
                  <div className="actas-comprobante">
                    
                    {ent.facturaUrl ? (
                      <>
                        <button
                          type="button"
                          className="actas-comprobante-button"
                          onClick={() => window.open(ent.facturaUrl, "_blank", "noopener,noreferrer")}
                        >
                          Ver comprobante
                        </button>
                        {/* miniatura removida intencionadamente */}
                      </>
                    ) : (
                      <span className="no-firma"></span>
                    )}
                  </div>
                  {ent.observacion && <div className="actas-historial-note"><em>{ent.observacion}</em></div>}
                </div>
              ))}
            </div>
          ) : (
            <div>No hay entregas registradas.</div>
          )}
          <div className="actas-modal-buttons">
            <button className="actas-modal-close" onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </div>
    );
  };

  // Función para toggle de expansión de fila
  const toggleExpand = (id) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Función para obtener los ítems de dotación según el tipo
  const getDotacionItems = (dotacion, tipo) => {
    if (!dotacion || !tipo) return null;
    const tipoKey = dotacionTipoMap[tipo] || tipo.toLowerCase();
    return dotacion[tipoKey] || null;
  };

  if (loading) {
    return (
      <div className="actas-entregas-container">
        <div className="loading">Cargando actas...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="actas-entregas-container">
        <div className="error">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="actas-entregas-container">
      <h2>Actas de Entregas de Dotación</h2>
      <p>Aquí se listan las actas de las personas que han recibido su dotación, con detalles y firma digital.</p>
      
      {/* Información del total de registros */}
      <div className="actas-total-info">
        <strong>Total de registros: {totalRecords}</strong>
      </div>

      {/* Filtros */}
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
          <button onClick={limpiarFiltros} className="actas-limpiar-filtros">
            Limpiar Filtros
          </button>
        </div>
      </div>

      {/* Tabla */}
      {paginatedActas.length === 0 ? (
        <div className="no-data">No hay actas registradas aún.</div>
      ) : (
        <>
          <table className="actas-entregas-table mejorada">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Documento</th>
                <th>Cargo</th>
                <th>Empresa</th>
                <th>Sede</th>
                <th>Fecha Entrega</th>
                <th>Dotación Entregada</th>
              </tr>
            </thead>
            <tbody>
              {paginatedActas.map((acta) => {
                return (
                  <React.Fragment key={acta.id || Math.random()}>
                    <tr>
                      <td>{acta.nombre || "N/A"}</td>
                      <td>{acta.documento || "N/A"}</td>
                      <td>{acta.cargo || acta.dotacion_tipo || "N/A"}</td>
                      <td>{acta.empresa || "N/A"}</td>
                      <td>{acta.sede || "N/A"}</td>
                      <td>{acta.fecha_entrega || "N/A"}</td>
                      <td>
                        <button
                          className="ver-button"
                          onClick={() => handleVerHistorial(acta)}
                        >
                          Ver Historial
                        </button>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          
          {/* Componente de paginación */}
          <Paginacion />
        </>
      )}

      {/* Modal historial */}
      <HistorialModal
        open={historialOpen}
        onClose={() => setHistorialOpen(false)}
        entregas={registroActivo?.entregas || []}
      />
    </div>
  );
};

export default ActasDeEntregas;