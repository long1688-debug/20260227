/**
 * 统一物体检测接口。推理在 Rust 端（ONNX Runtime）执行，前端不感知具体模型。
 *
 * detect(imageData | Blob | ArrayBuffer, { threshold }) -> [{ label, class_id, score, box: { x, y, width, height } }]
 * box 为原图像素坐标。
 */
import { invoke } from '@tauri-apps/api/core'

export async function getDetectorStatus() {
  return invoke('get_detector_status')
}

export async function detect(image, { threshold = 0.5 } = {}) {
  const headers = { 'x-threshold': String(threshold) }
  let body
  if (typeof ImageData !== 'undefined' && image instanceof ImageData) {
    body = new Uint8Array(image.data.buffer, image.data.byteOffset, image.data.byteLength)
    headers['x-width'] = String(image.width)
    headers['x-height'] = String(image.height)
  } else if (image instanceof Blob) {
    body = new Uint8Array(await image.arrayBuffer())
  } else {
    body = new Uint8Array(image)
  }
  return invoke('detect_objects', body, { headers })
}
