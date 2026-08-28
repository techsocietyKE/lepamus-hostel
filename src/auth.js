import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { authConfig } from '@/auth.config';
import { normalisePhone } from '@/lib/validation';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { identifier: {}, password: {} },
      async authorize(raw) {
        const identifier = String(raw?.identifier ?? '').trim();
        const password = String(raw?.password ?? '');
        if (!identifier || !password) return null;

        // One field accepts either. Work out which was typed.
        const asPhone = normalisePhone(identifier);
        const match = [
          asPhone ? { phone: asPhone } : undefined,
          identifier.includes('@') ? { email: identifier.toLowerCase() } : undefined,
        ].filter(Boolean);
        if (match.length === 0) return null;

        const user = await prisma.user.findFirst({
          where: { isActive: true, OR: match },
        });
        if (user) {
          const ok = await bcrypt.compare(password, user.passwordHash);
          if (!ok) return null;
          return { id: user.id, name: user.name, role: user.role, email: user.email ?? undefined };
        }

        /**
         * Students live in their own table and sign in through the same box.
         * A vacated or blacklisted student keeps their record but loses access
         * — the history stays, the door closes.
         */
        const student = await prisma.student.findFirst({
          where: { status: { in: ['ACTIVE', 'NOTICE_GIVEN'] }, OR: match },
        });
        if (!student?.passwordHash) return null;

        const studentOk = await bcrypt.compare(password, student.passwordHash);
        if (!studentOk) return null;

        return {
          id: student.id,
          name: student.fullName,
          role: 'STUDENT',
          email: student.email ?? undefined,
        };
      },
    }),
  ],
});

/** Throws unless someone is signed in as staff. Use at the top of every action. */
export async function requireStaff() {
  const session = await auth();
  const user = session?.user;
  if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'CLERK')) {
    throw new Error('You need to sign in to do that.');
  }
  return user;
}

/** Throws unless the signed-in user is the proprietor. */
export async function requireSuperAdmin() {
  const user = await requireStaff();
  if (user.role !== 'SUPER_ADMIN') {
    throw new Error('Only the proprietor can do that.');
  }
  return user;
}

/**
 * The signed-in student, or null. For pages: a layout's redirect does not win a
 * race against its own page, which renders in parallel, so a page that throws
 * shows an error screen to someone who simply is not signed in. Pages ask for
 * this and redirect; actions use requireStudent and throw.
 */
export async function currentStudent() {
  const session = await auth();
  const user = session?.user;
  if (!user || user.role !== 'STUDENT') return null;
  const student = await prisma.student.findUnique({ where: { id: user.id } });
  if (!student || !['ACTIVE', 'NOTICE_GIVEN'].includes(student.status)) return null;
  return student;
}

/**
 * Throws unless a student is signed in, and returns their own record.
 *
 * Every portal action reads the student id from the session and never from the
 * form — a student must not be able to act on somebody else's account by
 * editing a hidden field.
 */
export async function requireStudent() {
  const session = await auth();
  const user = session?.user;
  if (!user || user.role !== 'STUDENT') {
    throw new Error('You need to sign in to do that.');
  }
  const student = await prisma.student.findUnique({ where: { id: user.id } });
  if (!student || !['ACTIVE', 'NOTICE_GIVEN'].includes(student.status)) {
    throw new Error('That account is no longer active.');
  }
  return student;
}
