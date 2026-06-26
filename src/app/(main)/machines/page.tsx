"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
	useStoreStore,
	getRemainingWater,
	getMachineInventory,
	getProductUnitsLeft,
	machineNeedsRefill,
} from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";
import gsap from "gsap";
import {
	FiCpu,
	FiPlus,
	FiTrash2,
	FiMapPin,
	FiX,
	FiAlertTriangle,
	FiEdit2,
	FiLayers,
} from "react-icons/fi";
import { CgSpinner } from "react-icons/cg";
import EmptyState from "@/components/EmptyState";
import ProductIcon, { getProductIconBg } from "@/components/ProductIcon";
import { isAdmin, parseApiArray } from "@/lib/utils";
import type { MachineType, ProductType } from "@/lib/types";

type Tab = "machines" | "catalogue";

export default function MachinesPage() {
	const router = useRouter();
	const { machines, products, transactions, refills, effectiveUser, setMachines, setProducts } =
		useStoreStore();

	const [loading, setLoading] = useState(true);
	const [activeTab, setActiveTab] = useState<Tab>("machines");
	const [showAddMachine, setShowAddMachine] = useState(false);
	const [showAddProduct, setShowAddProduct] = useState(false);
	const headerRef = useRef<HTMLDivElement>(null);

	const [newLocationName, setNewLocationName] = useState("");
	const [newLocationDetail, setNewLocationDetail] = useState("");
	const [newProductCapacity, setNewProductCapacity] = useState(5000);
	const [newWaterCapacity, setNewWaterCapacity] = useState(10000);

	const [newProductName, setNewProductName] = useState("");
	const [newProductCategory, setNewProductCategory] = useState("Coffee");
	const [newProductPrice, setNewProductPrice] = useState(2.5);
	const [newProductMl, setNewProductMl] = useState(15);
	const [newWaterReq, setNewWaterReq] = useState(200);

	useEffect(() => {
		if (machines.length > 0 || products.length > 0 || effectiveUser) setLoading(false);
	}, [machines, products, effectiveUser]);

	useEffect(() => {
		if (loading) return;
		if (headerRef.current) {
			gsap.fromTo(headerRef.current, { y: -20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" });
		}
	}, [loading]);

	const refreshMachines = async () => {
		const all = await parseApiArray<MachineType>(await fetch("/api/machines"));
		setMachines(all);
	};

	const refreshProducts = async () => {
		const all = await parseApiArray<ProductType>(await fetch("/api/products"));
		setProducts(all);
	};

	const handleAddMachine = async () => {
		if (!newLocationName.trim()) return;
		await fetch("/api/machines", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				locationName: newLocationName.trim(),
				locationDetail: newLocationDetail.trim(),
				productIds: [],
                totalPowderCapacityPerProduct: newProductCapacity,
				totalWaterCapacity: newWaterCapacity,
			}),
		});
		await refreshMachines();
		setNewLocationName("");
		setNewLocationDetail("");
		setShowAddMachine(false);
	};

	const handleDeleteMachine = async (id: string) => {
		await fetch(`/api/machines?id=${id}`, { method: "DELETE" });
		await refreshMachines();
	};

	const handleAddProduct = async () => {
		if (!newProductName.trim()) return;
		await fetch("/api/products", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: newProductName.trim(),
				category: newProductCategory,
				price: newProductPrice,
				unitProductMl: newProductMl,
				unitWaterReq: newWaterReq,
			}),
		});
		await refreshProducts();
		setNewProductName("");
		setNewProductCategory("Coffee");
		setNewProductPrice(2.5);
		setNewProductMl(15);
		setNewWaterReq(200);
		setShowAddProduct(false);
	};

	const handleDeleteProduct = async (id: string) => {
		await fetch(`/api/products?id=${id}`, { method: "DELETE" });
		await refreshProducts();
	};

	if (!isAdmin(effectiveUser?.userId)) {
		return (
			<div className="w-full h-full flex flex-col items-center justify-center p-6 text-theme-text opacity-70">
				<FiAlertTriangle className="text-4xl mb-4 text-red-500" />
				<p className="font-bold text-xl">Restricted Access</p>
				<p className="text-theme-text/50 text-sm mt-2">Only admins can manage machines and products.</p>
			</div>
		);
	}

	if (loading) {
		return (
			<div className="w-full h-full flex flex-col items-center justify-center text-theme-text opacity-70">
				<CgSpinner className="animate-spin text-4xl mb-4 text-theme-accent" />
				<p className="animate-pulse">Loading Machines...</p>
			</div>
		);
	}

	const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
		{ key: "machines", label: "Machines", icon: <FiCpu /> },
		{ key: "catalogue", label: "Catalogue", icon: <FiLayers /> },
	];

	return (
		<div className="w-full h-full flex flex-col gap-6 p-6 px-4 md:px-8 overflow-y-auto mb-[100px] scrollbar-hidden">
			<div ref={headerRef} className="flex flex-col gap-2 mb-2">
				<h2 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
					<FiCpu className="text-theme-text" /> Machine Management
				</h2>
				<p className="text-theme-text/50">
					{machines.length} machines · {products.length} products in catalogue
				</p>
			</div>

			<div className="flex gap-2 p-1 bg-theme-card border border-theme-border/50 rounded-full w-fit">
				{tabs.map((tab) => (
					<button
						key={tab.key}
						onClick={() => setActiveTab(tab.key)}
						className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-medium transition-all duration-300 ${
							activeTab === tab.key
								? "bg-theme-accent text-white shadow-lg"
								: "text-theme-text/60 hover:text-theme-text"
						}`}
					>
						{tab.icon}
						{tab.label}
					</button>
				))}
			</div>

			{activeTab === "machines" && (
				<div className="flex flex-col gap-3">
					<div className="flex items-center justify-between mb-2">
						<span className="text-theme-text/50 text-sm">{machines.length} registered machines</span>
						<button
							onClick={() => setShowAddMachine(true)}
							className="flex items-center gap-2 px-4 py-2 bg-theme-accent text-white rounded-full font-medium hover:bg-theme-accent/70 hover:text-white transition-all"
						>
							<FiPlus /> Add Machine
						</button>
					</div>

					{machines.length === 0 ? (
						<EmptyState
							title="No machines yet"
							message="Register your first vending machine to start tracking inventory and orders."
						/>
					) : (
						machines.map((m, idx) => {
							const inventory = getMachineInventory(m, m._id, transactions, refills, products);
							const waterRemaining = getRemainingWater(m._id, machines, transactions, refills, products);
							const waterPct = inventory.waterCapacity > 0 ? (waterRemaining / inventory.waterCapacity) * 100 : 0;
							const assignedCount = (m.productIds || []).length;
							const needsRefill = machineNeedsRefill(m, m._id, transactions, refills, products);
							const assignedProducts = products.filter((p) => m.productIds?.includes(p._id));

							return (
								<motion.div
									key={m._id}
									initial={{ opacity: 0, y: 12 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: idx * 0.04, duration: 0.3 }}
									onClick={() => router.push(`/machines/${m._id}`)}
									role="button"
									tabIndex={0}
									onKeyDown={(event) => {
										if (event.key === "Enter" || event.key === " ") {
											event.preventDefault();
											router.push(`/machines/${m._id}`);
										}
									}}
									className="flex flex-col gap-3 p-4 bg-theme-card border border-theme-border/30 rounded-2xl hover:bg-theme-card/80 hover:border-theme-accent/40 transition-all duration-300 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-accent/60"
								>
									<div className="flex items-center gap-4">
										<div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-theme-accent/20 text-theme-accent">
											<FiMapPin className="text-lg" />
										</div>
										<div className="flex flex-col flex-1 min-w-0">
											<span className="font-bold text-base truncate">{m.locationName}</span>
											<span className="text-xs text-theme-text/50 uppercase tracking-wide truncate">
												{m.locationDetail || "No detail"} · {assignedCount} products
												{needsRefill && (
													<span className="text-red-400 ml-2">· Needs refill</span>
												)}
											</span>
											{inventory.waterCapacity > 0 && (
												<div className="flex items-center gap-2 mt-2">
													<div className="flex-1 h-1.5 bg-theme-border/30 rounded-full overflow-hidden max-w-[140px]">
														<div
															className={`h-full rounded-full ${waterPct < 20 ? "bg-red-500" : waterPct < 50 ? "bg-orange-400" : "bg-sky-500"}`}
															style={{ width: `${waterPct}%` }}
														/>
													</div>
													<span className="text-[10px] text-theme-text/40 font-bold">
														{waterRemaining.toLocaleString()}ml water · {waterPct.toFixed(0)}%
													</span>
												</div>
											)}
										</div>
										<div className="flex items-center gap-2 shrink-0">
										{/* <button
												onClick={(event) => {
													event.stopPropagation();
													router.push(`/machines/${m._id}`);
												}}
												className="flex items-center gap-1.5 px-3 py-2 bg-theme-accent/10 text-theme-accent rounded-xl text-sm font-medium hover:bg-theme-accent/20 transition-all"
											>
												<FiEdit2 /> Manage
											</button> */}
											<button
												onClick={(event) => {
													event.stopPropagation();
													handleDeleteMachine(m._id);
												}}
												className="p-2.5 text-red-400 hover:bg-red-400/20 rounded-xl transition-all"
											>
												<FiTrash2 />
											</button>
										</div>
									</div>
									{assignedProducts.length > 0 && (
										<div className="flex flex-wrap gap-2 pl-14">
											{assignedProducts.map((p) => {
												const units = getProductUnitsLeft(m, p, inventory, products, m._id, transactions, refills);
												return (
													<div
														key={p._id}
														className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
															units <= 0
																? "border-red-400/40 bg-red-500/10 text-red-400"
																: "border-theme-border/30 bg-theme-background/50 text-theme-text/60"
														}`}
													>
														<ProductIcon name={p.name} className="text-xs" />
														{p.name}: {units <= 0 ? "0" : units}
													</div>
												);
											})}
										</div>
									)}
								</motion.div>
							);
						})
					)}
				</div>
			)}

			{activeTab === "catalogue" && (
				<div className="flex flex-col gap-3">
					<div className="flex items-center justify-between mb-2">
						<span className="text-theme-text/50 text-sm">{products.length} products in catalogue</span>
						<button
							onClick={() => setShowAddProduct(true)}
							className="flex items-center gap-2 px-4 py-2 bg-theme-accent text-white rounded-full font-medium hover:bg-theme-accent/70 hover:text-white transition-all"
						>
							<FiPlus /> Add Product
						</button>
					</div>

					{products.length === 0 ? (
						<EmptyState
							title="No products yet"
							message="Add products to the catalogue, then assign them to machines."
						/>
					) : (
						products.map((p, idx) => (
							<motion.div
								key={p._id}
								initial={{ opacity: 0, y: 12 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: idx * 0.04, duration: 0.3 }}
								className="flex items-center gap-4 p-4 bg-theme-card border border-theme-border/30 rounded-2xl hover:bg-theme-card/80 transition-all duration-300"
							>
								<div
									className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${getProductIconBg(p.name)}`}
								>
									<ProductIcon name={p.name} className="text-lg" />
								</div>
								<div className="flex flex-col flex-1 min-w-0">
									<span className="font-bold text-base truncate">{p.name}</span>
									<span className="text-xs text-theme-text/50 uppercase tracking-wide">
										{p.category} · {p.unitProductMl}ml powder · {p.unitWaterReq}ml water
									</span>
								</div>
								<div className="flex flex-col items-end shrink-0">
									<span className="text-lg font-extrabold text-emerald-400">${p.price.toFixed(2)}</span>
									<span className="text-[10px] text-theme-text/40 uppercase">per unit</span>
								</div>
								<button
									onClick={() => handleDeleteProduct(p._id)}
									className="p-2.5 text-red-400 hover:bg-red-400/20 rounded-xl transition-all shrink-0"
								>
									<FiTrash2 />
								</button>
							</motion.div>
						))
					)}
				</div>
			)}

			{/* Add Machine Modal */}
			<AnimatePresence>
				{showAddMachine && (
					<div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							className="absolute inset-0 bg-black/60 backdrop-blur-sm"
							onClick={() => setShowAddMachine(false)}
						/>
						<motion.div
							initial={{ opacity: 0, scale: 0.9, y: 20 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.9, y: 20 }}
							className="bg-theme-background relative z-10 w-full max-w-md rounded-3xl p-6 shadow-2xl flex flex-col gap-5"
						>
							<div className="flex justify-between items-center">
								<h3 className="text-2xl font-bold tracking-tight">Add Machine</h3>
								<button onClick={() => setShowAddMachine(false)} className="p-2 bg-theme-card rounded-full">
									<FiX />
								</button>
							</div>
							<div className="flex flex-col gap-2">
								<label className="text-sm font-semibold text-theme-text/70 uppercase">Location Name</label>
								<input
									type="text"
									value={newLocationName}
									onChange={(e) => setNewLocationName(e.target.value)}
									placeholder="e.g. Building A Lobby"
									className="p-3 rounded-xl bg-theme-card outline-none text-theme-text border border-theme-border/30 focus:border-theme-accent"
								/>
							</div>
							<div className="flex flex-col gap-2">
								<label className="text-sm font-semibold text-theme-text/70 uppercase">Coordinates (lat, lng)</label>
								<input
									type="text"
									value={newLocationDetail}
									onChange={(e) => setNewLocationDetail(e.target.value)}
									placeholder="e.g. 40.7128, -74.0060"
									className="p-3 rounded-xl bg-theme-card outline-none text-theme-text border border-theme-border/30 focus:border-theme-accent font-mono text-sm"
								/>
							</div>
							<div className="grid grid-cols-2 gap-4">
								<div className="flex flex-col gap-2">
									<label className="text-sm font-semibold text-theme-text/70 uppercase">Max Powder per Product (ml)</label>
									<input
										type="number"
										min="1"
										value={newProductCapacity}
										onChange={(e) => setNewProductCapacity(parseInt(e.target.value) || 0)}
										className="p-3 rounded-xl bg-theme-card outline-none text-theme-text border border-theme-border/30"
									/>
								</div>
								<div className="flex flex-col gap-2">
									<label className="text-sm font-semibold text-theme-text/70 uppercase">Max Water (ml)</label>
									<input
										type="number"
										min="1"
										value={newWaterCapacity}
										onChange={(e) => setNewWaterCapacity(parseInt(e.target.value) || 0)}
										className="p-3 rounded-xl bg-theme-card outline-none text-theme-text border border-theme-border/30"
									/>
								</div>
							</div>
							<button
								onClick={handleAddMachine}
								className="w-full p-4 bg-theme-text text-theme-background rounded-xl font-black text-lg hover:opacity-90 transition-opacity"
							>
								Add Machine
							</button>
						</motion.div>
					</div>
				)}
			</AnimatePresence>

			{/* Add Product Modal */}
			<AnimatePresence>
				{showAddProduct && (
					<div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							className="absolute inset-0 bg-black/60 backdrop-blur-sm"
							onClick={() => setShowAddProduct(false)}
						/>
						<motion.div
							initial={{ opacity: 0, scale: 0.9, y: 20 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.9, y: 20 }}
							className="bg-theme-background relative z-10 w-full max-w-md rounded-3xl p-6 shadow-2xl flex flex-col gap-5"
						>
							<div className="flex justify-between items-center">
								<h3 className="text-2xl font-bold tracking-tight">Add Product</h3>
								<button onClick={() => setShowAddProduct(false)} className="p-2 bg-theme-card rounded-full">
									<FiX />
								</button>
							</div>
							<div className="flex flex-col gap-2">
								<label className="text-sm font-semibold text-theme-text/70 uppercase">Name</label>
								<input
									type="text"
									value={newProductName}
									onChange={(e) => setNewProductName(e.target.value)}
									placeholder="e.g. Cappuccino"
									className="p-3 rounded-xl bg-theme-card outline-none text-theme-text border border-theme-border/30"
								/>
							</div>
							<div className="flex flex-col gap-2">
								<label className="text-sm font-semibold text-theme-text/70 uppercase">Category</label>
								<select
									value={newProductCategory}
									onChange={(e) => setNewProductCategory(e.target.value)}
									className="p-3 rounded-xl bg-theme-card outline-none text-theme-text border border-theme-border/30"
								>
									<option value="Coffee">Coffee</option>
									<option value="Cappuccino">Cappuccino</option>
									<option value="Macchiato">Macchiato</option>
									<option value="Other">Other</option>
								</select>
							</div>
							<div className="grid grid-cols-2 gap-4">
								<div className="flex flex-col gap-2">
									<label className="text-sm font-semibold text-theme-text/70 uppercase">Price ($)</label>
									<input
										type="number"
										min="0"
										step="0.01"
										value={newProductPrice}
										onChange={(e) => setNewProductPrice(parseFloat(e.target.value) || 0)}
										className="p-3 rounded-xl bg-theme-card outline-none text-theme-text border border-theme-border/30"
									/>
								</div>
								<div className="flex flex-col gap-2">
									<label className="text-sm font-semibold text-theme-text/70 uppercase">Powder (ml)</label>
									<input
										type="number"
										min="1"
										value={newProductMl}
										onChange={(e) => setNewProductMl(parseInt(e.target.value) || 0)}
										className="p-3 rounded-xl bg-theme-card outline-none text-theme-text border border-theme-border/30"
									/>
								</div>
							</div>
							<div className="flex flex-col gap-2">
								<label className="text-sm font-semibold text-theme-text/70 uppercase">Water per serving (ml)</label>
								<input
									type="number"
									min="1"
									value={newWaterReq}
									onChange={(e) => setNewWaterReq(parseInt(e.target.value) || 0)}
									className="p-3 rounded-xl bg-theme-card outline-none text-theme-text border border-theme-border/30"
								/>
							</div>
							<button
								onClick={handleAddProduct}
								className="w-full p-4 bg-theme-text text-theme-background rounded-xl font-black text-lg hover:opacity-90 transition-opacity"
							>
								Add Product
							</button>
						</motion.div>
					</div>
				)}
			</AnimatePresence>
		</div>
	);
}
