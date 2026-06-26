import { NextResponse } from "next/server";
import { dbConnect, Transaction } from "@/db/model";

export async function GET(req: Request) {
  try {
    await dbConnect();
    const results = await Transaction.find().sort({ createdAt: -1 });
    return NextResponse.json(results);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await dbConnect();
    const data = await req.json();
    const transaction = await Transaction.create(data);
    return NextResponse.json(transaction);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    await dbConnect();
    const data = await req.json();
    const { _id, ...updateData } = data;
    const transaction = await Transaction.findByIdAndUpdate(_id, updateData, { new: true });
    return NextResponse.json(transaction);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
    await Transaction.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
