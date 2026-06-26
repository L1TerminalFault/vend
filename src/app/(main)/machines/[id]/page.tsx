"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
	useStoreStore,
	getMachineInventory,
	getRemainingWater,
	getProductUnitsLeft,
} from "@/lib/store";
import { motion } from "framer-motion";
import { FiBox, FiDroplet, FiPlus, FiX, FiArrowLeft, FiAlertTriangle, FiMapPin, FiExternalLink } from "react-icons/fi";
import { CgSpinner } from "react-icons/cg";
import { isAdmin, parseApiArray, getGoogleMapsUrl } from "@/lib/utils";
import ProductIcon, { getProductIconBg } from "@/components/ProductIcon";
import type { MachineType, ProductType } from "@/lib/types";

export default function MachineDetailPage() {
	const { id } = useParams<{ id: string }>();
	const router = useRouter();
	const { machines, products, transactions, refills, effectiveUser, setMachines, setProducts, setRefills } =
		useStoreStore();

	const [loading, setLoading] = useState(true);
	const [showAddProduct, setShowAddProduct] = useState(false);
	const [editLocationName, setEditLocationName] = useState("");
	const [editLocationDetail, setEditLocationDetail] = useState("");
	const [editProductCapacity, setEditProductCapacity] = useState(5000);
	const [editWaterCapacity, setEditWaterCapacity] = useState(10000);

	const [newProductName, setNewProductName] = useState("");
	const [newProductCategory, setNewProductCategory] = useState("Coffee");
	const [newProductPrice, setNewProductPrice] = useState(2.5);
	const [newProductMl, setNewProductMl] = useState(15);
	const [newWaterReq, setNewWaterReq] = useState(200);

	const machine = machines.find((m) => m._id === id);

	useEffect(() => {
		if (machines.length > 0 || effectiveUser) setLoading(false);
	}, [machines, effectiveUser]);

	useEffect(() => {
		if (machine) {
			setEditLocationName(machine.locationName);
			setEditLocationDetail(machine.locationDetail);
			setEditProductCapacity(machine.totalPowderCapacityPerProduct ?? 5000);
			setEditWaterCapacity(machine.totalWaterCapacity ?? 10000);
		}
	}, [machine]);

	const refreshMachines = async () => {
		const all = await parseApiArray<MachineType>(await fetch("/api/machines"));
		setMachines(all);
		return all;
	};

	const refreshProducts = async () => {
		const all = await parseApiArray<ProductType>(await fetch("/api/products"));
		setProducts(all);
		return all;
	};

	const handleSaveMachine = async () => {
		if (!machine) return;
		await fetch("/api/machines", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				_id: machine._id,
				locationName: editLocationName.trim(),
				locationDetail: editLocationDetail.trim(),
				productIds: machine.productIds || [],
				totalPowderCapacityPerProduct: editProductCapacity,
				totalWaterCapacity: editWaterCapacity,
			}),
		});
		await refreshMachines();
	};

	const toggleMachineProduct = async (productId: string) => {
		if (!machine) return;
		const current = machine.productIds || [];
		const next = current.includes(productId)
			? current.filter((pid) => pid !== productId)
			: [...current, productId];

		await fetch("/api/machines", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				_id: machine._id,
				locationName: machine.locationName,
				locationDetail: machine.locationDetail,
				productIds: next,
				totalPowderCapacityPerProduct: machine.totalPowderCapacityPerProduct,
				totalWaterCapacity: machine.totalWaterCapacity,
			}),
		});
		await refreshMachines();
	};

	const handleRefill = async () => {
		if (!machine) return;
		const res = await fetch("/api/refill", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ machineId: machine._id }),
		});
		const created = await res.json();
		const { refills: currentRefills } = useStoreStore.getState();
		setRefills([...currentRefills, created]);
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

	if (!isAdmin(effectiveUser?.userId)) {
		return (
			<div className="w-full h-full flex flex-col items-center justify-center p-6 text-theme-text opacity-70">
				<FiAlertTriangle className="text-4xl mb-4 text-red-500" />
				<p className="font-bold text-xl">Restricted Access</p>
			</div>
		);
	}

	if (loading) {
		return (
			<div className="w-full h-full flex flex-col items-center justify-center text-theme-text opacity-70">
				<CgSpinner className="animate-spin text-4xl mb-4 text-theme-accent" />
				<p className="animate-pulse">Loading...</p>
			</div>
		);
	}

	if (!machine) {
		return (
			<div className="w-full h-full flex flex-col items-center justify-center gap-4 p-6">
				<p className="font-bold text-xl">Machine not found</p>
				<Link href="/machines" className="text-theme-accent hover:underline">
					← Back to Machines
				</Link>
			</div>
		);
	}

	const inventory = getMachineInventory(machine, machine._id, transactions, refills, products);
	const waterRemaining = getRemainingWater(machine._id, machines, transactions, refills, products);
	const waterPct = inventory.waterCapacity > 0 ? (waterRemaining / inventory.waterCapacity) * 100 : 0;
	const mapsUrl = getGoogleMapsUrl(machine.locationDetail);

	return (
		<div className="w-full h-full flex flex-col gap-6 p-6 px-4 md:px-8 overflow-y-auto mb-[100px] scrollbar-hidden max-w-3xl mx-auto">
			<div className="flex items-center justify-between gap-4 flex-wrap">
				<div className="flex items-center gap-4">
					<button
						onClick={() => router.push("/machines")}
						className="p-2 bg-theme-card rounded-full text-theme-text/60 hover:text-theme-text border border-theme-border/30"
					>
						<FiArrowLeft />
					</button>
					<div className="flex flex-col gap-1">
						<h2 className="text-2xl font-extrabold tracking-tight">{machine.locationName}</h2>
						<p className="text-theme-text/50 text-sm font-mono">{machine.locationDetail || "No coordinates"}</p>
					</div>
				</div>
				{mapsUrl && (
					<a
						href={mapsUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center gap-2 px-4 py-2.5 bg-theme-accent/20 text-theme-accent rounded-full font-medium hover:bg-theme-accent hover:text-white transition-all text-sm"
					>
						<FiMapPin /> Google Maps <FiExternalLink className="text-xs" />
					</a>
				)}
			</div>

			{/* Water status */}
			<div className="bg-theme-card rounded-2xl p-5 border border-theme-border/30">
				<div className="flex items-center justify-between mb-3">
					<span className="font-bold flex items-center gap-2 text-sky-400">
						<FiDroplet /> Water
					</span>
					<span className="text-sm font-bold">{waterRemaining.toLocaleString()}ml · {waterPct.toFixed(0)}%</span>
				</div>
				<div className="h-2 bg-theme-border/30 rounded-full overflow-hidden">
					<motion.div
						initial={{ width: 0 }}
						animate={{ width: `${waterPct}%` }}
						className={`h-full rounded-full ${waterPct < 20 ? "bg-red-500" : waterPct < 50 ? "bg-orange-400" : "bg-sky-500"}`}
					/>
				</div>
				<p className="text-xs text-theme-text/40 mt-2">
					{machine.totalPowderCapacityPerProduct?.toLocaleString() ?? 0}ml powder capacity per assigned product
				</p>
			</div>

			{/* Edit details */}
			<div className="flex flex-col gap-4 bg-theme-card rounded-2xl p-5 border border-theme-border/30">
				<h3 className="font-bold">Machine Details</h3>
				<div className="flex flex-col gap-2">
					<label className="text-sm font-semibold text-theme-text/70 uppercase">Location Name</label>
					<input
						type="text"
						value={editLocationName}
						onChange={(e) => setEditLocationName(e.target.value)}
						className="p-3 rounded-xl bg-theme-background outline-none text-theme-text border border-theme-border/30 focus:border-theme-accent"
					/>
				</div>
				<div className="flex flex-col gap-2">
					<label className="text-sm font-semibold text-theme-text/70 uppercase">Coordinates (lat, lng)</label>
					<input
						type="text"
						value={editLocationDetail}
						onChange={(e) => setEditLocationDetail(e.target.value)}
						placeholder="e.g. 40.7128, -74.0060"
						className="p-3 rounded-xl bg-theme-background outline-none text-theme-text border border-theme-border/30 focus:border-theme-accent font-mono text-sm"
					/>
				</div>
				<div className="grid grid-cols-2 gap-4">
					<div className="flex flex-col gap-2">
						<label className="text-sm font-semibold text-theme-text/70 uppercase">Max Powder per Product (ml)</label>
						<input
							type="number"
							min="1"
							value={editProductCapacity}
							onChange={(e) => setEditProductCapacity(parseInt(e.target.value) || 0)}
							className="p-3 rounded-xl bg-theme-background outline-none text-theme-text border border-theme-border/30"
						/>
					</div>
					<div className="flex flex-col gap-2">
						<label className="text-sm font-semibold text-theme-text/70 uppercase">Max Water (ml)</label>
						<input
							type="number"
							min="1"
							value={editWaterCapacity}
							onChange={(e) => setEditWaterCapacity(parseInt(e.target.value) || 0)}
							className="p-3 rounded-xl bg-theme-background outline-none text-theme-text border border-theme-border/30"
						/>
					</div>
				</div>
				<button
					onClick={handleSaveMachine}
					className="w-full py-3 bg-theme-accent text-white rounded-xl font-bold hover:opacity-90 transition-all"
				>
					Save Changes
				</button>
			</div>

			{/* Assigned products */}
			<div className="flex flex-col gap-3">
				<div className="flex items-center justify-between">
					<h3 className="font-bold flex items-center gap-2">
						<FiBox className="text-theme-accent" /> Assigned Products
					</h3>
					<button
						onClick={() => setShowAddProduct(true)}
						className="flex items-center gap-1.5 px-3 py-1.5 bg-theme-accent/20 text-theme-accent rounded-full text-xs font-medium hover:bg-theme-accent hover:text-white transition-all"
					>
						<FiPlus /> Add Product
					</button>
				</div>
				{products.length === 0 ? (
					<p className="text-theme-text/40 text-sm">No products in catalogue yet.</p>
				) : (
					products.map((p) => {
						const assigned = (machine.productIds || []).includes(p._id);
						const unitsLeft = assigned
							? getProductUnitsLeft(machine, p, inventory, products, machine._id, transactions, refills)
							: 0;
						const powderState = inventory.productPowder.find((pp) => pp.productId === p._id);
						return (
							<button
								key={p._id}
								onClick={() => toggleMachineProduct(p._id)}
								className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
									assigned
										? "bg-theme-accent/10 border-theme-accent/40"
										: "bg-theme-card border-theme-border/30 hover:border-theme-border/60"
								}`}
							>
								<div
									className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${getProductIconBg(p.name)}`}
								>
									<ProductIcon name={p.name} className="text-sm" />
								</div>
								<div className="flex flex-col flex-1 min-w-0">
									<span className="font-bold text-sm truncate">{p.name}</span>
									<span className="text-xs text-theme-text/50">
										{p.unitProductMl}ml powder · {p.unitWaterReq}ml water · ${p.price.toFixed(2)}
									</span>
									{assigned && (
										<span
											className={`text-[10px] font-bold mt-1 ${unitsLeft <= 0 ? "text-red-400" : "text-emerald-400"}`}
										>
											{unitsLeft <= 0 ? "Out of stock" : `${unitsLeft} servings · ${powderState?.remaining ?? 0}ml powder`}
										</span>
									)}
								</div>
								<span
									className={`text-xs font-bold px-2 py-1 rounded-full shrink-0 ${
										assigned ? "bg-theme-accent text-white" : "bg-theme-border/30 text-theme-text/50"
									}`}
								>
									{assigned ? "Assigned" : "Add"}
								</span>
							</button>
						);
					})
				)}
			</div>

			{/* Refill */}
			<div className="flex flex-col gap-3 bg-[#3b82f6]/10 border border-[#3b82f6]/25 rounded-2xl p-5">
				<h3 className="font-bold flex items-center gap-2 text-[#3b82f6]">
					<FiDroplet /> Refill Machine
				</h3>
				<p className="text-theme-text/50 text-sm">
					Refill restores water and powder to maximum capacity for all assigned products.
				</p>
				<button
					onClick={handleRefill}
					className="w-full py-3 bg-[#3b82f6] text-white rounded-xl font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2"
				>
					<FiDroplet /> Record Full Refill
				</button>
			</div>

			{/* Add Product Modal */}
			{showAddProduct && (
				<div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
					<div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddProduct(false)} />
					<motion.div
						initial={{ opacity: 0, scale: 0.9 }}
						animate={{ opacity: 1, scale: 1 }}
						className="bg-theme-background relative z-10 w-full max-w-md rounded-3xl p-6 shadow-2xl flex flex-col gap-5"
					>
						<div className="flex justify-between items-center">
							<h3 className="text-2xl font-bold">Add Product</h3>
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
							className="w-full p-4 bg-theme-text text-theme-background rounded-xl font-black text-lg hover:opacity-90"
						>
							Add Product
						</button>
					</motion.div>
				</div>
			)}
		</div>
	);
}
