import { Router, type IRouter } from "express";
import documentsRouter from "./documents";
import healthRouter from "./health";
import integrationsRouter from "./integrations";

const router: IRouter = Router();

router.use(healthRouter);
router.use(integrationsRouter);
router.use(documentsRouter);

export default router;
