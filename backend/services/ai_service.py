import base64
import json
import re
import os
from openai import AsyncOpenAI

client = AsyncOpenAI(
    api_key=os.getenv("DOUBAO_API_KEY") or os.getenv("DASHSCOPE_API_KEY"),
    base_url=(
        "https://ark.cn-beijing.volces.com/api/v3"
        if os.getenv("DOUBAO_API_KEY")
        else "https://dashscope.aliyuncs.com/compatible-mode/v1"
    ),
)

# Model names: doubao vision model for image tasks, text model for essay
_VISION_MODEL = "doubao-1-5-vision-pro-32k-250115" if os.getenv("DOUBAO_API_KEY") else "qwen3.5-flash"
_TEXT_MODEL   = "doubao-1-5-pro-32k-250115"        if os.getenv("DOUBAO_API_KEY") else "qwen3.5-flash"


def _encode_image(image_bytes: bytes) -> str:
    return base64.b64encode(image_bytes).decode("utf-8")


async def analyze_image(image_bytes: bytes, content_type: str) -> list[dict]:
    """
    Send image to Qwen-VL and get back a list of guiding questions with options.
    Returns list of {"question": str, "options": [str, str, str]}
    """
    b64 = _encode_image(image_bytes)

    prompt = """你是一位小学语文老师，正在帮助一年级小朋友进行看图说话练习。

请仔细观察这张图片，生成 4-5 个适合一年级小朋友的引导问题。

要求：
1. 每个问题覆盖不同维度：场景（在哪里）、人物（有谁）、动作（在做什么）、心情（感觉怎样）、时间（什么时候）
2. 每个问题有 3 个选项，用词简单，适合一年级水平（6-7岁）
3. 选项要根据图片内容来生成，确保有 1 个选项最符合图片内容
4. 问题和选项都要简短（不超过15个字）

请严格按照以下 JSON 格式返回，不要有任何额外文字：
[
  {
    "question": "图片里在哪里？",
    "options": ["公园里", "学校里", "家里"]
  },
  {
    "question": "图片里有谁？",
    "options": ["小朋友", "大人", "小动物"]
  }
]"""

    response = await client.chat.completions.create(
        model=_VISION_MODEL,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{content_type};base64,{b64}"},
                    },
                    {
                        "type": "text",
                        "text": prompt,
                    },
                ],
            }
        ],
        max_tokens=1000,
    )

    content = response.choices[0].message.content.strip()

    # Strip markdown code fences if present
    content = re.sub(r"^```(?:json)?\s*", "", content)
    content = re.sub(r"\s*```$", "", content)

    questions = json.loads(content)
    return questions


async def generate_essay(image_bytes: bytes, content_type: str, answers: list[dict]) -> str:
    """
    Generate a short essay (作文) based on the image and the child's answers.
    answers: list of {"question": str, "selected_option": str}
    Returns essay text.
    """
    b64 = _encode_image(image_bytes)

    answers_text = "\n".join(
        [f"- {a['question']} → 小朋友选择了：{a['selected_option']}" for a in answers]
    )

    prompt = f"""你是一位小学语文老师，请根据图片内容和小朋友的回答，帮助小朋友写一篇看图说话作文。

小朋友的回答：
{answers_text}

要求：
1. 作文长度：100-150字，适合一年级水平
2. 语言简单、生动、有趣，富有童趣
3. 结构完整：开头（交代时间地点人物）、中间（描述事件）、结尾（表达感受）
4. 使用小朋友的回答内容，让作文贴近图片
5. 只返回作文正文，不要标题，不要任何解释

请直接输出作文内容："""

    response = await client.chat.completions.create(
        model=_VISION_MODEL,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{content_type};base64,{b64}"},
                    },
                    {
                        "type": "text",
                        "text": prompt,
                    },
                ],
            }
        ],
        max_tokens=500,
    )

    return response.choices[0].message.content.strip()
