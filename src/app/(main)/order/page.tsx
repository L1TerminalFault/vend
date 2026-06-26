"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useStoreStore, getMachineInventory, getRemainingWater, getProductUnitsLeft, getProductPowderUnitsLeft, getRemainingPowderForProduct } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";
import gsap from "gsap";
import { FiCheckCircle, FiShoppingCart, FiSmartphone, FiArrowRight, FiPlus, FiMinus, FiTrash2, FiZap, FiAlertTriangle, FiShoppingBag } from "react-icons/fi";
import { CgSpinner } from "react-icons/cg";

import EmptyState from "@/components/EmptyState";
import ProductIcon from "@/components/ProductIcon";
import { isAdmin } from "@/lib/utils";

type DetectedBarcode = { rawValue: string };

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => {
  detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]>;
};

export default function OrderPage() {
  const router = useRouter();
  const [urlMachineId, setUrlMachineId] = useState("");
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
     const params = new URLSearchParams(window.location.search);
     setUrlMachineId(params.get("machineId") || "");
  }, []);

  const [machineIdInput, setMachineIdInput] = useState("");
  const [confirmedMachine, setConfirmedMachine] = useState("");
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [scanActive, setScanActive] = useState(false);
  const [scanError, setScanError] = useState("");
  const cartRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanFrameRef = useRef<number | null>(null);
  
  // Cart: { productId: string, quantity: number }
  const [cart, setCart] = useState<{ productId: string, quantity: number }[]>([]);

  const { machines, products, transactions, refills, effectiveUser } = useStoreStore();
  const admin = isAdmin(effectiveUser?.userId);

  useEffect(() => {
    if (machines.length > 0 || products.length > 0 || effectiveUser) {
       setLoading(false);
    }
  }, [machines, products, effectiveUser]);

  useEffect(() => {
    if (urlMachineId) {
      setMachineIdInput(urlMachineId);
      setConfirmedMachine(urlMachineId);
    }
  }, [urlMachineId]);

  useEffect(() => {
    if (!loading && headerRef.current) {
      gsap.fromTo(headerRef.current,
        { y: -20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" }
      );
    }
  }, [loading, confirmedMachine]);

  useEffect(() => {
    if (cartRef.current && cart.length > 0) {
      gsap.fromTo(cartRef.current,
        { scale: 0.98, opacity: 0.8 },
        { scale: 1, opacity: 1, duration: 0.3, ease: "power2.out" }
      );
    }
  }, [cart.length]);

  const stopQrScan = () => {
    if (scanFrameRef.current) {
      cancelAnimationFrame(scanFrameRef.current);
      scanFrameRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScanActive(false);
  };

  useEffect(() => {
    return () => stopQrScan();
  }, []);

  const getMachineIdFromScan = (rawValue: string) => {
    const trimmed = rawValue.trim();
    try {
      const url = new URL(trimmed, window.location.origin);
      return url.searchParams.get("machineId") || trimmed;
    } catch {
      return trimmed;
    }
  };

  const handleScannedMachine = (rawValue: string) => {
    const scannedMachineId = getMachineIdFromScan(rawValue);
    if (!scannedMachineId) {
      setScanError("QR code did not include a machine ID.");
      return;
    }
    stopQrScan();
    setScanError("");
    setMachineIdInput(scannedMachineId);
    setConfirmedMachine(scannedMachineId);
    router.replace(`/order?machineId=${encodeURIComponent(scannedMachineId)}`);
  };

  const startQrScan = async () => {
    setScanError("");
    const BarcodeDetector = (window as typeof window & { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
    if (!BarcodeDetector) {
      setScanError("QR scanning is not supported in this browser. Use a browser with camera QR support.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setScanError("Camera access is not available in this browser.");
      return;
    }

    try {
      setScanActive(true);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) {
        stopQrScan();
        return;
      }
      video.srcObject = stream;
      await video.play();

      const detector = new BarcodeDetector({ formats: ["qr_code"] });
      const scan = async () => {
        if (!videoRef.current || !streamRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          const code = codes[0]?.rawValue;
          if (code) {
            handleScannedMachine(code);
            return;
          }
        } catch {
          setScanError("Could not read the QR code. Keep it centered and try again.");
        }
        scanFrameRef.current = requestAnimationFrame(scan);
      };
      scanFrameRef.current = requestAnimationFrame(scan);
    } catch {
      setScanError("Camera access was blocked or unavailable.");
      stopQrScan();
    }
  };

  const machine = machines.find(m => m._id === confirmedMachine);
  const inventory = machine
    ? getMachineInventory(machine, confirmedMachine, transactions, refills, products)
    : { remainingWater: 0, waterCapacity: 0, productPowder: [] };
  const remainingWater = confirmedMachine
    ? getRemainingWater(confirmedMachine, machines, transactions, refills, products)
    : 0;
  const machineCapacity = machine?.totalWaterCapacity ?? 0;
  const fillPct = machineCapacity > 0 ? (remainingWater / machineCapacity) * 100 : 0;

  const machineProducts = machine?.productIds?.length
    ? products.filter(p => machine.productIds!.includes(p._id))
    : [];

  const getCartConsumption = () => {
    let water = 0;
    cart.forEach(item => {
      const prod = products.find(p => p._id === item.productId);
      if (prod) water += prod.unitWaterReq * item.quantity;
    });
    return { water };
  };

  const cartConsumption = getCartConsumption();
  const waterAfterCart = remainingWater - cartConsumption.water;

  const getPowderUnitsLeft = (productId: string) => {
    const prod = products.find(p => p._id === productId);
    if (!prod || !machine) return 0;
    return getProductPowderUnitsLeft(machine, prod, confirmedMachine, transactions, refills, products, cart);
  };

  const canAddMore = (productId: string) => {
    const prod = products.find(p => p._id === productId);
    if (!prod || !machine) return false;
    return getPowderUnitsLeft(productId) > 0 && waterAfterCart >= prod.unitWaterReq;
  };

  const getCartTotal = () => {
    return cart.reduce((acc, item) => {
       const prod = products.find(p => p._id === item.productId);
       return acc + (prod ? prod.price * item.quantity : 0);
    }, 0);
  };

  const currentCartWater = cartConsumption.water;

  const addToCart = (productId: string) => {
    const prod = products.find(p => p._id === productId);
    if (!prod || !machine || !canAddMore(productId)) return;

    setCart(prev => {
       const exists = prev.find(i => i.productId === productId);
       if (exists) return prev.map(i => i.productId === productId ? { ...i, quantity: i.quantity + 1 } : i);
       return [...prev, { productId, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    const prod = products.find(p => p._id === productId);
    if (!prod || !machine) return;

    setCart(prev => {
       const exists = prev.find(i => i.productId === productId);
       if (!exists) return prev;
       
       const newQ = exists.quantity + delta;
       if (newQ <= 0) return prev.filter(i => i.productId !== productId);
       
       if (delta > 0 && getProductUnitsLeft(machine, prod, inventory, products, confirmedMachine, transactions, refills, prev) <= 0) return prev;

       return prev.map(i => i.productId === productId ? { ...i, quantity: newQ } : i);
    });
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (cartConsumption.water > remainingWater) {
      setError("Order exceeds available water. Remove some items.");
      return;
    }
    for (const item of cart) {
      const prod = products.find((p) => p._id === item.productId);
      if (!prod || !machine) continue;
      const powderAvailable = getRemainingPowderForProduct(
        machine, prod._id, confirmedMachine, transactions, refills, products,
      );
      if (prod.unitProductMl * item.quantity > powderAvailable) {
        setError(`${prod.name} exceeds available powder.`);
        return;
      }
    }
    
    setProcessing(true);
    setError("");
    const data = {
      clerkId: effectiveUser?.userId,
      machineId: confirmedMachine,
      idIfNotSignedIn: effectiveUser?.userId === "anon" ? `anon-${Date.now()}` : "",
      transactionData: JSON.stringify(cart),
      signedIn: effectiveUser?.userId !== "anon" && effectiveUser?.userId !== undefined
    };

    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });

      if (!res.ok) throw new Error("Order failed");
      
      const created = await res.json();
      const { setTransactions, transactions: currentTx } = useStoreStore.getState();
      setTransactions([...currentTx, created]);

      setCart([]);
      setProcessing(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch(e) {
      setProcessing(false);
      setError("Failed to process order. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-theme-text opacity-70">
        <CgSpinner className="animate-spin text-4xl mb-4 text-theme-accent" />
        <p className="animate-pulse">Loading Vend Network...</p>
      </div>
    );
  }

  if (!machines.length) {
    return (
      <div className="w-full h-full flex flex-col p-6 overflow-y-auto">
        <EmptyState 
           title="No machines available" 
           message="No vending machines have been registered yet. Please check back later." 
        />
      </div>
    );
  }

  if (!admin && !urlMachineId && !confirmedMachine) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-theme-text">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex flex-col p-10 rounded-3xl bg-theme-card border border-theme-border/30 shadow-2xl items-center text-center w-full max-w-xl relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-theme-accent/5 to-transparent pointer-events-none" />
          <div className="p-5 bg-theme-accent/10 rounded-full mb-6 text-theme-accent ring-8 ring-theme-accent/5 relative z-10">
            <FiSmartphone className="w-12 h-12" />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight mb-2 text-theme-text relative z-10">
            Scan a machine QR code
          </h2>
          <p className="text-sm opacity-60 relative z-10 max-w-sm">
            Orders start from the QR code on the vending machine. Scan it to open the correct order page.
          </p>
          <div className="relative z-10 w-full mt-8 flex flex-col gap-4">
            {scanActive && (
              <div className="w-full overflow-hidden rounded-2xl border border-theme-border/40 bg-black aspect-[4/3]">
                <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
              </div>
            )}
            {scanError && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm font-semibold text-red-400">
                {scanError}
              </div>
            )}
            <button
              type="button"
              onClick={scanActive ? stopQrScan : startQrScan}
              className="w-full py-4 text-sm rounded-full bg-theme-accent text-white font-bold tracking-widest uppercase shadow-[0_8px_30px_var(--accent)] hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              {scanActive ? "Stop Scan" : "Scan QR"} <FiSmartphone className="text-lg" />
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full p-6 pb-24 md:px-8 max-w-7xl mx-auto gap-6 overflow-y-auto scrollbar-hidden mb-[100px]">
      <div ref={headerRef} className="flex flex-col gap-2 mb-2">
        <h2 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
          <FiShoppingBag className="text-theme-text" /> Place Order
        </h2>
        <p className="text-theme-text/50">
          {!admin && confirmedMachine
            ? "Choose products and checkout"
            : confirmedMachine
            ? `Ordering from ${machine?.locationName || "machine"} · ${machineProducts.length} products available`
            : `${machines.length} machines online · Connect to start ordering`}
        </p>
      </div>

      <div className="flex flex-col xl:flex-row w-full gap-6">
      {!confirmedMachine ? (
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex flex-col p-10 rounded-3xl bg-theme-card border border-theme-border/30 shadow-2xl items-center text-center mt-10 w-full max-w-2xl mx-auto relative overflow-hidden h-fit">
          <div className="absolute inset-0 bg-gradient-to-b from-theme-accent/5 to-transparent pointer-events-none" />
          <div className="p-5 bg-theme-accent/10 rounded-full mb-6 text-theme-accent ring-8 ring-theme-accent/5 relative z-10">
              <FiSmartphone className="w-12 h-12" />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight mb-2 text-theme-text relative z-10">Connect to Machine</h2>
          <p className="text-sm opacity-60 mb-8 relative z-10 max-w-sm">
            {admin
              ? "Scan the QR code on the vending machine, or manually enter the Machine ID to start your order."
              : "Scan the QR code on the vending machine to start your order."}
          </p>
          
          {admin && (
          <div className="w-full relative z-10 mb-4">
              <input 
                type="text" 
                value={machineIdInput}
                onChange={e => setMachineIdInput(e.target.value)}
                className="w-full p-5 text-center rounded-2xl bg-theme-background/50 border border-theme-border/50 outline-none text-theme-text focus:border-theme-accent transition-all duration-300 tracking-[0.25em] uppercase font-mono shadow-inner hover:bg-theme-background/80"
                placeholder="MACHINE-ID"
              />
          </div>
          )}

          {/* Quick pick from known machines */}
          {admin && machines.length > 0 && (
            <div className="w-full relative z-10 mb-6">
              <p className="text-xs uppercase tracking-widest text-theme-text/40 font-bold mb-3">Or select a machine</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {machines.map(m => (
                  <motion.button
                    key={m._id}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => { setMachineIdInput(m._id); setConfirmedMachine(m._id); }}
                    className="px-4 py-2 bg-theme-background border border-theme-border/50 rounded-full text-sm font-medium hover:border-theme-accent/50 transition-all"
                  >
                    {m.locationName}
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          <button 
            onClick={admin ? () => setConfirmedMachine(machineIdInput) : startQrScan}
            disabled={admin && !machineIdInput}
            className="w-full py-4 text-sm rounded-full bg-theme-accent text-white font-bold tracking-widest uppercase shadow-[0_8px_30px_var(--accent)] hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:shadow-none disabled:active:scale-100 flex items-center justify-center gap-2 relative z-10"
          >
            {admin ? "Connect" : "Scan QR"} <FiArrowRight className="text-lg" />
          </button>
        </motion.div>
      ) : (
        <>
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex flex-col gap-6 flex-1">
          <div className="flex flex-col gap-1 border-b border-theme-border/50 pb-6">
             <div className="flex justify-between items-start">
                 <h3 className="text-xl font-extrabold tracking-tight">Dispense Menu</h3>
                 {admin && (
                 <button onClick={() => { setConfirmedMachine(""); setCart([]); setError(""); }} className="text-[10px] uppercase font-bold tracking-widest opacity-50 hover:text-theme-accent hover:opacity-100 px-3 py-1.5 bg-theme-card border border-theme-border rounded-full transition-colors">
                     Disconnect
                 </button>
                 )}
             </div>
             <p className="text-theme-text/50 mt-1 flex items-center gap-2">
                 <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                 {admin
                   ? <>{machine ? machine.locationName : 'Unknown Vendor'} · <span className="font-mono text-xs opacity-70 uppercase tracking-widest">{confirmedMachine.slice(0, 12)}</span></>
                   : "Ready to order"}
             </p>
             {/* Machine status bar */}
             {admin && (
             <div className="flex items-center gap-3 mt-3">
               <div className="flex-1 h-2 bg-theme-border/30 rounded-full overflow-hidden">
                 <motion.div 
                   initial={{ width: 0 }}
                   animate={{ width: `${fillPct}%` }}
                   transition={{ duration: 1, ease: "easeOut" }}
                   className={`h-full rounded-full ${fillPct < 20 ? 'bg-red-500' : fillPct < 50 ? 'bg-orange-400' : 'bg-emerald-500'}`}
                 />
               </div>
               <span className={`text-xs font-bold ${fillPct < 20 ? 'text-red-400' : 'text-theme-text/50'}`}>{fillPct.toFixed(0)}% Water</span>
             </div>
             )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence>
               {success && (
                 <motion.div initial={{ opacity:0, y:-10, scale:0.95 }} animate={{opacity:1, y:0, scale: 1}} exit={{opacity:0, scale:0.9}} className="col-span-full bg-emerald-500/10 text-emerald-400 p-5 rounded-2xl border border-emerald-500/20 flex items-center gap-4 shadow-lg">
                    <FiCheckCircle className="w-6 h-6 shrink-0" />
                    <div>
                      <span className="font-bold tracking-wide block">Order sent successfully!</span>
                      <span className="text-xs opacity-70">Your items are being dispensed now.</span>
                    </div>
                 </motion.div>
               )}
               {error && (
                 <motion.div initial={{ opacity:0, y:-10 }} animate={{opacity:1, y:0}} exit={{opacity:0}} className="col-span-full bg-red-500/10 text-red-400 p-5 rounded-2xl border border-red-500/20 flex items-center gap-4 shadow-lg">
                    <FiAlertTriangle className="w-6 h-6 shrink-0" />
                    <span className="font-bold tracking-wide">{error}</span>
                 </motion.div>
               )}
            </AnimatePresence>
            
            {machineProducts.length === 0 ? (
              <div className="col-span-full">
                <EmptyState
                  title={machine ? "No products available" : "Order unavailable"}
                  message={machine ? "No products are available for ordering right now." : "This QR code does not match an available ordering point."}
                />
              </div>
            ) : machineProducts.map((p, i) => {
               const powderUnitsLeft = getPowderUnitsLeft(p._id);
               const hasPowder = powderUnitsLeft > 0;
               const canAdd = canAddMore(p._id);
               const cartCount = cart.find(c => c.productId === p._id)?.quantity || 0;
               return (
                 <motion.div 
                   key={p._id}
                   initial={{ scale: 0.95, opacity: 0 }}
                   animate={{ scale: 1, opacity: 1 }}
                   transition={{ delay: i * 0.05 }}
                   whileHover={{ y: -2 }}
                   className={`flex flex-col p-5 rounded-3xl border transition-all duration-300 shadow-sm ${hasPowder || cartCount > 0 ? 'border-theme-border/40 bg-theme-card hover:border-theme-accent/60 hover:shadow-lg' : 'border-red-500/20 bg-red-500/5 opacity-60'}`}
                 >
                   <div className="flex justify-between items-start mb-4">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-theme-accent/10 flex items-center justify-center shrink-0">
                              <ProductIcon name={p.name} className="text-xl" />
                            </div>
                            <div className="flex flex-col gap-1">
                            <span className="font-extrabold tracking-tight text-xl text-theme-text">{p.name}</span>
                            <div className="flex items-center gap-2 flex-wrap">
                                {admin && (
                                <span className="text-xs bg-theme-background border border-theme-border/50 px-2 py-0.5 rounded-md font-mono tracking-widest opacity-80">{p.unitWaterReq}ML water</span>
                                )}
                                <span className="text-xs font-semibold opacity-60 uppercase">{p.category}</span>
                                {admin && (
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${powderUnitsLeft <= 0 ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-500'}`}>
                                  {powderUnitsLeft <= 0 ? 'No powder' : `${powderUnitsLeft} servings`}
                                </span>
                                )}
                            </div>
                            </div>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="font-black text-theme-text text-lg">${p.price.toFixed(2)}</span>
                          {cartCount > 0 && (
                            <span className="text-[10px] uppercase tracking-widest text-theme-accent font-black bg-theme-accent/10 px-2 py-0.5 rounded-full mt-1">In cart</span>
                          )}
                        </div>
                   </div>
                   
                   <div className="mt-auto">
                     {cartCount === 0 ? (
                         <button 
                           disabled={!canAdd || processing}
                           onClick={() => addToCart(p._id)}
                           className={`w-full py-3 rounded-full font-bold text-xs tracking-widest uppercase flex items-center justify-center gap-2 transition-all ${canAdd ? 'bg-theme-accent border border-theme-accent text-white hover:bg-theme-accent/70 hover:text-white' : 'hidden'}`}
                         >
                           Add to Order <FiPlus />
                         </button>
                     ) : (
                         <div className="flex items-center justify-between bg-theme-background border border-theme-border/50 rounded-full p-1 w-full">
                            <button onClick={() => updateQuantity(p._id, -1)} className="p-2.5 hover:bg-theme-card rounded-full text-theme-text opacity-70 hover:opacity-100 transition-colors">
                                {cartCount > 1 ? <FiMinus /> : <FiTrash2 className="text-red-400" />}
                            </button>
                            <span className="font-black text-lg tracking-widest">{cartCount}</span>
                            <button onClick={() => updateQuantity(p._id, 1)} disabled={!canAddMore(p._id)} className="p-2.5 hover:bg-theme-card rounded-full text-theme-text opacity-70 hover:opacity-100 transition-colors disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed">
                                <FiPlus />
                            </button>
                         </div>
                     )}
                     {!hasPowder && cartCount === 0 && (
                         <div className="w-full py-3 text-center text-xs font-black tracking-widest text-red-500/50 uppercase">No Powder Left</div>
                     )}
                     {hasPowder && !canAdd && cartCount === 0 && (
                         <div className="w-full py-3 text-center text-xs font-black tracking-widest text-orange-400/70 uppercase">Low Water</div>
                     )}
                   </div>
                 </motion.div>
               );
            })}
          </div>
        </motion.div>
        
        {/* Cart Sidebar */}
        <motion.div ref={cartRef} initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex flex-col w-full xl:w-[380px] shrink-0 h-fit bg-theme-card border border-theme-border/50 rounded-3xl p-6 shadow-xl sticky top-6">
            <h3 className="text-xl font-extrabold tracking-tight mb-4 flex items-center gap-2">
                <FiShoppingCart className="text-theme-accent" /> Your Order
            </h3>
            
            <div className="flex flex-col gap-3 min-h-[150px]">
                {cart.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-theme-text/40 text-sm font-medium gap-2 py-8">
                      <FiZap className="text-2xl opacity-30" />
                      Cart is empty
                    </div>
                ) : (
                    <AnimatePresence>
                        {cart.map(item => {
                            const p = products.find(prod => prod._id === item.productId);
                            if (!p) return null;
                            return (
                                <motion.div key={item.productId} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex overflow-hidden justify-between items-center bg-theme-background/50 border border-theme-border/30 rounded-xl p-4">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-sm">{p.name}</span>
                                        <span className="text-xs opacity-60">
                                          {admin ? `${p.unitWaterReq}ml water · ${item.quantity}× = ${p.unitWaterReq * item.quantity}ml` : `${item.quantity}× selected`}
                                        </span>
                                    </div>
                                    <div className="flex flex-col items-end">
                                      <span className="font-mono text-sm font-bold">${(p.price * item.quantity).toFixed(2)}</span>
                                      <button onClick={() => updateQuantity(item.productId, -item.quantity)} className="text-[10px] text-red-400 uppercase tracking-widest font-bold hover:text-red-300 mt-1">Remove</button>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                )}
            </div>

            <div className="flex flex-col gap-3 mt-6 pt-6 border-t border-theme-border/50">
                {admin && (
                <div className="flex justify-between items-center text-sm opacity-80">
                    <span>Water Available</span>
                    <span className="font-mono bg-theme-background border border-theme-border px-3 py-1 rounded-lg text-xs">{waterAfterCart.toLocaleString()}ML</span>
                </div>
                )}
                {admin && (
                <div className="flex justify-between items-center text-sm opacity-80">
                    <span>Order Water</span>
                    <span className={`font-mono text-xs ${currentCartWater > remainingWater ? 'text-red-400 font-bold' : ''}`}>{currentCartWater.toLocaleString()}ML</span>
                </div>
                )}
                {/* Water bar */}
                {admin && (
                <div className="h-1.5 w-full bg-theme-border/30 rounded-full overflow-hidden">
                  <motion.div 
                    animate={{ width: `${machineCapacity > 0 ? ((currentCartWater / machineCapacity) * 100) : 0}%` }}
                    className="h-full rounded-full bg-sky-500"
                  />
                </div>
                )}
                <div className="flex justify-between items-end mt-4">
                    <span className="font-bold text-lg">Total</span>
                    <span className="font-black text-3xl tracking-tighter">${getCartTotal().toFixed(2)}</span>
                </div>
            </div>

            <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleCheckout}
                disabled={cart.length === 0 || currentCartWater > remainingWater || processing}
                className="w-full mt-6 py-4 rounded-2xl bg-theme-text text-theme-background font-black tracking-widest uppercase hover:shadow-xl transition-all shadow-lg disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
            >
                {processing ? <CgSpinner className="animate-spin text-xl" /> : <><FiZap /> Checkout</>} 
            </motion.button>
        </motion.div>
        </>
      )}
      </div>
    </div>
  );
}
