import asyncio
import argparse
import base64
import json
import time
from io import BytesIO

import numpy as np
import cv2
import websockets

async def frame_generator_from_image(path: str, w=640, h=480):
    """Load a static image and keep returning frames (resized)."""
    img = cv2.imread(path)
    if img is None:
        raise FileNotFoundError(f"Image not found: {path}")
    while True:
        resized = cv2.resize(img, (w, h))
        yield resized

async def synthetic_frame_generator(w=640, h=480):
    """Generate synthetic frames (moving rectangle) so we don't require an input image."""
    t = 0
    while True:
        canvas = np.zeros((h, w, 3), dtype=np.uint8) + 40  # slightly gray background
        # moving rectangle
        x = int((w - 100) * (0.5 + 0.5 * np.sin(t * 0.2)))
        y = int((h - 80) * (0.5 + 0.5 * np.cos(t * 0.15)))
        cv2.rectangle(canvas, (x, y), (x + 100, y + 60), (10 + int(245 * (0.5 + 0.5*np.sin(t*0.1))),
                                                            10 + int(245 * (0.5 + 0.5*np.cos(t*0.07))),
                                                            200), -1)
        # add timestamp
        cv2.putText(canvas, f"t={t}", (10, h - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (220,220,220), 1)
        t += 1
        yield canvas

def image_to_data_url(img_bgr, quality=70):
    """Convert OpenCV BGR image to data URL (JPEG base64)."""
    ret, buf = cv2.imencode('.jpg', img_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    if not ret:
        raise RuntimeError("Failed to encode image to JPEG")
    b64 = base64.b64encode(buf.tobytes()).decode("ascii")
    return f"data:image/jpeg;base64,{b64}"

async def send_frames(uri: str, fps: float = 2.0, image_path: str = None):
    interval = 1.0 / max(0.1, fps)
    print(f"[test_client] connecting to {uri} at {fps} FPS (interval {interval:.3f}s)")
    async with websockets.connect(uri, ping_interval=10, max_size=None) as ws:
        print("[test_client] connected, waiting for server messages...")
        # Start a background task to receive messages
        async def receiver():
            try:
                async for msg in ws:
                    try:
                        data = json.loads(msg)
                        print(f"[server -> client] {json.dumps(data)}")
                    except Exception:
                        print(f"[server -> client] RAW: {msg}")
            except Exception as e:
                print("[receiver] disconnected:", e)

        recv_task = asyncio.create_task(receiver())

        # choose frame source
        if image_path:
            gen = frame_generator_from_image(image_path)
        else:
            gen = synthetic_frame_generator()

        frame_iter = gen.__aiter__() if hasattr(gen, "__aiter__") else gen  # generator may be sync-like
        try:
            while True:
                # get next frame
                if hasattr(frame_iter, "__anext__"):
                    frame = await frame_iter.__anext__()
                else:
                    frame = await gen.__anext__()  # fallback

                # convert to data URL
                data_url = image_to_data_url(frame, quality=50)
                payload = {"type": "frame", "frame": data_url}
                try:
                    await ws.send(json.dumps(payload))
                except Exception as e:
                    print("[test_client] send error:", e)
                    break

                await asyncio.sleep(interval)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            print("[test_client] main loop exception:", e)
        finally:
            recv_task.cancel()
            try:
                await ws.close()
            except Exception:
                pass
            print("[test_client] done")


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--host", default="localhost")
    p.add_argument("--port", default=8000, type=int)
    p.add_argument("--meeting", default="a5281125-44")
    p.add_argument("--client", default="3")
    p.add_argument("--fps", default=2.0, type=float)
    p.add_argument("--image", default=None, help="Optional image path to send instead of synthetic video")
    return p.parse_args()

if __name__ == "__main__":
    args = parse_args()
    uri = f"ws://{args.host}:{args.port}/ws/verify/{args.meeting}/{args.client}"
    try:
        asyncio.run(send_frames(uri, fps=args.fps, image_path=args.image))
    except KeyboardInterrupt:
        print("Interrupted by user")
