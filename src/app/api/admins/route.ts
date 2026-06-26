import { NextResponse } from "next/server";
import { dbConnect, Admins } from "@/db/model";

export async function GET(req: Request) {
  try {
    await dbConnect();
    const adminsList = await Admins.find();
    return NextResponse.json(adminsList);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await dbConnect();
    const data = await req.json();
    const admin = await Admins.create(data);
    return NextResponse.json(admin);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    await dbConnect();
    const data = await req.json();
    const { _id, ...updateData } = data;
    const admin = await Admins.findByIdAndUpdate(_id, updateData, { new: true });
    return NextResponse.json(admin);
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
    await Admins.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
