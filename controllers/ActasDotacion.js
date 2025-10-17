import supabase from "../supabase/cliente.js";

// Controlador: desactivar personal y registrar devolución/observación
export const desactivarPersonal = async (req, res) => {
  try {
    const { id } = req.params;
    const { devolvioDotacion, observacion } = req.body ?? {};

    if (!id) return res.status(400).json({ error: "El ID de la dotación es obligatorio" });

    // Leer registro actual
    const { data: existing, error: selErr } = await supabase
      .from("dotaciones")
      .select("id, nombre, documento, activo, entregas, devolvio_dotacion, observacion_desactivacion")
      .eq("id", id)
      .single();

    if (selErr) {
      console.error("Error al leer dotación:", selErr);
      return res.status(500).json({ error: "Error al buscar la dotación", details: selErr.message });
    }
    if (!existing) return res.status(404).json({ error: "Dotación no encontrada" });

    // Preparar objeto de actualización (no sobrescribimos campos no enviados)
    const updateObj = { activo: false };
    if (typeof devolvioDotacion !== "undefined") updateObj.devolvio_dotacion = !!devolvioDotacion;
    if (typeof observacion === "string") updateObj.observacion_desactivacion = observacion;

    // Si no hay cambios aplicables, retornar el registro actual
    if (Object.keys(updateObj).length === 0) {
      return res.status(400).json({ error: "Nada para actualizar" });
    }

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