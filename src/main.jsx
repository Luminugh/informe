import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BarChart3,
  Database,
  LayoutDashboard,
  Network,
  PieChart,
  Receipt,
  ShieldCheck,
  Sigma,
  TableProperties,
  TrendingUp,
  Warehouse
} from "lucide-react";
import data from "../data.json";
import "./index.css";

const dimensions = data.dimensions;
const timeById = Object.fromEntries(dimensions.time.map((item) => [item.id, item]));
const regionById = Object.fromEntries(dimensions.regions.map((item) => [item.id, item]));
const channelById = Object.fromEntries(dimensions.channels.map((item) => [item.id, item]));
const categoryById = Object.fromEntries(dimensions.categories.map((item) => [item.id, item]));
const productById = Object.fromEntries(dimensions.products.map((item) => [item.id, item]));
const factRows = data.facts.map((fact) => {
  const product = productById[fact.productId];
  const category = categoryById[product.categoryId];
  const margin = fact.sales ? ((fact.sales - fact.cost) / fact.sales) * 100 : 0;

  return {
    ...fact,
    month: timeById[fact.timeId].month,
    monthNumber: timeById[fact.timeId].monthNumber,
    quarter: timeById[fact.timeId].quarter,
    region: regionById[fact.regionId].name,
    stores: regionById[fact.regionId].stores,
    risk: regionById[fact.regionId].risk,
    channel: channelById[fact.channelId].name,
    channelColor: channelById[fact.channelId].color,
    product: product.name,
    category: category.name,
    margin
  };
});

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

function uniqueValues(rows, key) {
  return [...new Set(rows.map((row) => row[key]))];
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + row[key], 0);
}

function weightedMargin(rows) {
  const totalSales = sum(rows, "sales");
  if (!totalSales) return 0;
  return rows.reduce((total, row) => total + row.sales * row.margin, 0) / totalSales;
}

function groupBySum(rows, key, valueKey = "sales") {
  return rows.reduce((acc, row) => {
    acc[row[key]] = (acc[row[key]] || 0) + row[valueKey];
    return acc;
  }, {});
}

function KpiCard({ item }) {
  const Icon = item.Icon;
  return (
    <article className="panel p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{item.label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{item.value}</p>
        </div>
        <div className={`grid h-10 w-10 place-items-center rounded-lg ${item.tone}`}>
          <Icon size={20} />
        </div>
      </div>
      <p className="mt-4 text-sm font-medium text-slate-500">{item.helper}</p>
    </article>
  );
}

function SalesChart({ rows }) {
  const monthOrder = dimensions.time.map((item) => item.month);
  const channels = dimensions.channels.map((item) => item.name);
  const grouped = {};
  rows.forEach((row) => {
    grouped[row.month] ||= {};
    grouped[row.month][row.channel] = (grouped[row.month][row.channel] || 0) + row.sales;
  });
  const totals = monthOrder.map((month) => channels.reduce((acc, channel) => acc + (grouped[month]?.[channel] || 0), 0));
  const max = Math.max(...totals, 1);

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
        {monthOrder.map((month, index) => {
          const total = totals[index];
          return (
            <div className="grid grid-cols-[3rem_1fr_6rem] items-center gap-3" key={month}>
              <span className="text-sm font-semibold text-slate-600">{month}</span>
              <div className="bar-track flex">
                {dimensions.channels.map((channel) => (
                  <div
                    className="h-full"
                    key={channel.id}
                    style={{ width: `${((grouped[month]?.[channel.name] || 0) / max) * 100}%`, background: channel.color }}
                  />
                ))}
              </div>
              <span className="text-right text-sm font-semibold text-slate-700">{money(total)}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-5 flex gap-5 text-sm text-slate-600">
        {dimensions.channels.map((channel) => (
          <span className="flex items-center gap-2" key={channel.id}>
            <b className="h-3 w-3 rounded-sm" style={{ background: channel.color }} />
            {channel.name}
          </span>
        ))}
      </div>
    </section>
  );
}

function ChannelPanel({ rows }) {
  const grouped = groupBySum(rows, "channel");
  const total = sum(rows, "sales") || 1;

  return (
    <section className="panel p-5">
      <h2 className="text-lg font-semibold text-slate-950">Participacion por canal</h2>
      <p className="text-sm text-slate-500">Distribucion estimada del ingreso consolidado.</p>
      <div className="mt-6 space-y-5">
        {dimensions.channels.map((channel) => {
          const value = grouped[channel.name] || 0;
          const percent = (value / total) * 100;
          return (
          <div key={channel.id}>
            <div className="mb-2 flex justify-between text-sm">
              <span className="font-medium text-slate-700">{channel.name}</span>
              <span className="font-semibold text-slate-900">{percent.toFixed(1)}%</span>
            </div>
            <div className="bar-track">
              <div className="h-full rounded-full" style={{ width: `${percent}%`, background: channel.color }} />
            </div>
          </div>
        );})}
      </div>
    </section>
  );
}

function ProductTable({ rows }) {
  const grouped = Object.values(rows.reduce((acc, row) => {
    acc[row.product] ||= { name: row.product, category: row.category, units: 0, revenue: 0 };
    acc[row.product].units += row.units;
    acc[row.product].revenue += row.sales;
    return acc;
  }, {})).sort((a, b) => b.revenue - a.revenue).slice(0, 6);
  const max = Math.max(...grouped.map((row) => row.units), 1);

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
            {grouped.map((row) => (
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

function OlapControls({ filters, onChange }) {
  const fields = [
    ["region", "Region"],
    ["channel", "Canal"],
    ["category", "Categoria"]
  ];

  return (
    <section id="olap" className="panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-blue-700">Analisis OLAP</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">Cubo multidimensional de ventas</h2>
          <p className="mt-1 text-sm text-slate-500">Filtra por dimensiones para recalcular los indicadores y graficos estadisticos.</p>
        </div>
        <div className="grid w-full gap-3 md:w-auto md:grid-cols-3">
          {fields.map(([key, label]) => (
            <label className="text-sm font-medium text-slate-600" key={key}>
              {label}
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                value={filters[key]}
                onChange={(event) => onChange({ ...filters, [key]: event.target.value })}
              >
                <option value="Todos">Todos</option>
                {uniqueValues(factRows, key).map((value) => (
                  <option value={value} key={value}>{value}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </div>
    </section>
  );
}

function OlapMetricCards({ rows }) {
  const totalSales = sum(rows, "sales");
  const totalUnits = sum(rows, "units");
  const totalTransactions = sum(rows, "transactions");
  const ticket = totalTransactions ? totalSales / totalTransactions : 0;
  const margin = weightedMargin(rows);

  const metrics = [
    ["Ventas filtradas", money(totalSales), BarChart3, "bg-blue-50 text-blue-700"],
    ["Unidades vendidas", number(totalUnits), TableProperties, "bg-teal-50 text-teal-700"],
    ["Ticket OLAP", money(ticket), Receipt, "bg-amber-50 text-amber-700"],
    ["Margen ponderado", `${margin.toFixed(1)}%`, Sigma, "bg-emerald-50 text-emerald-700"]
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map(([label, value, Icon, tone]) => (
        <article className="panel p-5" key={label}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <div className={`grid h-9 w-9 place-items-center rounded-lg ${tone}`}>
              <Icon size={18} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-semibold text-slate-950">{value}</p>
        </article>
      ))}
    </div>
  );
}

function TrendChart({ rows }) {
  const monthOrder = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const grouped = groupBySum(rows, "month");
  const points = monthOrder.map((month) => ({ month, sales: grouped[month] || 0 }));
  const max = Math.max(...points.map((row) => row.sales), 1);
  const width = 680;
  const height = 240;
  const padding = 34;
  const coords = points.map((row, index) => {
    const x = padding + (index / (points.length - 1)) * (width - padding * 2);
    const y = height - padding - (row.sales / max) * (height - padding * 2);
    return { ...row, x, y };
  });
  const polyline = coords.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${padding},${height - padding} ${polyline} ${width - padding},${height - padding}`;

  return (
    <section className="panel p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Tendencia temporal</h2>
          <p className="text-sm text-slate-500">Serie mensual del cubo filtrado.</p>
        </div>
        <TrendingUp className="text-blue-700" size={22} />
      </div>
      <div className="mt-5 overflow-x-auto">
        <svg className="min-w-[620px]" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Grafico de tendencia temporal">
          <polygon points={area} fill="#dbeafe" opacity="0.9" />
          <polyline points={polyline} fill="none" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          {coords.map((point) => (
            <g key={point.month}>
              <circle cx={point.x} cy={point.y} r="5" fill="#0f172a" />
              <text x={point.x} y={height - 9} textAnchor="middle" fontSize="12" fill="#64748b">{point.month}</text>
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}

function ParetoChart({ rows }) {
  const grouped = groupBySum(rows, "category");
  const sorted = Object.entries(grouped)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  const total = sorted.reduce((acc, row) => acc + row.value, 0) || 1;
  let cumulative = 0;

  return (
    <section className="panel p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Pareto por categoria</h2>
          <p className="text-sm text-slate-500">Identifica las categorias que concentran mas ventas.</p>
        </div>
        <PieChart className="text-teal-700" size={22} />
      </div>
      <div className="mt-5 space-y-4">
        {sorted.map((row) => {
          cumulative += row.value;
          const percent = (row.value / total) * 100;
          const cumulativePercent = (cumulative / total) * 100;
          return (
            <div key={row.name}>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">{row.name}</span>
                <span className="font-semibold text-slate-900">{money(row.value)} | Acum. {cumulativePercent.toFixed(1)}%</span>
              </div>
              <div className="bar-track">
                <div className="h-full rounded-full bg-teal-500" style={{ width: `${percent}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Heatmap({ rows }) {
  const regions = dimensions.regions.map((region) => region.name);
  const categories = dimensions.categories.map((category) => category.name);
  const matrix = {};
  rows.forEach((row) => {
    const key = `${row.region}-${row.category}`;
    matrix[key] = (matrix[key] || 0) + row.sales;
  });
  const max = Math.max(...Object.values(matrix), 1);

  return (
    <section className="panel p-5">
      <h2 className="text-lg font-semibold text-slate-950">Mapa de calor region x categoria</h2>
      <p className="text-sm text-slate-500">Cruce OLAP para detectar concentracion de ventas.</p>
      <div className="mt-5 overflow-x-auto">
        <div className="grid min-w-[620px] gap-2" style={{ gridTemplateColumns: `120px repeat(${categories.length}, minmax(96px, 1fr))` }}>
          <div></div>
          {categories.map((category) => <div className="text-center text-xs font-bold uppercase text-slate-500" key={category}>{category}</div>)}
          {regions.map((region) => (
            <React.Fragment key={region}>
              <div className="flex items-center text-sm font-semibold text-slate-700">{region}</div>
              {categories.map((category) => {
                const value = matrix[`${region}-${category}`] || 0;
                const intensity = value / max;
                return (
                  <div
                    className="rounded-lg p-3 text-center text-xs font-semibold text-slate-900"
                    style={{ backgroundColor: `rgba(37, 99, 235, ${0.12 + intensity * 0.72})` }}
                    key={`${region}-${category}`}
                  >
                    {value ? money(value) : "-"}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}

function ScatterPlot({ rows }) {
  const regionTotals = dimensions.regions.map((regionDimension) => {
    const region = regionDimension.name;
    const regionRows = rows.filter((row) => row.region === region);
    return {
      region,
      sales: sum(regionRows, "sales"),
      margin: weightedMargin(regionRows),
      transactions: sum(regionRows, "transactions")
    };
  }).filter((row) => row.sales > 0);
  const maxSales = Math.max(...regionTotals.map((row) => row.sales), 1);
  const maxTransactions = Math.max(...regionTotals.map((row) => row.transactions), 1);

  return (
    <section className="panel p-5">
      <h2 className="text-lg font-semibold text-slate-950">Dispersión ventas vs margen</h2>
      <p className="text-sm text-slate-500">Cada punto representa una region del cubo filtrado.</p>
      <div className="mt-5 overflow-x-auto">
        <svg className="min-w-[520px]" viewBox="0 0 560 260" role="img" aria-label="Grafico de dispersion">
          <line x1="42" y1="218" x2="520" y2="218" stroke="#cbd5e1" />
          <line x1="42" y1="24" x2="42" y2="218" stroke="#cbd5e1" />
          {regionTotals.map((row) => {
            const x = 42 + (row.sales / maxSales) * 450;
            const y = 218 - (row.margin / 40) * 180;
            const radius = 8 + (row.transactions / maxTransactions) * 14;
            return (
              <g key={row.region}>
                <circle cx={x} cy={y} r={radius} fill="#14b8a6" opacity="0.78" />
                <text x={x} y={y - radius - 5} textAnchor="middle" fontSize="12" fill="#334155">{row.region}</text>
              </g>
            );
          })}
          <text x="280" y="250" textAnchor="middle" fontSize="12" fill="#64748b">Ventas</text>
          <text x="14" y="126" textAnchor="middle" fontSize="12" fill="#64748b" transform="rotate(-90 14 126)">Margen %</text>
        </svg>
      </div>
    </section>
  );
}

function PivotTable({ rows }) {
  const regions = dimensions.regions.map((region) => region.name);
  const channels = dimensions.channels.map((channel) => channel.name);
  const matrix = {};
  rows.forEach((row) => {
    const key = `${row.region}-${row.channel}`;
    matrix[key] = (matrix[key] || 0) + row.sales;
  });

  return (
    <section className="panel p-5">
      <h2 className="text-lg font-semibold text-slate-950">Tabla pivote region x canal</h2>
      <p className="text-sm text-slate-500">Vista tabular del cubo para comparar dimensiones.</p>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="py-3">Region</th>
              {channels.map((channel) => <th key={channel}>{channel}</th>)}
              <th>Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {regions.map((region) => {
              const total = channels.reduce((acc, channel) => acc + (matrix[`${region}-${channel}`] || 0), 0);
              return (
                <tr key={region}>
                  <td className="py-3 font-semibold text-slate-800">{region}</td>
                  {channels.map((channel) => <td key={channel}>{matrix[`${region}-${channel}`] ? money(matrix[`${region}-${channel}`]) : "-"}</td>)}
                  <td className="font-semibold text-slate-900">{money(total)}</td>
                </tr>
              );
            })}
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
        {data.processes.etl.map((row, index) => (
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
          {data.model.dimensions.slice(0, 3).map((dimension) => (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-center text-sm font-semibold text-indigo-900" key={dimension}>{dimension}</div>
          ))}
        </div>
        <div className="rounded-lg border border-teal-200 bg-teal-50 p-5 text-center text-teal-950">
          <p className="text-xs uppercase tracking-wide">Tabla de hechos</p>
          <h3 className="mt-1 text-xl font-bold">{data.model.fact}</h3>
          <p className="mt-3 text-sm">Metricas: {data.model.measures.join(", ")}</p>
        </div>
        <div className="space-y-3">
          {data.model.dimensions.slice(3).map((dimension) => (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-center text-sm font-semibold text-indigo-900" key={dimension}>{dimension}</div>
          ))}
        </div>
      </div>
    </section>
  );
}

function App() {
  const [filters, setFilters] = useState({
    region: "Todos",
    channel: "Todos",
    category: "Todos"
  });
  const totalSales = sum(factRows, "sales");
  const totalTransactions = sum(factRows, "transactions");
  const totalRecords = data.facts.length;
  const avgQuality = data.facts.reduce((acc, row) => acc + row.dataQuality, 0) / totalRecords;
  const kpis = [
    {
      label: "Ingresos consolidados",
      value: money(totalSales),
      helper: "Calculado desde la tabla de hechos",
      Icon: BarChart3,
      tone: "bg-blue-50 text-blue-700"
    },
    {
      label: "Ticket promedio",
      value: money(totalTransactions ? totalSales / totalTransactions : 0),
      helper: `${number(totalTransactions)} transacciones integradas`,
      Icon: Receipt,
      tone: "bg-amber-50 text-amber-700"
    },
    {
      label: "Registros de hechos",
      value: number(totalRecords),
      helper: "Filas simuladas en facts",
      Icon: Database,
      tone: "bg-teal-50 text-teal-700"
    },
    {
      label: "Calidad promedio",
      value: `${avgQuality.toFixed(1)}%`,
      helper: "Promedio de dataQuality",
      Icon: ShieldCheck,
      tone: "bg-emerald-50 text-emerald-700"
    }
  ];
  const regionSummary = dimensions.regions.map((region) => {
    const rows = factRows.filter((row) => row.region === region.name);
    return {
      ...region,
      sales: sum(rows, "sales")
    };
  }).sort((a, b) => b.sales - a.sales);
  const filteredFacts = useMemo(() => {
    return factRows.filter((row) => {
      return (
        (filters.region === "Todos" || row.region === filters.region) &&
        (filters.channel === "Todos" || row.channel === filters.channel) &&
        (filters.category === "Todos" || row.category === filters.category)
      );
    });
  }, [filters]);

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
            ["olap", "Analisis OLAP", Sigma],
            ["modelo", "Modelo DWH", Network]
          ].map(([id, label, Icon]) => (
            <a className="flex items-center gap-3 rounded-lg px-3 py-3 text-slate-300 hover:bg-white/10 hover:text-white" href={`#${id}`} key={id}>
              <Icon size={18} />
              <span>{label}</span>
            </a>
          ))}
        </nav>
        <div className="mt-8 rounded-lg bg-white/10 p-4">
          <p className="text-sm font-semibold text-white">Periodo analizado</p>
          <p className="mt-1 text-sm text-slate-300">{data.metadata.period}</p>
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
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {kpis.map((item) => <KpiCard item={item} key={item.label} />)}
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[1.7fr_1fr]">
              <SalesChart rows={factRows} />
              <ChannelPanel rows={factRows} />
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_1fr]">
              <ProductTable rows={factRows} />
              <section className="panel p-5">
                <h2 className="text-lg font-semibold text-slate-950">Ventas por region</h2>
                <p className="text-sm text-slate-500">Vista para priorizar abastecimiento y acciones comerciales.</p>
                <div className="mt-5 space-y-3">
                  {regionSummary.map((region) => (
                    <div className="rounded-lg border border-slate-200 p-4" key={region.id}>
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

            <div className="mt-6 space-y-6">
              <OlapControls filters={filters} onChange={setFilters} />
              <OlapMetricCards rows={filteredFacts} />
              <div className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
                <TrendChart rows={filteredFacts} />
                <ParetoChart rows={filteredFacts} />
              </div>
              <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
                <Heatmap rows={filteredFacts} />
                <ScatterPlot rows={filteredFacts} />
              </div>
              <PivotTable rows={filteredFacts} />
            </div>
          </div>
        </section>

        <section id="modelo" className="px-4 pb-8 md:px-8">
          <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[1.1fr_1fr]">
            <EtlPipeline />
            <StarSchema />
          </div>
        </section>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
