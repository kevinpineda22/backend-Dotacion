import React, { useState, useEffect } from "react";
import {
  FaCalendarAlt, FaTshirt, FaSignInAlt, FaUserTie, FaCity,
  FaRegIdCard, FaRegUserCircle, FaChevronDown, FaUser
} from "react-icons/fa";
import { toast, ToastContainer } from 'react-toastify';
import Swal from 'sweetalert2';
import 'react-toastify/dist/ReactToastify.css';
import "./FormularioDotación.css";

// Helpers
const genId = () => {
  try { return crypto.randomUUID(); } catch (_) {
    return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
};
const isISO = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);

// Mapa de tipo visible -> clave interna de categoría
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

const dotacionItems = {
  carnicero: [
    { key: "conjunto", label: "Conjunto Carnicería" },
    { key: "cofia", label: "Cofia", soloUnidades: true },
    { key: "gorra", label: "Gorra", soloUnidades: true },
    { key: "tapabocas", label: "Tapabocas", soloUnidades: true },
    { key: "botas", label: "Botas" },
  ],
  fruver: [
    { key: "delantal", label: "Delantal", soloUnidades: true },
    { key: "camisa", label: "Camisa" },
    { key: "pantalon", label: "Pantalón" },
    { key: "guantes", label: "Guantes", soloUnidades: true },
    { key: "botas", label: "Botas" },
  ],
  surtidorBodeguero: [
    { key: "camisa", label: "Camisa" },
    { key: "pantalon", label: "Pantalón" },
    { key: "botas", label: "Botas" },
  ],
  domiciliario: [
    { key: "camibuso", label: "Camibuso" },
    { key: "pantalon", label: "Pantalón" },
    { key: "botas", label: "Botas" },
    { key: "impermeable", label: "Impermeable" },
  ],
  servicioGenerales: [
    { key: "conjuntoAseo", label: "Conjunto Aseo General" },
    { key: "calzado", label: "Calzado" },
  ],
  liderPunto: [
    { key: "camisa", label: "Camisa" },
    { key: "pantalonCargo", label: "Pantalón Cargo" },
    { key: "bonoCalzado", label: "Bono de Calzado" },
  ],
  administrativos: [
    { key: "camisa", label: "Camisa" },
    { key: "pantalon", label: "Pantalón" },
    { key: "botasSeguridad", label: "Botas de Seguridad" },
    { key: "bonoCalzado", label: "Bono de Calzado" },
  ],
  cajera: [
    { key: "camisa", label: "Camisa" },
    { key: "pantalon", label: "Pantalón" },
    { key: "botas", label: "Botas" },
    { key: "bonoCalzado", label: "Bono de Calzado" },
  ],
  monitorServicio: [
    { key: "camisa", label: "Camisa" },
    { key: "pantalon", label: "Pantalón" },
    { key: "botas", label: "Botas" },
    { key: "bonoCalzado", label: "Bono de Calzado" },
  ],
};

const TALLAS_CIRCULO = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];
const INPUT_TALLA_NUMERICA_KEYS = ["botas", "botasSeguridad", "pantalon", "pantalonCargo", "calzado"];

const SEDES = [
  "Copacabana Plaza", "Villa Hermosa", "Girardota Parque", "Girardota Llano",
  "Copacabana Vegas", "Copacabana San Juan", "Supermercados Barbosa",
];

const FormularioDotacion = ({ onSubmit }) => {
  // Obtener información del usuario desde localStorage (igual que en Acceso.jsx)
  const correoUsuario = localStorage.getItem("correo_empleado");
  const empleado = JSON.parse(localStorage.getItem("empleado_info") || "{}");
  
  // Crear objeto de usuario consistente
  const usuarioActual = {
    email: correoUsuario,
    nombre: empleado.nombre || "Usuario no identificado",
    area: empleado.area || "Área no definida"
  };

  const [formData, setFormData] = useState({
    nombre: "", empresa: "", documento: "", sede: "", cargo: "",
    fechaIngreso: "", fechaEntrega: "", dotacionTipo: "",
    // Solo almacenar el nombre del responsable
    registradoPor: usuarioActual.nombre,
    fechaRegistro: new Date().toISOString(),
    dotacion: {
      carnicero: { conjunto:{checked:false,talla:"",unidades:""}, cofia:{checked:false,talla:"",unidades:""},
        gorra:{checked:false,talla:"",unidades:""}, tapabocas:{checked:false,talla:"",unidades:""},
        botas:{checked:false,talla:"",unidades:""} },
      fruver: { delantal:{checked:false,talla:"",unidades:""}, camisa:{checked:false,talla:"",unidades:""},
        pantalon:{checked:false,talla:"",unidades:""}, guantes:{checked:false,talla:"",unidades:""},
        botas:{checked:false,talla:"",unidades:""} },
      surtidorBodeguero: { camisa:{checked:false,talla:"",unidades:""}, pantalon:{checked:false,talla:"",unidades:""},
        botas:{checked:false,talla:"",unidades:""} },
      domiciliario: { camibuso:{checked:false,talla:"",unidades:""}, pantalon:{checked:false,talla:"",unidades:""},
        botas:{checked:false,talla:"",unidades:""}, impermeable:{checked:false,talla:"",unidades:""} },
      servicioGenerales: { conjuntoAseo:{checked:false,talla:"",unidades:""}, calzado:{checked:false,talla:"",unidades:""} },
      liderPunto: { camisa:{checked:false,talla:"",unidades:""}, pantalonCargo:{checked:false,talla:"",unidades:""},
        bonoCalzado:{checked:false,valor:70000} },
      administrativos: { camisa:{checked:false,talla:"",unidades:""}, pantalon:{checked:false,talla:"",unidades:""},
        botasSeguridad:{checked:false,talla:"",unidades:""}, bonoCalzado:{checked:false,valor:70000} },
      cajera: { camisa:{checked:false,talla:"",unidades:""}, pantalon:{checked:false,talla:"",unidades:""}, botas:{checked:false,talla:"",unidades:""}, bonoCalzado:{checked:false,valor:70000} },
      monitorServicio: { camisa:{checked:false,talla:"",unidades:""}, pantalon:{checked:false,talla:"",unidades:""}, botas:{checked:false,talla:"",unidades:""}, bonoCalzado:{checked:false,valor:70000} },
    },
  });

  const [showDotacionOptions, setShowDotacionOptions] = useState(false);
  const [message, setMessage] = useState({ text: "", status: "" });
  const [isSedeDisabled, setIsSedeDisabled] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isValidatingDocument, setIsValidatingDocument] = useState(false);
  const [documentError, setDocumentError] = useState("");

  // Función para validar si el documento ya existe
  const validateDocument = async (documento) => {
    if (!documento || documento.trim().length < 6) {
      setDocumentError("");
      return false;
    }

    setIsValidatingDocument(true);
    try {
      const response = await fetch(`https://backend-dotacion.vercel.app/api/dotacion/validar-documento/${documento.trim()}`);
      const result = await response.json();
      
      if (response.ok) {
        if (result.exists) {
          setDocumentError("Este documento ya está registrado en el sistema");
          return false;
        } else {
          setDocumentError("");
          return true;
        }
      } else {
        console.error('Error validando documento:', result.error);
        setDocumentError("");
        return true; // En caso de error de conexión, permitir continuar
      }
    } catch (error) {
      console.error('Error de conexión validando documento:', error);
      setDocumentError("");
      return true; // En caso de error de conexión, permitir continuar
    } finally {
      setIsValidatingDocument(false);
    }
  };

  // Función para mostrar alerta de documento duplicado
  const showDuplicateDocumentAlert = (documento, existingUser = null) => {
    Swal.fire({
      title: 'Documento Ya Registrado',
      html: `
        <div style="text-align: center;">
          <div style="font-size: 3rem; color: #ffc107; margin-bottom: 1rem;">⚠️</div>
          <p style="font-size: 1.1rem; margin-bottom: 1rem;">
            El documento <strong>${documento}</strong> ya se encuentra registrado en el sistema.
          </p>
          <div style="background: #fff3cd; padding: 1rem; border-radius: 8px; border-left: 4px solid #ffc107; margin-bottom: 1rem;">
            <p style="color: #210d65; font-size: 0.95rem; margin-bottom: 0.5rem;">
              <strong>¿Qué puedes hacer?</strong>
            </p>
            <ul style="color: #6c757d; font-size: 0.9rem; text-align: left; margin: 0; padding-left: 1.5rem;">
              <li>Verificar que el número de documento sea correcto</li>
              <li>Consultar el registro existente en el listado de empleados</li>
              <li>Contactar al administrador si necesitas actualizar la información</li>
            </ul>
          </div>
          <p style="color: #6c757d; font-size: 0.9rem;">
            No se pueden registrar empleados con el mismo número de documento.
          </p>
        </div>
      `,
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#ffc107',
      customClass: {
        popup: 'merkahorro-alert',
        confirmButton: 'merkahorro-btn-warning'
      }
    });
  };

  // Función para mostrar alerta de éxito
  const showSuccessAlert = (nombre, documento) => {
    Swal.fire({
      title: '¡Dotación Registrada!',
      html: `
        <div style="text-align: center;">
          <div style="font-size: 3rem; color: #89DC00; margin-bottom: 1rem;">✅</div>
          <p style="font-size: 1.1rem; margin-bottom: 1rem;">
            La dotación para <strong>${nombre}</strong> ha sido registrada correctamente.
          </p>
        </div>
      `,
      confirmButtonText: 'Continuar',
      confirmButtonColor: '#89DC00',
      customClass: {
        popup: 'merkahorro-alert',
        confirmButton: 'merkahorro-btn-success'
      }
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    // Eliminar validación automática para el documento
    if (name === "documento") {
      // Eliminar cualquier espacio en blanco ingresado
      const cleanValue = value.replace(/\s/g, '');
      setFormData(prev => ({ ...prev, [name]: cleanValue }));
      // Limpiar errores previos cuando el usuario escribe
      setDocumentError("");
      return;
    }

    if (name === "empresa") {
      let sedeValue = "";
      let sedeDisabled = false;
      if (value === "Megamayorista" || value === "Construahorro") {
        sedeValue = value;
        sedeDisabled = true;
      }
      setFormData(prev => ({ ...prev, empresa: value, sede: sedeValue }));
      setIsSedeDisabled(sedeDisabled);
      return;
    }

    if (name === "fechaEntrega") {
      let proxima_entrega = "";
      if (isISO(value)) {
        const d = new Date(value);
        if (!isNaN(d)) {
          const next = new Date(d.getFullYear(), d.getMonth() + 4, d.getDate());
          proxima_entrega = next.toISOString().slice(0, 10);
        }
      }
      setFormData(prev => ({ ...prev, fechaEntrega: value, proxima_entrega }));
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDotacionTipoChange = (e) => {
    const { value } = e.target;
    setFormData(prev => ({ ...prev, dotacionTipo: value }));
    setShowDotacionOptions(!!value);
  };

  const handleDotacionChange = (tipo, item, field, value) => {
    setFormData(prev => ({
      ...prev,
      dotacion: {
        ...prev.dotacion,
        [tipo]: {
          ...prev.dotacion[tipo],
          [item]: { ...prev.dotacion[tipo][item], [field]: value },
        },
      },
    }));
  };

  const formatFormDataForConfirmation = () => {
    const { nombre, empresa, documento, sede, cargo, fechaIngreso, fechaEntrega, dotacionTipo, dotacion } = formData;
    const tipoDotacionKey = dotacionTipoMap[dotacionTipo];
    const selectedItems = tipoDotacionKey
      ? dotacionItems[tipoDotacionKey]
          .filter(item => dotacion[tipoDotacionKey][item.key].checked)
          .map(item => {
            const it = dotacion[tipoDotacionKey][item.key];
            if (item.key === "bonoCalzado") {
              return <span key={item.key}><strong>{item.label}:</strong> ${it.valor.toLocaleString("es-CO")}<br/></span>;
            }
            return <span key={item.key}><strong>{item.label}:</strong> Talla {it.talla || 'N/A'}, Unidades {it.unidades || 'N/A'}<br/></span>;
          })
      : [];

    return (
      <div>
        <strong>Nombre:</strong> {nombre}<br />
        <strong>Empresa:</strong> {empresa}<br />
        <strong>Documento:</strong> {documento}<br />
        <strong>Sede:</strong> {sede}<br />
        <strong>Cargo:</strong> {cargo}<br />
        <strong>Fecha de Ingreso:</strong> {fechaIngreso}<br />
        <strong>Fecha de Entrega:</strong> {fechaEntrega}<br />
        <strong>Tipo de Dotación:</strong> {dotacionTipo}<br />
        <strong>Ítems Seleccionados:</strong><br />
        {selectedItems.length > 0 ? selectedItems : 'Ninguno'}
      </div>
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validaciones básicas primero
    if (!formData.dotacionTipo) {
      setMessage({ text: "Por favor seleccione un tipo de dotación.", status: "error" });
      return;
    }
    
    const tipoKey = dotacionTipoMap[formData.dotacionTipo];
    const hasSelectedItems = tipoKey && Object.entries(formData.dotacion[tipoKey]).some(([key, item]) => {
      if (key === "bonoCalzado") return item.checked;
      return item.checked && item.unidades && item.talla !== undefined;
    });
    
    if (!hasSelectedItems) {
      setMessage({ text: "Seleccione al menos un ítem con talla y unidades (o bono de calzado).", status: "error" });
      return;
    }

    // Ahora sí validar el documento antes de mostrar el diálogo de confirmación
    if (documentError) {
      showDuplicateDocumentAlert(formData.documento);
      return;
    }

    // Validar documento por primera vez al enviar
    const isDocumentValid = await validateDocument(formData.documento);
    if (!isDocumentValid) {
      showDuplicateDocumentAlert(formData.documento);
      return;
    }
    
    // Si todo está bien, mostrar diálogo de confirmación
    setShowConfirmDialog(true);
  };

  const confirmSubmission = async () => {
    try {
      // Validación final del documento antes de enviar (por si acaso)
      const isDocumentValid = await validateDocument(formData.documento);
      if (!isDocumentValid) {
        setShowConfirmDialog(false);
        showDuplicateDocumentAlert(formData.documento);
        return;
      }

      const dataToSend = { 
        ...formData,
        // Solo incluir el nombre del responsable
        registradoPor: usuarioActual.nombre,
        fechaRegistro: new Date().toISOString()
      };
      
      if (!dataToSend.proxima_entrega && isISO(dataToSend.fechaEntrega)) {
        const d = new Date(dataToSend.fechaEntrega);
        const next = new Date(d.getFullYear(), d.getMonth() + 4, d.getDate());
        dataToSend.proxima_entrega = next.toISOString().slice(0, 10);
      }

      const tipoKey = dotacionTipoMap[dataToSend.dotacionTipo];
      const catObj = dataToSend.dotacion?.[tipoKey] || {};
      const inicialItems = {};
      Object.entries(catObj).forEach(([k, v]) => {
        if (!v?.checked) return;
        const unidades = k === "bonoCalzado" ? 1 : Number(v?.unidades ?? 1) || 1;
        inicialItems[k] = { talla: v?.talla ? String(v.talla) : "", unidades };
      });
      if (Object.keys(inicialItems).length === 0) {
        throw new Error("Debe seleccionar al menos un ítem para la entrega inicial.");
      }

      dataToSend.entregas = [{
        id: genId(),
        tipo: "inicial",
        fecha: dataToSend.fechaEntrega,
        categoria: tipoKey,
        items: inicialItems,
        observacion: "Entrega inicial de dotación",
        // Solo incluir el nombre del responsable en la entrega
        registradoPor: usuarioActual.nombre,
        fechaRegistro: new Date().toISOString()
      }];

      // Mostrar alerta de procesamiento
      Swal.fire({
        title: 'Procesando Registro',
        html: `
          <div style="text-align: center;">
            <div style="font-size: 3rem; color: #89DC00; margin-bottom: 1rem;">⏳</div>
            <p style="font-size: 1.1rem; margin-bottom: 1rem;">Registrando dotación...</p>
            <div style="background: #f0f2f5; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
              <div style="color: #6c757d; font-size: 0.9rem;">
                • Validando información del empleado<br>
                • Guardando datos en el sistema<br>
                • Programando entrega inicial<br>
                • <strong>Registrado por:</strong> ${usuarioActual.nombre}
              </div>
            </div>
          </div>
        `,
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        customClass: {
          popup: 'merkahorro-alert'
        },
        didOpen: () => {
          Swal.showLoading();
        }
      });

      const response = await fetch('https://backend-dotacion.vercel.app/api/dotacion', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dataToSend),
      });
      const result = await response.json();
      
      if (!response.ok) {
        if (result.error && result.error.includes('documento ya existe')) {
          Swal.close();
          showDuplicateDocumentAlert(formData.documento);
          return;
        }
        throw new Error(result.error || 'Error al enviar los datos');
      }

      // Cerrar alerta de procesamiento y mostrar éxito simplificado
      Swal.close();
      Swal.fire({
        title: '¡Dotación Registrada!',
        html: `
          <div style="text-align: center;">
            <div style="font-size: 3rem; color: #89DC00; margin-bottom: 1rem;">✅</div>
            <p style="font-size: 1.1rem; margin-bottom: 1rem;">
              La dotación para <strong>${formData.nombre}</strong> ha sido registrada correctamente.
            </p>
          </div>
        `,
        confirmButtonText: 'Continuar',
        confirmButtonColor: '#89DC00',
        customClass: {
          popup: 'merkahorro-alert',
          confirmButton: 'merkahorro-btn-success'
        }
      });
      
      onSubmit?.(dataToSend);

      // Reset form
      setFormData({
        nombre: "", empresa: "", documento: "", sede: "", cargo: "",
        fechaIngreso: "", fechaEntrega: "", dotacionTipo: "",
        registradoPor: usuarioActual.nombre,
        fechaRegistro: new Date().toISOString(),
        dotacion: {
          carnicero: { conjunto:{checked:false,talla:"",unidades:""}, cofia:{checked:false,talla:"",unidades:""},
            gorra:{checked:false,talla:"",unidades:""}, tapabocas:{checked:false,talla:"",unidades:""},
            botas:{checked:false,talla:"",unidades:""} },
          fruver: { delantal:{checked:false,talla:"",unidades:""}, camisa:{checked:false,talla:"",unidades:""},
            pantalon:{checked:false,talla:"",unidades:""}, guantes:{checked:false,talla:"",unidades:""},
            botas:{checked:false,talla:"",unidades:""} },
          surtidorBodeguero: { camisa:{checked:false,talla:"",unidades:""}, pantalon:{checked:false,talla:"",unidades:""},
            botas:{checked:false,talla:"",unidades:""} },
          domiciliario: { camibuso:{checked:false,talla:"",unidades:""}, pantalon:{checked:false,talla:"",unidades:""},
            botas:{checked:false,talla:"",unidades:""}, impermeable:{checked:false,talla:"",unidades:""} },
          servicioGenerales: { conjuntoAseo:{checked:false,talla:"",unidades:""}, calzado:{checked:false,talla:"",unidades:""} },
          liderPunto: { camisa:{checked:false,talla:"",unidades:""}, pantalonCargo:{checked:false,talla:"",unidades:""},
            bonoCalzado:{checked:false,valor:70000} },
          administrativos: { camisa:{checked:false,talla:"",unidades:""}, pantalon:{checked:false,talla:"",unidades:""},
            botasSeguridad:{checked:false,talla:"",unidades:""}, bonoCalzado:{checked:false,valor:70000} },
          cajera: { camisa:{checked:false,talla:"",unidades:""}, pantalon:{checked:false,talla:"",unidades:""}, botas:{checked:false,talla:"",unidades:""}, bonoCalzado:{checked:false,valor:70000} },
          monitorServicio: { camisa:{checked:false,talla:"",unidades:""}, pantalon:{checked:false,talla:"",unidades:""}, botas:{checked:false,talla:"",unidades:""}, bonoCalzado:{checked:false,valor:70000} },
        },
      });
      setShowDotacionOptions(false);
      setShowConfirmDialog(false);
      setDocumentError("");
      setMessage({ text: "", status: "" });
      
    } catch (error) {
      Swal.close();
      
      // Mostrar alerta de error
      Swal.fire({
        title: 'Error al Registrar',
        html: `
          <div style="text-align: center;">
            <div style="font-size: 3rem; color: #e63946; margin-bottom: 1rem;">❌</div>
            <p style="font-size: 1.1rem; margin-bottom: 1rem;">Ha ocurrido un error al registrar la dotación.</p>
            <div style="background: #fdf2f2; padding: 1rem; border-radius: 8px; border-left: 4px solid #e63946; margin-bottom: 1rem;">
              <strong style="color: #210d65;">Mensaje de error:</strong><br>
              <span style="color: #e63946;">${error.message}</span>
            </div>
            <p style="color: #6c757d; font-size: 0.9rem;">
              Por favor, revise los datos e intente nuevamente. Si el problema persiste, contacte al administrador.
            </p>
          </div>
        `,
        confirmButtonText: 'Intentar Nuevamente',
        confirmButtonColor: '#e63946',
        customClass: {
          popup: 'merkahorro-alert',
          confirmButton: 'merkahorro-btn-error'
        }
      });
      
      setMessage({ text: error.message, status: "error" });
      setShowConfirmDialog(false);
    }
  };

  return (
    <div className="admin-dot-form-wrapper">
      <div className="admin-dot-form-container">
        <form onSubmit={handleSubmit}>
          <h2 className="admin-dot-main-title">Formulario de Dotación</h2>
          
          <div className="admin-dot-form-row">
            <div className="admin-dot-form-group">
              <label className="admin-dot-form-label"><FaChevronDown /> Empresa</label>
              <select name="empresa" className="admin-dot-form-input" value={formData.empresa} onChange={handleInputChange} required>
                <option value="">Seleccione una opción</option>
                <option value="Merkahorro">Merkahorro</option>
                <option value="Megamayorista">Megamayorista</option>
                <option value="Construahorro">Construahorro</option>
              </select>
            </div>
            <div className="admin-dot-form-group">
              <label className="admin-dot-form-label"><FaRegUserCircle /> Nombre</label>
              <input type="text" name="nombre" className="admin-dot-form-input" value={formData.nombre} onChange={handleInputChange} required/>
            </div>
            <div className="admin-dot-form-group">
              <label className="admin-dot-form-label">
                <FaRegIdCard /> Documento
                {isValidatingDocument && <span style={{color: '#89DC00', marginLeft: '8px'}}>Validando...</span>}
              </label>
              <input 
                type="text" 
                name="documento" 
                className={`admin-dot-form-input ${documentError ? 'error' : ''}`}
                value={formData.documento} 
                onChange={handleInputChange} 
                required
                placeholder="Número de documento de identidad"
                disabled={isValidatingDocument}
              />
              {documentError && (
                <div className="document-error-message">
                  <span style={{color: '#e63946', fontSize: '0.85em', display: 'flex', alignItems: 'center', gap: '5px', marginTop: '5px'}}>
                    ⚠️ {documentError}
                  </span>
                </div>
              )}
            </div>
            <div className="admin-dot-form-group">
              <label className="admin-dot-form-label"><FaCity /> Sede</label>
              <select name="sede" value={formData.sede} onChange={handleInputChange} required className="admin-dot-form-input" disabled={isSedeDisabled}>
                <option value="" disabled>Selecciona una sede</option>
                {formData.empresa === "Megamayorista" && (<option value="Megamayorista">Megamayorista</option>)}
                {formData.empresa === "Construahorro" && (<option value="Construahorro">Construahorro</option>)}
                {formData.empresa === "Merkahorro" && SEDES.map(s => (<option key={s} value={s}>{s}</option>))}
              </select>
            </div>
            <div className="admin-dot-form-group">
              <label className="admin-dot-form-label"><FaUserTie /> Cargo</label>
              <input type="text" name="cargo" className="admin-dot-form-input" value={formData.cargo} onChange={handleInputChange} required/>
            </div>
            <div className="admin-dot-form-group">
              <label className="admin-dot-form-label"><FaSignInAlt /> Ingreso a la empresa</label>
              <input type="date" name="fechaIngreso" className="admin-dot-form-input" value={formData.fechaIngreso} onChange={handleInputChange} required/>
            </div>
            <div className="admin-dot-form-group">
              <label className="admin-dot-form-label"><FaCalendarAlt /> Entrega de dotación</label>
              <input type="date" name="fechaEntrega" className="admin-dot-form-input" value={formData.fechaEntrega} onChange={handleInputChange} required/>
            </div>
            <div className="admin-dot-form-group">
              <label className="admin-dot-form-label"><FaTshirt /> Tipo Dotación</label>
              <select name="dotacionTipo" className="admin-dot-form-input" value={formData.dotacionTipo} onChange={handleDotacionTipoChange} required>
                <option value="">Seleccione una opción</option>
                <option value="Auxiliar Cárnico">Auxiliar Cárnico</option>
                <option value="Auxiliar Fruver">Auxiliar Fruver</option>
                <option value="Surtidor y Bodeguero">Surtidor y Bodeguero</option>
                <option value="Domiciliario">Domiciliario</option>
                <option value="Servicio Generales">Servicio Generales</option>
                <option value="Lider Punto">Lider de Punto</option>
                <option value="Administrativos">Administrativos</option>
                <option value="Cajera">Cajera</option>
                <option value="Monitor de Servicio">Monitor de Servicio</option>
              </select>
            </div>
          </div>

          <br />
          {showDotacionOptions && formData.dotacionTipo && (
            <div className="dotacion-items-section">
              <h2 className="admin-dot-main-title">Seleccione la Dotación - {formData.dotacionTipo}</h2>
              {dotacionItems[dotacionTipoMap[formData.dotacionTipo]].map((item) => (
                <div key={item.key} className="dotacion-item-row">
                  <label className="admin-dot-form-label">
                    <input
                      type="checkbox"
                      checked={formData.dotacion[dotacionTipoMap[formData.dotacionTipo]][item.key].checked}
                      onChange={(e) => handleDotacionChange(dotacionTipoMap[formData.dotacionTipo], item.key, "checked", e.target.checked)}
                    />
                    {item.label}
                  </label>

                  {formData.dotacion[dotacionTipoMap[formData.dotacionTipo]][item.key].checked && item.key !== "bonoCalzado" && (
                    <div className="dotacion-item-details">
                      {item.soloUnidades ? (
                        <>
                          <label className="admin-dot-form-label">Unidades</label>
                          <input
                            type="number"
                            className="admin-dot-form-input"
                            min="1"
                            value={formData.dotacion[dotacionTipoMap[formData.dotacionTipo]][item.key].unidades}
                            onChange={(e) => handleDotacionChange(dotacionTipoMap[formData.dotacionTipo], item.key, "unidades", e.target.value)}
                            required
                          />
                        </>
                      ) : (
                        <>
                          <label className="admin-dot-form-label">Talla</label>
                          {INPUT_TALLA_NUMERICA_KEYS.includes(item.key) ? (
                            <input
                              type="text"
                              className="admin-dot-form-input"
                              placeholder="Ej: 38, 40, 42"
                              value={formData.dotacion[dotacionTipoMap[formData.dotacionTipo]][item.key].talla}
                              onChange={(e) => handleDotacionChange(dotacionTipoMap[formData.dotacionTipo], item.key, "talla", e.target.value)}
                              required
                            />
                          ) : (
                            <div className="dotacion-tallas-circulo">
                              {TALLAS_CIRCULO.map((talla) => (
                                <label
                                  key={talla}
                                  className={`dotacion-talla-circulo ${formData.dotacion[dotacionTipoMap[formData.dotacionTipo]][item.key].talla === talla ? "selected" : ""}`}
                                >
                                  <input
                                    type="radio"
                                    name={`talla-${dotacionTipoMap[formData.dotacionTipo]}-${item.key}`}
                                    value={talla}
                                    checked={formData.dotacion[dotacionTipoMap[formData.dotacionTipo]][item.key].talla === talla}
                                    onChange={() => handleDotacionChange(dotacionTipoMap[formData.dotacionTipo], item.key, "talla", talla)}
                                    required
                                  />
                                  <span>{talla}</span>
                                </label>
                              ))}
                            </div>
                          )}
                          <label className="admin-dot-form-label" style={{ marginTop: "0.5rem" }}>Unidades</label>
                          <input
                            type="number"
                            className="admin-dot-form-input"
                            min="1"
                            value={formData.dotacion[dotacionTipoMap[formData.dotacionTipo]][item.key].unidades}
                            onChange={(e) => handleDotacionChange(dotacionTipoMap[formData.dotacionTipo], item.key, "unidades", e.target.value)}
                            required
                          />
                        </>
                      )}
                    </div>
                  )}

                  {formData.dotacion[dotacionTipoMap[formData.dotacionTipo]][item.key].checked && item.key === "bonoCalzado" && (
                    <div className="dotacion-item-details">
                      <label className="admin-dot-form-label">Valor</label>
                      <input
                        type="text"
                        className="admin-dot-form-input"
                        value={`$${formData.dotacion[dotacionTipoMap[formData.dotacionTipo]][item.key].valor.toLocaleString("es-CO")}`}
                        disabled
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <button 
            type="submit" 
            className="admin-dot-form-boton"
            disabled={isValidatingDocument}
          >
            {isValidatingDocument ? 'Validando documento...' : 'Confirmar Dotación'}
          </button>
          {message.text && (<div className="dot-message" data-status={message.status}>{message.text}</div>)}
        </form>

        {showConfirmDialog && (
          <div className="confirm-dialog">
            <div className="confirm-dialog-content">
              <h3>Confirmar Datos</h3>
              <pre>{formatFormDataForConfirmation()}</pre>
              <div className="confirm-dialog-buttons">
                <button className="admin-dot-form-boton confirm-button" onClick={confirmSubmission}>Confirmar</button>
                <button className="admin-dot-form-boton cancel-button" onClick={() => setShowConfirmDialog(false)}>Cancelar</button>
              </div>
            </div>
          </div>
        )}
        <ToastContainer />
      </div>
    </div>
  );
};

export default FormularioDotacion;
