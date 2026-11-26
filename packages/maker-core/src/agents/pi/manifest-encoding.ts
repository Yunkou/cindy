/**
 * Pi 用 `readFile(path, "utf-8")` 解码 models.json。写盘必须显式给字节，不能让平台或
 * 系统 ANSI 代码页参与：Windows 代码页 936 下「·」(U+00B7) 的 UTF-8 字节 C2 B7 恰好
 * 是「路」的 GBK 字节，一次按代码页的解码就会把模型显示名改写成「路」(#12928)。
 *
 * 编码成 UTF-8 字节，并确认字节能原样解回原文：文本含孤立代理项时会被替换成 U+FFFD，
 * 那就抛错——宁可这次会话写失败，也不落一个被改写过的清单。
 */
export function encodeManifestUtf8(content: string, label: string): Buffer {
  const bytes = Buffer.from(content, 'utf8');
  if (bytes.toString('utf8') !== content) {
    throw new Error(`[PI_MANIFEST_NOT_UTF8] ${label} contains text that UTF-8 cannot represent byte-for-byte`);
  }
  return bytes;
}
