"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useStoreStore, getRemainingWater, getMachineInventory, machineNeedsRefill, getProductUnitsLeft } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";
import gsap from "gsap";
import { 
	AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
	BarChart, Bar, LineChart, Line,
} from "recharts";
import { 
	FiActivity, FiBox, FiDroplet, FiRefreshCw, FiChevronDown, FiTrendingUp,
	FiBell, FiX, FiAlertTriangle, FiPackage, FiClock, FiHome, FiDollarSign,
} from "react-icons/fi";
import { CgSpinner } from "react-icons/cg";
import ProductIcon, { getProductIconBg } from "@/components/ProductIcon";
import { isAdmin, getScopedMachines, getScopedProducts } from "@/lib/utils";

export default function HomePage() {
  const { transactions, refills, machines, products, effectiveUser } = useStoreStore();
  const [loading, setLoading] = useState(true);
  const [selectedMachine, setSelectedMachine] = useState<string>("all");
  const [showMachinePicker, setShowMachinePicker] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [chartGranularity, setChartGranularity] = useState<"daily" | "hourly">("hourly");
  const statsRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (machines.length > 0 || products.length > 0 || effectiveUser) {
      setLoading(false);
    }
  }, [machines, products, effectiveUser]);

  // GSAP entrance animation
  useEffect(() => {
    if (loading) return;
    if (headerRef.current) {
      gsap.fromTo(headerRef.current, 
        { y: -30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.7, ease: "power3.out" }
      );
    }
    if (statsRef.current) {
      gsap.fromTo(statsRef.current.children, 
        { y: 40, opacity: 0, scale: 0.95 },
        { y: 0, opacity: 1, scale: 1, duration: 0.6, stagger: 0.1, ease: "power3.out", delay: 0.2 }
      );
    }
  }, [loading]);

  const admin = isAdmin(effectiveUser?.userId);

  const scopedMachines = getScopedMachines(machines, selectedMachine);
  const scopedProducts = getScopedProducts(machines, products, selectedMachine);

  const totalWaterAvailable = scopedMachines.reduce(
    (acc, m) => acc + getRemainingWater(m._id, machines, transactions, refills, products),
    0,
  );
  const selectedWater = totalWaterAvailable;

  const scopedOrders = transactions.filter(
    (t) => selectedMachine === "all" || t.machineId === selectedMachine,
  );

  const getTransactionTotal = useCallback((transactionData: string) => {
    try {
      const data = JSON.parse(transactionData);
      if (Array.isArray(data)) {
        return data.reduce((sum: number, entry: { productId: string; quantity?: number }) => {
          const prod = products.find((p) => p._id === entry.productId);
          return sum + (prod ? prod.price * (entry.quantity || 1) : 0);
        }, 0);
      }
    } catch {
      /* ignore */
    }
    return 0;
  }, [products]);

  const totalPayments = scopedOrders.reduce(
    (sum, tx) => sum + getTransactionTotal(tx.transactionData),
    0,
  );

  // Last refill info
  let lastRefillDate = "No refills recorded";
  let lastRefillAgo = "";
  if (selectedMachine !== "all") {
    const mRef = refills.filter(r => r.machineId === selectedMachine).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (mRef.length) {
      const d = new Date(mRef[0].createdAt);
      lastRefillDate = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      const hoursAgo = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60));
      lastRefillAgo = hoursAgo < 24 ? `${hoursAgo}h ago` : `${Math.floor(hoursAgo / 24)}d ago`;
    }
  } else {
    const allRefills = [...refills].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (allRefills.length) {
      const d = new Date(allRefills[0].createdAt);
      lastRefillDate = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      const hoursAgo = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60));
      lastRefillAgo = hoursAgo < 24 ? `${hoursAgo}h ago` : `${Math.floor(hoursAgo / 24)}d ago`;
    }
  }

  // Chart data: mixed timeline of orders & refills
  const mixed = [...transactions.map(t => ({...t, type:'t'})), ...refills.map(r => ({...r, type:'r'}))]
    .sort((a,b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime()); 

  const filteredMix = mixed.filter(x => selectedMachine === 'all' || x.machineId === selectedMachine);

  const chartData = useMemo(() => {
    const chartMap: Record<string, { date: string; sortKey: number; orders: number; refills: number; volume: number; payments: number }> = {};
    filteredMix.forEach((item) => {
      const d = new Date(item.createdAt!);
      const bucket = new Date(d);
      if (chartGranularity === "hourly") {
        bucket.setMinutes(0, 0, 0);
      } else {
        bucket.setHours(0, 0, 0, 0);
      }
      const sortKey = bucket.getTime();
      const date =
        chartGranularity === "hourly"
          ? bucket.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric" })
          : bucket.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      const key = String(sortKey);
      if (!chartMap[key]) chartMap[key] = { date, sortKey, orders: 0, refills: 0, volume: 0, payments: 0 };
      if (item.type === "t") {
        chartMap[key].orders += 1;
        if ("transactionData" in item && typeof item.transactionData === "string") {
          chartMap[key].payments += getTransactionTotal(item.transactionData);
        }
        try {
	  if ("transactionData" in item) {
            const data = JSON.parse((item as { transactionData: string }).transactionData);
            if (Array.isArray(data)) {
              data.forEach((entry: { productId: string; quantity?: number }) => {
                const prod = products.find((p) => p._id === entry.productId);
                if (prod) chartMap[key].volume += prod.unitWaterReq * (entry.quantity || 1);
              });
            }
          }
        } catch {
          /* ignore */
        }
      }
      if (item.type === "r") chartMap[key].refills += 1;
    });
    return Object.values(chartMap).sort((a, b) => a.sortKey - b.sortKey);
  }, [filteredMix, chartGranularity, products, getTransactionTotal]);

  // Volume per machine bar chart
  const machineBarData = scopedMachines.map((m) => ({
    name: m.locationName,
    remaining: getRemainingWater(m._id, machines, transactions, refills, products),
  }));

  const lowStockMachines = machines.filter((m) =>
    machineNeedsRefill(m, m._id, transactions, refills, products),
  );

  const staleRefillMachines = machines.filter(m => {
    const mRef = refills.filter(r => r.machineId === m._id).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (mRef.length === 0) return true;
    const hoursSince = (Date.now() - new Date(mRef[0].createdAt).getTime()) / (1000 * 60 * 60);
    return hoursSince > 72;
  });

  const notificationCount = lowStockMachines.length + staleRefillMachines.length;

  const renderAdminDash = () => (
    <>
      {/* Top Header */}
      <div ref={headerRef} className="flex flex-col sm:flex-row w-full justify-between items-start sm:items-center gap-4 border-b border-theme-border/50 pb-6 pt-2">
        <div className="flex flex-col gap-2 w-full">
          <h2 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
            <FiHome className="text-theme-text" /> Dashboard
          </h2>
          <p className="text-theme-text/50">
            {scopedMachines.length} machines · {scopedProducts.length} products — overview for{" "}
            <span className="font-bold text-theme-text">{selectedMachine === 'all' ? 'All Machines' : machines.find(m => m._id === selectedMachine)?.locationName}</span>
          </p>
        </div>
        
        <div className="flex items-center gap-3 w-full justify-end">
          <div className="relative">
            <button
              onClick={() => setShowMachinePicker((v) => !v)}
              className="flex items-center gap-2 px-4 py-2 bg-theme-card border border-theme-border rounded-full font-medium hover:bg-theme-background transition-all"
            >
              <FiRefreshCw />
              {selectedMachine === 'all' ? 'All Machines' : machines.find(m => m._id === selectedMachine)?.locationName || "Select"}
              <FiChevronDown className={`transition-transform ${showMachinePicker ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
              {showMachinePicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMachinePicker(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="absolute right-0 top-full mt-2 z-50 min-w-[220px] bg-theme-card border border-theme-border/50 rounded-2xl shadow-xl overflow-hidden backdrop-blur-xl"
                  >
                    <button
                      onClick={() => { setSelectedMachine('all'); setShowMachinePicker(false); }}
                      className={`w-full text-left px-4 py-3 hover:bg-theme-accent/10 transition-colors ${selectedMachine === 'all' ? "bg-theme-accent/20 text-theme-accent font-bold" : "text-theme-text"}`}
                    >Global View</button>
                    {machines.map((s) => (
                      <button
                        key={s._id}
                        onClick={() => { setSelectedMachine(s._id); setShowMachinePicker(false); }}
                        className={`w-full text-left px-4 py-3 hover:bg-theme-accent/10 transition-colors ${s._id === selectedMachine ? "bg-theme-accent/20 text-theme-accent font-bold" : "text-theme-text"}`}
                      >
                        {s.locationName}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <button 
            onClick={() => setShowNotifications(true)}
            className="relative p-3 bg-theme-card border border-theme-border rounded-full hover:bg-theme-background transition-all"
          >
            <FiBell className="text-xl" />
            {notificationCount > 0 && (
              <span className="absolute top-0 right-0 -mt-1 -mr-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-theme-background">
              {notificationCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Summary Overview Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full bg-theme-card p-8 rounded-3xl shadow-xl border border-theme-border/30"
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
          <div className="flex flex-col gap-2">
            <span className="font-bold tracking-widest text-xs uppercase text-theme-accent">Water Status</span>
            <h2 className="text-2xl font-extrabold tracking-tight">Network Overview</h2>
            <p className="text-theme-text/50 text-sm">Water remaining across {selectedMachine === 'all' ? 'all machines' : machines.find(m => m._id === selectedMachine)?.locationName}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-8 sm:gap-16">
            <div className="flex flex-col gap-1">
              <span className="text-theme-text/50 text-xs uppercase tracking-wider font-semibold">Remaining Water</span>
              <span className="text-4xl lg:text-5xl font-extrabold text-sky-400 tracking-tighter">
                {selectedWater.toLocaleString()}ml
              </span>
            </div>
            <div className="hidden sm:block w-px bg-theme-border/50" />
            <div className="flex flex-col gap-1">
              <span className="text-theme-text/50 text-xs uppercase tracking-wider font-semibold">Total Orders</span>
              <span className="text-4xl lg:text-5xl font-extrabold text-emerald-400 tracking-tighter">
                {scopedOrders.length}
              </span>
            </div>
            <div className="hidden sm:block w-px bg-theme-border/50" />
            <div className="flex flex-col gap-1">
              <span className="text-theme-text/50 text-xs uppercase tracking-wider font-semibold">Payments Received</span>
              <span className="text-4xl lg:text-5xl font-extrabold text-amber-400 tracking-tighter">
                ${totalPayments.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Per-machine breakdown */}
        {machines.length > 0 && selectedMachine === 'all' && (
          <div className="mt-8 pt-6 border-t border-theme-border/50">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-theme-text/60">Machines</h3>
              <span className="text-xs text-theme-text/40">Volume remaining by machine</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {machines.map((m) => {
                const inv = getMachineInventory(m, m._id, transactions, refills, products);
                const vol = inv.remainingWater;
                const capacity = inv.waterCapacity;
                const pct = capacity > 0 ? (vol / capacity) * 100 : 0;
                return (
                  <div
                    key={m._id}
                    className="rounded-2xl border p-4 bg-theme-background/35 border-theme-border/40 hover:border-theme-accent/40 transition-all cursor-pointer"
                    onClick={() => { setSelectedMachine(m._id); }}
                  >
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <span className="font-bold truncate">{m.locationName}</span>
                      <span className="text-[10px] uppercase tracking-widest text-theme-text/40 font-bold">{m.locationDetail}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] uppercase tracking-widest text-theme-text/40 font-bold">Water</span>
                        <span className={`text-lg font-black ${pct < 20 ? 'text-red-400' : 'text-sky-400'}`}>
                          {vol.toLocaleString()}ml
                        </span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] uppercase tracking-widest text-theme-text/40 font-bold">Fill %</span>
                        <span className={`text-lg font-black ${pct < 20 ? 'text-red-400' : 'text-theme-text'}`}>
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-3 h-1.5 w-full bg-theme-border/30 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
                        className={`h-full rounded-full ${pct < 20 ? 'bg-red-500' : pct < 50 ? 'bg-orange-400' : 'bg-emerald-500'}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </motion.div>

      {/* Header Stat Cards */}
      <div ref={statsRef} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6 w-full">
        <div className="flex flex-col bg-theme-card p-6 rounded-3xl shadow-lg border border-theme-border/30">
          <div className="flex justify-between items-start mb-2">
            <div className="flex flex-col gap-1">
              <span className="font-bold tracking-widest text-xs uppercase text-theme-accent">Machines</span>
              <span className="text-theme-text/40 text-[10px] uppercase">{selectedMachine === 'all' ? 'Active network' : 'Selected machine'}</span>
            </div>
            <div className="p-3 bg-theme-accent/10 text-theme-accent rounded-xl">
              <FiBox className="text-xl" />
            </div>
          </div>
          <h2 className="text-3xl lg:text-4xl font-extrabold text-theme-text tracking-tighter mt-2">
            {scopedMachines.length}
          </h2>
        </div>

        <div className="flex flex-col bg-theme-card p-6 rounded-3xl shadow-lg border border-theme-border/30">
          <div className="flex justify-between items-start mb-2">
            <div className="flex flex-col gap-1">
              <span className="font-bold tracking-widest text-xs uppercase text-sky-400">Water Remaining</span>
              <span className="text-theme-text/40 text-[10px] uppercase">{selectedMachine === 'all' ? 'Across selection' : lastRefillDate}</span>
            </div>
            <div className="p-3 bg-sky-500/10 text-sky-400 rounded-xl">
              <FiDroplet className="text-xl" />
            </div>
          </div>
          <h2 className="text-3xl lg:text-4xl font-extrabold text-theme-text tracking-tighter mt-2">
            {selectedWater.toLocaleString()} <span className="text-lg font-bold text-theme-text/40">ml</span>
          </h2>
        </div>
        
        <div className="flex flex-col bg-theme-card p-6 rounded-3xl shadow-lg border border-theme-border/30">
          <div className="flex justify-between items-start mb-2">
            <div className="flex flex-col gap-1">
              <span className="font-bold tracking-widest text-xs uppercase text-emerald-400">Assigned Products</span>
              <span className="text-theme-text/40 text-[10px] uppercase">{selectedMachine === 'all' ? 'Across machines' : 'On this machine'}</span>
            </div>
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <FiActivity className="text-xl" />
            </div>
          </div>
          <h2 className="text-3xl lg:text-4xl font-extrabold text-theme-text tracking-tighter mt-2">
            {scopedProducts.length}
          </h2>
        </div>

        <div className="flex flex-col bg-theme-card p-6 rounded-3xl shadow-lg border border-theme-border/30">
          <div className="flex justify-between items-start mb-2">
            <div className="flex flex-col gap-1">
              <span className="font-bold tracking-widest text-xs uppercase text-violet-400">Total Orders</span>
              <span className="text-theme-text/40 text-[10px] uppercase">{selectedMachine === 'all' ? 'All machines' : 'This machine'}</span>
            </div>
            <div className="p-3 bg-violet-500/10 text-violet-400 rounded-xl">
              <FiTrendingUp className="text-xl" />
            </div>
          </div>
          <h2 className="text-3xl lg:text-4xl font-extrabold text-theme-text tracking-tighter mt-2">
            {scopedOrders.length}
          </h2>
        </div>

        <div className="flex flex-col bg-theme-card p-6 rounded-3xl shadow-lg border border-theme-border/30">
          <div className="flex justify-between items-start mb-2">
            <div className="flex flex-col gap-1">
              <span className="font-bold tracking-widest text-xs uppercase text-amber-400">Payments Received</span>
              <span className="text-theme-text/40 text-[10px] uppercase">{selectedMachine === 'all' ? 'All machines' : 'This machine'}</span>
            </div>
            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
              <FiDollarSign className="text-xl" />
            </div>
          </div>
          <h2 className="text-3xl lg:text-4xl font-extrabold text-theme-text tracking-tighter mt-2">
            ${totalPayments.toFixed(2)}
          </h2>
        </div>
      </div>

      {/* Product Stock */}
      {scopedProducts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="w-full bg-theme-card p-6 rounded-3xl shadow-xl border border-theme-border/30"
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold tracking-wide flex items-center gap-2">
              <FiPackage className="text-theme-accent" /> Product Stock
            </h3>
            <span className="text-xs text-theme-text/40 uppercase tracking-wider">
              Servings remaining per product
            </span>
          </div>
          <div className="flex flex-col gap-4">
            {scopedMachines.map((m) => {
              const inv = getMachineInventory(m, m._id, transactions, refills, products);
              const assigned = products.filter((p) => m.productIds?.includes(p._id));
              if (!assigned.length) return null;
              return (
                <div key={m._id} className="flex flex-col gap-2">
                  {selectedMachine === "all" && (
                    <h4 className="text-sm font-bold text-theme-text/60 uppercase tracking-wider border-b border-theme-border/30 pb-2">
                      {m.locationName}
                    </h4>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {assigned.map((p) => {
                      const units = getProductUnitsLeft(m, p, inv, products, m._id, transactions, refills);
                      const powder = inv.productPowder.find((pp) => pp.productId === p._id);
                      const powderPct = powder && powder.capacity > 0 ? (powder.remaining / powder.capacity) * 100 : 0;
                      return (
                        <div
                          key={`${m._id}-${p._id}`}
                          className={`flex items-center gap-3 p-4 rounded-2xl border ${
                            units <= 0
                              ? "border-red-400/30 bg-red-500/5"
                              : "border-theme-border/30 bg-theme-background/30"
                          }`}
                        >
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${getProductIconBg(p.name)}`}>
                            <ProductIcon name={p.name} className="text-sm" />
                          </div>
                          <div className="flex flex-col flex-1 min-w-0">
                            <span className="font-bold text-sm truncate">{p.name}</span>
                            <span className={`text-xs font-bold ${units <= 0 ? "text-red-400" : "text-emerald-400"}`}>
                              {units <= 0 ? "Out of stock" : `${units} servings`}
                            </span>
                            <div className="flex items-center gap-2 mt-1.5">
                              <div className="flex-1 h-1 bg-theme-border/30 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${powderPct < 20 ? "bg-red-500" : "bg-amber-500"}`}
                                  style={{ width: `${powderPct}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-theme-text/40 shrink-0">{powder?.remaining ?? 0}ml</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Main Chart Section */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4 }}
        className="w-full grid grid-cols-1 xl:grid-cols-2 gap-6 mt-4"
      >
        {/* Activity Timeline */}
        <div className="min-w-0 w-full h-[360px] sm:h-[350px] bg-theme-card p-4 sm:p-6 rounded-3xl shadow-xl flex flex-col border border-theme-border/30">
          <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
              <h3 className="text-lg font-bold tracking-wide">Activity Timeline</h3>
            </div>
            <div className="flex gap-1 p-1 bg-theme-background border border-theme-border/40 rounded-full">
              <button
                type="button"
                onClick={() => setChartGranularity("daily")}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  chartGranularity === "daily"
                    ? "bg-theme-accent text-white shadow-md"
                    : "text-theme-text/50 hover:text-theme-text"
                }`}
              >
                Daily
              </button>
              <button
                type="button"
                onClick={() => setChartGranularity("hourly")}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  chartGranularity === "hourly"
                    ? "bg-theme-accent text-white shadow-md"
                    : "text-theme-text/50 hover:text-theme-text"
                }`}
              >
                Hourly
              </button>
            </div>
          </div>
          <div className="flex-1 w-full min-h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.6}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorRefills" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.6}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--borderCol)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--fg)" opacity={0.5} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--fg)" opacity={0.5} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--cardBg)', borderRadius: '12px', border: '1px solid var(--borderCol)', backdropFilter: 'blur(10px)' }} itemStyle={{ color: 'var(--fg)' }} />
                <Area type="monotone" dataKey="orders" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorOrders)" name="Orders" />
                <Area type="monotone" dataKey="refills" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRefills)" name="Refills" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Volume per Machine Bar Chart */}
        <div className="min-w-0 w-full h-[360px] sm:h-[350px] bg-theme-card p-4 sm:p-6 rounded-3xl shadow-xl flex flex-col border border-theme-border/30">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-3 h-3 rounded-full bg-sky-500"></div>
            <h3 className="text-lg font-bold tracking-wide">Water by Machine</h3>
          </div>
          <div className="flex-1 w-full min-h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={machineBarData} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--borderCol)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--fg)" opacity={0.5} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--fg)" opacity={0.5} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}ml`} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--cardBg)', borderRadius: '12px', border: '1px solid var(--borderCol)', backdropFilter: 'blur(10px)' }} itemStyle={{ color: 'var(--fg)' }} />
                <Bar dataKey="remaining" fill="#0ea5e9" radius={[8, 8, 0, 0]} name="Water remaining ml" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Log */}
        <div className="min-w-0 w-full h-[360px] sm:h-[350px] bg-theme-card p-4 sm:p-6 rounded-3xl shadow-xl flex flex-col border border-theme-border/30 xl:col-span-2">
          <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-amber-500"></div>
              <h3 className="text-lg font-bold tracking-wide">Payment Log</h3>
            </div>
            <span className="text-sm font-black text-amber-400">${totalPayments.toFixed(2)} received</span>
          </div>
          <div className="flex-1 w-full min-h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--borderCol)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--fg)" opacity={0.5} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--fg)" opacity={0.5} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  formatter={(value) => [`$${Number(value).toFixed(2)}`, "Payments"]}
                  contentStyle={{ backgroundColor: 'var(--cardBg)', borderRadius: '12px', border: '1px solid var(--borderCol)', backdropFilter: 'blur(10px)' }}
                  itemStyle={{ color: 'var(--fg)' }}
                />
                <Line type="monotone" dataKey="payments" stroke="#f59e0b" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} name="Payments" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </motion.div>

      {/* Notifications Slide-Over Panel */}
      <AnimatePresence>
        {showNotifications && (
          <div className="fixed inset-0 z-[100] flex items-center justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowNotifications(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="bg-theme-background relative z-10 w-full max-w-md h-full shadow-2xl flex flex-col"
            >
              <div className="flex justify-between items-center bg-theme-background p-6 border-b border-theme-border/50 sticky top-0 z-20">
                <h3 className="text-2xl font-black tracking-tight flex items-center gap-3">
                  <FiBell /> Notifications
                </h3>
                <button
                  onClick={() => setShowNotifications(false)}
                  className="p-2 bg-theme-card rounded-full text-theme-text/60 hover:text-theme-text hover:bg-theme-border transition-colors"
                >
                  <FiX />
                </button>
              </div>

              <div className="flex flex-col p-6 gap-8 overflow-y-auto w-full h-full pb-20 scrollbar-hidden">

                {notificationCount === 0 && (
                  <div className="text-center font-bold text-theme-text/50 mt-10">
                    All caught up! No notifications.
                  </div>
                )}

                {/* Low Stock Warnings */}
                {lowStockMachines.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 border-b border-theme-border/50 pb-2 mb-2">
                      <FiAlertTriangle className="text-red-400 text-lg" />
                      <h4 className="font-bold uppercase tracking-wider text-sm flex-1">Needs Refill</h4>
                      <span className="bg-red-500/20 text-red-500 text-xs font-black px-2 py-0.5 rounded-full">{lowStockMachines.length}</span>
                    </div>
                    {lowStockMachines.map(m => {
                      const inv = getMachineInventory(m, m._id, transactions, refills, products);
                      return (
                        <div key={m._id} className="bg-red-500/10 rounded-xl p-3 border-l-4 border-red-500 flex flex-col gap-1 text-sm">
                          <div className="flex justify-between">
                            <span className="font-bold truncate max-w-[200px]">{m.locationName}</span>
                            <span className="font-bold text-red-400">{inv.remainingWater}ml water</span>
                          </div>
                          <div className="text-theme-text/50 text-xs">Low water or product stock</div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Stale Refills */}
                {staleRefillMachines.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 border-b border-theme-border/50 pb-2 mb-2">
                      <FiClock className="text-orange-400 text-lg" />
                      <h4 className="font-bold uppercase tracking-wider text-sm flex-1">Stale Refills</h4>
                      <span className="bg-orange-500/20 text-orange-500 text-xs font-black px-2 py-0.5 rounded-full">{staleRefillMachines.length}</span>
                    </div>
                    {staleRefillMachines.map(m => (
                      <div key={m._id} className="bg-theme-card rounded-xl p-3 border-l-4 border-orange-500 flex flex-col gap-1 text-sm">
                        <span className="font-bold">{m.locationName}</span>
                        <div className="text-theme-text/50 text-xs">Not refilled in 72+ hours</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );

  const renderUserDash = () => {
    const myTrans = transactions.filter(t => t.clerkId === effectiveUser?.userId);
    return (
      <div className="flex flex-col gap-6 w-full">
         <div ref={headerRef} className="flex flex-col gap-2 border-b border-theme-border/50 pb-6 pt-2">
            <h2 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
              <FiHome className="text-theme-text" /> My Dashboard
            </h2>
            <p className="text-theme-text/50">
              {myTrans.length} orders placed
            </p>
         </div>

         <div ref={statsRef} className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="flex flex-col bg-theme-card p-6 rounded-3xl shadow-lg border border-theme-border/30">
             <div className="flex justify-between items-start mb-2">
               <div className="flex flex-col gap-1">
                 <span className="font-bold tracking-widest text-xs uppercase text-emerald-400">My Orders</span>
                 <span className="text-theme-text/40 text-[10px] uppercase">Lifetime Total</span>
               </div>
               <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
                 <FiTrendingUp className="text-xl" />
               </div>
             </div>
             <h2 className="text-3xl lg:text-4xl font-extrabold text-theme-text tracking-tighter mt-2">
               {myTrans.length}
             </h2>
           </div>

	   {/* <div className="flex flex-col bg-theme-card p-6 rounded-3xl shadow-lg border border-theme-border/30">
             <div className="flex justify-between items-start mb-2">
               <div className="flex flex-col gap-1">
                 <span className="font-bold tracking-widest text-xs uppercase text-sky-400">Available Machines</span>
                 <span className="text-theme-text/40 text-[10px] uppercase">Online now</span>
               </div>
               <div className="p-3 bg-sky-500/10 text-sky-400 rounded-xl">
                 <FiBox className="text-xl" />
               </div>
             </div>
             <h2 className="text-3xl lg:text-4xl font-extrabold text-theme-text tracking-tighter mt-2">
               {machines.length}
             </h2>
           </div> */}
         </div>

         {/* Recent orders list */}
         {myTrans.length > 0 && (
           <motion.div 
             initial={{ opacity: 0, y: 20 }} 
             animate={{ opacity: 1, y: 0 }} 
             transition={{ delay: 0.3 }}
             className="bg-theme-card p-6 rounded-3xl shadow-lg border border-theme-border/30"
           >
             <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
               <FiPackage className="text-theme-accent" /> Recent Orders
             </h3>
             <div className="flex flex-col gap-2">
               {myTrans.slice(0, 10).map((tx, idx) => (
                 <motion.div 
                   key={tx._id}
                   initial={{ opacity: 0, x: -10 }}
                   animate={{ opacity: 1, x: 0 }}
                   transition={{ delay: idx * 0.05 }}
                   className="flex items-center justify-between p-3 bg-theme-background/50 rounded-xl border border-theme-border/20"
                 >
                   <div className="flex flex-col">
                     <span className="font-bold text-sm">{machines.find(m => m._id === tx.machineId)?.locationName || 'Machine'}</span>
                     <span className="text-xs text-theme-text/40">{new Date(tx.createdAt).toLocaleString()}</span>
                   </div>
                   <span className="text-emerald-400 font-black text-sm">Dispensed</span>
                 </motion.div>
               ))}
             </div>
           </motion.div>
         )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-theme-text opacity-70">
        <CgSpinner className="animate-spin text-4xl mb-4 text-theme-accent" />
        <p className="animate-pulse">Loading Dashboard Metrics...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col gap-6 p-6 px-4 md:px-8 overflow-y-auto mb-[100px] scrollbar-hidden">
      {admin ? renderAdminDash() : renderUserDash()}
    </div>
  );
}
