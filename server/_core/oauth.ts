import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db/db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { ENV } from "./env";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      // Auto-cadastro: se for o dono do projeto e ainda não tiver usuário local, cria como Master
      if (userInfo.openId === ENV.ownerOpenId && userInfo.email) {
        try {
          const existing = await db.getLocalUserByEmail(userInfo.email.toLowerCase());
          if (!existing) {
            // Cria usuário Master com senha temporária aleatória
            const tempPassword = Math.random().toString(36).slice(-10);
            const passwordHash = await bcrypt.hash(tempPassword, 10);
            await db.createLocalUser({
              name: userInfo.name || "Master",
              email: userInfo.email.toLowerCase(),
              passwordHash,
              role: "master",
              active: "sim",
            });
            console.log(`[OAuth] Master user auto-created for owner: ${userInfo.email}`);
          }
          // Cria local_session para o usuário master
          const localUser = await db.getLocalUserByEmail(userInfo.email.toLowerCase());
          if (localUser) {
            const localToken = jwt.sign(
              { localUserId: localUser.id, role: localUser.role, name: localUser.name, email: localUser.email },
              process.env.JWT_SECRET ?? "secret",
              { expiresIn: "365d" }
            );
            res.cookie("local_session", localToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
          }
        } catch (err) {
          console.error("[OAuth] Failed to auto-create master user:", err);
        }
      }

      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
