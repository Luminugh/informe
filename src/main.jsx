import React from "react";
import { createRoot } from "react-dom/client";
import {
  BarChart3,
  Database,
  FileText,
  LayoutDashboard,
  Network,
  Printer,
  Receipt,
  ShieldCheck,
  Warehouse
} from "lucide-react";
import data from "../data.json";
import "./index.css";

const sqlServerScript = `CREATE DATABASE dwh_retail_sa;
GO

USE dwh_retail_sa;
GO

CREATE SCHEMA dwh;
GO

CREATE TABLE dwh.dim_tiempo (
    id_tiempo INT NOT NULL PRIMARY KEY,
    fecha DATE NOT NULL,
    anio SMALLINT NOT NULL,
    trimestre TINYINT NOT NULL,
    mes TINYINT NOT NULL,
    nombre_mes VARCHAR(20) NOT NULL,
    dia_semana VARCHAR(20) NOT NULL
);

CREATE TABLE dwh.dim_producto (
    id_producto INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    codigo_sku VARCHAR(50) NOT NULL UNIQUE,
    nombre_producto VARCHAR(120) NOT NULL,
    categoria VARCHAR(60) NOT NULL,
    marca VARCHAR(60) NOT NULL,
    precio_lista DECIMAL(10,2) NOT NULL
);

CREATE TABLE dwh.dim_tienda (
    id_tienda INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    nombre_tienda VARCHAR(120) NOT NULL,
    ciudad VARCHAR(60) NOT NULL,
    region VARCHAR(60) NOT NULL,
    gerente_tienda VARCHAR(120) NULL
);

CREATE TABLE dwh.dim_cliente (
    id_cliente INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    codigo_cliente VARCHAR(50) NULL,
    nombre_cliente VARCHAR(120) NOT NULL DEFAULT 'No Registrado',
    segmento VARCHAR(60) NOT NULL DEFAULT 'General',
    ciudad VARCHAR(60) NULL
);

CREATE TABLE dwh.dim_canal_venta (
    id_canal INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    nombre_canal VARCHAR(50) NOT NULL,
    descripcion VARCHAR(150) NULL
);

CREATE TABLE dwh.hecho_ventas (
    id_venta BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY NONCLUSTERED,
    id_tiempo INT NOT NULL,
    id_producto INT NOT NULL,
    id_tienda INT NULL,
    id_cliente INT NULL,
    id_canal INT NOT NULL,
    cantidad_vendida INT NOT NULL,
    monto_total DECIMAL(12,2) NOT NULL,
    descuento_aplicado DECIMAL(10,2) NOT NULL DEFAULT 0,
    costo_total DECIMAL(12,2) NOT NULL DEFAULT 0,
    fecha_carga DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT fk_ventas_tiempo FOREIGN KEY (id_tiempo) REFERENCES dwh.dim_tiempo(id_tiempo),
    CONSTRAINT fk_ventas_producto FOREIGN KEY (id_producto) REFERENCES dwh.dim_producto(id_producto),
    CONSTRAINT fk_ventas_tienda FOREIGN KEY (id_tienda) REFERENCES dwh.dim_tienda(id_tienda),
    CONSTRAINT fk_ventas_cliente FOREIGN KEY (id_cliente) REFERENCES dwh.dim_cliente(id_cliente),
    CONSTRAINT fk_ventas_canal FOREIGN KEY (id_canal) REFERENCES dwh.dim_canal_venta(id_canal)
);
GO

CREATE VIEW dwh.vw_resumen_ventas_mensual
WITH SCHEMABINDING
AS
SELECT
    t.anio,
    t.mes,
    p.categoria,
    c.nombre_canal,
    SUM(CONVERT(BIGINT, h.cantidad_vendida)) AS total_unidades,
    SUM(h.monto_total) AS total_ingresos,
    SUM(h.descuento_aplicado) AS total_descuentos,
    COUNT_BIG(*) AS conteo_filas
FROM dwh.hecho_ventas AS h
INNER JOIN dwh.dim_tiempo AS t ON h.id_tiempo = t.id_tiempo
INNER JOIN dwh.dim_producto AS p ON h.id_producto = p.id_producto
INNER JOIN dwh.dim_canal_venta AS c ON h.id_canal = c.id_canal
GROUP BY t.anio, t.mes, p.categoria, c.nombre_canal;
GO

CREATE UNIQUE CLUSTERED INDEX ix_vw_resumen_ventas_mensual
ON dwh.vw_resumen_ventas_mensual (anio, mes, categoria, nombre_canal);
GO`;

const partitionScript = `CREATE PARTITION FUNCTION pf_ventas_tiempo (INT)
AS RANGE RIGHT FOR VALUES (20260101, 20270101);
GO

CREATE PARTITION SCHEME ps_ventas_tiempo
AS PARTITION pf_ventas_tiempo
ALL TO ([PRIMARY]);
GO

CREATE CLUSTERED INDEX cx_hecho_ventas_tiempo
ON dwh.hecho_ventas (id_tiempo, id_venta)
ON ps_ventas_tiempo(id_tiempo);
GO`;

const iconMap = {
  "chart-no-axes-combined": BarChart3,
  receipt: Receipt,
  database: Database,
  "shield-check": ShieldCheck
};

function money(value) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    maximumFractionDigits: value > 1000 ? 0 : 1
  }).format(value);
}

function number(value) {
  return new Intl.NumberFormat("es-PE").format(value);
}

function metricValue(item) {
  if (item.format === "currency") return money(item.value);
  if (item.format === "percent") return `${item.value.toFixed(1)}%`;
  return number(item.value);
}

function KpiCard({ item }) {
  const Icon = iconMap[item.icon] || BarChart3;
  return (
    <article className="panel p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{item.label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{metricValue(item)}</p>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700">
          <Icon size={20} />
        </div>
      </div>
      <p className="mt-4 text-sm font-medium text-emerald-700">+{item.change}% frente al periodo anterior</p>
    </article>
  );
}

function SalesChart() {
  const max = Math.max(...data.monthlySales.map((row) => row.tiendas + row.ecommerce));
  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Ventas mensuales integradas</h2>
          <p className="text-sm text-slate-500">Comparativo entre tiendas fisicas y canales digitales.</p>
        </div>
        <span className="rounded-md bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Soles</span>
      </div>
      <div className="mt-6 space-y-4">
        {data.monthlySales.map((row) => {
          const total = row.tiendas + row.ecommerce;
          return (
            <div className="grid grid-cols-[3rem_1fr_6rem] items-center gap-3" key={row.month}>
              <span className="text-sm font-semibold text-slate-600">{row.month}</span>
              <div className="bar-track flex">
                <div className="h-full bg-blue-600" style={{ width: `${(row.tiendas / max) * 100}%` }} />
                <div className="h-full bg-teal-500" style={{ width: `${(row.ecommerce / max) * 100}%` }} />
              </div>
              <span className="text-right text-sm font-semibold text-slate-700">{money(total)}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-5 flex gap-5 text-sm text-slate-600">
        <span className="flex items-center gap-2"><b className="h-3 w-3 rounded-sm bg-blue-600" />Tiendas</span>
        <span className="flex items-center gap-2"><b className="h-3 w-3 rounded-sm bg-teal-500" />Digital</span>
      </div>
    </section>
  );
}

function ChannelPanel() {
  return (
    <section className="panel p-5">
      <h2 className="text-lg font-semibold text-slate-950">Participacion por canal</h2>
      <p className="text-sm text-slate-500">Distribucion estimada del ingreso consolidado.</p>
      <div className="mt-6 space-y-5">
        {data.channels.map((row) => (
          <div key={row.name}>
            <div className="mb-2 flex justify-between text-sm">
              <span className="font-medium text-slate-700">{row.name}</span>
              <span className="font-semibold text-slate-900">{row.value}%</span>
            </div>
            <div className="bar-track">
              <div className="h-full rounded-full" style={{ width: `${row.value}%`, background: row.color }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProductTable() {
  const max = Math.max(...data.topProducts.map((row) => row.units));
  return (
    <section className="panel p-5">
      <h2 className="text-lg font-semibold text-slate-950">Top productos</h2>
      <p className="text-sm text-slate-500">Productos con mayor rotacion para decisiones comerciales.</p>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[540px] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="py-3">Producto</th>
              <th>Categoria</th>
              <th>Unidades</th>
              <th>Ingresos</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.topProducts.map((row) => (
              <tr key={row.name}>
                <td className="py-3 font-medium text-slate-800">
                  {row.name}
                  <div className="mt-2 h-1.5 rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-blue-600" style={{ width: `${(row.units / max) * 100}%` }} />
                  </div>
                </td>
                <td className="text-slate-600">{row.category}</td>
                <td className="font-semibold text-slate-800">{number(row.units)}</td>
                <td className="font-semibold text-slate-800">{money(row.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function EtlPipeline() {
  return (
    <section className="panel p-5">
      <h2 className="text-lg font-semibold text-slate-950">Proceso ETL propuesto</h2>
      <p className="text-sm text-slate-500">Flujo para convertir datos transaccionales en informacion analitica.</p>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {data.etl.map((row, index) => (
          <article className="rounded-lg border border-slate-200 bg-slate-50 p-4" key={row.phase}>
            <div className="mb-4 flex items-center justify-between">
              <span className="grid h-8 w-8 place-items-center rounded-md bg-slate-900 text-sm font-semibold text-white">{index + 1}</span>
              <span className="text-sm font-semibold text-emerald-700">{row.quality}% calidad</span>
            </div>
            <h3 className="font-semibold text-slate-950">{row.phase}</h3>
            <p className="mt-2 min-h-16 text-sm leading-6 text-slate-600">{row.detail}</p>
            <p className="mt-4 text-sm font-semibold text-slate-800">{number(row.records)} registros</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function StarSchema() {
  return (
    <section className="panel p-5">
      <h2 className="text-lg font-semibold text-slate-950">Modelo dimensional</h2>
      <p className="text-sm text-slate-500">Esquema estrella recomendado para Power BI.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-[1fr_1.2fr_1fr] md:items-center">
        <div className="space-y-3">
          {data.starSchema.dimensions.slice(0, 3).map((dimension) => (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-center text-sm font-semibold text-indigo-900" key={dimension}>{dimension}</div>
          ))}
        </div>
        <div className="rounded-lg border border-teal-200 bg-teal-50 p-5 text-center text-teal-950">
          <p className="text-xs uppercase tracking-wide">Tabla de hechos</p>
          <h3 className="mt-1 text-xl font-bold">{data.starSchema.fact}</h3>
          <p className="mt-3 text-sm">Metricas: {data.starSchema.measures.join(", ")}</p>
        </div>
        <div className="space-y-3">
          {data.starSchema.dimensions.slice(3).map((dimension) => (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-center text-sm font-semibold text-indigo-900" key={dimension}>{dimension}</div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Report() {
  return (
    <section id="informe" className="bg-white px-4 py-8 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="report-section p-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Informe tecnico mejorado</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Data Warehouse y Business Intelligence para {data.metadata.empresa}</h1>
          <p className="mt-3 max-w-3xl leading-7 text-slate-600">
            Propuesta integral para unificar datos de tiendas fisicas y comercio electronico en un repositorio analitico centralizado,
            con calidad de datos, rendimiento, escalabilidad y soporte para decisiones gerenciales.
          </p>
          <div className="mt-5 grid gap-3 text-sm text-slate-600 md:grid-cols-3">
            <span><b>Curso:</b> {data.metadata.curso}</span>
            <span><b>Docente:</b> {data.metadata.docente}</span>
            <span><b>Fecha:</b> {data.metadata.fecha}</span>
          </div>
        </header>

        <article className="report-section p-6">
          <h2 className="text-xl font-semibold text-slate-950">1. Introduccion y objetivos</h2>
          <p className="mt-3 leading-7 text-slate-700">
            Retail S.A. presenta dispersion de datos entre tiendas fisicas, e-commerce y archivos operativos. Esta separacion retrasa los
            reportes comerciales, limita la vision historica y eleva el riesgo de decisiones basadas en informacion incompleta.
          </p>
          <p className="mt-3 leading-7 text-slate-700">
            El objetivo es disenar un Data Warehouse centralizado que consolide las fuentes operacionales, aplique ETL incremental y alimente
            dashboards de Power BI con indicadores confiables.
          </p>
        </article>

        <article className="report-section p-6">
          <h2 className="text-xl font-semibold text-slate-950">2. Arquitectura BI propuesta</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            {[
              ["Fuentes", "SQL Server, PostgreSQL, ERP, CRM y CSV."],
              ["Staging", "Validacion, homologacion, deduplicacion y auditoria."],
              ["DWH", "Modelo estrella con historico de ventas."],
              ["BI", "Paneles ejecutivos, KPIs y analisis OLAP."]
            ].map(([title, text], index) => (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4" key={title}>
                <span className="text-xs font-bold uppercase text-blue-700">Nivel {index + 1}</span>
                <h3 className="mt-2 font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="report-section p-6">
          <h2 className="text-xl font-semibold text-slate-950">3. SQL Server para el Data Warehouse</h2>
          <p className="mt-3 leading-7 text-slate-700">
            Script consistente para SQL Server con dimensiones, tabla de hechos, claves foraneas y vista indexada para resumen mensual.
          </p>
          <pre className="mono-block mt-4"><code>{sqlServerScript}</code></pre>
        </article>

        <article className="report-section p-6">
          <h2 className="text-xl font-semibold text-slate-950">4. Particionamiento temporal</h2>
          <p className="mt-3 leading-7 text-slate-700">
            La tabla de hechos se optimiza por rango de fecha usando `id_tiempo`, reduciendo lecturas cuando Power BI consulta periodos especificos.
          </p>
          <pre className="mono-block mt-4"><code>{partitionScript}</code></pre>
        </article>
      </div>
    </section>
  );
}

function App() {
  const totalSales = data.monthlySales.reduce((sum, row) => sum + row.tiendas + row.ecommerce, 0);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[280px_1fr]">
      <aside className="sticky top-0 z-10 h-auto bg-slate-950 p-4 text-slate-200 lg:h-screen">
        <div className="flex items-center gap-3 border-b border-white/10 pb-5">
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-white text-slate-950"><Warehouse size={22} /></div>
          <div>
            <p className="text-sm text-slate-300">Proyecto BI</p>
            <h1 className="text-lg font-semibold">Retail S.A.</h1>
          </div>
        </div>
        <nav className="mt-5 space-y-2">
          {[
            ["dashboard", "Dashboard", LayoutDashboard],
            ["modelo", "Modelo DWH", Network],
            ["informe", "Informe", FileText]
          ].map(([id, label, Icon]) => (
            <a className="flex items-center gap-3 rounded-lg px-3 py-3 text-slate-300 hover:bg-white/10 hover:text-white" href={`#${id}`} key={id}>
              <Icon size={18} />
              <span>{label}</span>
            </a>
          ))}
        </nav>
        <div className="mt-8 rounded-lg bg-white/10 p-4">
          <p className="text-sm font-semibold text-white">Periodo analizado</p>
          <p className="mt-1 text-sm text-slate-300">{data.metadata.periodo}</p>
          <p className="mt-4 text-sm font-semibold text-white">Ventas simuladas</p>
          <p className="mt-1 text-lg font-bold">{money(totalSales)}</p>
        </div>
      </aside>

      <main>
        <section id="dashboard" className="px-4 py-6 md:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-blue-700">Data Warehouse & Business Intelligence</p>
                <h2 className="mt-2 text-3xl font-bold text-slate-950 md:text-4xl">Dashboard Gerencial de Ventas</h2>
                <p className="mt-3 max-w-3xl leading-7 text-slate-600">
                  Panel basado en datos simulados para demostrar integracion ETL, modelo estrella, rendimiento analitico y visualizacion ejecutiva.
                </p>
              </div>
              <button className="no-print inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-3 text-sm font-semibold text-white" onClick={() => window.print()}>
                <Printer size={18} />
                Imprimir informe
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {data.kpis.map((item) => <KpiCard item={item} key={item.label} />)}
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[1.7fr_1fr]">
              <SalesChart />
              <ChannelPanel />
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_1fr]">
              <ProductTable />
              <section className="panel p-5">
                <h2 className="text-lg font-semibold text-slate-950">Ventas por region</h2>
                <p className="text-sm text-slate-500">Vista para priorizar abastecimiento y acciones comerciales.</p>
                <div className="mt-5 space-y-3">
                  {data.regions.map((region) => (
                    <div className="rounded-lg border border-slate-200 p-4" key={region.name}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-slate-900">{region.name}</h3>
                          <p className="text-sm text-slate-500">{region.stores} tiendas</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-slate-900">{money(region.sales)}</p>
                          <p className="text-xs font-semibold text-slate-500">Riesgo {region.risk}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </section>

        <section id="modelo" className="px-4 pb-8 md:px-8">
          <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[1.1fr_1fr]">
            <EtlPipeline />
            <StarSchema />
          </div>
        </section>

        <Report />
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
