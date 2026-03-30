import { useState, useMemo, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from "recharts";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const MONTHS = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];

// ── 年份常量 ────────────────────────────────────────────────
const START_YEAR   = 2026;
const CURRENT_YEAR = new Date().getFullYear();
const END_YEAR     = Math.max(CURRENT_YEAR + 2, 2030);
// 例：今年2026 → END=2030；今年2029 → END=2031；永不撞墙

const DEFAULT_VAR_COSTS = [
  { id: 1, name: "胶片冲印耗材",  desc: "冲印所需耗材成本",       unitCost: 0, qty: "" },
  { id: 2, name: "设备清洁维护",  desc: "相机清洁保养服务",       unitCost: 0, qty: "" },
  { id: 3, name: "周边物料礼品",  desc: "贴纸、挂绳等周边物料",   unitCost: 0, qty: "" },
  { id: 4, name: "消费抵扣券",    desc: "核销消费抵扣券成本",     unitCost: 0, qty: "" },
  { id: 5, name: "冲印优惠券",    desc: "核销冲印优惠券成本",     unitCost: 0, qty: "" },
  { id: 6, name: "活动赠品",      desc: "节日 / 活动赠品物料",    unitCost: 0, qty: "" },
];

const DEFAULT_FIXED_COSTS = [
  { id: 1, name: "店铺租金",      desc: "月度店铺租金",           amount: "" },
  { id: 2, name: "水电网络费",    desc: "水、电、宽带月度费用",   amount: "" },
  { id: 3, name: "员工薪资",      desc: "本月员工薪资合计",       amount: "" },
  { id: 4, name: "设备折旧",      desc: "相机等设备折旧摊销",     amount: "" },
  { id: 5, name: "其他固定支出",  desc: "其他月度固定费用",       amount: "" },
];

const FUNNEL_FIELDS = [
  { key: "daodian",   label: "到店人数" },
  { key: "fatie",     label: "发帖人数" },
  { key: "jiawei",    label: "加微人数" },
  { key: "jinqun",    label: "进群人数" },
  { key: "chengjiao", label: "成交人数" },
  { key: "fugou",     label: "复购人数" },
  { key: "zhuanjie",  label: "转介绍人数" },
];

const n   = (v) => parseFloat(v) || 0;
const pct = (a, b) => n(b) > 0 ? ((n(a) / n(b)) * 100).toFixed(1) + "%" : "—";
const yuan = (a, b) => n(b) > 0 ? "¥" + (n(a) / n(b)).toFixed(2) : "—";

const defaultRow = () => ({
  daodian: "", fatie: "", jiawei: "", jinqun: "",
  chengjiao: "", fugou: "", zhuanjie: "",
  revenue: "", revenueTarget: "", grossProfit: "",
  rewards:    DEFAULT_VAR_COSTS.map((r) => ({ ...r })),
  fixedCosts: DEFAULT_FIXED_COSTS.map((f) => ({ ...f })),
});

const defaultYearData = () => {
  const d = {};
  MONTHS.forEach((_, i) => { d[i] = defaultRow(); });
  return d;
};

function Collapse({ title, dark = false, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-2xl shadow-sm overflow-hidden border ${dark ? "bg-stone-800 border-stone-700" : "bg-white border-stone-100"}`}>
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between px-4 py-3 transition-all ${dark ? "hover:bg-stone-700" : "hover:bg-stone-50"}`}
      >
        <h3 className={`text-sm font-semibold ${dark ? "text-white" : "text-stone-700"}`}>{title}</h3>
        <span className={`text-xs transition-transform duration-200 ${open ? "rotate-180" : ""} ${dark ? "text-stone-400" : "text-stone-400"}`}>▼</span>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

export default function App() {
  // ── activeYear 初始值 = START_YEAR ────────────────────────
  const [activeYear,  setActiveYear]  = useState(START_YEAR);
  const [activeMonth, setActiveMonth] = useState(new Date().getMonth());
  const [section, setSection] = useState("funnel");

  const [data, setData] = useState(() => ({
    [START_YEAR]: defaultYearData(),
  }));

  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const saveTimer = useRef(null);

  // 切换年份时，若该年数据不存在则自动初始化
  useEffect(() => {
    setData((prev) => {
      if (prev[activeYear]) return prev;
      return { ...prev, [activeYear]: defaultYearData() };
    });
  }, [activeYear]);

  // 初始加载远端数据
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: rows } = await supabase.from("monthly_data").select("*");
      if (rows?.length) {
        setData((prev) => {
          const next = { ...prev };
          rows.forEach((r) => {
            const yr = r.year ?? START_YEAR;
            if (!next[yr]) next[yr] = defaultYearData();
            next[yr] = {
              ...next[yr],
              [r.month_index]: {
                daodian:       r.daodian        ?? "",
                fatie:         r.fatie          ?? "",
                jiawei:        r.jiawei         ?? "",
                jinqun:        r.jinqun         ?? "",
                chengjiao:     r.chengjiao      ?? "",
                fugou:         r.fugou          ?? "",
                zhuanjie:      r.zhuanjie       ?? "",
                revenue:       r.revenue        ?? "",
                revenueTarget: r.revenue_target ?? "",
                grossProfit:   r.gross_profit   ?? "",
                rewards:    r.rewards     ?? DEFAULT_VAR_COSTS.map((x) => ({ ...x })),
                fixedCosts: r.fixed_costs ?? DEFAULT_FIXED_COSTS.map((x) => ({ ...x })),
              },
            };
          });
          return next;
        });
      }
      setLoading(false);
    })();
  }, []);

  const scheduleSave = (year, idx, rowData) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      await supabase.from("monthly_data").upsert(
        {
          year,
          month_index:    idx,
          daodian:        n(rowData.daodian),
          fatie:          n(rowData.fatie),
          jiawei:         n(rowData.jiawei),
          jinqun:         n(rowData.jinqun),
          chengjiao:      n(rowData.chengjiao),
          fugou:          n(rowData.fugou),
          zhuanjie:       n(rowData.zhuanjie),
          revenue:        n(rowData.revenue),
          revenue_target: n(rowData.revenueTarget),
          gross_profit:   n(rowData.grossProfit),
          rewards:        rowData.rewards,
          fixed_costs:    rowData.fixedCosts,
          updated_at:     new Date().toISOString(),
        },
        { onConflict: "year,month_index" }
      );
      setSaving(false);
      setLastSaved(new Date());
    }, 1200);
  };

  const row = (data[activeYear] ?? defaultYearData())[activeMonth] ?? defaultRow();

  const setField = (key, val) =>
    setData((prev) => {
      const yearData = prev[activeYear] ?? defaultYearData();
      const newRow = { ...yearData[activeMonth], [key]: val };
      scheduleSave(activeYear, activeMonth, newRow);
      return { ...prev, [activeYear]: { ...yearData, [activeMonth]: newRow } };
    });

  const setReward = (id, field, val) =>
    setData((prev) => {
      const yearData = prev[activeYear] ?? defaultYearData();
      const newRewards = yearData[activeMonth].rewards.map((r) =>
        r.id === id ? { ...r, [field]: val } : r
      );
      const newRow = { ...yearData[activeMonth], rewards: newRewards };
      scheduleSave(activeYear, activeMonth, newRow);
      return { ...prev, [activeYear]: { ...yearData, [activeMonth]: newRow } };
    });

  const setFixedCost = (id, val) =>
    setData((prev) => {
      const yearData = prev[activeYear] ?? defaultYearData();
      const newFixed = yearData[activeMonth].fixedCosts.map((f) =>
        f.id === id ? { ...f, amount: val } : f
      );
      const newRow = { ...yearData[activeMonth], fixedCosts: newFixed };
      scheduleSave(activeYear, activeMonth, newRow);
      return { ...prev, [activeYear]: { ...yearData, [activeMonth]: newRow } };
    });

  const calc = useMemo(() => {
    const r = row;
    const totalVar   = r.rewards.reduce((s, rw) => s + n(rw.unitCost) * n(rw.qty), 0);
    const totalFixed = r.fixedCosts.reduce((s, f) => s + n(f.amount), 0);
    const totalCost  = totalVar + totalFixed;
    const rev = n(r.revenue);
    const gp  = n(r.grossProfit);
    const varRatioRaw   = rev > 0 ? (totalVar   / rev) * 100 : null;
    const fixedRatioRaw = rev > 0 ? (totalFixed / rev) * 100 : null;
    const totalRatioRaw = rev > 0 ? (totalCost  / rev) * 100 : null;
    return {
      fatiePct:      pct(r.fatie,     r.daodian),
      jiawei_pct:    pct(r.jiawei,    r.daodian),
      jinqun_pct:    pct(r.jinqun,    r.jiawei),
      chengjiao_pct: pct(r.chengjiao, r.daodian),
      fugou_pct:     pct(r.fugou,     r.chengjiao),
      zhuanjie_pct:  pct(r.zhuanjie,  r.chengjiao),
      ugcUnit:    yuan(totalVar, r.fatie),
      privateAcq: yuan(totalVar, r.jiawei),
      dealCost:   yuan(totalVar, r.chengjiao),
      totalVar, totalFixed, totalCost,
      varRatio:   varRatioRaw   !== null ? varRatioRaw.toFixed(1)   + "%" : "—",
      fixedRatio: fixedRatioRaw !== null ? fixedRatioRaw.toFixed(1) + "%" : "—",
      totalRatio: totalRatioRaw !== null ? totalRatioRaw.toFixed(1) + "%" : "—",
      varRatioHigh: varRatioRaw !== null && varRatioRaw > 5,
      gpRate:     rev > 0 ? ((gp / rev) * 100).toFixed(1) + "%" : "—",
      achievePct: n(r.revenueTarget) > 0 ? ((rev / n(r.revenueTarget)) * 100).toFixed(1) + "%" : "—",
      netProfit:      gp - totalCost,
      netProfitValid: gp > 0,
      rev, gp,
    };
  }, [row]);

  const allMonths = MONTHS.map((m, i) => {
    const d = (data[activeYear] ?? {})[i] ?? defaultRow();
    const totalVar   = d.rewards.reduce((s, rw) => s + n(rw.unitCost) * n(rw.qty), 0);
    const totalFixed = d.fixedCosts.reduce((s, f) => s + n(f.amount), 0);
    return {
      name: m, 营收: n(d.revenue), 毛利: n(d.grossProfit),
      变动成本: totalVar, 固定成本: totalFixed,
      到店: n(d.daodian), 成交: n(d.chengjiao),
    };
  });

  const SECTIONS = [
    { key: "funnel",   label: "🔻 漏斗" },
    { key: "revenue",  label: "📈 营收" },
    { key: "variable", label: "🔄 变动成本" },
    { key: "fixed",    label: "🏪 固定成本" },
  ];

  if (loading) return (
    <div className="min-h-screen bg-amber-50 flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="text-5xl">📊</div>
        <p className="text-stone-400 text-sm">加载数据中…</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-amber-50 pb-16">

      {/* ── Header ───────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-amber-50/90 backdrop-blur border-b border-amber-100 px-4 pt-4 pb-2 space-y-3">

        {/* 年份切换行 */}
        <div className="flex items-center justify-between">
          {/* ← 左箭头：到达 START_YEAR 时禁用 */}
          <button
            onClick={() => setActiveYear((y) => y - 1)}
            disabled={activeYear <= START_YEAR}
            className="w-8 h-8 flex items-center justify-center rounded-full
                       bg-white border border-stone-200 text-stone-500
                       disabled:opacity-30 disabled:cursor-not-allowed
                       hover:enabled:bg-amber-100 transition"
          >
            ←
          </button>

          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-stone-800 tabular-nums">
              {activeYear} 年
            </span>
            {/* 今年标记 */}
            {activeYear === CURRENT_YEAR && (
              <span className="text-xs bg-amber-400 text-white px-1.5 py-0.5 rounded-full">
                今年
              </span>
            )}
            {/* 不在今年时，显示「回到今年」快捷按钮 */}
            {activeYear !== CURRENT_YEAR && (
              <button
                onClick={() => setActiveYear(CURRENT_YEAR)}
                className="text-xs text-amber-600 underline underline-offset-2"
              >
                回到今年
              </button>
            )}
          </div>

          {/* → 右箭头：到达 END_YEAR 时禁用 */}
          <button
            onClick={() => setActiveYear((y) => y + 1)}
            disabled={activeYear >= END_YEAR}
            className="w-8 h-8 flex items-center justify-center rounded-full
                       bg-white border border-stone-200 text-stone-500
                       disabled:opacity-30 disabled:cursor-not-allowed
                       hover:enabled:bg-amber-100 transition"
          >
            →
          </button>
        </div>

        {/* 月份切换行 */}
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
          {MONTHS.map((m, i) => (
            <button
              key={i}
              onClick={() => setActiveMonth(i)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                activeMonth === i
                  ? "bg-amber-400 text-white shadow"
                  : "bg-white text-stone-500 border border-stone-200"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Section Tab */}
        <div className="flex gap-1">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              className={`flex-1 py-1.5 rounded-xl text-xs font-medium transition-all ${
                section === s.key
                  ? "bg-stone-800 text-white"
                  : "bg-white text-stone-500 border border-stone-200"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* 保存状态 */}
        <div className="text-right text-xs text-stone-400 h-4">
          {saving ? "⏳ 保存中…" : lastSaved ? `✅ 已保存 ${lastSaved.toLocaleTimeString()}` : ""}
        </div>
      </header>

      {/* ── 主内容区（保持不变）────────────────────────────── */}
      <main className="px-4 pt-4 space-y-4 max-w-lg mx-auto">
        {/* ... 你原有的 section 渲染逻辑保持不变 ... */}
      </main>
    </div>
  );
}
