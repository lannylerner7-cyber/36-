import { Router, type IRouter } from "express";
import documentsRouter from "./documents";
import imagesRouter from "./images";
import healthRouter from "./health";
import integrationsRouter from "./integrations";
import authRouter from "./auth";
import payeesRouter from "./payees";
import commerceRouter from "./commerce";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(integrationsRouter);
router.use(authRouter);
router.use(payeesRouter);
router.use(commerceRouter);
router.use(adminRouter);
router.use(documentsRouter);
router.use(imagesRouter);

export default router;
