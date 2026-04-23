import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { isAdminUserId } from "../middlewares/requireAdmin";

const router: IRouter = Router();

router.get("/me", (req, res): void => {
  const auth = getAuth(req);
  const userId = auth?.userId ?? null;
  res.json({
    userId,
    isAdmin: isAdminUserId(userId),
  });
});

export default router;
