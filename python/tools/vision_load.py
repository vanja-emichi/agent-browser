import base64
import hashlib
import asyncio

from python.helpers.print_style import PrintStyle
from python.helpers.tool import Tool, Response
from python.helpers import runtime, files, images
from mimetypes import guess_type
import models
from langchain_core.messages import HumanMessage, SystemMessage

# Image optimization
MAX_PIXELS = 768_000
QUALITY = 75
MAX_IMAGES = 5  # max images per single vision_load call
MAX_DESCRIPTION_TOKENS = 500  # max tokens for vision model response per image
VISION_TIMEOUT = 30.0  # seconds

DESCRIBE_SYSTEM_PROMPT = (
    "You describe images concisely and accurately in 3-8 sentences. "
    "Focus on: visible text and labels, layout structure, UI elements and their states, "
    "colors and visual hierarchy, data in charts/tables/graphs, and any errors or warnings. "
    "Be specific and factual about what you see."
)

DESCRIBE_USER_PROMPT = (
    "Describe this image. Include:\n"
    "- Any visible text, headings, or labels\n"
    "- Layout and structural organization\n"
    "- UI states (active/disabled buttons, form fields, error indicators)\n"
    "- Notable colors or visual emphasis\n"
    "- Data shown in charts, tables, or graphs\n"
    "- Any errors, warnings, overlays, or popups\n\n"
    "Be specific and factual:"
)


class VisionLoad(Tool):
    async def execute(self, paths: list[str] = [], **kwargs) -> Response:

        self.descriptions = {}  # path -> description text
        self.errors = {}  # path -> error message
        seen_hashes = set()
        loaded_count = 0

        # Find a vision-capable model
        vision_model_config = self._get_vision_model_config()
        if not vision_model_config:
            msg = (
                "No vision-capable model configured (neither chat_model nor "
                "browser_model has vision=True). Cannot describe images."
            )
            PrintStyle(font_color="#E74C3C", bold=True).print(msg)
            self.agent.context.log.log(
                type="warning", content=msg
            )
            self.errors["_config"] = msg
            return Response(message=msg, break_loop=False)

        # Build the vision model instance
        try:
            vision_model = models.get_chat_model(
                provider=vision_model_config.provider,
                name=vision_model_config.name,
                model_config=vision_model_config,
                **vision_model_config.build_kwargs(),
            )
        except Exception as e:
            msg = f"Failed to initialize vision model: {e}"
            PrintStyle(font_color="#E74C3C").print(msg)
            self.agent.context.log.log(type="warning", content=msg)
            self.errors["_init"] = msg
            return Response(message=msg, break_loop=False)

        for path in paths:
            # Enforce max images limit
            if loaded_count >= MAX_IMAGES:
                self.errors[path] = f"Skipped: max images limit ({MAX_IMAGES}) reached"
                PrintStyle(font_color="#E74C3C").print(
                    f"Max images limit ({MAX_IMAGES}) reached, skipping: {path}"
                )
                self.agent.context.log.log(
                    type="warning",
                    content=f"Max images limit ({MAX_IMAGES}) reached, skipping: {path}",
                )
                continue

            # Check file exists
            if not await runtime.call_development_function(files.exists, str(path)):
                self.errors[path] = "File not found"
                continue

            # Skip already processed
            if path in self.descriptions:
                continue

            # Check mime type
            mime_type, _ = guess_type(str(path))
            if not mime_type or not mime_type.startswith("image/"):
                self.errors[path] = f"Not an image file (mime: {mime_type})"
                continue

            try:
                # Read binary file
                file_content = await runtime.call_development_function(
                    files.read_file_base64, str(path)
                )
                file_content = base64.b64decode(file_content)

                # MD5 deduplication
                content_hash = hashlib.md5(file_content).hexdigest()
                if content_hash in seen_hashes:
                    PrintStyle(font_color="#F39C12").print(
                        f"Skipping duplicate image: {path} (hash: {content_hash[:8]})"
                    )
                    self.agent.context.log.log(
                        type="info",
                        content=f"Skipping duplicate image: {path} (hash: {content_hash[:8]})",
                    )
                    continue
                seen_hashes.add(content_hash)

                # Compress and convert to JPEG
                compressed = images.compress_image(
                    file_content, max_pixels=MAX_PIXELS, quality=QUALITY
                )
                image_b64 = base64.b64encode(compressed).decode("utf-8")
                compressed_kb = len(compressed) // 1024

                # Describe via vision model (NOT embedding base64 in history)
                description = await self._describe_image(
                    vision_model, image_b64, path
                )

                if description:
                    self.descriptions[path] = description
                    loaded_count += 1
                    PrintStyle(font_color="#27AE60").print(
                        f"Described: {path} ({compressed_kb}KB compressed)"
                    )
                    preview = (
                        description[:200] + "..."
                        if len(description) > 200
                        else description
                    )
                    PrintStyle(font_color="#85C1E9").print(f"   {preview}")
                else:
                    self.errors[path] = "Vision model returned empty description"
                    PrintStyle(font_color="#F39C12").print(
                        f"Empty description for: {path}"
                    )

            except Exception as e:
                self.errors[path] = str(e)
                PrintStyle().error(f"Error processing image {path}: {e}")
                self.agent.context.log.log(
                    type="warning",
                    content=f"Error processing image {path}: {e}",
                )

        return Response(message="dummy", break_loop=False)

    async def after_execution(self, response: Response, **kwargs):
        # Build text result with all descriptions - NO base64, only text
        parts = []

        for path, desc in self.descriptions.items():
            parts.append(f"## Image: {path}\n{desc}")

        for path, err in self.errors.items():
            if not path.startswith("_"):  # skip internal error keys
                parts.append(f"## Error ({path}): {err}")

        if parts:
            result_text = "\n\n".join(parts)
        else:
            result_text = "No images processed"

        # Add as plain text tool result - images described, not embedded
        self.agent.hist_add_tool_result(self.name, result_text)

        # Print and log summary
        desc_count = len(self.descriptions)
        err_count = len(
            {k: v for k, v in self.errors.items() if not k.startswith("_")}
        )

        if desc_count == 0 and err_count == 0:
            message = "No images processed"
        else:
            summary_parts = []
            if desc_count:
                summary_parts.append(f"{desc_count} image(s) described")
            if err_count:
                summary_parts.append(f"{err_count} error(s)")
            message = ", ".join(summary_parts)

        PrintStyle(
            font_color="#1B4F72", background_color="white", padding=True, bold=True
        ).print(f"{self.agent.agent_name}: Response from tool '{self.name}'")
        PrintStyle(font_color="#85C1E9").print(message)
        self.log.update(content=message)

    def _get_vision_model_config(self):
        """Find a vision-capable model config.

        Prefers chat_model (main model), falls back to browser_model.
        """
        chat_model = getattr(self.agent.config, "chat_model", None)
        if chat_model and getattr(chat_model, "vision", False):
            return chat_model

        browser_model = getattr(self.agent.config, "browser_model", None)
        if browser_model and getattr(browser_model, "vision", False):
            return browser_model

        return None

    async def _describe_image(self, model, image_b64: str, path: str) -> str:
        """Send image to vision model and get text description.

        Returns description text or empty string on failure.
        """
        try:
            vision_messages = [
                SystemMessage(content=DESCRIBE_SYSTEM_PROMPT),
                HumanMessage(
                    content=[
                        {
                            "type": "text",
                            "text": f"Image: {path}\n\n{DESCRIBE_USER_PROMPT}",
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_b64}"
                            },
                        },
                    ]
                ),
            ]

            description, _reasoning = await asyncio.wait_for(
                model.unified_call(
                    messages=vision_messages,
                    rate_limiter_callback=self.agent.rate_limiter_callback,
                    max_tokens=MAX_DESCRIPTION_TOKENS,
                ),
                timeout=VISION_TIMEOUT,
            )

            return description.strip() if description else ""

        except asyncio.TimeoutError:
            msg = f"Vision model timed out ({VISION_TIMEOUT}s) for: {path}"
            PrintStyle(font_color="#E74C3C").print(msg)
            self.agent.context.log.log(type="warning", content=msg)
            return ""
        except Exception as e:
            msg = f"Vision model error for {path}: {e}"
            PrintStyle(font_color="#E74C3C").print(msg)
            self.agent.context.log.log(type="warning", content=msg)
            return ""
