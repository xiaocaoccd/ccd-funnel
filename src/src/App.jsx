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

const CURRENT_YEAR = new Date().getFullYear();
const WINDOW_SIZE  = 5;
const MONTHS = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];

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
  { key: "daodian",   label: "到店人数",   color: "bg-amber-600" },
  { key: "fatie",     label: "发帖人数",   color: "bg-amber-500" },
  { key: "hege",      label: "合格发帖数", color: "bg-yellow-500" },
  { key: "baoliu7",   label: "7天保留数",  color: "bg-yellow-400" },
  { key: "jiawei",    label: "加微人数",   color: "bg-orange-500" },
  { key: "jinqun",    label: "进群人数",   color: "bg-orange-400" },
  { key: "chengjiao", label: "成交人数",   color: "bg-green-500" },
  { key: "fugou",     label: "复购人数",   color: "bg-teal-500" },
  { key: "zhuanjie",  label: "转介绍人数", color: "bg-blue-400" },
];

const n      = (v) => parseFloat(v) || 0;
const hasVal = (v) => v !== "" && v !== null && v !== undefined;
const pctNum = (a, b) => n(b) > 0 ? (n(a) / n(b)) * 100 : null;
const fmtPct = (num)  => num !== null ? num.toFixed(1) + "%" : "—";
const pct    = (a, b) => fmtPct(pctNum(a, b));
const yuan   = (a, b) => n(b) > 0 ? "¥" + (n(a) / n(b)).toFixed(0) : "—";

const defaultRow = () => ({
  daodian: "", fatie: "", hege: "", baoliu7: "",
  jiawei: "", jinqun: "", chengjiao: "", fugou: "", zhuanjie: "",
  revenue: "", revenueTarget: "", grossProfit: "",
  qunTotal: "", qunActive: "", kocCount: "", xiaohongshu: "", douyin: "",
  rewards:    DEFAULT_VAR_COSTS.map((r) => ({ ...r })),
  fixedCosts: DEFAULT_FIXED_COSTS.map((f) => ({ ...f })),
});

const initYear = () => {
  const d = {};
  MONTHS.forEach((_, mi) => { d[mi] = defaultRow(); });
  return d;
};

const initAllData = () => {
  const d = {};
  for (let y = CURRENT_YEAR - 3; y <= CURRENT_YEAR + 12; y++) d[y] = initYear();
  return d;
};

const ensureYear = (data, year) => {
  if (data[year]) return data;
  return { ...data, [year]: initYear() };
};

// ── Collapsible：支持 defaultOpen（CCD）和 dark（初见）两种用法 ──
function Collapsible({ title, dark = false, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`rounded-2xl shadow-sm overflow-hidden border ${dark ? "bg-stone-800 border-stone-700" : "bg-white border-stone-100"}`}>
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex justify-between items-center px-4 py-3 text-sm font-semibold transition-all ${dark ? "hover:bg-stone-700" : "hover:bg-stone-50"}`}
      >
        <span className={dark ? "text-white" : "text-stone-700"}>{title}</span>
        <span className={`text-stone-400 text-xs transition-transform duration-200 ${open ? "rotate-180" : ""}`}>▼</span>
      </button>
      {open && (
        <div className={`p-4 border-t ${dark ? "border-stone-700" : "border-stone-100"}`}>
          {children}
        </div>
      )}
    </div>
  );
}

function GoalCard({ label, actual, target, unit, desc }) {
  let status = "gray";
  if (actual !== null) {
    if (actual >= target)          status = "green";
    else if (actual >= target * 0.7) status = "yellow";
    else                           status = "red";
  }
  const C = {
    green:  { bg: "bg-green-50",  text: "text-green-700",  badge: "bg-green-100 text-green-700",  tag: "达标 ✓" },
    yellow: { bg: "bg-yellow-50", text: "text-yellow-700", badge: "bg-yellow-100 text-yellow-700", tag: "接近" },
    red:    { bg: "bg-red-50",    text: "text-red-600",    badge: "bg-red-100 text-red-600",       tag: "未达标" },
    gray:   { bg: "bg-stone-50",  text: "text-stone-400",  badge: "bg-stone-100 text-stone-400",   tag: "待录入" },
  }[status];
  return (
    <div className={`rounded-xl p-3 ${C.bg}`}>
      <div className="flex justify-between items-start mb-1.5">
        <span className="text-xs font-medium text-stone-600">{label}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${C.badge}`}>{C.tag}</span>
      </div>
      <div className={`text-xl font-bold ${C.text}`}>
        {actual !== null ? `${Number.isInteger(actual) ? actual : actual.toFixed(1)}${unit}` : "—"}
      </div>
      <div className="text-xs text-stone-400 mt-1">目标 ≥ {target}{unit} · {desc}</div>
    </div>
  );
}

export default function App() {
  const now = new Date();
  const [windowStart, setWindowStart] = useState(CURRENT_YEAR);
  const [activeYear, setActiveYear]   = useState(CURRENT_YEAR);
  const [activeMonth, setActiveMonth] = useState(now.getMonth());
  const [section, setSection]         = useState("funnel");
  const [data, setData]               = useState(initAllData);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [lastSaved, setLastSaved]     = useState(null);
  const saveTimer = useRef(null);

  const visibleYears = Array.from({ length: WINDOW_SIZE }, (_, i) => windowStart + i);

  // ── 云端加载 ──
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: rows } = await supabase.from("monthly_data").select("*");
      if (rows?.length) {
        setData((prev) => {
          const next = { ...prev };
          rows.forEach((r) => {
            const yr = r.year ?? CURRENT_YEAR;
            if (!next[yr]) next[yr] = initYear();
            next[yr] = { ...next[yr] };
            next[yr][r.month_index] = {
              daodian:       r.daodian        ?? "",
              fatie:         r.fatie          ?? "",
              hege:          r.hege           ?? "",
              baoliu7:       r.baoliu7        ?? "",
              jiawei:        r.jiawei         ?? "",
              jinqun:        r.jinqun         ?? "",
              chengjiao:     r.chengjiao      ?? "",
              fugou:         r.fugou          ?? "",
              zhuanjie:      r.zhuanjie       ?? "",
              revenue:       r.revenue        ?? "",
              revenueTarget: r.revenue_target ?? "",
              grossProfit:   r.gross_profit   ?? "",
              qunTotal:      r.qun_total      ?? "",
              qunActive:     r.qun_active     ?? "",
              kocCount:      r.koc_count      ?? "",
              xiaohongshu:   r.xiaohongshu    ?? "",
              douyin:        r.douyin         ?? "",
              rewards:    r.rewards    ?? DEFAULT_VAR_COSTS.map((x) => ({ ...x })),
              fixedCosts: r.fixed_costs ?? DEFAULT_FIXED_COSTS.map((x) => ({ ...x })),
            };
          });
          return next;
        });
      }
      setLoading(false);
    })();
  }, []);

  // ── 云端防抖保存（复合主键 year + month_index）──
  const scheduleSave = (year, idx, rowData) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      await supabase.from("monthly_data").upsert(
        {
          year:           year,
          month_index:    idx,
          daodian:        n(rowData.daodian),
          fatie:          n(rowData.fatie),
          hege:           n(rowData.hege),
          baoliu7:        n(rowData.baoliu7),
          jiawei:         n(rowData.jiawei),
          jinqun:         n(rowData.jinqun),
          chengjiao:      n(rowData.chengjiao),
          fugou:          n(rowData.fugou),
          zhuanjie:       n(rowData.zhuanjie),
          revenue:        n(rowData.revenue),
          revenue_target: n(rowData.revenueTarget),
          gross_profit:   n(rowData.grossProfit),
          qun_total:      n(rowData.qunTotal),
          qun_active:     n(rowData.qunActive),
          koc_count:      n(rowData.kocCount),
          xiaohongshu:    n(rowData.xiaohongshu),
          douyin:         n(rowData.douyin),
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

  const handleWindowPrev = () => {
    const ns = windowStart - 1;
    setWindowStart(ns);
    setData((prev) => ensureYear(prev, ns));
  };
  const handleWindowNext = () => {
    const ns = windowStart + 1;
    setWindowStart(ns);
    setData((prev) => ensureYear(prev, ns + WINDOW_SIZE - 1));
  };
  const handleYearClick = (y) => {
    setActiveYear(y);
    setData((prev) => ensureYear(prev, y));
  };

  const row = data[activeYear]?.[activeMonth] ?? defaultRow();

  const setField = (key, val) =>
    setData((prev) => {
      const newRow = { ...(prev[activeYear]?.[activeMonth] ?? defaultRow()), [key]: val };
      scheduleSave(activeYear, activeMonth, newRow);
      return { ...prev, [activeYear]: { ...(prev[activeYear] ?? initYear()), [activeMonth]: newRow } };
    });

  const setReward = (id, field, val) =>
    setData((prev) => {
      const cur = prev[activeYear]?.[activeMonth] ?? defaultRow();
      const newRewards = cur.rewards.map((r) => r.id === id ? { ...r, [field]: val } : r);
      const newRow = { ...cur, rewards: newRewards };
      scheduleSave(activeYear, activeMonth, newRow);
      return { ...prev, [activeYear]: { ...(prev[activeYear] ?? initYear()), [activeMonth]: newRow } };
    });

  const setFixed = (id, val) =>
    setData((prev) => {
      const cur = prev[activeYear]?.[activeMonth] ?? defaultRow();
      const newFixed = cur.fixedCosts.map((f) => f.id === id ? { ...f, amount: val } : f);
      const newRow = { ...cur, fixedCosts: newFixed };
      scheduleSave(activeYear, activeMonth, newRow);
      return { ...prev, [activeYear]: { ...(prev[activeYear] ?? initYear()), [activeMonth]: newRow } };
    });

  const calc = useMemo(() => {
    const r = row;
    const totalVar   = r.rewards.reduce((s, rw) => s + n(rw.unitCost) * n(rw.qty), 0);
    const totalFixed = r.fixedCosts.reduce((s, f) => s + n(f.amount), 0);
    const totalCost  = totalVar + totalFixed;
    const rev = n(r.revenue), gp = n(r.grossProfit);
    const varPctRaw   = rev > 0 ? totalVar   / rev * 100 : null;
    const fixedPctRaw = rev > 0 ? totalFixed / rev * 100 : null;
    const totalPctRaw = rev > 0 ? totalCost  / rev * 100 : null;
    const fatieRate  = pctNum(r.fatie,     r.daodian);
    const baoliuRate = pctNum(r.baoliu7,   r.fatie);
    const qunActRate = pctNum(r.qunActive, r.qunTotal);
    const netProfit  = gp - totalCost;
    return {
      fatieRate, baoliuRate, qunActRate,
      fatiePct:      fmtPct(fatieRate),
      baoliuPct:     fmtPct(baoliuRate),
      hegePct:       pct(r.hege,       r.fatie),
      jiawei_pct:    pct(r.jiawei,     r.daodian),
      jinqun_pct:    pct(r.jinqun,     r.jiawei),
      chengjiao_pct: pct(r.chengjiao,  r.daodian),
      fugou_pct:     pct(r.fugou,      r.chengjiao),
      zhuanjie_pct:  pct(r.zhuanjie,   r.chengjiao),
      qunActPct:     fmtPct(qunActRate),
      totalVar, totalFixed, totalCost,
      varRatio:   varPctRaw   !== null ? varPctRaw.toFixed(1)   + "%" : "—",
      fixedRatio: fixedPctRaw !== null ? fixedPctRaw.toFixed(1) + "%" : "—",
      totalRatio: totalPctRaw !== null ? totalPctRaw.toFixed(1) + "%" : "—",
      varHigh:    varPctRaw !== null && varPctRaw > 5,
      gpRate:     rev > 0 ? (gp / rev * 100).toFixed(1) + "%" : "—",
      achievePct: n(r.revenueTarget) > 0 ? (rev / n(r.revenueTarget) * 100).toFixed(1) + "%" : "—",
      aov:        n(r.chengjiao) > 0 ? "¥" + (rev / n(r.chengjiao)).toFixed(0) : "—",
      ugcCost:    yuan(totalVar, r.fatie),
      hegeCost:   yuan(totalVar, r.hege),
      privCost:   yuan(totalVar, r.jiawei),
      dealCost:   yuan(totalVar, r.chengjiao),
      netProfit, netProfitValid: gp > 0,
      warnVar:     varPctRaw !== null && varPctRaw > 5,
      warnFatie:   fatieRate  !== null && fatieRate  < 40,
      warnBaoliu:  baoliuRate !== null && baoliuRate < 70,
      warnPrivate: hasVal(r.jiawei) && n(r.jiawei) < 100,
    };
  }, [row]);

  const allMonths = MONTHS.map((m, i) => {
    const d  = data[activeYear]?.[i] ?? defaultRow();
    const tv = d.rewards.reduce((s, rw) => s + n(rw.unitCost) * n(rw.qty), 0);
    const tf = d.fixedCosts.reduce((s, f) => s + n(f.amount), 0);
    return { name: m, 营收: n(d.revenue), 毛利: n(d.grossProfit), 变动成本: tv, 固定成本: tf, 到店: n(d.daodian), 成交: n(d.chengjiao) };
  });

  const yearCompare = visibleYears.map((y) => {
    const total   = MONTHS.reduce((s, _, mi) => s + n((data[y]?.[mi] ?? defaultRow()).revenue),     0);
    const totalGP = MONTHS.reduce((s, _, mi) => s + n((data[y]?.[mi] ?? defaultRow()).grossProfit), 0);
    return { name: `${y}年`, 年度营收: total, 年度毛利: totalGP };
  });

  const warns = [
    calc.warnVar     && { lvl: "red",    title: "变动成本预警",      msg: `变动成本占比 ${calc.varRatio}，已超建议上限5%` },
    calc.warnFatie   && { lvl: "orange", title: "发帖转化率偏低",    msg: `当前 ${calc.fatiePct}，目标≥40%，建议优化店员引导话术` },
    calc.warnBaoliu  && { lvl: "orange", title: "7天内容保留率偏低", msg: `当前 ${calc.baoliuPct}，目标≥70%，建议加强发帖跟进` },
    calc.warnPrivate && { lvl: "yellow", title: "月新增私域不足",    msg: `本月加微 ${n(row.jiawei)} 人，目标≥100人` },
  ].filter(Boolean);

  const TABS = [
    { key: "funnel",    label: "🔻 漏斗" },
    { key: "community", label: "👥 社群" },
    { key: "revenue",   label: "📈 营收" },
    { key: "variable",  label: "🔄 变动" },
    { key: "fixed",     label: "🏪 固定" },
  ];

  if (loading) return (
    <div className="min-h-screen bg-amber-50 flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="text-5xl">📊</div>
        <p className="text-stone-400 text-sm">数据加载中，请稍候...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-amber-50 p-3 font-sans">
      <div className="max-w-5xl mx-auto space-y-4">

        {/* ── Header ── */}
        <div className="flex items-start justify-between pt-1">
          <div>
            <h1 className="text-xl font-bold text-stone-800">🎞️ 初见 · 经营数据看板</h1>
            <p className="text-xs text-stone-400 mt-0.5">漏斗转化 · 目标达成 · 社群健康 · 成本结构 · 净利润 全链路追踪</p>
          </div>
          <div className="text-xs text-right shrink-0 ml-4 mt-1">
            {saving
              ? <span className="text-blue-400 animate-pulse">⏳ 同步中...</span>
              : lastSaved
                ? <span className="text-green-500">✅ 已保存 {lastSaved.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</span>
                : <span className="text-stone-300">☁️ 云端同步</span>
            }
          </div>
        </div>

        {/* ── 年份滚动窗口 ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-stone-100 px-4 py-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-stone-500 shrink-0">📅 年份</span>
            <button onClick={handleWindowPrev}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-stone-100 text-stone-400 hover:bg-amber-100 hover:text-amber-700 transition-all font-bold text-lg leading-none select-none"
              title="查看更早年份">‹</button>
            {visibleYears.map((y) => (
              <button key={y} onClick={() => handleYearClick(y)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold transition-all ${
                  activeYear === y
                    ? "bg-amber-700 text-white shadow-md scale-105"
                    : "bg-stone-100 text-stone-500 hover:bg-amber-100 hover:text-amber-700"
                }`}>
                {y}年
                {y === CURRENT_YEAR && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold leading-none ${
                    activeYear === y ? "bg-amber-500 text-white" : "bg-amber-100 text-amber-600"
                  }`}>本年</span>
                )}
              </button>
            ))}
            <button onClick={handleWindowNext}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-stone-100 text-stone-400 hover:bg-amber-100 hover:text-amber-700 transition-all font-bold text-lg leading-none select-none"
              title="查看更晚年份">›</button>
          </div>
        </div>

        {/* ── 预警 ── */}
        {warns.map((w, i) => (
          <div key={i} className={`text-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-md ${
            w.lvl === "red" ? "bg-red-500" : w.lvl === "orange" ? "bg-orange-500" : "bg-amber-500"
          }`}>
            <span className="text-2xl">⚠️</span>
            <div>
              <div className="font-bold text-sm">{w.title}</div>
              <div className="text-xs opacity-90 mt-0.5">{w.msg}</div>
            </div>
          </div>
        ))}

        {/* ── 6 KPI Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className={`rounded-2xl p-4 shadow-sm text-white ${
            !calc.netProfitValid ? "bg-amber-700" : calc.netProfit >= 0 ? "bg-green-600" : "bg-red-500"
          }`}>
            <div className="text-xs opacity-75 mb-1">💰 净利润</div>
            <div className="text-xl font-bold">
              {calc.netProfitValid
                ? (calc.netProfit >= 0 ? `¥${calc.netProfit.toFixed(0)}` : `-¥${Math.abs(calc.netProfit).toFixed(0)}`)
                : "—"}
            </div>
            <div className="text-xs opacity-60 mt-1">毛利 − 变动 − 固定</div>
          </div>
          <div className="bg-amber-600 text-white rounded-2xl p-4 shadow-sm">
            <div className="text-xs opacity-75 mb-1">🎯 营收达成率</div>
            <div className="text-xl font-bold">{calc.achievePct}</div>
            <div className="text-xs opacity-60 mt-1">实际 ¥{n(row.revenue).toFixed(0)}</div>
          </div>
          <div className="bg-teal-600 text-white rounded-2xl p-4 shadow-sm">
            <div className="text-xs opacity-75 mb-1">📊 毛利率</div>
            <div className="text-xl font-bold">{calc.gpRate}</div>
            <div className="text-xs opacity-60 mt-1">毛利 ÷ 实际营收</div>
          </div>
          <div className="bg-stone-700 text-white rounded-2xl p-4 shadow-sm">
            <div className="text-xs opacity-75 mb-1">🏷️ 月度总成本</div>
            <div className="text-xl font-bold">¥{calc.totalCost.toFixed(0)}</div>
            <div className="text-xs opacity-60 mt-1">占营收 {calc.totalRatio}</div>
          </div>
          <div className="bg-indigo-600 text-white rounded-2xl p-4 shadow-sm">
            <div className="text-xs opacity-75 mb-1">🛒 客单价</div>
            <div className="text-xl font-bold">{calc.aov}</div>
            <div className="text-xs opacity-60 mt-1">营收 ÷ 成交人数</div>
          </div>
          <div className={`text-white rounded-2xl p-4 shadow-sm ${
            n(row.jiawei) >= 100 ? "bg-emerald-600" : hasVal(row.jiawei) && n(row.jiawei) > 0 ? "bg-orange-500" : "bg-stone-500"
          }`}>
            <div className="text-xs opacity-75 mb-1">📱 月私域新增</div>
            <div className="text-xl font-bold">{hasVal(row.jiawei) ? `${n(row.jiawei)} 人` : "—"}</div>
            <div className="text-xs opacity-60 mt-1">目标 ≥ 100人 {n(row.jiawei) >= 100 ? "✓" : ""}</div>
          </div>
        </div>

        {/* ── 运营目标 KPI ── */}
        <Collapsible title="🚦 运营目标达成状态（方案5项核心KPI对照）" defaultOpen={true}>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            <GoalCard label="发帖转化率"    actual={calc.fatieRate}  target={40}  unit="%" desc="发帖÷到店" />
            <GoalCard label="7天内容保留率" actual={calc.baoliuRate} target={70}  unit="%" desc="7天保留÷发帖" />
            <GoalCard label="月新增私域"    actual={hasVal(row.jiawei)   ? n(row.jiawei)   : null} target={100} unit="人" desc="本月加微人数" />
            <GoalCard label="社群活跃留存"  actual={calc.qunActRate} target={35}  unit="%" desc="活跃÷群总人数" />
            <GoalCard label="老带新月均"    actual={hasVal(row.zhuanjie) ? n(row.zhuanjie) : null} target={30}  unit="单" desc="转介绍成单数" />
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-stone-400 justify-center">
            {[
              { c: "bg-green-500",  t: "达标" },
              { c: "bg-yellow-400", t: "接近目标（≥70%）" },
              { c: "bg-red-500",    t: "未达标" },
              { c: "bg-stone-300",  t: "待录入" },
            ].map(({ c, t }) => (
              <span key={t} className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full inline-block ${c}`} />{t}
              </span>
            ))}
          </div>
        </Collapsible>

        {/* ── 月份选择 ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-stone-100 px-4 py-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-semibold text-stone-500 shrink-0">🗓️ 月份</span>
            <div className="flex flex-wrap gap-1.5">
              {MONTHS.map((m, i) => (
                <button key={i} onClick={() => setActiveMonth(i)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                    activeMonth === i
                      ? "bg-amber-700 text-white shadow"
                      : "bg-stone-100 text-stone-400 hover:text-amber-600"
                  }`}>{m}</button>
              ))}
            </div>
          </div>
          <div className="mt-2 text-xs text-stone-400 pl-1">
            当前查看：<span className="font-semibold text-amber-700">{activeYear}年 {MONTHS[activeMonth]}</span>
          </div>
        </div>

        {/* ── Main Grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Left — Tab 区 */}
          <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
            <div className="flex border-b border-stone-100 overflow-x-auto">
              {TABS.map((t) => (
                <button key={t.key} onClick={() => setSection(t.key)}
                  className={`flex-shrink-0 px-3 py-2.5 text-xs font-medium transition-all ${
                    section === t.key
                      ? "border-b-2 border-amber-500 text-amber-700 bg-amber-50"
                      : "text-stone-400 hover:text-stone-600"
                  }`}>{t.label}</button>
              ))}
            </div>
            <div className="p-4">

              {section === "funnel" && (
                <div className="space-y-2">
                  {FUNNEL_FIELDS.map((f) => (
                    <div key={f.key} className="flex items-center gap-3">
                      <label className="text-xs text-stone-500 w-20 shrink-0">{f.label}</label>
                      <input type="number" min="0" value={row[f.key]}
                        onChange={(e) => setField(f.key, e.target.value)} placeholder="0"
                        className="flex-1 border border-stone-200 rounded-lg px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-200" />
                    </div>
                  ))}
                  <div className="mt-4 pt-3 border-t border-stone-100">
                    <div className="text-xs font-semibold text-stone-500 mb-2">📱 平台发帖分拆</div>
                    {[{ key: "xiaohongshu", label: "小红书" }, { key: "douyin", label: "抖音" }].map((f) => (
                      <div key={f.key} className="flex items-center gap-3 mb-2">
                        <label className="text-xs text-stone-500 w-20 shrink-0">{f.label}</label>
                        <input type="number" min="0" value={row[f.key] || ""}
                          onChange={(e) => setField(f.key, e.target.value)} placeholder="0"
                          className="flex-1 border border-stone-200 rounded-lg px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-200" />
                      </div>
                    ))}
                    {(n(row.xiaohongshu) + n(row.douyin) > 0 && n(row.fatie) > 0) && (
                      <div className="flex gap-2 mt-1">
                        {[
                          { label: "小红书", val: n(row.xiaohongshu), color: "text-rose-500" },
                          { label: "抖音",   val: n(row.douyin),      color: "text-stone-600" },
                        ].map((item) => (
                          <div key={item.label} className="flex-1 bg-stone-50 rounded-lg p-2 text-center">
                            <div className="text-xs font-bold text-stone-500">{item.label}</div>
                            <div className={`text-lg font-bold ${item.color}`}>{item.val}</div>
                            <div className="text-xs text-stone-400">{pct(item.val, n(row.fatie))} 占比</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {section === "community" && (
                <div className="space-y-3">
                  <p className="text-xs text-stone-400 mb-1">记录社群健康度与KOC运营数据（月度手动更新）</p>
                  {[
                    { key: "qunTotal",  label: "群总人数",      placeholder: "社群成员总数",         ring: "focus:ring-amber-200" },
                    { key: "qunActive", label: "本月活跃人数",  placeholder: "30天内有互动的成员数", ring: "focus:ring-green-200" },
                    { key: "kocCount",  label: "本月激活KOC数", placeholder: "本月产出内容的KOC数量", ring: "focus:ring-blue-200" },
                  ].map((f) => (
                    <div key={f.key}>
                      <label className="text-xs text-stone-500">{f.label}</label>
                      <input type="number" min="0" value={row[f.key] || ""}
                        onChange={(e) => setField(f.key, e.target.value)} placeholder={f.placeholder}
                        className={`w-full mt-1 border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${f.ring}`} />
                    </div>
                  ))}
                  <div className="bg-amber-50 rounded-xl p-3 space-y-2 text-xs mt-1">
                    {[
                      { label: "社群活跃留存率", val: calc.qunActPct, note: "目标≥35%", color: calc.qunActRate !== null && calc.qunActRate >= 35 ? "text-green-600" : "text-orange-500" },
                      { label: "本月激活KOC数",  val: hasVal(row.kocCount)    ? `${n(row.kocCount)} 位`    : "—", note: "建议≥2位/月", color: "text-blue-600" },
                      { label: "小红书发帖",     val: hasVal(row.xiaohongshu) ? `${n(row.xiaohongshu)} 篇` : "—", note: "", color: "text-rose-500" },
                      { label: "抖音发帖",       val: hasVal(row.douyin)      ? `${n(row.douyin)} 篇`      : "—", note: "", color: "text-stone-600" },
                    ].map((item) => (
                      <div key={item.label} className="flex justify-between items-center">
                        <span className="text-stone-500">
                          {item.label}
                          {item.note && <span className="text-stone-300 ml-1">({item.note})</span>}
                        </span>
                        <span className={`font-bold ${item.color}`}>{item.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {section === "revenue" && (
                <div className="space-y-3">
                  {[
                    { key: "revenueTarget", label: "月度营收目标 (¥)", placeholder: "如: 50000", ring: "focus:ring-stone-200" },
                    { key: "revenue",       label: "月度实际营收 (¥)", placeholder: "如: 48000", ring: "focus:ring-green-200" },
                    { key: "grossProfit",   label: "月度毛利 (¥)",     placeholder: "如: 25000", ring: "focus:ring-amber-200" },
                  ].map((f) => (
                    <div key={f.key}>
                      <label className="text-xs text-stone-500">{f.label}</label>
                      <input type="number" min="0" value={row[f.key]}
                        onChange={(e) => setField(f.key, e.target.value)} placeholder={f.placeholder}
                        className={`w-full mt-1 border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${f.ring}`} />
                    </div>
                  ))}
                  <div className="bg-amber-50 rounded-xl p-3 space-y-2 text-xs mt-1">
                    {[
                      { label: "营收达成率",    val: calc.achievePct, color: "text-amber-700" },
                      { label: "毛利率",         val: calc.gpRate,     color: "text-green-600" },
                      { label: "客单价",         val: calc.aov,        color: "text-indigo-600" },
                      { label: "变动成本占营收", val: calc.varRatio,   color: calc.varHigh ? "text-red-500" : "text-green-600" },
                      { label: "固定成本占营收", val: calc.fixedRatio, color: "text-orange-500" },
                      { label: "总成本占营收",   val: calc.totalRatio, color: "text-purple-600" },
                      {
                        label: "净利润估算",
                        val:   calc.netProfitValid
                          ? (calc.netProfit >= 0 ? `¥${calc.netProfit.toFixed(0)}` : `-¥${Math.abs(calc.netProfit).toFixed(0)}`)
                          : "—",
                        color: calc.netProfit >= 0 ? "text-green-600" : "text-red-500",
                      },
                    ].map((item) => (
                      <div key={item.label} className="flex justify-between">
                        <span className="text-stone-500">{item.label}</span>
                        <span className={`font-bold ${item.color}`}>{item.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {section === "variable" && (
                <div className="space-y-2">
                  <p className="text-xs text-stone-400 mb-2">按单价 × 数量录入，随业务量浮动的成本</p>
                  {row.rewards.map((rw) => {
                    const sub = n(rw.unitCost) * n(rw.qty);
                    return (
                      <div key={rw.id} className="border border-stone-100 rounded-xl p-3">
                        <div className="mb-2">
                          <span className="text-xs font-medium text-stone-700">{rw.name}</span>
                          <span className="text-xs text-stone-400 ml-1">· {rw.desc}</span>
                        </div>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="text-xs text-stone-400">单价(¥)</label>
                            <input type="number" min="0" value={rw.unitCost}
                              onChange={(e) => setReward(rw.id, "unitCost", e.target.value)}
                              className="w-full mt-0.5 border border-stone-200 rounded-lg px-2 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-amber-200" />
                          </div>
                          <div className="flex-1">
                            <label className="text-xs text-stone-400">数量</label>
                            <input type="number" min="0" value={rw.qty}
                              onChange={(e) => setReward(rw.id, "qty", e.target.value)} placeholder="0"
                              className="w-full mt-0.5 border border-stone-200 rounded-lg px-2 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-green-200" />
                          </div>
                          <div className="flex-1">
                            <label className="text-xs text-stone-400">小计(¥)</label>
                            <div className="w-full mt-0.5 bg-stone-50 border border-stone-100 rounded-lg px-2 py-1 text-xs text-right font-semibold text-stone-700">
                              {sub.toFixed(0)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex justify-between items-center bg-amber-700 rounded-xl px-4 py-2.5">
                    <span className="text-xs text-amber-100">本月变动成本合计</span>
                    <span className="text-white font-bold">¥{calc.totalVar.toFixed(0)}</span>
                  </div>
                </div>
              )}

              {section === "fixed" && (
                <div className="space-y-2">
                  <p className="text-xs text-stone-400 mb-2">每月刚性支出，直接填月度金额</p>
                  {row.fixedCosts.map((fc) => (
                    <div key={fc.id} className="border border-stone-100 rounded-xl p-3">
                      <div className="mb-2">
                        <span className="text-xs font-medium text-stone-700">{fc.name}</span>
                        <span className="text-xs text-stone-400 ml-1">· {fc.desc}</span>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-xs text-stone-400">月度金额(¥)</label>
                          <input type="number" min="0" value={fc.amount}
                            onChange={(e) => setFixed(fc.id, e.target.value)} placeholder="0"
                            className="w-full mt-0.5 border border-stone-200 rounded-lg px-2 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-orange-200" />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs text-stone-400">占营收比</label>
                          <div className="w-full mt-0.5 bg-stone-50 border border-stone-100 rounded-lg px-2 py-1 text-xs text-right font-semibold text-orange-600">
                            {n(row.revenue) > 0 ? ((n(fc.amount) / n(row.revenue)) * 100).toFixed(1) + "%" : "—"}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between items-center bg-orange-500 rounded-xl px-4 py-2.5">
                    <span className="text-xs text-orange-100">本月固定成本合计</span>
                    <span className="text-white font-bold">¥{calc.totalFixed.toFixed(0)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-4">
              <h3 className="text-sm font-semibold text-stone-700 mb-3">🎯 全链路转化率</h3>
              <div className="space-y-2">
                {[
                  { label: "发帖转化率", val: calc.fatiePct,      sub: "发帖÷到店",    target: "≥40%", warn: calc.warnFatie },
                  { label: "合格发帖率", val: calc.hegePct,       sub: "合格÷发帖",    target: null,   warn: false },
                  { label: "7天保留率",  val: calc.baoliuPct,     sub: "7天保留÷发帖", target: "≥70%", warn: calc.warnBaoliu },
                  { label: "加微率",     val: calc.jiawei_pct,    sub: "加微÷到店",    target: null,   warn: false },
                  { label: "进群率",     val: calc.jinqun_pct,    sub: "进群÷加微",    target: null,   warn: false },
                  { label: "到店成交率", val: calc.chengjiao_pct, sub: "成交÷到店",    target: null,   warn: false },
                  { label: "复购率",     val: calc.fugou_pct,     sub: "复购÷成交",    target: null,   warn: false },
                  { label: "转介绍率",   val: calc.zhuanjie_pct,  sub: "转介绍÷成交",  target: null,   warn: false },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between items-center text-xs">
                    <span className="text-stone-500">
                      {item.label}
                      <span className="text-stone-300 ml-1">({item.sub})</span>
                      {item.target && <span className="text-stone-300 ml-1">{item.target}</span>}
                    </span>
                    <span className={`font-bold ${item.warn ? "text-red-500" : "text-amber-700"}`}>{item.val}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-br from-stone-800 to-stone-900 rounded-2xl p-4 text-white">
              <h3 className="text-sm font-semibold mb-3">💰 成本 & ROI 模型</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "单篇UGC成本",  val: calc.ugcCost,  sub: "变动÷发帖数",     high: false },
                  { label: "合格帖成本",    val: calc.hegeCost, sub: "变动÷合格发帖数", high: false },
                  { label: "私域获客成本",  val: calc.privCost, sub: "变动÷加微数",     high: false },
                  { label: "单笔成交成本",  val: calc.dealCost, sub: "变动÷成交数",     high: false },
                  { label: "变动成本占比",  val: calc.varRatio, sub: "建议控制≤5%",     high: calc.varHigh },
                  { label: "客单价",        val: calc.aov,      sub: "营收÷成交人数",   high: false },
                ].map((item) => (
                  <div key={item.label} className={`rounded-xl p-3 ${item.high ? "bg-red-500 bg-opacity-40" : "bg-white bg-opacity-10"}`}>
                    <div className="text-base font-bold">{item.val}</div>
                    <div className="text-xs text-stone-200 mt-0.5">{item.label}</div>
                    <div className="text-xs text-stone-400">{item.sub}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 space-y-1.5">
                {[
                  { label: "变动成本合计", val: `¥${calc.totalVar.toFixed(0)}`,   color: "text-amber-300",  bg: "bg-white bg-opacity-5" },
                  { label: "固定成本合计", val: `¥${calc.totalFixed.toFixed(0)}`, color: "text-orange-300", bg: "bg-white bg-opacity-5" },
                  { label: "月度总成本",   val: `¥${calc.totalCost.toFixed(0)}`,  color: "text-yellow-400", bg: "bg-white bg-opacity-10" },
                ].map((item) => (
                  <div key={item.label} className={`${item.bg} rounded-xl px-4 py-2 flex justify-between items-center`}>
                    <span className="text-xs text-stone-400">{item.label}</span>
                    <span className={`text-base font-bold ${item.color}`}>{item.val}</span>
                  </div>
                ))}
                {calc.netProfitValid && (
                  <div className={`rounded-xl px-4 py-2 flex justify-between items-center ${calc.netProfit >= 0 ? "bg-green-500 bg-opacity-20" : "bg-red-500 bg-opacity-20"}`}>
                    <span className="text-xs text-stone-300 font-medium">净利润估算</span>
                    <span className={`text-lg font-bold ${calc.netProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {calc.netProfit >= 0 ? `¥${calc.netProfit.toFixed(0)}` : `-¥${Math.abs(calc.netProfit).toFixed(0)}`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── 漏斗可视化 ── */}
        {n(row.daodian) > 0 && (
          <Collapsible title={`🔻 ${activeYear}年 ${MONTHS[activeMonth]} 用户转化漏斗`}>
            <div className="space-y-2">
              {FUNNEL_FIELDS.map((f) => {
                const val = n(row[f.key]);
                const max = n(row.daodian) || 1;
                const w   = Math.max((val / max) * 100, val > 0 ? 4 : 0);
                return (
                  <div key={f.key} className="flex items-center gap-3">
                    <span className="text-xs text-stone-400 w-20 text-right shrink-0">{f.label}</span>
                    <div className="flex-1 bg-stone-100 rounded-full h-6">
                      <div
                        className={`${f.color} h-6 rounded-full flex items-center justify-end pr-2 transition-all duration-500`}
                        style={{ width: `${w}%` }}
                      >
                        {val > 0 && <span className="text-white text-xs font-bold">{val}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Collapsible>
        )}

        {/* ── 图表 ── */}
        <Collapsible title={`📈 ${activeYear}年 全年月度趋势`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-semibold text-stone-700 mb-3">营收 · 毛利 · 成本</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={allMonths} barSize={5} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => `¥${v}`} />
                  <Bar dataKey="营收"     fill="#d97706" radius={[3,3,0,0]} />
                  <Bar dataKey="毛利"     fill="#6ee7b7" radius={[3,3,0,0]} />
                  <Bar dataKey="变动成本" fill="#fca5a5" radius={[3,3,0,0]} />
                  <Bar dataKey="固定成本" fill="#fdba74" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 justify-center mt-1 text-xs text-stone-400">
                {[{ c:"bg-amber-500",t:"营收" },{ c:"bg-emerald-300",t:"毛利" },{ c:"bg-red-300",t:"变动成本" },{ c:"bg-orange-300",t:"固定成本" }].map((x) => (
                  <span key={x.t} className="flex items-center gap-1"><span className={`w-2 h-2 rounded ${x.c} inline-block`} />{x.t}</span>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-stone-700 mb-3">👥 到店 vs 成交</h3>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={allMonths}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="到店" stroke="#d97706" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="成交" stroke="#6ee7b7" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
              <div className="flex gap-4 justify-center mt-1 text-xs text-stone-400">
                {[{ c:"bg-amber-500",t:"到店" },{ c:"bg-emerald-300",t:"成交" }].map((x) => (
                  <span key={x.t} className="flex items-center gap-1"><span className={`w-2 h-2 rounded ${x.c} inline-block`} />{x.t}</span>
                ))}
              </div>
            </div>
          </div>
        </Collapsible>

        {/* ── 跨年对比 ── */}
        <Collapsible title={`🗂️ 跨年度营收对比（${visibleYears[0]}–${visibleYears[WINDOW_SIZE-1]}）`}>
          <div>
            <h3 className="text-sm font-semibold text-stone-700 mb-3">各年度营收 · 毛利汇总（当前窗口）</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={yearCompare} barCategoryGap="35%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => `¥${v.toFixed(0)}`} />
                <Bar dataKey="年度营收" fill="#d97706" radius={[4,4,0,0]} />
                <Bar dataKey="年度毛利" fill="#6ee7b7" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-4 justify-center mt-2 text-xs text-stone-400">
              {[{ c:"bg-amber-500",t:"年度营收" },{ c:"bg-emerald-300",t:"年度毛利" }].map((x) => (
                <span key={x.t} className="flex items-center gap-1"><span className={`w-2 h-2 rounded ${x.c} inline-block`} />{x.t}</span>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2">
              {yearCompare.map((y, idx) => (
                <div key={y.name} className={`rounded-xl p-3 text-center border transition-all ${
                  activeYear === visibleYears[idx] ? "border-amber-400 bg-amber-50" : "border-stone-100 bg-stone-50"
                }`}>
                  <div className="text-xs font-bold text-stone-600 flex items-center justify-center gap-1">
                    {y.name}
                    {visibleYears[idx] === CURRENT_YEAR && (
                      <span className="text-xs bg-amber-100 text-amber-600 px-1 rounded font-bold">今</span>
                    )}
                  </div>
                  <div className="text-sm font-bold text-amber-700 mt-1">
                    {y.年度营收 > 0 ? `¥${y.年度营收.toFixed(0)}` : "—"}
                  </div>
                  <div className="text-xs text-teal-600">
                    {y.年度毛利 > 0 ? `毛利¥${y.年度毛利.toFixed(0)}` : ""}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Collapsible>

        {/* ── 变动成本明细 ── */}
        <Collapsible title={`🔄 ${activeYear}年${MONTHS[activeMonth]} 变动成本明细`}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-stone-400 border-b border-stone-100">
                  <th className="text-left py-2 font-medium">项目</th>
                  <th className="text-left py-2 font-medium text-stone-300">说明</th>
                  <th className="text-right py-2 font-medium">单价</th>
                  <th className="text-right py-2 font-medium">数量</th>
                  <th className="text-right py-2 font-medium">小计</th>
                  <th className="text-right py-2 font-medium">占比</th>
                </tr>
              </thead>
              <tbody>
                {row.rewards.map((rw) => {
                  const sub   = n(rw.unitCost) * n(rw.qty);
                  const share = calc.totalVar > 0 ? ((sub / calc.totalVar) * 100).toFixed(1) + "%" : "—";
                  return (
                    <tr key={rw.id} className="border-b border-stone-50 hover:bg-amber-50">
                      <td className="py-2 font-medium text-stone-700">{rw.name}</td>
                      <td className="py-2 text-stone-300">{rw.desc}</td>
                      <td className="py-2 text-right text-stone-500">¥{rw.unitCost}</td>
                      <td className="py-2 text-right text-stone-500">{n(rw.qty) || 0}</td>
                      <td className="py-2 text-right font-semibold text-stone-700">¥{sub.toFixed(0)}</td>
                      <td className="py-2 text-right text-amber-600">{share}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-amber-50">
                  <td colSpan={4} className="py-2 pl-2 font-bold text-stone-700">变动成本合计</td>
                  <td className="py-2 text-right font-bold text-stone-800">¥{calc.totalVar.toFixed(0)}</td>
                  <td className="py-2 text-right font-bold text-amber-700">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Collapsible>

        {/* ── 固定成本明细 ── */}
        <Collapsible title={`🏪 ${activeYear}年${MONTHS[activeMonth]} 固定成本明细`}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-stone-400 border-b border-stone-100">
                  <th className="text-left py-2 font-medium">项目</th>
                  <th className="text-left py-2 font-medium text-stone-300">说明</th>
                  <th className="text-right py-2 font-medium">月度金额</th>
                  <th className="text-right py-2 font-medium">占营收</th>
                  <th className="text-right py-2 font-medium">占固定成本</th>
                </tr>
              </thead>
              <tbody>
                {row.fixedCosts.map((fc) => {
                  const amt      = n(fc.amount);
                  const revShare = n(row.revenue) > 0  ? ((amt / n(row.revenue))  * 100).toFixed(1) + "%" : "—";
                  const fixShare = calc.totalFixed > 0 ? ((amt / calc.totalFixed) * 100).toFixed(1) + "%" : "—";
                  return (
                    <tr key={fc.id} className="border-b border-stone-50 hover:bg-amber-50">
                      <td className="py-2 font-medium text-stone-700">{fc.name}</td>
                      <td className="py-2 text-stone-300">{fc.desc}</td>
                      <td className="py-2 text-right font-semibold text-stone-700">¥{amt.toFixed(0)}</td>
                      <td className="py-2 text-right text-orange-500">{revShare}</td>
                      <td className="py-2 text-right text-amber-600">{fixShare}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-orange-50">
                  <td colSpan={2} className="py-2 pl-2 font-bold text-stone-700">固定成本合计</td>
                  <td className="py-2 text-right font-bold text-stone-800">¥{calc.totalFixed.toFixed(0)}</td>
                  <td className="py-2 text-right font-bold text-orange-600">
                    {n(row.revenue) > 0 ? ((calc.totalFixed / n(row.revenue)) * 100).toFixed(1) + "%" : "—"}
                  </td>
                  <td className="py-2 text-right font-bold text-amber-700">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Collapsible>

        {/* ── 公式说明 ── */}
        <Collapsible title="🧮 计算公式说明" dark>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-1.5 gap-x-6 font-mono text-xs text-stone-300 leading-relaxed">
            <div>单篇UGC成本  = <span className="text-yellow-400">变动成本 ÷ 发帖人数</span></div>
            <div>合格帖成本   = <span className="text-yellow-400">变动成本 ÷ 合格发帖数</span></div>
            <div>私域获客成本 = <span className="text-yellow-400">变动成本 ÷ 加微人数</span></div>
            <div>单笔成交成本 = <span className="text-yellow-400">变动成本 ÷ 成交人数</span></div>
            <div>7天保留率    = <span className="text-green-400">7天保留数 ÷ 发帖人数</span></div>
            <div>客单价       = <span className="text-indigo-400">实际营收 ÷ 成交人数</span></div>
            <div>毛利率       = <span className="text-green-400">毛利 ÷ 实际营收</span></div>
            <div>营收达成率   = <span className="text-amber-400">实际营收 ÷ 目标营收</span></div>
            <div>社群活跃率   = <span className="text-blue-400">活跃人数 ÷ 群总人数</span></div>
            <div>净利润估算   = <span className="text-emerald-400">毛利 − 变动成本 − 固定成本</span></div>
          </div>
        </Collapsible>

        {/* ── 保密声明 ── */}
        <div className="text-center text-xs text-stone-400 py-4 border-t border-stone-200 mt-2 leading-relaxed">
          🔒 本看板为「初见 · 经营数据看板」内部专用，数据涉及商业机密，<br />
          严禁截图或以任何形式对外泄露，违者将依法承担相应法律责任。
        </div>

      </div>
    </div>
  );
}
