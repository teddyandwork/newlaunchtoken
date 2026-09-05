import { Router, type IRouter } from "express";
import healthRouter from "./health";
import radarRouter from "./radar";
import settingsRouter from "./settings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(radarRouter);
router.use(settingsRouter);

export default router;
