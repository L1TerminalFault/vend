import { create } from "zustand";
import type { MachineType, ProductType, TransactionType, RefillType, AdminsType } from "./types";

export type EffectiveUser = {
  userId: string;
  role: "Admin" | "User";
};

export type ProductPowderState = {
  productId: string;
  remaining: number;
  capacity: number;
};

export type MachineInventory = {
  remainingWater: number;
  waterCapacity: number;
  productPowder: ProductPowderState[];
};

type StoreState = {
  effectiveUser: EffectiveUser;
  setEffectiveUser: (user: EffectiveUser) => void;
  machines: MachineType[];
  setMachines: (machines: MachineType[]) => void;
  products: ProductType[];
  setProducts: (products: ProductType[]) => void;
  transactions: TransactionType[];
  setTransactions: (t: TransactionType[]) => void;
  refills: RefillType[];
  setRefills: (r: RefillType[]) => void;
  admins: AdminsType[];
  setAdmins: (a: AdminsType[]) => void;
};

export const useStoreStore = create<StoreState>((set) => ({
  effectiveUser: { userId: "anon", role: "User" },
  setEffectiveUser: (user) => set({ effectiveUser: user }),
  machines: [],
  setMachines: (machines) => set({ machines }),
  products: [],
  setProducts: (products) => set({ products }),
  transactions: [],
  setTransactions: (transactions) => set({ transactions }),
  refills: [],
  setRefills: (refills) => set({ refills }),
  admins: [],
  setAdmins: (admins) => set({ admins }),
}));

function transactionsSinceLastRefill(
  machineId: string,
  transactions: TransactionType[],
  refills: RefillType[],
): TransactionType[] {
  const machineRefills = refills
    .filter((r) => r.machineId === machineId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const lastRefill = machineRefills[0];
  if (!lastRefill) return [];

  const lastRefillTime = new Date(lastRefill.createdAt).getTime();
  return transactions.filter(
    (t) => t.machineId === machineId && new Date(t.createdAt).getTime() >= lastRefillTime,
  );
}

function hasRefillSince(machineId: string, refills: RefillType[]): boolean {
  return refills.some((r) => r.machineId === machineId);
}

export function getConsumedPowderForProduct(
  machineId: string,
  productId: string,
  transactions: TransactionType[],
  refills: RefillType[],
  products: ProductType[],
): number {
  let consumed = 0;
  transactionsSinceLastRefill(machineId, transactions, refills).forEach((t) => {
    try {
      const data = JSON.parse(t.transactionData);
      if (Array.isArray(data)) {
        data.forEach((item: { productId: string; quantity?: number }) => {
          if (item.productId !== productId) return;
          const prod = products.find((p) => p._id === productId);
          if (prod) consumed += prod.unitProductMl * (item.quantity || 1);
        });
      }
    } catch {
      /* ignore */
    }
  });
  return consumed;
}

export function getRemainingPowderForProduct(
  machine: MachineType | undefined,
  productId: string,
  machineId: string,
  transactions: TransactionType[],
  refills: RefillType[],
  products: ProductType[],
): number {
  const capacity = machine?.totalPowderCapacityPerProduct ?? 0;
  if (!hasRefillSince(machineId, refills)) return 0;
  const consumed = getConsumedPowderForProduct(machineId, productId, transactions, refills, products);
  return Math.max(0, capacity - consumed);
}

export function getMachineInventory(
  machine: MachineType | undefined,
  machineId: string,
  transactions: TransactionType[],
  refills: RefillType[],
  products: ProductType[],
): MachineInventory {
  const waterCapacity = machine?.totalWaterCapacity ?? 0;
  const powderCapacityPerProduct = machine?.totalPowderCapacityPerProduct ?? 0;
  const refilled = hasRefillSince(machineId, refills);

  if (!refilled) {
    return {
      remainingWater: 0,
      waterCapacity,
      productPowder: (machine?.productIds || []).map((productId) => ({
        productId,
        remaining: 0,
        capacity: powderCapacityPerProduct,
      })),
    };
  }

  let consumedWater = 0;
  transactionsSinceLastRefill(machineId, transactions, refills).forEach((t) => {
    try {
      const data = JSON.parse(t.transactionData);
      if (Array.isArray(data)) {
        data.forEach((item: { productId: string; quantity?: number }) => {
          const prod = products.find((p) => p._id === item.productId);
          if (prod) consumedWater += prod.unitWaterReq * (item.quantity || 1);
        });
      }
    } catch {
      /* ignore */
    }
  });

  const productPowder = (machine?.productIds || []).map((productId) => {
    const remaining = getRemainingPowderForProduct(
      machine,
      productId,
      machineId,
      transactions,
      refills,
      products,
    );
    return { productId, remaining, capacity: powderCapacityPerProduct };
  });

  return {
    remainingWater: Math.max(0, waterCapacity - consumedWater),
    waterCapacity,
    productPowder,
  };
}

export function getRemainingWater(
  machineId: string,
  machines: MachineType[],
  transactions: TransactionType[],
  refills: RefillType[],
  products: ProductType[],
): number {
  const machine = machines.find((m) => m._id === machineId);
  return getMachineInventory(machine, machineId, transactions, refills, products).remainingWater;
}

export function getRemainingVolume(
  machineId: string,
  transactions: TransactionType[],
  refills: RefillType[],
  products: ProductType[],
  machines?: MachineType[],
): number {
  const machine = machines?.find((m) => m._id === machineId);
  return getMachineInventory(machine, machineId, transactions, refills, products).remainingWater;
}

export function getProductUnitsLeft(
  machine: MachineType | undefined,
  product: ProductType,
  inventory: MachineInventory,
  products: ProductType[],
  machineId: string,
  transactions: TransactionType[],
  refills: RefillType[],
  extraCart: { productId: string; quantity: number }[] = [],
): number {
  if (!machine?.productIds?.includes(product._id)) return 0;
  if (!product.unitProductMl || !product.unitWaterReq) return 0;

  let water = inventory.remainingWater;
  extraCart.forEach((item) => {
    const p = products.find((x) => x._id === item.productId);
    if (p) water -= p.unitWaterReq * item.quantity;
  });

  let powder = getRemainingPowderForProduct(
    machine,
    product._id,
    machineId,
    transactions,
    refills,
    products,
  );
  extraCart.forEach((item) => {
    if (item.productId === product._id) {
      powder -= product.unitProductMl * item.quantity;
    }
  });

  const byPowder = Math.floor(powder / product.unitProductMl);
  const byWater = Math.floor(water / product.unitWaterReq);
  return Math.max(0, Math.min(byPowder, byWater));
}

/** Servings left from this product's powder pool only (ignores shared water). */
export function getProductPowderUnitsLeft(
  machine: MachineType | undefined,
  product: ProductType,
  machineId: string,
  transactions: TransactionType[],
  refills: RefillType[],
  products: ProductType[],
  extraCart: { productId: string; quantity: number }[] = [],
): number {
  if (!machine?.productIds?.includes(product._id)) return 0;
  if (!product.unitProductMl) return 0;

  let powder = getRemainingPowderForProduct(
    machine,
    product._id,
    machineId,
    transactions,
    refills,
    products,
  );
  extraCart.forEach((item) => {
    if (item.productId === product._id) {
      powder -= product.unitProductMl * item.quantity;
    }
  });

  return Math.max(0, Math.floor(powder / product.unitProductMl));
}

export function machineNeedsRefill(
  machine: MachineType,
  machineId: string,
  transactions: TransactionType[],
  refills: RefillType[],
  products: ProductType[],
): boolean {
  if (!hasRefillSince(machineId, refills)) return true;

  const inv = getMachineInventory(machine, machineId, transactions, refills, products);
  if (inv.waterCapacity > 0 && inv.remainingWater <= 0) return true;
  if (inv.waterCapacity > 0 && inv.remainingWater / inv.waterCapacity < 0.2) return true;

  const assigned = products.filter((p) => machine.productIds?.includes(p._id));
  return assigned.some(
    (p) =>
      getProductUnitsLeft(machine, p, inv, products, machineId, transactions, refills) <= 0 ||
      getRemainingPowderForProduct(machine, p._id, machineId, transactions, refills, products) <= 0,
  );
}

export function getAssignedProducts(machine: MachineType | undefined, products: ProductType[]): ProductType[] {
  if (!machine?.productIds?.length) return [];
  return products.filter((p) => machine.productIds!.includes(p._id));
}
