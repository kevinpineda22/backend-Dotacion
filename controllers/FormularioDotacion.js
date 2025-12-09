import supabase from "../supabase/cliente.js";




// Inicializar Supabase
// Helpers

// --- Helper robusto para normalizar la columna 'entregas' ---
// Acepta array, string JSON, null/undefined y cualquier cosa rara.
// Devuelve siempre un Array seguro.
function ensureArrayEntregas(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw == null) return [];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

const genId = () => {
  try { return crypto.randomUUID(); } catch (_) {
    return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
};
const isValidISO = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);

// Normaliza items: unidades como número, talla string (o '')
const normalizeItems = (items = {}) =>
  Object.fromEntries(
    Object.entries(items).map(([k, v]) => [
      k,
      {
        talla: v?.talla ? String(v.talla) : '',
        unidades: Number(v?.unidades ?? 1) || 1,
      },
    ])
  );


/// Endpoint para confirmar la dotación con firma 

export const confirmarDotacion = async (req, res) => {
  try {
    const { dotacionId, entregaId, firma, facturaUrl } = req.body;

    // Validar entrada
    if (!dotacionId || !entregaId || !firma) {
      return res.status(400).json({
        error: "dotacionId, entregaId y firma son obligatorios",
      });
    }

    // Subir la firma a Supabase Storage
    const fileName = `firma_${dotacionId}_${entregaId}_${Date.now()}.png`;
    const base64Data = firma.replace(/^data:image\/png;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    const { data: storageData, error: storageError } = await supabase.storage
      .from("firmas")
      .upload(fileName, buffer, { contentType: "image/png" });

    if (storageError) {
      return res.status(500).json({ error: "Error al subir la firma", details: storageError.message });
    }

    const { data: publicUrlData } = supabase.storage
      .from("firmas")
      .getPublicUrl(fileName);
    const firmaUrl = publicUrlData.publicUrl;

    // Obtener el registro de dotación
    const { data: dotacionData, error: dotacionError } = await supabase
      .from("dotaciones")
      .select("id, entregas")
      .eq("id", dotacionId)
      .single();

    if (dotacionError || !dotacionData) {
      return res.status(404).json({ error: "No se encontró la dotación" });
    }

    // Buscar la entrega y actualizar firma/factura
    let entregas = Array.isArray(dotacionData.entregas) ? dotacionData.entregas : [];
    const idx = entregas.findIndex(e => e.id === entregaId);
    if (idx === -1) {
      return res.status(404).json({ error: "No se encontró la entrega" });
    }
    if (entregas[idx].firma) {
      return res.status(400).json({ error: "La entrega ya tiene una firma registrada" });
    }
    entregas[idx].firma = firmaUrl;
    if (facturaUrl) entregas[idx].facturaUrl = facturaUrl;

    // Actualizar el registro en la base de datos
    const { data: updateData, error: updateError } = await supabase
      .from("dotaciones")
      .update({ entregas })
      .eq("id", dotacionId)
      .select();

    if (updateError) {
      return res.status(500).json({ error: "Error al actualizar la entrega", details: updateError.message });
    }

    return res.status(200).json({
      message: "Firma registrada con éxito",
      data: entregas[idx],
    });
  } catch (error) {
    return res.status(500).json({
      error: "Error al registrar la firma",
      details: error.message,
    });
  }
};

// FACTURA BONO CALZADO
export const subirFactura = async (req, res) => {
  try {
    const { dotacionId, entregaId, factura } = req.body;  // factura = base64

    // Validar entrada (IGUAL)
    if (!dotacionId || !entregaId || !factura) {
      return res.status(400).json({
        error: "dotacionId, entregaId y factura son obligatorios",
      });
    }

    // Subir a Supabase Storage (IGUAL pero facturas)
    const fileName = `factura_${dotacionId}_${entregaId}_${Date.now()}.png`;
    const base64Data = factura.replace(/^data:image\/\w+;base64,/, "");  // ✅ Soporta webp/png
    const buffer = Buffer.from(base64Data, "base64");

    const { data: storageData, error: storageError } = await supabase.storage
      .from("facturas")  // ✅ Cambia bucket a "facturas"
      .upload(fileName, buffer, { contentType: "image/png" });  // ✅ O "image/webp"

    if (storageError) {
      return res.status(500).json({ error: "Error al subir la factura", details: storageError.message });
    }

    const { data: publicUrlData } = supabase.storage
      .from("facturas")  // ✅ Mismo bucket
      .getPublicUrl(fileName);
    const facturaUrl = publicUrlData.publicUrl;

    // Obtener y actualizar DB (EXACTAMENTE IGUAL)
    const { data: dotacionData, error: dotacionError } = await supabase
      .from("dotaciones")
      .select("id, entregas")
      .eq("id", dotacionId)
      .single();

    if (dotacionError || !dotacionData) {
      return res.status(404).json({ error: "No se encontró la dotación" });
    }

    let entregas = Array.isArray(dotacionData.entregas) ? dotacionData.entregas : [];
    const idx = entregas.findIndex(e => e.id === entregaId);
    if (idx === -1) {
      return res.status(404).json({ error: "No se encontró la entrega" });
    }

    entregas[idx].facturaUrl = facturaUrl;  // ✅ Solo esto cambia

    const { data: updateData, error: updateError } = await supabase
      .from("dotaciones")
      .update({ entregas })
      .eq("id", dotacionId)
      .select();

    if (updateError) {
      return res.status(500).json({ error: "Error al actualizar la entrega", details: updateError.message });
    }

    return res.status(200).json({
      message: "Factura registrada con éxito",  // ✅ Mensaje cambiado
      url: facturaUrl,  // ✅ Devuelve URL
      data: entregas[idx],
    });
  } catch (error) {
    return res.status(500).json({
      error: "Error al registrar la factura",
      details: error.message,
    });
  }
};

export const crearDotacion = async (req, res) => {
  try {
    const formData = req.body;

    const requiredFields = [
      "nombre","empresa","documento","sede","cargo",
      "fechaIngreso","fechaEntrega","dotacionTipo","dotacion"
    ];
    for (const field of requiredFields) {
      if (!formData[field]) {
        return res.status(400).json({ error: `El campo ${field} es obligatorio` });
      }
    }

    const fecha_entrega = formData.fechaEntrega;
    if (!isValidISO(fecha_entrega)) {
      return res.status(400).json({ error: "fechaEntrega debe ser YYYY-MM-DD" });
    }

    // Calcula próxima entrega si no viene
    let proxima_entrega = formData.proxima_entrega;
    if (!proxima_entrega) {
      const d = new Date(fecha_entrega);
      const next = new Date(d.getFullYear(), d.getMonth() + 4, d.getDate());
      proxima_entrega = next.toISOString().slice(0, 10);
    }

    // Mapa del valor visible al key interno
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
    const categoriaKey = dotacionTipoMap[formData.dotacionTipo] || formData.dotacionTipo;
    const catObj = formData.dotacion?.[categoriaKey] || {};

    // Construir items seleccionados para la entrega inicial (solo los checked)
    const inicialItems = {};
    for (const [k, v] of Object.entries(catObj)) {
      if (!v?.checked) continue;
      // bonoCalzado puede traer valor sin talla/unidades => guarda unidades=1
      const unidades = k === "bonoCalzado"
        ? 1
        : Number(v?.unidades ?? 1) || 1;
      inicialItems[k] = { talla: v?.talla ? String(v.talla) : "", unidades };
    }

    // Si no hay nada seleccionado, error controlado
    if (Object.keys(inicialItems).length === 0) {
      return res.status(400).json({
        error: "Debe seleccionar al menos un ítem para la dotación inicial"
      });
    }

    // Capturar información del responsable del registro
    const registradoPor = formData.registradoPor || "Usuario no identificado";
    const fechaRegistro = formData.fechaRegistro || new Date().toISOString();

    const entregaInicial = {
      id: genId(),
      tipo: "inicial",
      fecha: fecha_entrega,
      categoria: categoriaKey,
      items: normalizeItems(inicialItems),
      observacion: "",
      // Agregar información del responsable en la entrega
      registradoPor: registradoPor,
      fechaRegistro: fechaRegistro
    };

    const payload = {
      nombre: formData.nombre,
      empresa: formData.empresa,
      documento: formData.documento,
      sede: formData.sede,
      cargo: formData.cargo,
      fecha_ingreso: formData.fechaIngreso,
      fecha_entrega,
      dotacion_tipo: formData.dotacionTipo,
      dotacion: formData.dotacion,      // lo guardas como plantilla viva
      proxima_entrega,
      entregas: [entregaInicial],        // <<--- HISTORIAL arranca con la inicial
      // Agregar campos de auditoría al registro principal
      registrado_por: registradoPor,
      fecha_registro: fechaRegistro
    };

    const { data, error } = await supabase
      .from("dotaciones")
      .insert([payload])
      .select();

    if (error) throw new Error(error.message);

    res.status(201).json({
      message: "Dotación registrada con éxito",
      data: data[0],
      registradoPor: registradoPor // Incluir en la respuesta para confirmación
    });
  } catch (error) {
    console.error("Error al registrar la dotación:", error);
    res.status(500).json({
      error: "Error al registrar la dotación",
      details: error.message,
    });
  }
};


// Endpoint para obtener todas las dotaciones
export const obtenerDotaciones = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("dotaciones")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    res.status(200).json({
      message: "Dotaciones obtenidas con éxito",
      data: data,
    });
  } catch (error) {
    console.error("Error al obtener las dotaciones:", error);
    res.status(500).json({
      error: "Error al obtener las dotaciones",
      details: error.message,
    });
  }
};

// Endpoint para buscar dotaciones por número de cédula
export const obtenerDotacionPorDocumento = async (req, res) => {
  try {
    const { documento } = req.params;
    console.log("Cédula recibida:", documento); // Depuración

    if (!documento) {
      return res.status(400).json({
        error: "El documento es obligatorio",
      });
    }

    const { data, error } = await supabase
      .from("dotaciones")
      .select("*")
      .eq("documento", documento);

    console.log("Datos devueltos por Supabase:", data); // Depuración

    if (error) {
      throw new Error(error.message);
    }

    if (!data || data.length === 0) {
      return res.status(200).json({
        message: "No se encontraron dotaciones para este documento",
        data: [],
      });
    }

    res.status(200).json({
      message: "Dotaciones obtenidas con éxito",
      data: data,
    });
  } catch (error) {
    console.error("Error al obtener la dotación:", error);
    res.status(500).json({
      error: "Error al obtener la dotación",
      details: error.message,
    });
  }
};



// Endpoint para actualizar la dotación (modo seguro opcional)
export const actualizarDotacion = async (req, res) => {
  try {
    const { id } = req.params;
    let { dotacion, entregas, fecha_entrega, proxima_entrega, allowEmptyEntregas } = req.body || {};

    if (!id) return res.status(400).json({ error: 'El ID de la dotación es obligatorio' });

    // Construir updateData con cuidado
    const updateData = {};
    if (dotacion) updateData.dotacion = dotacion;
    if (fecha_entrega) updateData.fecha_entrega = fecha_entrega;
    if (proxima_entrega) updateData.proxima_entrega = proxima_entrega;

    // Solo sustituir entregas si:
    // - Es un array Y (tiene elementos o explícitamente permiten vacío)
    if (Array.isArray(entregas)) {
      if (entregas.length > 0 || allowEmptyEntregas === true) {
        updateData.entregas = entregas;
      } // si viene [], lo ignoramos por defecto
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'Nada para actualizar' });
    }

    // Validación fechas
    if (updateData.fecha_entrega && updateData.proxima_entrega) {
      const d1 = new Date(updateData.fecha_entrega);
      const d2 = new Date(updateData.proxima_entrega);
      if (d2 <= d1) return res.status(400).json({ error: 'La próxima entrega debe ser posterior a la fecha de entrega' });
    }

    const { data, error } = await supabase
      .from('dotaciones')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) return res.status(404).json({ error: 'Dotación no encontrada' });

    res.status(200).json({ message: 'Dotación actualizada con éxito', data: data[0] });
  } catch (error) {
    console.error('Error al actualizar la dotación:', error);
    res.status(500).json({ error: 'Error al actualizar la dotación', details: error.message });
  }
};



// Endpoint para agregar una nueva entrega de dotación
export const appendEntrega = async (req, res) => {
  try {
    const { id } = req.params;
    const { entrega, fecha_entrega, proxima_entrega } = req.body;
    // entrega = { id?, tipo: 'regular', fecha, categoria, items, observacion }

    if (!id || !entrega) {
      return res.status(400).json({ error: "id y entrega son obligatorios" });
    }

    const entregaToAdd = {
      id: entrega.id || genId(),
      tipo: entrega.tipo || "regular",
      fecha: entrega.fecha,
      categoria: entrega.categoria,
      items: normalizeItems(entrega.items || {}),
      observacion: entrega.observacion || "",
    };

    const { data: row, error: selErr } = await supabase
      .from("dotaciones")
      .select("entregas")
      .eq("id", id)
      .single();

    if (selErr) throw new Error(selErr.message);

    const actuales = Array.isArray(row?.entregas) ? row.entregas : [];
    const nuevas = [...actuales, entregaToAdd];

    const updateObj = { entregas: nuevas };
    if (fecha_entrega) updateObj.fecha_entrega = fecha_entrega;
    if (proxima_entrega) updateObj.proxima_entrega = proxima_entrega;

    const { data, error } = await supabase
      .from("dotaciones")
      .update(updateObj)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    res.json({ message: "Entrega agregada", data });
  } catch (error) {
    console.error("appendEntrega error:", error);
    res.status(500).json({ error: "No se pudo agregar la entrega", details: error.message });
  }
};


// PUT /api/dotaciones/:id/entregas/:entregaId
export const updateEntrega = async (req, res) => {
  try {
    const { id, entregaId } = req.params;
    const { items, observacion } = req.body || {};

    if (!id || !entregaId) {
      return res.status(400).json({ error: 'Faltan parámetros (id o entregaId).' });
    }
    if (!items || typeof items !== 'object') {
      return res.status(400).json({ error: 'items es obligatorio y debe ser un objeto.' });
    }

    // 1) Leer fila actual
    const { data: rows, error: selErr } = await supabase
      .from('dotaciones')
      .select('entregas')
      .eq('id', id)
      .limit(1);

    if (selErr) throw new Error(selErr.message);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Dotación no encontrada' });
    }

    // 2) Entregas normalizadas (por si la columna es TEXT y viene string JSON)
    const actual = ensureArrayEntregas(rows[0].entregas);

    // 3) Buscar la entrega por ID y reemplazar SOLO esa
    const idx = actual.findIndex(e => e && e.id === entregaId);
    if (idx === -1) {
      return res.status(404).json({ error: 'Entrega no encontrada en el historial' });
    }

    const entregaOriginal = actual[idx];
    const entregaActualizada = {
      ...entregaOriginal,
      items,
      ...(typeof observacion === 'string' ? { observacion } : {}),
    };

    const nuevas = actual.slice(0, idx).concat(entregaActualizada, actual.slice(idx + 1));

    // 4) Guardar el array completo de entregas actualizado
    const { data: upd, error: updErr } = await supabase
      .from('dotaciones')
      .update({ entregas: nuevas })
      .eq('id', id)
      .select();

    if (updErr) throw new Error(updErr.message);

    return res.status(200).json({ message: 'Entrega actualizada', data: upd[0] });
  } catch (err) {
    console.error('updateEntrega error:', err);
    return res.status(500).json({ error: 'Error al actualizar la entrega', details: err.message });
  }
};

// ---- ENDPOINT PARA VALIDAR SI UN DOCUMENTO YA EXISTE ----
// Valida si un número de documento ya está registrado en el sistema
// Devuelve { exists: boolean, message: string }
export const validarDocumento = async (req, res) => {
  try {
    const { documento } = req.params;

    // Validar que el documento venga en la petición
    if (!documento || !documento.trim()) {
      return res.status(400).json({
        error: "El número de documento es obligatorio",
        exists: false
      });
    }

    // Validar longitud mínima del documento (como en el frontend)
    if (documento.trim().length < 6) {
      return res.status(200).json({
        exists: false,
        message: "Documento válido para registro"
      });
    }

    // Buscar en la base de datos si ya existe una dotación con ese documento
    const { data, error } = await supabase
      .from("dotaciones")
      .select("id, nombre, documento, empresa, cargo")
      .eq("documento", documento.trim())
      .limit(1);

    if (error) {
      console.error("Error al validar documento:", error);
      return res.status(500).json({
        error: "Error interno del servidor al validar el documento",
        details: error.message,
        exists: false // En caso de error, permitir continuar
      });
    }

    // Si existe algún registro con ese documento
    if (data && data.length > 0) {
      const existingUser = data[0];
      return res.status(200).json({
        exists: true,
        message: "Este documento ya está registrado en el sistema",
        data: {
          nombre: existingUser.nombre,
          empresa: existingUser.empresa,
          cargo: existingUser.cargo
        }
      });
    }

    // Si no existe, documento disponible para registro
    return res.status(200).json({
      exists: false,
      message: "Documento disponible para registro"
    });

  } catch (error) {
    console.error("Error al validar documento:", error);
    return res.status(500).json({
      error: "Error al validar el documento",
      details: error.message,
      exists: false // En caso de error, permitir continuar
    });
  }
};

// ---- ACTUALIZAR NOMBRE ----
export const actualizarNombre = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre } = req.body;

    if (!nombre) {
      return res.status(400).json({ error: "El nombre es obligatorio" });
    }

    const { data, error } = await supabase
      .from("dotaciones")
      .update({ nombre })
      .eq("id", id)
      .select();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: "Dotación no encontrada" });
    }

    res.status(200).json({ message: "Nombre actualizado correctamente", data: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};