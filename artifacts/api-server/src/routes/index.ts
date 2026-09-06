import { Router, type IRouter } from "express";
import documentsRouter from "./documents";
import imagesRouter from "./images";
import healthRouter from "./health";
import integrationsRouter from "./integrations";

const router: IRouter = Router();

router.use(healthRouter);
router.use(integrationsRouter);
router.use(documentsRouter);
router.use(imagesRouter);

export default router;
