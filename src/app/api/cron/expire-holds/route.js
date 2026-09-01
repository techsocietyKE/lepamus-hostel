import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request) {
  // 1. Verify Authorization Header for cron security
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    // 2. Find all pending/hold bookings where expiresAt is past now
    const expiredBookings = await prisma.booking.findMany({
      where: {
        status: { in: ["PENDING", "HOLD"] },
        expiresAt: { lt: now },
      },
      select: {
        id: true,
        bedId: true,
      },
    });

    if (expiredBookings.length === 0) {
      return NextResponse.json({
        message: "No expired holds found",
        sweptCount: 0,
      });
    }

    const bookingIds = expiredBookings.map((b) => b.id);
    const bedIds = expiredBookings.map((b) => b.bedId).filter(Boolean);

    // 3. Atomically cancel bookings and free the beds
    const result = await prisma.$transaction(async (tx) => {
      // Mark bookings as EXPIRED
      const updatedBookings = await tx.booking.updateMany({
        where: { id: { in: bookingIds } },
        data: { status: "EXPIRED" },
      });

      // Reset bed occupancy status if applicable
      if (bedIds.length > 0) {
        await tx.bed.updateMany({
          where: { id: { in: bedIds } },
          data: { isAvailable: true },
        });
      }

      // Log the sweeping action in the audit trail
      await tx.auditLog.create({
        data: {
          action: "HOLD_SWEEPER_AUTO",
          details: `Swept ${updatedBookings.count} expired booking holds automatically.`,
        },
      });

      return updatedBookings.count;
    });

    return NextResponse.json({
      success: true,
      sweptCount: result,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("Failed to sweep expired holds:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}