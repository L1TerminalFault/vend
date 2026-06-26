"use client";

import { useEffect, useRef, useState } from "react";
import { useStoreStore } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";
import gsap from "gsap";
import { FiFileText, FiAlertTriangle, FiDroplet, FiBox, FiChevronDown } from "react-icons/fi";
import { CgSpinner } from "react-icons/cg";
import EmptyState from "@/components/EmptyState";
import { isAdmin } from "@/lib/utils";
import type { TransactionType } from "@/lib/types";

type Tab = "all" | "refills" | "orders";

export default function TransactionsPage() {
  const { transactions, refills, machines, products, effectiveUser } = useStoreStore();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [selectedMachine, setSelectedMachine] = useState<string>("all");
  const [showMachineFilter, setShowMachineFilter] = useState(false);
  const [clerkNames, setClerkNames] = useState<Record<string, string>>({});
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (machines.length > 0 || transactions.length > 0 || refills.length > 0 || effectiveUser) {
      setLoading(false);
    }
  }, [machines, transactions, refills, effectiveUser]);

  useEffect(() => {
    if (loading) return;
    if (headerRef.current) {
      gsap.fromTo(headerRef.current, 
        { y: -20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" }
      );
    }
  }, [loading]);

  useEffect(() => {
    const signedInIds = transactions
      .filter((t) => t.signedIn && t.clerkId)
      .map((t) => t.clerkId);
    if (!signedInIds.length) return;

    fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: signedInIds }),
    })
      .then((res) => res.json())
      .then((names) => {
        if (names && typeof names === "object" && !names.error) {
          setClerkNames((prev) => ({ ...prev, ...names }));
        }
      })
      .catch(() => {});
  }, [transactions]);

  if (!isAdmin(effectiveUser?.userId) && effectiveUser?.userId !== undefined && effectiveUser?.userId !== "anon") {
    return (
       <div className="w-full h-full flex flex-col items-center justify-center p-6 text-theme-text opacity-70">
          <FiAlertTriangle className="text-4xl mb-4 text-red-500" />
          <p className="font-bold text-xl">Restricted Access</p>
          <p className="text-theme-text/50 text-sm mt-2">Only admins can view the full activity log.</p>
       </div>
    );
  }

  // Mix transactions and refills chronologically
  const mixedData = [
    ...transactions.map(t => ({ ...t, type: 'transaction' as const })),
    ...refills.map(r => ({ ...r, type: 'refill' as const }))
  ].sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());

  const displayed = mixedData.filter(item => {
    if (selectedMachine !== "all" && item.machineId !== selectedMachine) return false;
    if (activeTab === "refills" && item.type !== "refill") return false;
    if (activeTab === "orders" && item.type !== "transaction") return false;
    return true;
  });

  const tabs: { key: Tab; label: string; count: number; icon?: any }[] = [
    { key: "all", label: "All Activity", count: mixedData.filter(x => selectedMachine === 'all' || x.machineId === selectedMachine).length },
    { key: "orders", label: "Orders", count: transactions.filter(t => selectedMachine === 'all' || t.machineId === selectedMachine).length, icon: FiBox },
    { key: "refills", label: "Refills", count: refills.filter(r => selectedMachine === 'all' || r.machineId === selectedMachine).length, icon: FiDroplet },
  ];

  const getTransactionTotal = (tx: TransactionType) => {
    try {
      const data = JSON.parse(tx.transactionData);
      if (Array.isArray(data)) {
        return data.reduce((sum: number, item: { productId: string; quantity?: number }) => {
          const prod = products.find(p => p._id === item.productId);
          return sum + (prod ? prod.price * (item.quantity || 1) : 0);
        }, 0);
      }
    } catch {}
    return 0;
  };

  const getOrderLabel = (tx: TransactionType) => {
    if (tx.signedIn && tx.clerkId && clerkNames[tx.clerkId]) {
      return clerkNames[tx.clerkId];
    }
    if (tx.signedIn) return "Verified User";
    return "Guest Order";
  };

  const getTransactionProducts = (tx: TransactionType) => {
    try {
      const data = JSON.parse(tx.transactionData);
      if (Array.isArray(data)) {
        return data.map((item: any) => {
          const prod = products.find(p => p._id === item.productId);
          return prod ? `${prod.name} ×${item.quantity || 1}` : `Unknown ×${item.quantity || 1}`;
        }).join(', ');
      }
    } catch {}
    return 'Unknown products';
  };

  return (
    <div className="w-full h-full flex flex-col gap-6 p-6 px-4 md:px-8 overflow-y-auto mb-[100px] scrollbar-hidden">
      <div ref={headerRef} className="flex flex-col sm:flex-row w-full gap-4 mb-2 justify-between sm:items-end">
        <div className="flex flex-col gap-2 w-full">
          <h2 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
            <FiFileText className="text-theme-text" /> Activity Log
          </h2>
          <p className="text-theme-text/50">
            {loading ? "Loading..." : `${mixedData.length} records total`}
            {!loading && refills.length > 0 && (
              <span className="text-[#3b82f6] ml-2">
                · {refills.length} refills
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3 w-full justify-end">
          <div className="relative">
            <button
              onClick={() => setShowMachineFilter(v => !v)}
              className="flex items-center gap-2 px-4 py-2 bg-theme-card border border-theme-border rounded-full font-medium hover:bg-theme-background transition-all"
            >
              {selectedMachine === "all" ? "All Machines" : machines.find(m => m._id === selectedMachine)?.locationName || "Select"}
              <FiChevronDown className={`transition-transform ${showMachineFilter ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
              {showMachineFilter && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMachineFilter(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="absolute right-0 top-full mt-2 z-50 min-w-[220px] bg-theme-card border border-theme-border/50 rounded-2xl shadow-xl overflow-hidden backdrop-blur-xl"
                  >
                    <button
                      onClick={() => { setSelectedMachine("all"); setShowMachineFilter(false); }}
                      className={`w-full text-left px-4 py-3 hover:bg-theme-accent/10 transition-colors ${selectedMachine === "all" ? "bg-theme-accent/20 text-theme-accent font-bold" : "text-theme-text"}`}
                    >All Machines</button>
                    {machines.map(m => (
                      <button
                        key={m._id}
                        onClick={() => { setSelectedMachine(m._id); setShowMachineFilter(false); }}
                        className={`w-full text-left px-4 py-3 hover:bg-theme-accent/10 transition-colors ${m._id === selectedMachine ? "bg-theme-accent/20 text-theme-accent font-bold" : "text-theme-text"}`}
                      >
                        {m.locationName}
                        <span className="text-xs text-theme-text/40 ml-2">{m.locationDetail}</span>
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
	</div>
      </div>

      <div className="flex flex-wrap gap-2 p-1 bg-theme-card border border-theme-border/50 rounded-full w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-medium transition-all duration-300 ${
              activeTab === tab.key
                ? tab.key === "refills"
                  ? "bg-[#3b82f6] text-white shadow-lg"
                  : "bg-theme-accent text-white shadow-lg"
                : "text-theme-text/60 hover:text-theme-text"
            }`}
          >
            {tab.icon && <tab.icon />}
            {tab.label}
            <span className="text-xs opacity-80">({tab.count})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col w-full h-full items-center justify-center gap-4 text-theme-text/70 mt-20">
          <CgSpinner className="animate-spin text-4xl text-theme-accent" />
          <p className="animate-pulse">Loading Logs...</p>
        </div>
      ) : !displayed.length ? (
        <EmptyState
          title="No activity found"
          message="No transactions or refills match your current filter."
        />
      ) : (
        <div className="flex flex-col gap-3">
          <AnimatePresence>
          {displayed.map((item, idx) => {
            const isRefill = item.type === 'refill';
            return (
              <motion.div
                key={item._id + item.type}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: idx * 0.04, duration: 0.35 }}
                className={`flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 ${
                  isRefill
                    ? "bg-[#3b82f6]/10 border border-[#3b82f6]/25 hover:bg-[#3b82f6]/15"
                    : "bg-theme-card border border-theme-border/30 hover:bg-theme-card/80"
                }`}
              >
                {/* Icon */}
                <div className={`p-3 rounded-xl shrink-0 ${isRefill ? 'bg-[#3b82f6]/20 text-[#3b82f6]' : 'bg-emerald-500/10 text-emerald-400'}`}>
                  {isRefill ? <FiDroplet className="text-xl" /> : <FiBox className="text-xl" />}
                </div>

                <div className="flex flex-col flex-1 min-w-0">
                  <span className="font-bold text-base truncate flex items-center gap-2">
                    {isRefill ? 'Refill' : getOrderLabel(item as TransactionType)}
                    {isRefill && (
                      <span className="text-[10px] uppercase tracking-wider font-black text-[#3b82f6] bg-[#3b82f6]/20 px-2 py-0.5 rounded-full">
                        Restock
                      </span>
                    )}
                    {!isRefill && (item as any).signedIn && (
                      <span className="text-[10px] uppercase tracking-wider font-black text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full">
                        Verified
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-theme-text/50 uppercase tracking-wide mt-1">
                    {machines.find(m => m._id === item.machineId)?.locationName || item.machineId}
                    {!isRefill && <span className="text-theme-text/30 ml-2">· {getTransactionProducts(item)}</span>}
                  </span>
                </div>

                <div className="flex flex-col items-end shrink-0">
                  <span
                    className={`text-lg font-extrabold ${
                      isRefill ? "text-[#3b82f6]" : "text-emerald-400"
                    }`}
                  >
                    {isRefill ? '' : `$${getTransactionTotal(item as TransactionType).toFixed(2)} paid`}
                  </span>
                  <span className="text-[10px] text-theme-text/40 uppercase">
                    {new Date(item.createdAt!).toLocaleString()}
                  </span>
                </div>
              </motion.div>
            );
          })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
