import { Router, type IRouter } from "express";
import {
  RemoveBackgroundBody,
  RemoveBackgroundResponse,
} from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const REMOVE_BG_ENDPOINT = "https://api.remove.bg/v1.0/removebg";

router.post("/images/remove-background", async (req, res): Promise<void> => {
  const parsed = RemoveBackgroundBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const apiKey = process.env["REMOVE_BG_API_KEY"];
  if (!apiKey) {
    res.status(503).json({
      error: "Background removal is not configured. Add REMOVE_BG_API_KEY to the server environment.",
    });
    return;
  }

  const match = parsed.data.imageDataUrl.match(
    /^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i,
  );
  if (!match) {
    res.status(400).json({
      error: "Upload a PNG, JPEG, JPG, or WebP image encoded as a data URL.",
    });
    return;
  }

  const [, mimeType, base64Data] = match;
  const imageBytes = Buffer.from(base64Data, "base64");
  const formData = new FormData();
  formData.append(
    "image_file",
    new Blob([imageBytes], { type: mimeType }),
    "bank-logo",
  );
  formData.append("size", "auto");

  try {
    const response = await fetch(REMOVE_BG_ENDPOINT, {
      method: "POST",
      headers: { "X-Api-Key": apiKey },
      body: formData,
    });

    if (!response.ok) {
      logger.warn(
        { statusCode: response.status },
        "remove.bg rejected the background-removal request",
      );
      res.status(502).json({
        error: "The background-removal provider could not process this logo.",
      });
      return;
    }

    const contentType = response.headers.get("content-type") || "image/png";
    const output = Buffer.from(await response.arrayBuffer()).toString("base64");
    res.json(
      RemoveBackgroundResponse.parse({
        imageDataUrl: `data:${contentType};base64,${output}`,
      }),
    );
  } catch (error) {
    logger.error({ err: error }, "remove.bg request failed");
    res.status(502).json({
      error: "The background-removal provider is currently unavailable.",
    });
  }
});

export default router;