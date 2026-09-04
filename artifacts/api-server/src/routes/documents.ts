import { Router, type IRouter } from "express";
import {
  RenderSamplePdfBody,
  RenderSamplePdfResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/documents/pdf", (req, res): void => {
  const parsed = RenderSamplePdfBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  res.status(202).json(
    RenderSamplePdfResponse.parse({
      status: "not_configured",
      message:
        "Sample PDF export is reserved for the configured server renderer. Browser print is available now.",
    }),
  );
});

export default router;