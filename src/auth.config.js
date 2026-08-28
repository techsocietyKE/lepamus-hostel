/**
 * Edge-safe half of the auth setup. No Prisma, no bcrypt — middleware runs on
 * the edge runtime and cannot load either. The credentials provider lives in
 * src/auth.js, which only runs in Node.
 */
export const authConfig = {
  trustHost: true,
  session: { strategy: 'jwt', maxAge: 60 * 60 * 12 },
  pages: { signIn: '/login' },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const user = auth?.user;
      if (pathname.startsWith('/admin')) {
        return Boolean(user && (user.role === 'SUPER_ADMIN' || user.role === 'CLERK'));
      }
      if (pathname.startsWith('/portal')) {
        return Boolean(user && user.role === 'STUDENT');
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.name = user.name;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.name = token.name;
      }
      return session;
    },
  },
};
