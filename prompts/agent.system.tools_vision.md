## "Multimodal (Vision) Agent Tools" available:

### vision_load:
analyze images using vision model and get text descriptions
use paths arg for image files to analyze
multiple images supported (max 5 per call)
images are described by vision model - descriptions added to context as text
no base64 data enters the chat history preventing context overflow
only bitmaps supported convert first if needed

**Example usage**:
```json
{
    "thoughts": [
        "I need to see what's in this image...",
    ],
    "headline": "Analyzing image with vision model",
    "tool_name": "vision_load",
    "tool_args": {
        "paths": ["/path/to/image.png"],
    }
}
```
