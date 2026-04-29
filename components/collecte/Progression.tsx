import { BarChart3, TrendingUp, Target, CheckCircle2 } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend
} from "recharts";

// Données d'exemple pour la collecte
const decoupage = [
  { exploitation: "Exploitation A", taux: 78, collectes: 78, attendus: 100 },
  { exploitation: "Exploitation B", taux: 45, collectes: 45, attendus: 100 },
  { exploitation: "Exploitation C", taux: 92, collectes: 92, attendus: 100 },
  { exploitation: "Exploitation D", taux: 23, collectes: 23, attendus: 100 },
  { exploitation: "Exploitation E", taux: 67, collectes: 67, attendus: 100 },
  { exploitation: "Exploitation F", taux: 34, collectes: 34, attendus: 100 },
  { exploitation: "Exploitation G", taux: 88, collectes: 88, attendus: 100 },
];

const pctCol = (taux: number) => {
  if (taux >= 70) return { fill: "#10B981", gradient: "from-emerald-500 to-teal-500" };
  if (taux >= 40) return { fill: "#F59E0B", gradient: "from-amber-500 to-orange-500" };
  return { fill: "#EF4444", gradient: "from-red-500 to-rose-500" };
};

// Données pour le pie chart
const pieData = [
  { name: "Collectés", value: 46, color: "#10B981" },
  { name: "En cours", value: 9, color: "#3B82F6" },
  { name: "Restants", value: 45, color: "#E5E7EB" },
];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg bg-white/95 backdrop-blur-sm border border-gray-200 shadow-xl p-3">
        <p className="text-sm font-semibold text-gray-900">{payload[0].name}</p>
        <p className="text-2xl font-bold" style={{ color: payload[0].payload.color }}>
          {payload[0].value}%
        </p>
      </div>
    );
  }
  return null;
};

export default function CollecteAvancement() {
  const totalCollectes = decoupage.reduce((acc, d) => acc + d.collectes, 0);
  const totalAttendus = decoupage.reduce((acc, d) => acc + d.attendus, 0);
  const globalProgress = (totalCollectes / totalAttendus) * 100;

  return (
    <div className="group overflow-hidden rounded-3xl bg-gradient-to-br from-white via-white to-gray-50/50 border border-gray-200/80 shadow-xl hover:shadow-2xl transition-all duration-500">
      {/* Header avec effet glassmorphism */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 via-transparent to-emerald-600/5" />
        <div className="relative flex items-center justify-between border-b border-gray-200/60 px-6 py-5 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-400 rounded-2xl blur-lg opacity-30" />
              <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-blue-500 shadow-lg">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
            </div>
            <div>
              <p className="text-base font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                État d'avancement de la collecte
              </p>
              <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                <Target className="h-3 w-3" />
                Pourcentages de collecte par catégorie
              </p>
            </div>
          </div>
          
          {/* Indicateur global */}
          <div className="hidden md:flex items-center gap-3 rounded-full bg-gradient-to-r from-emerald-50 to-blue-50 px-4 py-2 border border-gray-200/60">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            <div>
              <p className="text-xs text-gray-600">Progression globale</p>
              <p className="text-lg font-bold text-gray-900">
                {globalProgress.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2">
        {/* Section Par exploitation avec scroll */}
        <div className="border-b border-gray-200/60 p-6 lg:border-b-0 lg:border-r bg-gradient-to-b from-white to-gray-50/30">
          <div className="flex items-center justify-between mb-5">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              PAR EXPLOITATION
            </p>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <CheckCircle2 className="h-3 w-3" />
              {decoupage.length} exploitations
            </div>
          </div>
          
          {/* Zone scrollable */}
          <div className="max-h-[320px] overflow-y-auto pr-2 custom-scrollbar space-y-4">
            {decoupage.map((d, idx) => {
              const c = pctCol(d.taux);
              return (
                <div 
                  key={d.exploitation}
                  className="group/item relative transition-all duration-300 hover:scale-[1.02]"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  {/* Carte individuelle avec effet hover */}
                  <div className="relative rounded-xl bg-white p-3 transition-all duration-300 hover:shadow-md border border-gray-100/80 hover:border-gray-200/80">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div 
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: c.fill }}
                        />
                        <span className="text-sm font-semibold text-gray-800">
                          {d.exploitation}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span 
                          className="text-sm font-bold bg-gradient-to-r bg-clip-text text-transparent"
                          style={{ 
                            backgroundImage: `linear-gradient(135deg, ${c.fill}, ${c.fill}cc)`,
                            WebkitBackgroundClip: 'text'
                          }}
                        >
                          {d.taux}%
                        </span>
                      </div>
                    </div>
                    
                    {/* Barre de progression animée */}
                    <div className="relative mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
                      <div 
                        className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out"
                        style={{ 
                          width: `${d.taux}%`,
                          background: `linear-gradient(90deg, ${c.fill}, ${c.fill}dd)`,
                        }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent animate-shimmer" />
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-gray-500">
                        {d.collectes} / {d.attendus} collectés
                      </p>
                      {d.taux === 100 && (
                        <span className="text-xs font-medium text-emerald-600">✓ Complet</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section Vue globale avec pie chart Recharts */}
        <div className="p-6 bg-gradient-to-br from-gray-50/50 to-white">
          <div className="flex items-center justify-between mb-5">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              VUE GLOBALE
            </p>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
              En temps réel
            </div>
          </div>
          
          <div className="flex flex-col items-center gap-6">
            {/* Pie Chart avec Recharts */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-3xl font-bold text-gray-900">{globalProgress.toFixed(0)}%</p>
                  <p className="text-xs text-gray-500 mt-0.5">global</p>
                </div>
              </div>
              <ResponsiveContainer width={200} height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.color}
                        className="transition-all duration-300 hover:opacity-80 cursor-pointer"
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Légende améliorée */}
            <div className="flex flex-wrap justify-center gap-5">
              {pieData.map((item) => (
                <div 
                  key={item.name} 
                  className="group/legend flex items-center gap-2.5 rounded-full bg-white/80 px-3 py-1.5 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer"
                >
                  <div 
                    className="h-2.5 w-2.5 rounded-full transition-all duration-300 group-hover/legend:scale-110"
                    style={{ backgroundColor: item.color }}
                  />
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-gray-700">{item.name}</span>
                    <span 
                      className="text-xs font-bold"
                      style={{ color: item.color }}
                    >
                      {item.value}%
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Statistiques rapides */}
            <div className="w-full grid grid-cols-2 gap-3 mt-2 pt-3 border-t border-gray-200/60">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{totalCollectes}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Total collectés</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{totalAttendus}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Objectif total</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

