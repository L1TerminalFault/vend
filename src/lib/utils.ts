import type { MachineType, ProductType } from "./types";

/** Clerk user IDs with admin access. Add your Clerk IDs here. */
export const ADMINS: string[] = ["user_3Fdp2UzlldWYj2FnkM1saWKapMM", "user_3Ffhxg6jqhx4DtSy6ivFKkeqOWJ"];

export function isAdmin(userId?: string | null): boolean {
  if (!userId || userId === "anon") return false;
  return ADMINS.includes(userId);
}

export async function parseApiArray<T>(res: Response): Promise<T[]> {
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export function getScopedMachines(machines: MachineType[], selectedMachine: string): MachineType[] {
  return selectedMachine === "all" ? machines : machines.filter((m) => m._id === selectedMachine);
}

export function getScopedProducts(
  machines: MachineType[],
  products: ProductType[],
  selectedMachine: string,
): ProductType[] {
  if (selectedMachine === "all") {
    const ids = new Set(machines.flatMap((m) => m.productIds || []));
    return products.filter((p) => ids.has(p._id));
  }
  const machine = machines.find((m) => m._id === selectedMachine);
  if (!machine?.productIds?.length) return [];
  return products.filter((p) => machine.productIds!.includes(p._id));
}

export function parseCoords(locationDetail: string): { lat: number; lng: number } | null {
  const parts = locationDetail.split(",").map((s) => s.trim());
  if (parts.length !== 2) return null;
  const lat = parseFloat(parts[0]);
  const lng = parseFloat(parts[1]);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
}

export function getGoogleMapsUrl(locationDetail: string): string | null {
  const coords = parseCoords(locationDetail);
  if (!coords) return null;
  return `https://www.google.com/maps?q=${coords.lat},${coords.lng}`;
}
