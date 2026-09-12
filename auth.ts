import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Google,
    Credentials({
      credentials: {
        email: { type: "email" },
        password: { type: "password" },
      },
      authorize: async (credentials) => {
        const email = (credentials.email as string)?.trim().toLowerCase()
        const password = credentials.password as string

        if (!email || !password) return null

        const user = await prisma.user.findUnique({
          where: { email },
        })

        if (!user?.password) return null

        const valid = await bcrypt.compare(password, user.password)
        if (!valid) return null

        return { id: user.id, email: user.email, name: user.name }
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      // First sign-in: resolve the local user by email, creating one for
      // Google logins that have no account yet (password stays null).
      if (user?.email) {
        const email = user.email.trim().toLowerCase()
        let dbUser = await prisma.user.findUnique({ where: { email } })
        if (!dbUser) {
          dbUser = await prisma.user.create({
            data: { email, name: user.name ?? null },
          })
        }
        token.id = dbUser.id
      }
      return token
    },
    session: ({ session, token }) => {
      if (token.id && session.user) {
        session.user.id = token.id as string
      }
      return session
    },
  },
})
