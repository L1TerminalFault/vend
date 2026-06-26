export interface MachineType {
  _id: string;
  locationName: string;
  locationDetail: string;
  productIds?: string[];
  totalPowderCapacityPerProduct?: number;
  totalWaterCapacity?: number;
  __ext?: string;
}

export interface ProductType {
  _id: string;
  name: string;
  price: number;
  category: string;
  unitProductMl: number;
  unitWaterReq: number;
  __ext?: string;
}

export interface AdminsType {
  _id: string;
  adminClerkIds: string[];
  __ext?: string;
}

export interface TransactionType {
  _id: string;
  clerkId: string;
  machineId: string;
  idIfNotSignedIn: string;
  transactionData: string;
  signedIn: boolean;
  createdAt: string;
  updatedAt: string;
  __ext?: string;
}

export interface RefillType {
  _id: string;
  machineId: string;
  createdAt: string;
  updatedAt: string;
  __ext?: string;
}
