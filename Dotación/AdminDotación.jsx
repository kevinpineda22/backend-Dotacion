import React, { useState } from "react";
import { FaUser, FaBox, FaWarehouse, FaFileSignature, FaUserLock, FaChartBar, FaArrowLeft, FaHardHat } from "react-icons/fa";
import { Link } from "react-router-dom";
import "./AdminDotación.css";
import { getAssetUrl } from "../../config/storage";
import FormularioDotacion from "../Dotación/FormularioDotación.jsx";
import ProximasEntregas from "../Dotación/ProximasEntregas.jsx";
import StockDotacion from "../Dotación/StockDotacion.jsx";
import ActasDeEntregas from "../Dotación/ActasDeEntregas.jsx";
import PersonalActivo  from "../Dotación/PersonalActivo.jsx";
import DesactivarPersonal from "../Dotación/DesactivarPersonal.jsx";
import Analitica from "../../Dashboards/DSH-dotacion/analitica.jsx";
import EPP from "./EPP.jsx";

const initialStock = {
  carnicero: {
    conjunto: { S: 10, M: 12, L: 8 },
    cofia: { unica: 30 },
    gorra: { unica: 25 },
    tapabocas: { unica: 100 },
    botas: { 38: 5, 40: 7, 42: 4 },
  },
  fruver: {
    delantal: { unica: 20 },
    camisa: { S: 15, M: 10, L: 5 },
    pantalon: { 36: 8, 38: 6, 40: 4 },
    guantes: { unica: 50 },
    botas: { 38: 6, 40: 8, 42: 3 },
  },
};

const AdminDotacion = () => {
  const [currentView, setCurrentView] = useState("formulario");
  const [entregas, setEntregas] = useState([]);
  const [stock, setStock] = useState(initialStock);

  const handleFormSubmit = (formData) => {
    setEntregas([...entregas, formData]);
  };

  const descontarInventario = (dotacionTipo, items) => {
    setStock((prevStock) => {
      const newStock = { ...prevStock };
      Object.entries(items).forEach(([key, item]) => {
        if (item.checked) {
          const talla = item.talla || "unica";
          const unidades = parseInt(item.unidades || 1, 10);
          if (
            newStock[dotacionTipo] &&
            newStock[dotacionTipo][key] &&
            newStock[dotacionTipo][key][talla] !== undefined
          ) {
            newStock[dotacionTipo][key][talla] = Math.max(
              0,
              newStock[dotacionTipo][key][talla] - unidades
            );
          }
        }
      });
      return newStock;
    });
  };

  return (
    <div className="admin-dot-main-container">
      <div className="admin-dot-sidebar">
        <div className="admin-dot-sidebar-header">
        <div className="admin-dot-header-top">
          <Link to="/acceso" className="admin-dot-back-button" title="Volver a Acceso">
            <FaArrowLeft />
          </Link>
        </div>
        <img
          src={getAssetUrl("mkicono.webp")}
          alt="Logo de la Empresa"
          className="admin-dot-logo"
        />
        <h2 className="admin-dot-sidebar-title">Panel Dotación </h2>
      </div>
        <nav className="admin-dot-sidebar-nav">
          <button
            className={`admin-dot-sidebar-button ${
              currentView === "formulario"
                ? "admin-dot-sidebar-button-active"
                : ""
            }`}
            onClick={() => setCurrentView("formulario")}
          >
            <FaUser /> Formulario
          </button>
          <button
            className={`admin-dot-sidebar-button ${
              currentView === "entregas"
                ? "admin-dot-sidebar-button-active"
                : ""
            }`}
            onClick={() => setCurrentView("entregas")}
          >
            <FaBox /> Próximas Entregas
          </button>
          <button
            className={`admin-dot-sidebar-button ${
              currentView === "actas" ? "admin-dot-sidebar-button-active" : ""
            }`}
            onClick={() => setCurrentView("actas")}
          >
            <FaFileSignature /> Actas de Entregas
          </button>
          <button
             className={`admin-dot-sidebar-button ${
               currentView === "epp" ? "admin-dot-sidebar-button-active" : ""
             }`}
             onClick={() => setCurrentView("epp")}
           >
             <FaHardHat /> Entrega EPP
           </button>
          {/* <button
            className={`admin-dot-sidebar-button ${
              currentView === "stock" ? "admin-dot-sidebar-button-active" : ""
            }`}
            onClick={() => setCurrentView("stock")}
          >
            <FaWarehouse /> Stock Dotación
          </button> */}
          {/* <button
            className={`admin-dot-sidebar-button ${
              currentView === "personalActivo" ? "admin-dot-sidebar-button-active" : ""
            }`}
            onClick={() => setCurrentView("personalActivo")}
          >
            <FaUser /> Personal Activo
          </button> */}
          <button
            className={`admin-dot-sidebar-button ${
              currentView === "desactivar" ? "admin-dot-sidebar-button-active" : ""
            }`}
            onClick={() => setCurrentView("desactivar")}
          >
           <FaUserLock /> Desactivar Personal
          </button>
            <button
            className={`admin-dot-sidebar-button ${
              currentView === "analitica" ? "admin-dot-sidebar-button-active" : ""
            }`}
            onClick={() => setCurrentView("analitica")}
          >
            <FaChartBar /> Analítica
          </button>
        </nav>
      </div>
      <div className="admin-dot-content">
        {currentView === "formulario" ? (
          <FormularioDotacion onSubmit={handleFormSubmit} />
        ) : currentView === "entregas" ? (
          <ProximasEntregas entregas={entregas} />
        ) : currentView === "stock" ? (
          <StockDotacion stock={stock} />
        ) : currentView === "actas" ? (
          <ActasDeEntregas />
        ) : currentView === "epp" ? (
          <EPP />
        ) : currentView === "personalActivo" ? (
          <PersonalActivo entregas={entregas} />
        ) : currentView === "desactivar" ? (
          <DesactivarPersonal />
        ) : currentView === "analitica" ? (
          <Analitica />
        ) : null}
      </div>
    </div>
  );
};

export { AdminDotacion };