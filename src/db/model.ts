import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI || "";

let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

export async function dbConnect() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }
  return cached.conn;
}

// INFO: Schemas
const adminsSchema = new mongoose.Schema({
	adminClerkIds: [String],
	__ext: String,
});

const productSchema = new mongoose.Schema({
	name: String,
	price: Number,
	category: String,
	// INFO: the amount in milliliters of a unit product (this should be used in transactions and to calculate remainings)
	unitProductMl: Number,
	// INFO: the amount of water a unit product requires (also should be used in transactions and to calculate remainings)
	unitWaterReq: Number,
	__ext: String,
});

const transactionSchema = new mongoose.Schema({
	clerkId: String,
	machineId: String,
	idIfNotSignedIn: String,
	transactionData: String,
	signedIn: Boolean,
	__ext: String,	
}, { timestamps: true });

const refillSchema = new mongoose.Schema({
	machineId: String,
	__ext: String,
}, { timestamps: true });

const machineSchema = new mongoose.Schema({
	locationName: String,
	locationDetail: String,
	productIds: [String],
	// INFO: maximum product (powder) in milliliters for each assigned product
	totalPowderCapacityPerProduct: Number,
	// INFO: maximum water in milliliters
	totalWaterCapacity: Number,
	__ext: String,
});

// const customerSchema = new mongoose.Schema({
// });

// INFO: Interfaces
export const Machine = 
  mongoose.models.Machine || 
  mongoose.model("Machine", machineSchema);

export const Product = 
  mongoose.models.Product || 
  mongoose.model("Product", productSchema);

export const Admins = 
  mongoose.models.Admins || 
  mongoose.model("Admins", adminsSchema);

export const Transaction = 
  mongoose.models.Transaction || 
  mongoose.model("Transaction", transactionSchema);

export const Refill =
  mongoose.models.Refill ||
  mongoose.model("Refill", refillSchema);

// export const Customer = 
//   mongoose.models.Customer || 
//   mongoose.model("Customer", customerSchema);
