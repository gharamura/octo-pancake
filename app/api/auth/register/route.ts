import { userRepository } from "@/lib/repositories/user.repository";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { name, email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const exists = await userRepository.existsByEmail(email);
  if (exists) {
    return NextResponse.json({ error: "Email already in use." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await userRepository.create({ name, email, passwordHash });

  return NextResponse.json({ success: true }, { status: 201 });
}
