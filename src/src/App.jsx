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

const n = (v) => parseFloat(v) || 0;
const pct = (a, b) => n(b) > 0 ? ((n(a) / n(b)) * 100).toFixed(1) + "%" : "—";
const yuan = (a, b) => n(b) > 0 ? "¥" + (n(a) / n(b)).toFixed(2) : "—";

const defaultRow = () => ({
  daodian: "", fatie: "", jiawei: "", jinqun: "",
  chengjiao: "", fugou: "", zhuanjie: "",
  revenue: "", revenueTarget: "", grossProfit: "",
  rewards: DEFAULT_VAR_COSTS.map((r) => ({ ...r })),
  fixedCosts: DEFAULT_FIXED_COSTS.map((f) => ({ ...f })),
});

export default function App() {
  const [activeMonth, setActiveMonth] = useState(new Date().getMonth());
  const [section, setSection] = useState("funnel");
  const [data, setData] = useState(() => {
    const d = {};
    MONTHS.forEach((_, i) => { d[i] = defaultRow(); });
    return d;
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const saveTimer = useRef(null);

  // 初始加载云端数据
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: rows } = await supabase.from("monthly_data").select("*");
      if (rows?.length) {
        setData((prev) => {
          const next = { ...prev };
          rows.forEach((r) => {
            next[r.month_index] = {
              daodian:       r.daodian       ?? "",
              fatie:         r.fatie         ?? "",
              jiawei:        r.jiawei        ?? "",
              jinqun:        r.jinqun        ?? "",
              chengjiao:     r.chengjiao     ?? "",
              fugou:         r.fugou         ?? "",
              zhuanjie:      r.zhuanjie      ?? "",
              revenue:       r.revenue       ?? "",
              revenueTarget: r.revenue_target ?? "",
              grossProfit:   r.gross_profit  ?? "",
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

  // 防抖自动保存（停止输入 1.2 秒后保存）
  const scheduleSave = (idx, rowData) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      await supabase.from("monthly_data").upsert(
        {
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
        { onConflict: "month_index" }
      );
      setSaving(false);
      setLastSaved(new Date());
    }, 1200);
  };

  const row = data[activeMonth];

  const setField = (key, val) =>
    setData((prev) => {
      const newRow = { ...prev[activeMonth], [key]: val };
      scheduleSave(activeMonth, newRow);
      return { ...prev, [activeMonth]: newRow };
    });

  const setReward = (id, field, val) =>
    setData((prev) => {
      const newRewards = prev[activeMonth].rewards.map((r) =>
        r.id === id ? { ...r, [field]: val } : r
      );
      const newRow = { ...prev[activeMonth], rewards: newRewards };
      scheduleSave(activeMonth, newRow);
      return { ...prev, [activeMonth]: newRow };
    });

  const setFixedCost = (id, val) =>
    setData((prev) => {
      const newFixed = prev[activeMonth].fixedCosts.map((f) =>
        f.id === id ? { ...f, amount: val } : f
      );
      const newRow = { ...prev[activeMonth], fixedCosts: newFixed };
      scheduleSave(activeMonth, newRow);
      return { ...prev, [activeMonth]: newRow };
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
      varRatio:      varRatioRaw   !== null ? varRatioRaw.toFixed(1)   + "%" : "—",
      fixedRatio:    fixedRatioRaw !== null ? fixedRatioRaw.toFixed(1) + "%" : "—",
      totalRatio:    totalRatioRaw !== null ? totalRatioRaw.toFixed(1) + "%" : "—",
      varRatioHigh:  varRatioRaw !== null && varRatioRaw > 5,
      gpRate:     rev > 0 ? ((gp / rev) * 100).toFixed(1) + "%" : "—",
      achievePct: n(r.revenueTarget) > 0 ? ((rev / n(r.revenueTarget)) * 100).toFixed(1) + "%" : "—",
      netProfit:      gp - totalCost,
      netProfitValid: gp > 0,
    };
  }, [row]);

  const allMonths = MONTHS.map((m, i) => {
    const d = data[i];
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
        <p className="text-stone-400 text-sm">数据加载中，请稍候...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-amber-50 p-3 font-sans">
      <div className="max-w-5xl mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-start justify-between pt-1">
          <div>
            <h1 className="text-xl font-bold text-stone-800">🎞️ 初见 · 经营数据看板</h1>
            <p className="text-xs text-stone-400 mt-0.5">漏斗转化 · 变动成本 · 固定成本 · 营收毛利 · 净利润 全链路追踪</p>
          </div>
          <div className="text-xs text-right shrink-0 ml-4 mt-1">
            {saving
              ? <span className="text-blue-400 animate-pulse">⏳ 同步中...</span>
              : lastSaved
                ? <span className="text-green-500">✅ 已保存 {lastSaved.toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit"})}</span>
                : <span className="text-stone-300">☁️ 云端同步</span>
            }
          </div>
        </div>

        {/* Month Tabs */}
        <div className="flex flex-wrap gap-1.5">
          {MONTHS.map((m, i) => (
            <button key={i} onClick={() => setActiveMonth(i)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                activeMonth === i ? "bg-amber-700 text-white shadow" : "bg-white text-stone-400 border border-stone-200 hover:border-amber-400"
              }`}>{m}</button>
          ))}
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
            <div className="flex border-b border-stone-100">
              {SECTIONS.map((s) => (
                <button key={s.key} onClick={() => setSection(s.key)}
                  className={`flex-1 py-2.5 text-xs font-medium transition-all ${
                    section === s.key ? "border-b-2 border-amber-500 text-amber-700 bg-amber-50" : "text-stone-400 hover:text-stone-600"
                  }`}>{s.label}</button>
              ))}
            </div>
            <div className="p-4">
              {section === "funnel" && (
                <div className="space-y-3">
                  {FUNNEL_FIELDS.map((f) => (
                    <div key={f.key} className="flex items-center gap-3">
                      <label className="text-xs text-stone-500 w-20 shrink-0">{f.label}</label>
                      <input type="number" min="0" value={row[f.key]}
                        onChange={(e) => setField(f.key, e.target.value)} placeholder="0"
                        className="flex-1 border border-stone-200 rounded-lg px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-200" />
                    </div>
                  ))}
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
                  <div className="mt-2 bg-amber-50 rounded-xl p-3 space-y-2 text-xs">
                    {[
                      { label: "营收达成率",    val: calc.achievePct, color: "text-amber-700" },
                      { label: "毛利率",         val: calc.gpRate,     color: "text-green-600" },
                      { label: "变动成本占营收", val: calc.varRatio,   color: calc.varRatioHigh ? "text-red-500" : "text-green-600" },
                      { label: "固定成本占营收", val: calc.fixedRatio, color: "text-orange-500" },
                      { label: "总成本占营收",   val: calc.totalRatio, color: "text-purple-600" },
                      {
                        label: "净利润估算",
                        val: calc.netProfitValid
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
                    {calc.varRatioHigh && (
                      <p className="text-red-400 text-xs pt-1 border-t border-red-100">⚠️ 变动成本占比超出建议上限 5%，请检查成本结构</p>
                    )}
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
                  <div className="flex justify-between items-center bg-amber-700 rounded-xl px-4 py-2.5 mt-1">
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
                            onChange={(e) => setFixedCost(fc.id, e.target.value)} placeholder="0"
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
                  <div className="flex justify-between items-center bg-orange-500 rounded-xl px-4 py-2.5 mt-1">
                    <span className="text-xs text-orange-100">本月固定成本合计</span>
                    <span className="text-white font-bold">¥{calc.totalFixed.toFixed(0)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-4">
              <h3 className="text-sm font-semibold text-stone-700 mb-3">🎯 关键转化率</h3>
              <div className="space-y-2">
                {[
                  { label: "发帖转化率", val: calc.fatiePct,      sub: "发帖 ÷ 到店" },
                  { label: "加微率",     val: calc.jiawei_pct,    sub: "加微 ÷ 到店" },
                  { label: "进群率",     val: calc.jinqun_pct,    sub: "进群 ÷ 加微" },
                  { label: "到店成交率", val: calc.chengjiao_pct, sub: "成交 ÷ 到店" },
                  { label: "复购率",     val: calc.fugou_pct,     sub: "复购 ÷ 成交" },
                  { label: "转介绍率",   val: calc.zhuanjie_pct,  sub: "转介绍 ÷ 成交" },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between items-center text-xs">
                    <span className="text-stone-500">{item.label}
                      <span className="text-stone-300 ml-1">({item.sub})</span>
                    </span>
                    <span className="font-bold text-amber-700">{item.val}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gradient-to-br from-stone-800 to-stone-900 rounded-2xl p-4 text-white">
              <h3 className="text-sm font-semibold mb-3">💰 成本 & ROI 模型</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "单篇UGC成本",  val: calc.ugcUnit,    sub: "变动成本 ÷ 发帖数", high: false },
                  { label: "私域获客成本", val: calc.privateAcq, sub: "变动成本 ÷ 加微数", high: false },
                  { label: "单笔成交成本", val: calc.dealCost,   sub: "变动成本 ÷ 成交数", high: false },
                  { label: "变动成本占比", val: calc.varRatio,   sub: "建议控制在 ≤5%",   high: calc.varRatioHigh },
                ].map((item) => (
                  <div key={item.label} className={`rounded-xl p-3 ${item.high ? "bg-red-500 bg-opacity-40" : "bg-white bg-opacity-10"}`}>
                    <div className="text-base font-bold">{item.val}</div>
                    <div className="text-xs text-stone-200 mt-0.5">{item.label}</div>
                    <div className="text-xs text-stone-400">{item.sub}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 space-y-1.5">
                <div className="bg-white bg-opacity-5 rounded-xl px-4 py-2 flex justify-between items-center">
                  <span className="text-xs text-stone-400">变动成本合计</span>
                  <span className="text-base font-bold text-amber-300">¥{calc.totalVar.toFixed(0)}</span>
                </div>
                <div className="bg-white bg-opacity-5 rounded-xl px-4 py-2 flex justify-between items-center">
                  <span className="text-xs text-stone-400">固定成本合计</span>
                  <span className="text-base font-bold text-orange-300">¥{calc.totalFixed.toFixed(0)}</span>
                </div>
                <div className="bg-white bg-opacity-10 rounded-xl px-4 py-2 flex justify-between items-center">
                  <span className="text-xs text-stone-300 font-medium">月度总成本</span>
                  <span className="text-lg font-bold text-yellow-400">¥{calc.totalCost.toFixed(0)}</span>
                </div>
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

        {n(row.daodian) > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-4">
            <h3 className="text-sm font-semibold text-stone-700 mb-3">🔻 {MONTHS[activeMonth]} 用户转化漏斗</h3>
            <div className="space-y-2">
              {FUNNEL_FIELDS.map((f, i) => {
                const val = n(row[f.key]);
                const max = n(row.daodian) || 1;
                const w = Math.max((val / max) * 100, val > 0 ? 5 : 0);
                const COLORS = ["bg-amber-600","bg-amber-500","bg-yellow-500","bg-orange-400","bg-green-500","bg-teal-500","bg-stone-500"];
                return (
                  <div key={f.key} className="flex items-center gap-3">
                    <span className="text-xs text-stone-400 w-16 text-right shrink-0">{f.label}</span>
                    <div className="flex-1 bg-stone-100 rounded-full h-6">
                      <div className={`${COLORS[i]} h-6 rounded-full flex items-center justify-end pr-2 transition-all duration-500`} style={{ width: `${w}%` }}>
                        {val > 0 && <span className="text-white text-xs font-bold">{val}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-4">
            <h3 className="text-sm font-semibold text-stone-700 mb-3">📈 全年营收 · 毛利 · 成本趋势</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={allMonths} barSize={5} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => `¥${v}`} />
                <Bar dataKey="营收"    fill="#d97706" radius={[3,3,0,0]} />
                <Bar dataKey="毛利"    fill="#6ee7b7" radius={[3,3,0,0]} />
                <Bar dataKey="变动成本" fill="#fca5a5" radius={[3,3,0,0]} />
                <Bar dataKey="固定成本" fill="#fdba74" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-3 justify-center mt-1 text-xs text-stone-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-amber-500 inline-block" />营收</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-300 inline-block" />毛利</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-300 inline-block" />变动成本</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-orange-300 inline-block" />固定成本</span>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-4">
            <h3 className="text-sm font-semibold text-stone-700 mb-3">👥 全年到店 vs 成交趋势</h3>
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
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-amber-500 inline-block" />到店</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-300 inline-block" />成交</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-4">
          <h3 className="text-sm font-semibold text-stone-700 mb-3">🔄 {MONTHS[activeMonth]} 变动成本明细</h3>
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
                  const sub = n(rw.unitCost) * n(rw.qty);
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
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-4">
          <h3 className="text-sm font-semibold text-stone-700 mb-3">🏪 {MONTHS[activeMonth]} 固定成本明细</h3>
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
                  const amt = n(fc.amount);
                  const revShare = n(row.revenue) > 0 ? ((amt / n(row.revenue)) * 100).toFixed(1) + "%" : "—";
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
        </div>

        <div className="bg-stone-800 rounded-2xl p-4 text-stone-300 text-xs">
          <h3 className="text-white font-semibold mb-2 text-sm">🧮 计算公式说明</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-1 gap-x-4 font-mono leading-relaxed">
            <div>单篇UGC成本  = <span className="text-yellow-400">变动成本 ÷ 发帖人数</span></div>
            <div>私域获客成本 = <span className="text-yellow-400">变动成本 ÷ 加微人数</span></div>
            <div>单笔成交成本 = <span className="text-yellow-400">变动成本 ÷ 成交人数</span></div>
            <div>变动成本占比 = <span className="text-red-400">变动成本 ÷ 月度营收</span></div>
            <div>毛利率       = <span className="text-green-400">毛利 ÷ 实际营收</span></div>
            <div>营收达成率   = <span className="text-amber-400">实际营收 ÷ 目标营收</span></div>
            <div>净利润估算   = <span className="text-emerald-400">毛利 − 变动成本 − 固定成本</span></div>
          </div>
        </div>

      </div>
    </div>
  );
}
