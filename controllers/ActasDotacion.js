import supabase from "../supabase/cliente.js";

// Controlador: desactivar personal y registrar devolución/observación
export const desactivarPersonal = async (req, res) => {
  try {
    const { id } = req.params;
    const { devolvioDotacion, observacion } = req.body ?? {};

    if (!id) return res.status(400).json({ error: "El ID de la dotación es obligatorio" });

    // Preparar objeto de actualización usando la columna 'activo'
    const updateObj = {
      activo: false,  // Usar activo: false en lugar de estado: "inactivo"
    };
    
    if (typeof devolvioDotacion !== "undefined") updateObj.devolvio_dotacion = !!devolvioDotacion;
    if (typeof observacion === "string") updateObj.observacion_desactivacion = observacion;

    const { data: updated, error: updErr } = await supabase
      .from("dotaciones")
      .update(updateObj)
      .eq("id", id)
      .select()
      .single();

    if (updErr) {
      console.error("Error al actualizar dotación:", updErr);
      return res.status(500).json({ error: "Error al actualizar la dotación", details: updErr.message });
    }

    return res.status(200).json({ message: "Empleado desactivado", data: updated });
  } catch (error) {
    console.error("desactivarPersonal error:", error);
    return res.status(500).json({ error: "Error interno", details: error.message });
  }
};

// Controlador: reactivar personal
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

    const { data: updated, error: updErr } = await supabase
      .from("dotaciones")
      .update(updateObj)
      .eq("id", id)
      .select()
      .single();

    if (updErr) {
      console.error("Error al reactivar:", updErr);
      return res.status(500).json({ error: "Error al reactivar", details: updErr.message });
    }

    return res.status(200).json({ message: "Empleado reactivado", data: updated });
  } catch (error) {
    console.error("reactivarPersonal error:", error);
    return res.status(500).json({ error: "Error interno", details: error.message });
  }
};
