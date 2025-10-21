import supabase from "../supabase/cliente.js";

// Controlador: desactivar personal y registrar devolución/observación
export const desactivarPersonal = async (req, res) => {
  try {
    const { id } = req.params;
    const { devolvioDotacion, observacion } = req.body ?? {};

    if (!id) return res.status(400).json({ error: "El ID de la dotación es obligatorio" });

    // Solo usar activo: false (más limpio)
    const updateObj = {
      activo: false,
    };
    
    if (typeof devolvioDotacion !== "undefined") updateObj.devolvio_dotacion = !!devolvioDotacion;
    if (typeof observacion === "string") updateObj.observacion_desactivacion = observacion;

    // ...existing code...
  } catch (error) {
    // ...existing code...
  }
};

export const reactivarPersonal = async (req, res) => {
  try {
    const { id } = req.params;
    const { observacion } = req.body ?? {};

    if (!id) return res.status(400).json({ error: "El ID de la dotación es obligatorio" });

    const updateObj = { 
      activo: true,
      devolvio_dotacion: false,
      observacion_reactivacion: observacion || ''
    };

    // ...existing code...
  } catch (error) {
    // ...existing code...
  }
};