import { NextResponse } from "next/server";
import { dbConnect, Refill } from "@/db/model";

export async function GET(req: Request) {
  try {
    await dbConnect();
    const results = await Refill.find().sort({ createdAt: -1 });
    return NextResponse.json(results);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await dbConnect();
    const data = await req.json();
    const refill = await Refill.create(data);
    return NextResponse.json(refill);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    await dbConnect();
    const data = await req.json();
    const { _id, ...updateData } = data;
    const refill = await Refill.findByIdAndUpdate(_id, updateData, { new: true });
    return NextResponse.json(refill);
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
    await Refill.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
